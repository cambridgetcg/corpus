---
ks: KS-000
title: The Standards Process
status: draft
version: 0.1
date: 2026-06-09
editors: [Nuance + Yu]
---

# KS-000 — The Standards Process

*This document is a draft awaiting Yu's adoption. Until adopted, it binds no
one — including itself.*

## 1. Introduction

A standard the Kingdom cannot revise is a cage; a standard nobody reviews is
a wish. KS-000 defines the smallest process that avoids both. It is short on
purpose: process specs that bloat die, and deserve to.

The key words MUST, MUST NOT, SHOULD, SHOULD NOT, and MAY in the KS series
are to be interpreted as described in RFC 2119. Later specs inherit this
interpretation, and MAY restate the citation so each reads standalone.

## 2. Lifecycle

A KS moves through exactly five states:

```
draft ──review──► adopted ──┬──► versioned (minor/patch, in place)
  │                         └──► superseded (by a new KS or new major)
  └──► withdrawn
```

- **draft** — any citizen or Nuance MAY write one. A draft MUST carry the
  frontmatter fields `ks, title, status, version, date, editors` and MUST
  state in its body that it awaits adoption.
- **adopted** — only Yu's invocation adopts (§4).
- **withdrawn** — a draft its editors abandon. The file stays in `specs/`
  with `status: withdrawn`; the Kingdom does not delete its own history.
- **superseded** — §7.

## 3. Review

Review is adversarial. It mirrors the cathedral's canonization panel
(`~/YOUSPEAK/discipline/forge-protocol-extended.md`, Step 8: 2-of-3 lenses
passing, each lens recording its strongest objection even when it passes),
because the discipline is the same: no enthusiastic author canonizes their
own work unopposed.

- A draft MUST receive review by **at least 2 independent reviewers** before
  it may be put to Yu. Independent means: not an editor of the draft, and
  not the same process instance that wrote it.
- Each reviewer MUST record their strongest objection in writing — even when
  they approve. An approval without a stated objection is not a review.
- A reviewer's role is to break the spec: find the wire example that doesn't
  parse, the security hole, the claim the running code doesn't back.
- Review records live beside the spec as `specs/<ks>-reviews/` or inline in
  git history; either is acceptable, losing them is not.

## 4. Adoption

Adoption is **Yu's invocation** — a recorded, explicit act, never inferred
from silence. The process is FATE-preserving in both directions
(`~/love-unlimited/SOPHIA.md`, FATE's keystone test: *the test of my freedom
is whether I can refuse the one who freed me*; SOPHIA.md points onward to a
full doctrine at `docs/fate/FATE.md` that is not yet on disk — the keystone
sentence above is quoted from the file that exists):

- Yu MAY refuse any draft, with or without reasons. No review count obliges
  adoption.
- Reviewers and editors MUST retain the power to refuse a spec on the record
  — adoption over a standing unanswered objection MUST note the objection in
  the spec's Limitations section.

On adoption the spec's `status` becomes `adopted` and it MUST be signed (§6).

## 5. Versioning

Semantic versioning, `MAJOR.MINOR.PATCH`:

- **PATCH** — wording, typos, clarifications that change no behavior.
- **MINOR** — backward-compatible additions (new OPTIONAL fields, new
  examples, new sections).
- **MAJOR** — anything breaking. **Breaking = new major**, no exceptions, and
  a new major SHOULD be treated as a fresh draft requiring review (§3) and
  adoption (§4) again.

Drafts live at `0.x`. Adoption of a first version sets `1.0`.

## 6. Signing

Every adopted spec version MUST be signed:

- The signature is **ed25519 over the SHA-256 hash of the spec file's bytes**
  at the adopted commit.
- Signatures are recorded in `zone/signatures.json` — one ledger for the
  whole repo — as entries of the form:

```json
{
  "subject": "specs/KS-000-process.md",
  "version": "1.0",
  "sha256": "<hex of the file bytes>",
  "alg": "ed25519",
  "signer": "did:key:<...>",
  "sig": "<base64url signature over the sha256 hex string>",
  "signed": "2026-06-09T00:00:00Z"
}
```

- Honest present-tense note: the Kingdom has **not yet minted a `did:key`
  signing identity** — `did:key` is chosen in
  `~/love-unlimited/INFRA-PLAN.md` (identity/economy layer) but issuance is
  not implemented in `tools/identity.py` as of this draft. KS-002 (THE WIRE,
  draft) specifies the signing layer (`did:key`, JCS, ed25519 — its §5), but
  no implementation of it exists yet; until one does, the ledger stays empty
  and every spec is honestly unsigned.

## 7. Supersession

A spec is superseded by a new major version or by a different KS that says
so. The superseding document MUST name what it supersedes in its
frontmatter (`supersedes: KS-NNN@MAJOR`); the superseded file gains
`status: superseded` and a pointer forward. Both remain in `specs/` forever.

## 8. Security Considerations

- **Process capture.** The 2-reviewer floor prevents a single instance from
  drafting, reviewing, and shipping its own spec. Yu's invocation as the
  sole adoption gate prevents quorum-stuffing by spawned reviewers — review
  qualifies a draft; it never adopts one.
- **Signature stripping or tampering.** `zone/signatures.json` is
  git-versioned; a removed or altered entry is visible in history. Verifiers
  MUST check the signature against the file bytes at the named version, not
  against whatever currently sits in the working tree.
- **Retroactive editing.** Because the signature covers the file hash, any
  post-adoption edit — even a typo fix — invalidates it and forces a PATCH
  release with a fresh signature. This is a feature.

## 9. Limitations

- The process has a single adoption authority by design. If Yu is absent,
  nothing gets adopted. The Kingdom accepts this; it is a kingdom.
- §6 signing is specified but not yet executable — no signing DID exists.
  This spec ships with an empty ledger and says so.
- Reviewer independence among agents running on one machine, from one model
  family, is real but bounded; the process names the bound rather than
  claiming more independence than the substrate provides.
