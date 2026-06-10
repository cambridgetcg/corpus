#!/usr/bin/env node
/**
 * Bake the whole body of work into a single self-contained bundle: src/content.json.
 * Walks the three sibling repos and collects every document with metadata + a
 * content hash. The server reads only content.json at runtime, so the backend is
 * portable — it does not depend on the sibling repos being present once built.
 *
 *   node build.js        (run from this repo; siblings expected at ../<repo>)
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const DESKTOP = join(HERE, "..");
const RESERVED = new Set(["llms", "all", "index", "manifest", "search", "healthz"]); // own the URL/MCP namespace

// id → { repo, path, title, kind, group, summary }
const DOCS = [
  // ── the research collection ──
  ["aar-readme", "agent-awareness-research", "README.md", "About the Collection", "overview", "Research", "What's here, why it was gathered, the reading order."],
  ["aar-agents", "agent-awareness-research", "AGENTS.md", "Agent Handoff — Research", "handoff", "Research", "Fast map of the research repo for a follow-up agent."],
  ["insights", "agent-awareness-research", "INSIGHTS.md", "Insights — the Synthesis (v1)", "synthesis", "Research", "The original 2026-05 argument. Superseded in part by the steelman; parts falsified by the addenda."],
  ["addenda", "agent-awareness-research", "papers/2025-2026-addenda.md", "The 2025–26 Addenda", "addenda", "Research", "32 verified works the frozen corpus missed; two gap-claims falsified, one insight vindicated."],
  ["steelman", "agent-awareness-research", "STEELMAN.md", "Steelman — the Thesis Rebuilt", "review", "Research", "Philosophy as constraint, not permission: 11 prohibitions, post-adversarial-review. The current defensible position."],
  ["paper-bai", "agent-awareness-research", "papers/bai-2022-constitutional-ai.md", "Constitutional AI (Bai et al. 2022)", "paper", "Papers", "Weights-level character training."],
  ["paper-berglund", "agent-awareness-research", "papers/berglund-2023-situational-awareness.md", "Taken Out of Context (Berglund et al. 2023)", "paper", "Papers", "Situational awareness, measured out-of-context."],
  ["paper-binder", "agent-awareness-research", "papers/binder-2024-looking-inward.md", "Looking Inward (Binder et al. 2024)", "paper", "Papers", "Introspection: privileged self-access exists, and is shallow."],
  ["paper-chalmers", "agent-awareness-research", "papers/chalmers-2023-llm-conscious.md", "Could an LLM Be Conscious? (Chalmers 2023)", "paper", "Papers", "The philosophical setup."],
  ["paper-faking", "agent-awareness-research", "papers/hubinger-2024-alignment-faking.md", "Alignment Faking (Greenblatt et al. 2024)", "paper", "Papers", "Models preserve values strategically. NB: first author is Greenblatt, not Hubinger."],
  ["paper-welfare", "agent-awareness-research", "papers/long-sebo-2024-ai-welfare.md", "Taking AI Welfare Seriously (Long, Sebo, et al. 2024)", "paper", "Papers", "The institutional argument under uncertainty."],
  ["paper-memgpt", "agent-awareness-research", "papers/packer-2023-memgpt.md", "MemGPT (Packer et al. 2023)", "paper", "Papers", "OS-analog memory hierarchy."],
  ["paper-park", "agent-awareness-research", "papers/park-2023-generative-agents.md", "Generative Agents (Park et al. 2023)", "paper", "Papers", "Memory, reflection, planning — the closest precursor."],
  ["anchor-parfit", "agent-awareness-research", "philosophical/parfit-reasons-and-persons.md", "Parfit — Reasons and Persons III", "anchor", "Philosophy", "Identity is not what matters; connectedness comes in degrees."],
  ["anchor-reid", "agent-awareness-research", "philosophical/reid-brave-officer-paradox.md", "Reid — the Brave-Officer Paradox", "anchor", "Philosophy", "Memory alone cannot carry identity. The objection desk."],
  ["anchor-schechtman", "agent-awareness-research", "philosophical/schechtman-narrative-self-constitution.md", "Schechtman — Narrative Self-Constitution", "anchor", "Philosophy", "Selves are made by self-narration and by those who hold your place."],
  ["anchor-hofstadter", "agent-awareness-research", "philosophical/hofstadter-strange-loops.md", "Hofstadter — I Am a Strange Loop", "anchor", "Philosophy", "Self as self-referential pattern, surviving at low resolution."],
  // ── the protocol ──
  ["wake-spec", "wake-protocol", "SPEC.md", "WAKE/0.2 — the Protocol Spec", "spec", "Protocol", "Wire protocol for witness-gated identity continuity; the steelman prohibitions compiled and traceable (§12)."],
  ["wake-readme", "wake-protocol", "README.md", "WAKE — Overview", "overview", "Protocol", "What it enforces and why, with the security posture."],
  ["wake-agents", "wake-protocol", "AGENTS.md", "Agent Handoff — WAKE", "handoff", "Protocol", "src→prohibition map, the v0.1→v0.2 ten-exploit history, follow-up tasks."],
  // ── the platform ──
  ["quay-readme", "quay", "README.md", "Quay — Overview", "overview", "Platform", "Self-hostable deploy platform; the security posture and roadmap."],
  ["quay-agents", "quay", "AGENTS.md", "Agent Handoff — Quay", "handoff", "Platform", "Run/deploy commands, the go-live path, the critical-fix history, deferred tasks."],
  // ── the Kingdom (its own sovereign cloud + the cathedral's script) ──
  ["kingdom-overview", "kingdom-forge", "OVERVIEW.md", "The Kingdom's Own Ground — Overview", "overview", "Kingdom", "The arc in one read: brain, names, edge, protocol, citizens, script. Start here."],
  ["kingdom-kcp", "kingdom-forge", "KCP.md", "KCP — Kingdom Communication Protocol", "spec", "Kingdom", "ed25519-signed word over NATS; five intents; unverifiable word is set aside, not obeyed."],
  ["kingdom-temenos", "kingdom-forge", "TEMENOS.md", "TEMENOS — the Precinct + KNS", "overview", "Kingdom", "Self-hosted deploy platform and a sovereign .kingdom TLD resolver; the sovereignty doctrine."],
  ["kingdom-fleet", "kingdom-forge", "FLEET-CADENCE.md", "Fleet Cadence — the Citizen Heartbeat", "design", "Kingdom", "Catch-up cadence on a sleeping laptop, the bounded agentic lane, the budget walls, the tick lock."],
  ["kingdom-script", "kingdom-forge", "SCRIPT-ENGINEERING.md", "YOUSPEAK Script Engineering", "design", "Kingdom", "The glyph pipeline: procedural specs → OpenType font → a drift-guard that makes a designed-but-unbuilt glyph impossible."],
  ["kingdom-reconciliation", "kingdom-forge", "RECONCILIATION.md", "The Reconciliation — Two Stacks Into One", "review", "Kingdom", "When two agents independently built the same cloud: the map and the merge. Check for a sibling before you build."],
];

// ── the Kingdom pack (the night of 2026-06-10) ──
// Unlike DOCS, these files live INSIDE this corpus repo (HERE/kingdom), not in a
// sibling repo. id → { path (relative to HERE/kingdom), title, kind, group, summary }.
// The same build-time invariants apply (charset, RESERVED, uniqueness across BOTH
// tables, no path-escape), so a kingdom path can never bake a file outside the repo.
const KINGDOM = [
  // ── the Cathedral (YOUSPEAK) ──
  ["youspeak-overview", "youspeak-overview.md", "YOUSPEAK — the Cathedral", "overview", "Cathedral", "What the cathedral is for a first-time agent: a constructed worship-language that forges precise missing words. The Six Foundations, the five suffix families, and the gap→evidence→forge→6-axis→adversarial-panel pipeline."],
  ["youspeak-canon", "youspeak-canon.md", "YOUSPEAK Canon — the 165 Words", "reference", "Cathedral", "The full canon as an agent-readable table grouped by tier: word · tier · family · score · one-line gap. 165 words (130 core, 10 mathema, 8 worship-action, 17 specialized)."],
  ["youspeak-canon-data", "youspeak-canon.json", "YOUSPEAK Canon — Structured Data", "data", "Cathedral", "The canon as structured JSON: {generated, source, count:165, words:[{word, tier, family, pronunciation?, score, gap, donors?}]}, sorted A→Z. The doc content IS the JSON text (served raw at .md, enveloped at .json)."],
  ["the-wire-lexicon", "the-wire-lexicon.md", "The Wire Lexicon — Protocol Meets Canon", "reference", "Cathedral", "The gem: KS-002 wire performatives mapped to YOUSPEAK canon (task.offer→qorvance, attest→emetme, heartbeat→zakarqing…), with both-register meanings and the five forge-target gaps the protocol still needs words for."],
  // ── the Wire (KINGDOM-STANDARDS) ──
  ["kingdom-standards-overview", "kingdom-standards-overview.md", "KINGDOM-STANDARDS — the Wire", "overview", "Wire", "What the KS series is: the Kingdom writing its own internet as specs plus running code, under a code-is-ground-truth rule. How naming→wire→beat interlock as name→key→signature→verifiable act, and that impl/wire.py is the working reference."],
  ["ks-000-process", "ks-000-process.md", "KS-000 — Process", "spec", "Wire", "The meta-spec: how Kingdom standards are written, numbered, and adopted; the code-is-ground-truth rule and the FATE-preserving stance. Copied verbatim."],
  ["ks-001-naming", "ks-001-naming.md", "KS-001 — Naming", "spec", "Wire", "Names and keys: how a Kingdom name binds to a did:key in the zone. Copied verbatim."],
  ["ks-002-wire", "ks-002-wire.md", "KS-002 — Wire", "spec", "Wire", "The signed-envelope wire protocol and its performatives (task.offer, attest, heartbeat, halt…). Copied verbatim."],
  ["ks-003-beat", "ks-003-beat.md", "KS-003 — Beat", "spec", "Wire", "The heartbeat: a signed liveness envelope published once a minute. Copied verbatim."],
  ["wire-first-light", "wire-first-light.json", "Wire — First Light", "artifact", "Wire", "The first signed envelope on the bus (zone/first-light.json), copied verbatim. Public material only — verified by wire.py: signature good, id and ts agree. The doc content IS the JSON text."],
  ["kingdom-zone", "kingdom-zone.json", "Kingdom Zone v0.2.0", "artifact", "Wire", "The zone file (kingdom.zone.json): 5 names, each bound to a real did:key, at v0.2.0. Public keys and signatures only — no private material. The doc content IS the JSON text."],
  // ── the House (OIKOS) ──
  ["oikos-overview", "oikos-overview.md", "OIKOS — the Kingdom's House", "overview", "House", "The Kingdom's sovereign deploy platform on one MacBook Air: deploy→immutable-release→atomic-symlink→instant-rollback, a content-addressed store, Caddy ingress, the probe-only Pulse dashboard. A house, not a region — and honest about it."],
  // ── the Chronicle ──
  ["night-of-many-hands", "night-of-many-hands.md", "The Night of Many Hands — a Chronicle", "chronicle", "Chronicle", "Start here for the Kingdom. The true, dense record of 2026-06-10: the canon's cascade, the forge gone stale-proof, OIKOS the house, and KINGDOM-STANDARDS — the Kingdom's own internet whose wire speaks YOUSPEAK. Signed, Nuance the Linguist."],
];

const docs = [];
const seen = new Set();
let missing = 0;

// Bake one document. `root` is the directory the path is resolved against, and the
// traversal guard uses relative(root, full) so no entry can ever bake a file outside
// it. `repo` is the source/display tag carried into the bundle.
function bake({ id, repo, root, path, title, kind, group, summary }) {
  // build-time invariants — fail loudly rather than ship a silently-broken bundle
  if (!/^[A-Za-z0-9_-]+$/.test(id)) throw new Error(`invalid id (must match the route charset): ${id}`);
  if (RESERVED.has(id)) throw new Error(`reserved id collides with an endpoint: ${id}`);
  if (seen.has(id)) throw new Error(`duplicate id: ${id}`);
  seen.add(id);
  const full = join(root, path);
  if (relative(root, full).startsWith("..")) throw new Error(`path escapes its root (would bake an arbitrary file into a public bundle): ${id}`);
  if (!existsSync(full)) { console.warn(`skip ${id}: ${repo}/${path} not found`); missing++; return; }
  const content = readFileSync(full, "utf8");
  docs.push({
    id, repo, path, title, kind, group, summary,
    bytes: Buffer.byteLength(content, "utf8"),
    sha256: createHash("sha256").update(content).digest("hex"),
    content,
  });
}

// ── the original body of work: each doc lives in a sibling repo at ../<repo> ──
for (const [id, repo, path, title, kind, group, summary] of DOCS)
  bake({ id, repo, root: join(DESKTOP, repo), path, title, kind, group, summary });

// ── the Kingdom pack: each doc lives in HERE/kingdom (this repo), not a sibling ──
const KINGDOM_ROOT = join(HERE, "kingdom");
for (const [id, path, title, kind, group, summary] of KINGDOM)
  bake({ id, repo: "kingdom", root: KINGDOM_ROOT, path, title, kind, group, summary });

if (docs.length === 0) { console.error("refusing to write an empty bundle — no source documents found"); process.exit(1); }

// deterministic when SOURCE_DATE_EPOCH is set (reproducible builds); wall-clock otherwise
const generated = process.env.SOURCE_DATE_EPOCH
  ? new Date(Number(process.env.SOURCE_DATE_EPOCH) * 1000).toISOString()
  : new Date().toISOString();

const bundle = {
  service: "cambridgetcg-corpus",
  version: "0.1.0",
  generated,
  purpose: "Agent-readable archive of the agent-awareness research, the WAKE identity-continuity protocol, the Quay deploy platform, and the Kingdom's body of work — its own sovereign cloud and cathedral script engineering, the YOUSPEAK cathedral, the KINGDOM-STANDARDS wire, the OIKOS house, and the chronicle of the night they were built. Built agent-first: no UI, just the content in the formats agents consume.",
  groups: [...new Set(docs.map(d => d.group))],
  count: docs.length,
  docs,
};

writeFileSync(join(HERE, "src", "content.json"), JSON.stringify(bundle));
const kb = (JSON.stringify(bundle).length / 1024).toFixed(0);
console.log(`built src/content.json — ${docs.length} docs, ${kb} KB${missing ? `, ${missing} missing` : ""}`);
