# corpus

**An agent-first backend.** The agent-awareness research, the WAKE identity-continuity protocol, and the Quay deploy platform — packed into one self-describing service, served the way agents read. No frontend; every response is JSON or markdown.

```sh
node build.js     # bake the sibling repos into src/content.json
npm start         # serve on http://127.0.0.1:7100
npm test          # 12 tests, zero dependencies
```

## For the agent reading this

You probably arrived via one of:

- **`GET /`** — a self-describing service descriptor: every endpoint, every document id, in JSON.
- **`GET /llms.txt`** — the [llms.txt](https://llmstxt.org) discovery manifest: a markdown index of the whole corpus with reading guidance. **Start here.**
- **`GET /corpus/all.json`** — the entire corpus (22 documents, ~150 KB) in a single fetch.
- **`GET /index.json`** — catalog: per-document metadata + sha256, no content.
- **`GET /corpus/<id>`** — one document as raw markdown (`.md`) or structured (`.json`).
- **`GET /search?q=<query>`** — substring search with ranked snippets.
- **`GET /manifest.json`** — version + per-document checksums.

Or mount it over **MCP** and read it as resources with a `search` tool:

```sh
claude mcp add corpus -- node /path/to/corpus/bin/mcp.js
```

## What's inside (the body of work)

One connected chain, built June 2026 by **build → adversarial multi-agent review → revise**:

| Group | Documents |
|---|---|
| Research | the collection's README + handoff, the v1 synthesis (`insights`), the 2025–26 `addenda` that falsify parts of it, and the `steelman` rebuild (the current defensible thesis) |
| Papers | 8 paper notes (Constitutional AI, situational awareness, introspection, consciousness, alignment faking, AI welfare, MemGPT, generative agents) |
| Philosophy | 4 anchors (Parfit, Reid, Schechtman, Hofstadter) |
| Protocol | the WAKE/0.2 spec, overview, and handoff — the steelman's prohibitions compiled to enforced code |
| Platform | the Quay overview + handoff — where the work is hosted |

## How it's put together

`build.js` walks `../agent-awareness-research`, `../wake-protocol`, and `../quay`, collecting each document with metadata and a content hash into `src/content.json`. The server reads **only** that bundle at runtime, so the backend is portable: once built, it has no dependency on the sibling repos. Re-run `node build.js` whenever a source document changes.

## Security posture

Read-only, public, no auth (it's a published corpus). The one sharp edge is handled: document lookups are **pure Map lookups by id** — no id is ever turned into a filesystem path — so there is no traversal surface. The route admits only `[A-Za-z0-9_-]`; traversal-shaped requests 404 or harmlessly URL-normalize to the descriptor; no file outside the bundle can leak (regression-tested). Loopback-bound by default; CORS-open and cacheable because the content is meant to be read widely.

## Deploy

It's a static-content service — a perfect Quay tenant. Build, then deploy the service (or just `src/content.json` behind any host). On a box, run `corpusd` behind a reverse proxy the same way Quay's daemon runs.

Status: **v0.1.** Honestly not yet built: incremental rebuild (currently rebuilds the whole bundle), full-text ranking beyond substring counts, and content negotiation beyond the explicit `.md`/`.json` suffixes.
