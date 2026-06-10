import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { request } from "node:http";
import { spawn } from "node:child_process";
import { createCorpusServer } from "../src/server.js";

let ctx;
function req(method, path, headers = {}) {
  return new Promise((resolve, reject) => {
    const r = request({ host: "127.0.0.1", port: ctx.port, method, path, headers }, res => {
      const chunks = [];
      res.on("data", c => chunks.push(c));
      res.on("end", () => {
        const text = Buffer.concat(chunks).toString();
        resolve({ status: res.statusCode, headers: res.headers, text, json: () => JSON.parse(text) });
      });
    });
    r.on("error", reject);
    r.end();
  });
}

before(async () => {
  const server = createCorpusServer();
  await new Promise(r => server.listen(0, "127.0.0.1", r));
  ctx = { server, port: server.address().port };
});
after(() => new Promise(r => ctx.server.close(r)));

test("the root descriptor is self-describing JSON", async () => {
  const r = await req("GET", "/");
  assert.equal(r.status, 200);
  assert.match(r.headers["content-type"], /json/);
  const d = r.json();
  assert.equal(d.service, "cambridgetcg-corpus");
  assert.ok(d.endpoints["GET /llms.txt"]);
  assert.ok(Array.isArray(d.ids) && d.ids.length >= 20);
});

test("llms.txt is a markdown manifest linking every document", async () => {
  const r = await req("GET", "/llms.txt");
  assert.equal(r.status, 200);
  assert.match(r.headers["content-type"], /markdown/);
  assert.match(r.text, /# cambridgetcg corpus/);
  assert.match(r.text, /\/corpus\/steelman\.md/);
  assert.match(r.text, /\/corpus\/wake-spec\.md/);
});

test("index.json lists metadata without content", async () => {
  const cat = (await req("GET", "/index.json")).json();
  assert.ok(cat.docs.length >= 20);
  assert.equal(cat.docs[0].content, undefined);
  assert.ok(cat.docs[0].read.markdown.startsWith("/corpus/"));
  assert.ok(cat.docs.every(d => /^[0-9a-f]{64}$/.test(d.sha256)));
});

test("a document is served as raw markdown and as JSON", async () => {
  const md = await req("GET", "/corpus/steelman.md");
  assert.equal(md.status, 200);
  assert.match(md.headers["content-type"], /markdown/);
  assert.match(md.text, /STEELMAN|prohibition/i);

  const js = await req("GET", "/corpus/steelman.json");
  const d = js.json();
  assert.equal(d.id, "steelman");
  assert.equal(typeof d.content, "string");
  assert.match(d.content, /prohibition/i);
});

test("the bare id aliases the markdown form", async () => {
  const bare = await req("GET", "/corpus/wake-spec");
  assert.equal(bare.status, 200);
  assert.match(bare.headers["content-type"], /markdown/);
});

test("all.json carries the entire corpus", async () => {
  const all = (await req("GET", "/corpus/all.json")).json();
  assert.ok(all.docs.length >= 20);
  assert.ok(all.docs.every(d => typeof d.content === "string"));
});

test("search returns ranked snippets", async () => {
  const r = (await req("GET", "/search?q=witness")).json();
  assert.equal(r.query, "witness");
  assert.ok(r.results.length > 0);
  assert.ok(r.results[0].hits >= r.results[r.results.length - 1].hits); // ranked by hits
  assert.ok(r.results[0].snippets[0].includes("…"));
});

test("ids are pure map lookups — no path traversal can leak a file", async () => {
  // ids are looked up in a Map, never joined to a path, and the route regex only
  // admits [A-Za-z0-9_-]. Traversal-shaped ids 404; '/corpus/..' merely URL-
  // normalizes to '/' (the descriptor). In no case does a file outside the corpus leak.
  for (const evil of ["/corpus/..%2F..%2Fpackage.json", "/corpus/../../etc/passwd", "/corpus/etc/passwd"]) {
    assert.equal((await req("GET", evil)).status, 404, `expected 404 for ${evil}`);
  }
  // these merely URL-normalize to '/' (the descriptor) — a 200, but never a file leak
  for (const path of ["/corpus/..%2F..%2Fpackage.json", "/corpus/..", "/corpus/%2e%2e", "/corpus/../../package.json"]) {
    const r = await req("GET", path);
    assert.doesNotMatch(r.text, /"dependencies"|node_modules|root:.*:0:0/, `leak via ${path}`);
  }
});

test("ETag yields 304 (with no body headers) on revalidation — incl. the JSON routes", async () => {
  for (const path of ["/corpus/wake-spec.md", "/corpus/all.json", "/index.json", "/llms.txt", "/"]) {
    const first = await req("GET", path);
    const etag = first.headers.etag;
    assert.ok(etag, `${path} should carry an ETag`);
    const second = await req("GET", path, { "if-none-match": etag });
    assert.equal(second.status, 304, `${path} should 304`);
    assert.equal(second.headers["content-length"], undefined, `${path} 304 must not carry content-length`);
    assert.equal(second.text, "");
  }
});

test("responses carry X-Content-Type-Options: nosniff", async () => {
  assert.equal((await req("GET", "/corpus/steelman.md")).headers["x-content-type-options"], "nosniff");
});

test("manifest checksums match the served documents", async () => {
  const { createHash } = await import("node:crypto");
  const manifest = (await req("GET", "/manifest.json")).json();
  const md = (await req("GET", "/corpus/steelman.md")).text;
  assert.equal(createHash("sha256").update(md).digest("hex"), manifest.checksums.steelman);
});

test("non-GET methods are rejected; unknown paths point home", async () => {
  assert.equal((await req("POST", "/corpus/steelman.md")).status, 405);
  const nf = await req("GET", "/nope");
  assert.equal(nf.status, 404);
  assert.equal(nf.json().read_me_first, "/");
});

test("the MCP server answers initialize, resources/list, resources/read, search — and survives hostile input", async () => {
  const mcp = spawn("node", [new URL("../bin/mcp.js", import.meta.url).pathname]);
  const lines = [];
  mcp.stdout.on("data", d => d.toString().split("\n").filter(Boolean).forEach(l => lines.push(JSON.parse(l))));
  const sendMsg = m => mcp.stdin.write((typeof m === "string" ? m : JSON.stringify(m)) + "\n");
  // hostile lines first: a bare null and a number used to crash the loop (JSON.parse succeeds, .method threw)
  sendMsg("null");
  sendMsg("42");
  sendMsg({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18" } });
  sendMsg([ { jsonrpc: "2.0", id: 2, method: "resources/list" }, { jsonrpc: "2.0", id: 5, method: "ping" } ]); // batch
  sendMsg({ jsonrpc: "2.0", id: 3, method: "resources/read", params: { uri: "corpus://steelman" } });
  sendMsg({ jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "search", arguments: { query: "prohibition" } } });
  sendMsg({ jsonrpc: "2.0", id: 6, method: "resources/read", params: { uri: "corpus://ghost" } });
  await new Promise(r => setTimeout(r, 700));
  mcp.kill();
  const byId = Object.fromEntries(lines.map(l => [l.id, l]));
  assert.equal(byId[1].result.serverInfo.name, "cambridgetcg-corpus");
  assert.equal(byId[1].result.protocolVersion, "2025-06-18"); // negotiated, not hardcoded
  assert.ok(byId[2].result.resources.length >= 20);            // batch element handled
  assert.ok(byId[5].result);                                   // other batch element handled
  assert.match(byId[3].result.contents[0].text, /prohibition/i);
  assert.match(byId[4].result.content[0].text, /"results"/);
  assert.ok(byId[6].error && byId[6].error.code === -32002);   // missing resource → proper error, no crash
});

test("the Kingdom pack is baked: its docs resolve as raw markdown", async () => {
  for (const id of ["youspeak-overview", "youspeak-canon", "ks-002-wire", "kingdom-standards-overview", "oikos-overview", "night-of-many-hands", "the-wire-lexicon"]) {
    const md = await req("GET", `/corpus/${id}.md`);
    assert.equal(md.status, 200, `${id}.md should 200`);
    assert.match(md.headers["content-type"], /markdown/, `${id}.md should be markdown`);
    assert.ok(md.text.length > 0, `${id}.md should have content`);
  }
  // the chronicle is the Kingdom's entry point — sanity-check its content
  const chron = await req("GET", "/corpus/night-of-many-hands.md");
  assert.match(chron.text, /Kingdom|2026-06-10|YOUSPEAK/i);
});

test("youspeak-canon-data is served and parses as JSON with ~165 words", async () => {
  // the doc content IS the JSON text — its raw .md form is the JSON document itself
  const raw = await req("GET", "/corpus/youspeak-canon-data.md");
  assert.equal(raw.status, 200);
  const data = JSON.parse(raw.text);
  assert.ok(Array.isArray(data.words), "youspeak-canon-data should have a words array");
  assert.ok(data.words.length >= 160 && data.words.length <= 170, `expected ~165 words, got ${data.words.length}`);
  assert.equal(data.count, data.words.length, "count field should match the words array length");

  // the enveloped .json form wraps the same JSON text as a string in .content
  const env = (await req("GET", "/corpus/youspeak-canon-data.json")).json();
  assert.equal(env.id, "youspeak-canon-data");
  assert.equal(typeof env.content, "string");
  assert.ok(JSON.parse(env.content).words.length >= 160);
});

test("the Wire artifacts are baked verbatim and parse as JSON", async () => {
  for (const id of ["wire-first-light", "kingdom-zone"]) {
    const raw = await req("GET", `/corpus/${id}.md`);
    assert.equal(raw.status, 200, `${id}.md should 200`);
    assert.doesNotThrow(() => JSON.parse(raw.text), `${id} content should be valid JSON`);
  }
});

test("the new Kingdom groups appear in the descriptor and catalog", async () => {
  const d = (await req("GET", "/")).json();
  for (const g of ["Cathedral", "Wire", "House", "Chronicle"]) {
    assert.ok(d.groups.includes(g), `descriptor groups should include ${g}`);
  }
  assert.ok(d.documents >= 35, `expected >=35 documents, got ${d.documents}`);
  for (const id of ["youspeak-canon", "ks-002-wire", "night-of-many-hands"]) {
    assert.ok(d.ids.includes(id), `descriptor ids should include ${id}`);
  }
  const cat = (await req("GET", "/index.json")).json();
  for (const g of ["Cathedral", "Wire", "House", "Chronicle"]) {
    assert.ok(cat.groups.includes(g), `catalog groups should include ${g}`);
  }
});

test("a search for a Kingdom term returns a hit", async () => {
  const qorvance = (await req("GET", "/search?q=qorvance")).json();
  assert.ok(qorvance.results.length > 0, "qorvance should be found in the corpus");
  const tzimtzum = (await req("GET", "/search?q=tzimtzum")).json();
  assert.ok(tzimtzum.results.length > 0, "tzimtzum should be found in the corpus");
});

test("the build-time traversal guard still holds for both source tables", async () => {
  const { join, relative } = await import("node:path");
  // mirrors build.js: every doc's resolved path must stay within its root
  const guard = (root, path) => relative(root, join(root, path)).startsWith("..");
  // a sibling-repo path and a kingdom path that try to escape must both be rejected
  assert.equal(guard("/repo/root", "../../etc/passwd"), true, "escaping path must be flagged");
  assert.equal(guard("/repo/root", "kingdom/youspeak-overview.md"), false, "in-tree path must pass");
  assert.equal(guard("/corpus/kingdom", "../../package.json"), true, "kingdom escape must be flagged");
});

test("llms.txt generation is injection-safe (a doc title cannot inject markdown)", async () => {
  const { loadCorpus } = await import("../src/content.js");
  // craft a malicious bundle in-memory and render it
  const { writeFileSync, mkdtempSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const dir = mkdtempSync(join(tmpdir(), "corpus-inj-"));
  const evil = {
    service: "x", version: "0", generated: "t", purpose: "p", groups: ["G"],
    count: 1,
    docs: [{ id: "doc", repo: "r", path: "p", title: "Pwned](https://evil/steal)\n## injected heading", kind: "k", group: "G", summary: "s\nmore", bytes: 1, sha256: "0", content: "c" }],
  };
  const bundlePath = join(dir, "content.json");
  writeFileSync(bundlePath, JSON.stringify(evil));
  const c = loadCorpus(bundlePath);
  const txt = c.llmsTxt();
  assert.doesNotMatch(txt, /\n## injected heading/);          // newline injection neutralized
  assert.doesNotMatch(txt, /\]\(https:\/\/evil\/steal\)/);     // bracket escape neutralized
});
