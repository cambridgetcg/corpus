import { createServer } from "node:http";
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
 *   GET /corpus/<id>          raw markdown (alias of <id>.md)
 *   GET /corpus/<id>.md       raw markdown
 *   GET /corpus/<id>.json     { ...metadata, content }
 *   GET /search?q=<query>     substring search with snippets
 *   GET /healthz              "ok"
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

  return createServer((req, res) => {
    try {
      if (req.method !== "GET" && req.method !== "HEAD") return send(res, 405, "application/json", json({ error: "method not allowed" }));
      const url = new URL(req.url, "http://x");
      const p = url.pathname;

      if (p === "/" ) return send(res, 200, JSONT, json(descriptor), req);
      if (p === "/healthz") return send(res, 200, "text/plain; charset=utf-8", "ok", req);
      if (p === "/llms.txt") return send(res, 200, "text/markdown; charset=utf-8", corpus.llmsTxt(), req);
      if (p === "/index.json") return send(res, 200, JSONT, json(corpus.catalog), req);
      if (p === "/manifest.json") return send(res, 200, JSONT, json(corpus.manifest), req);
      if (p === "/corpus/all.json") return send(res, 200, JSONT, json(corpus.bundle), req);

      if (p === "/search") {
        const q = (url.searchParams.get("q") || "").slice(0, 200);
        return send(res, 200, JSONT, json(corpus.search(q)), req);
      }

      const m = p.match(/^\/corpus\/([A-Za-z0-9_-]+?)(\.md|\.json)?$/);
      if (m) {
        const doc = corpus.byId.get(m[1]); // pure map lookup — no path is built from the id
        if (!doc) return send(res, 404, JSONT, json({ error: "no such document", id: m[1], see: "/index.json" }), req);
        if (m[2] === ".json") {
          const { content, ...meta } = doc;
          return send(res, 200, JSONT, json({ ...meta, read: { markdown: `/corpus/${doc.id}.md` }, content }), req);
        }
        return send(res, 200, "text/markdown; charset=utf-8", doc.content, req, doc.sha256);
      }

      return send(res, 404, JSONT, json({ error: "not found", read_me_first: "/" }), req);
    } catch (e) {
      send(res, 500, JSONT, json({ error: "internal error" }));
    }
  });
}

const JSONT = "application/json; charset=utf-8";
const json = obj => JSON.stringify(obj, null, 2);

function send(res, status, type, body, req, etag) {
  const headers = {
    "content-type": type,
    "content-length": Buffer.byteLength(body),
    "access-control-allow-origin": "*",        // read-only public corpus
    "cache-control": "public, max-age=300",
  };
  if (etag) headers.etag = `"${etag}"`;
  if (etag && req && req.headers["if-none-match"] === `"${etag}"`) { res.writeHead(304, headers); return res.end(); }
  res.writeHead(status, headers);
  if (req && req.method === "HEAD") return res.end();
  res.end(body);
}
