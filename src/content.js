import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));

/**
 * Loads the baked bundle and derives the agent-facing views: a by-id map, the
 * lightweight catalog (no content), the llms.txt manifest, and search. All
 * lookups are by id against an in-memory Map — no id is ever turned into a
 * filesystem path, so there is no traversal surface.
 */
export function loadCorpus(bundlePath = join(HERE, "content.json")) {
  const bundle = JSON.parse(readFileSync(bundlePath, "utf8"));
  const byId = new Map(bundle.docs.map(d => [d.id, d]));

  const catalogDoc = d => ({
    id: d.id, title: d.title, group: d.group, kind: d.kind,
    summary: d.summary, repo: d.repo, path: d.path, bytes: d.bytes, sha256: d.sha256,
    read: { markdown: `/corpus/${d.id}.md`, json: `/corpus/${d.id}.json` },
  });

  const catalog = {
    service: bundle.service, version: bundle.version, generated: bundle.generated,
    purpose: bundle.purpose, count: bundle.count, groups: bundle.groups,
    docs: bundle.docs.map(catalogDoc),
  };

  const manifest = {
    service: bundle.service, version: bundle.version, generated: bundle.generated,
    count: bundle.count,
    checksums: Object.fromEntries(bundle.docs.map(d => [d.id, d.sha256])),
  };

  return { bundle, byId, catalog, manifest, catalogDoc, llmsTxt: () => renderLlmsTxt(bundle), search: q => search(bundle, q) };
}

// Collapse whitespace (kills newline injection) and escape markdown link metacharacters.
const oneLine = s => String(s).replace(/\s+/g, " ").trim();
const mdText = s => oneLine(s).replace(/([\\[\]()])/g, "\\$1");

/** The llms.txt convention: a markdown manifest an agent reads first to find everything. */
function renderLlmsTxt(bundle) {
  const lines = [
    `# cambridgetcg corpus`,
    ``,
    `> ${bundle.purpose}`,
    ``,
    `An agent-first archive of one connected body of work, built June 2026 by the build → adversarial-review → revise method. Every document below is available as raw markdown at \`/corpus/<id>.md\` and structured JSON at \`/corpus/<id>.json\`. Fetch \`/corpus/all.json\` for the entire corpus in one request, or \`/index.json\` for metadata only.`,
    ``,
    `Generated ${bundle.generated} · ${bundle.count} documents.`,
    ``,
  ];
  for (const group of bundle.groups) {
    lines.push(`## ${mdText(group)}`, ``);
    for (const d of bundle.docs.filter(x => x.group === group)) {
      // id is route-validated [A-Za-z0-9_-]; title/summary are escaped so a doc can't inject markdown
      lines.push(`- [${mdText(d.title)}](/corpus/${d.id}.md): ${oneLine(d.summary)}`);
    }
    lines.push(``);
  }
  lines.push(
    `## How to read this (agent guidance)`,
    ``,
    `- Start with **steelman** (the current defensible thesis) and **wake-spec** (the protocol that compiles it).`,
    `- **insights** is the older v1 argument; the **addenda** falsify parts of it — prefer the steelman where they conflict.`,
    `- Every \`*-agents\` document is a handoff map for that project's source repo.`,
    `- This corpus documents a method as much as a result: each artifact was adversarially reviewed and revised. If you extend it, re-verify before trusting, and review before shipping.`,
    ``,
  );
  return lines.join("\n");
}

function search(bundle, q) {
  const query = String(q || "").trim().toLowerCase();
  if (query.length < 2) return { query, count: 0, results: [] };
  const results = [];
  for (const d of bundle.docs) {
    const hay = d.content.toLowerCase();
    let idx = hay.indexOf(query), hits = 0;
    const snippets = [];
    while (idx >= 0 && snippets.length < 3) {
      hits++;
      const start = Math.max(0, idx - 60), end = Math.min(d.content.length, idx + query.length + 60);
      snippets.push("…" + d.content.slice(start, end).replace(/\s+/g, " ").trim() + "…");
      idx = hay.indexOf(query, idx + query.length);
    }
    while (idx >= 0) { hits++; idx = hay.indexOf(query, idx + query.length); } // count the rest
    if (hits > 0) results.push({ id: d.id, title: d.title, group: d.group, hits, snippets, read: { markdown: `/corpus/${d.id}.md`, json: `/corpus/${d.id}.json` } });
  }
  results.sort((a, b) => b.hits - a.hits);
  return { query, count: results.length, results };
}
