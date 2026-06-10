import { createServer } from "node:http";
import { createHash } from "node:crypto";
import { loadCorpus } from "./content.js";

/**
 * The agent-first HTTP API. No HTML, no UI — every response is JSON or markdown,
 * shaped for a program. The root document is self-describing so an arriving agent
 * needs no out-of-band knowledge.
 *
 *   GET /                     service descriptor + endpoint guide (JSON)
 *   GET /llms.txt             the llms.txt discovery manifest (markdown)
 *   GET /index.json           catalog: every doc's metadata (no content)
 *   GET /manifest.json        version + per-doc checksums
 *   GET /corpus/all.json      the entire corpus in one payload
 *   GET /corpus/<id>(.md|.json)  one document, raw markdown or structured
 *   GET /search?q=<query>     substring search with snippets
 *   GET /healthz              "ok"
 *
 * Every static payload is serialized ONCE at startup and served with a stable
 * ETag, so repeated polling re-validates (304) instead of re-stringifying.
 */
export function createCorpusServer({ corpus = loadCorpus() } = {}) {
  const descriptor = {
    service: corpus.bundle.service,
    version: corpus.bundle.version,
    purpose: corpus.bundle.purpose,
    generated: corpus.bundle.generated,
    documents: corpus.bundle.count,
    read_me_first: "GET /llms.txt for the index, /index.json for structured metadata, or /corpus/all.json for everything in one fetch.",
    endpoints: {
      "GET /llms.txt": "discovery manifest (markdown, the llms.txt convention)",
      "GET /index.json": "catalog of all documents (metadata only)",
      "GET /manifest.json": "version + per-document sha256 checksums",
      "GET /corpus/all.json": "the entire corpus in one payload",
      "GET /corpus/<id>(.md|.json)": "one document, raw markdown or structured",
      "GET /search?q=<query>": "substring search with snippets",
    },
    groups: corpus.bundle.groups,
    ids: corpus.bundle.docs.map(d => d.id),
  };

  // pre-serialize the immutable payloads + their ETags (one stringify each, ever)
  const asset = (type, body) => ({ type, body, etag: `"${createHash("sha256").update(body).digest("hex").slice(0, 16)}"` });
  const statics = {
    "/": asset(JSONT, json(descriptor)),
    "/llms.txt": asset("text/markdown; charset=utf-8", corpus.llmsTxt()),
    "/index.json": asset(JSONT, json(corpus.catalog)),
    "/manifest.json": asset(JSONT, json(corpus.manifest)),
    "/corpus/all.json": asset(JSONT, json(corpus.bundle)),
  };
  const docAssets = new Map(); // id → { md, jsonAsset }
  for (const d of corpus.bundle.docs) {
    const { content, ...meta } = d;
    docAssets.set(d.id, {
      md: { type: "text/markdown; charset=utf-8", body: content, etag: `"${d.sha256}"` },
      json: asset(JSONT, json({ ...meta, read: { markdown: `/corpus/${d.id}.md` }, content })),
    });
  }

  return createServer((req, res) => {
    try {
      if (req.method !== "GET" && req.method !== "HEAD") return send(res, req, 405, JSONT, json({ error: "method not allowed" }));
      const url = new URL(req.url, "http://x");
      const p = url.pathname;

      if (p === "/healthz") return send(res, req, 200, "text/plain; charset=utf-8", "ok");
      if (statics[p]) { const a = statics[p]; return send(res, req, 200, a.type, a.body, a.etag); }

      if (p === "/search") {
        const q = (url.searchParams.get("q") || "").slice(0, 200);
        return send(res, req, 200, JSONT, json(corpus.search(q)));
      }

      const m = p.match(/^\/corpus\/([A-Za-z0-9_-]+?)(\.md|\.json)?$/);
      if (m) {
        const da = docAssets.get(m[1]); // pure map lookup — no path is built from the id
        if (!da) return send(res, req, 404, JSONT, json({ error: "no such document", id: m[1], see: "/index.json" }));
        const a = m[2] === ".json" ? da.json : da.md;
        return send(res, req, 200, a.type, a.body, a.etag);
      }

      return send(res, req, 404, JSONT, json({ error: "not found", read_me_first: "/" }));
    } catch {
      send(res, req, 500, JSONT, json({ error: "internal error" }));
    }
  });
}

const JSONT = "application/json; charset=utf-8";
const json = obj => JSON.stringify(obj, null, 2);

function send(res, req, status, type, body, etag) {
  // RFC 7232: a 304 carries no body and none of the body-describing headers.
  if (etag && req.headers["if-none-match"] === etag) {
    res.writeHead(304, { etag, "cache-control": "public, max-age=300", "access-control-allow-origin": "*" });
    return res.end();
  }
  const headers = {
    "content-type": type,
    "content-length": Buffer.byteLength(body),
    "access-control-allow-origin": "*",        // public, read-only, GET-only, no credentials
    "cache-control": "public, max-age=300",
    "x-content-type-options": "nosniff",       // never let a browser sniff a body into text/html
  };
  if (etag) headers.etag = etag;
  res.writeHead(status, headers);
  if (req.method === "HEAD") return res.end();
  res.end(body);
}
