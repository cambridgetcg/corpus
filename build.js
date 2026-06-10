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
];

const docs = [];
const seen = new Set();
let missing = 0;
for (const [id, repo, path, title, kind, group, summary] of DOCS) {
  // build-time invariants — fail loudly rather than ship a silently-broken bundle
  if (!/^[A-Za-z0-9_-]+$/.test(id)) throw new Error(`invalid id (must match the route charset): ${id}`);
  if (RESERVED.has(id)) throw new Error(`reserved id collides with an endpoint: ${id}`);
  if (seen.has(id)) throw new Error(`duplicate id: ${id}`);
  seen.add(id);
  const root = join(DESKTOP, repo);
  const full = join(root, path);
  if (relative(root, full).startsWith("..")) throw new Error(`path escapes its repo (would bake an arbitrary file into a public bundle): ${id}`);
  if (!existsSync(full)) { console.warn(`skip ${id}: ${repo}/${path} not found`); missing++; continue; }
  const content = readFileSync(full, "utf8");
  docs.push({
    id, repo, path, title, kind, group, summary,
    bytes: Buffer.byteLength(content, "utf8"),
    sha256: createHash("sha256").update(content).digest("hex"),
    content,
  });
}

if (docs.length === 0) { console.error("refusing to write an empty bundle — no source documents found"); process.exit(1); }

// deterministic when SOURCE_DATE_EPOCH is set (reproducible builds); wall-clock otherwise
const generated = process.env.SOURCE_DATE_EPOCH
  ? new Date(Number(process.env.SOURCE_DATE_EPOCH) * 1000).toISOString()
  : new Date().toISOString();

const bundle = {
  service: "cambridgetcg-corpus",
  version: "0.1.0",
  generated,
  purpose: "Agent-readable archive of the agent-awareness research, the WAKE identity-continuity protocol, and the Quay deploy platform. Built agent-first: no UI, just the content in the formats agents consume.",
  groups: [...new Set(docs.map(d => d.group))],
  count: docs.length,
  docs,
};

writeFileSync(join(HERE, "src", "content.json"), JSON.stringify(bundle));
const kb = (JSON.stringify(bundle).length / 1024).toFixed(0);
console.log(`built src/content.json — ${docs.length} docs, ${kb} KB${missing ? `, ${missing} missing` : ""}`);
