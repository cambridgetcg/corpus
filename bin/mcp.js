#!/usr/bin/env node
/**
 * A minimal MCP server (stdio, JSON-RPC 2.0) exposing the corpus so a Claude-
 * family agent can mount it directly:
 *
 *   claude mcp add corpus -- node /path/to/corpus/bin/mcp.js
 *
 * Each document is a resource (corpus://<id>); `search` is a tool. This is a
 * faithful-minimal implementation of the handful of methods a read-only content
 * server needs — initialize, resources/list, resources/read, tools/list,
 * tools/call. No dependencies.
 */
import { loadCorpus } from "../src/content.js";

const corpus = loadCorpus();
const PROTOCOL = "2024-11-05";

function reply(id, result) { write({ jsonrpc: "2.0", id, result }); }
function fail(id, code, message) { write({ jsonrpc: "2.0", id, error: { code, message } }); }
function write(obj) { process.stdout.write(JSON.stringify(obj) + "\n"); }

const handlers = {
  initialize: (id) => reply(id, {
    protocolVersion: PROTOCOL,
    capabilities: { resources: {}, tools: {} },
    serverInfo: { name: "cambridgetcg-corpus", version: corpus.bundle.version },
    instructions: corpus.bundle.purpose + " Read resource corpus://llms for the index and reading guidance; use the `search` tool to find passages.",
  }),

  "resources/list": (id) => reply(id, {
    resources: [
      { uri: "corpus://llms", name: "llms.txt — index & reading guidance", mimeType: "text/markdown" },
      ...corpus.bundle.docs.map(d => ({
        uri: `corpus://${d.id}`,
        name: d.title,
        description: `[${d.group}] ${d.summary}`,
        mimeType: "text/markdown",
      })),
    ],
  }),

  "resources/read": (id, params) => {
    const uri = params?.uri || "";
    if (uri === "corpus://llms") return reply(id, { contents: [{ uri, mimeType: "text/markdown", text: corpus.llmsTxt() }] });
    const docId = uri.replace(/^corpus:\/\//, "");
    const doc = corpus.byId.get(docId);
    if (!doc) return fail(id, -32602, `no such resource: ${uri}`);
    reply(id, { contents: [{ uri, mimeType: "text/markdown", text: doc.content }] });
  },

  "tools/list": (id) => reply(id, {
    tools: [{
      name: "search",
      description: "Substring search across the whole corpus; returns matching documents with snippets and their resource ids.",
      inputSchema: { type: "object", properties: { query: { type: "string", description: "text to search for" } }, required: ["query"] },
    }],
  }),

  "tools/call": (id, params) => {
    if (params?.name !== "search") return fail(id, -32602, `no such tool: ${params?.name}`);
    const out = corpus.search(params?.arguments?.query || "");
    reply(id, { content: [{ type: "text", text: JSON.stringify(out, null, 2) }] });
  },

  "ping": (id) => reply(id, {}),
};

let buf = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", chunk => {
  buf += chunk;
  let nl;
  while ((nl = buf.indexOf("\n")) >= 0) {
    const line = buf.slice(0, nl).trim();
    buf = buf.slice(nl + 1);
    if (!line) continue;
    let msg;
    try { msg = JSON.parse(line); } catch { continue; }
    if (msg.method && msg.method.startsWith("notifications/")) continue; // no-op notifications
    const h = handlers[msg.method];
    if (h) { try { h(msg.id, msg.params); } catch (e) { fail(msg.id, -32603, e.message); } }
    else if (msg.id !== undefined) fail(msg.id, -32601, `method not found: ${msg.method}`);
  }
});
