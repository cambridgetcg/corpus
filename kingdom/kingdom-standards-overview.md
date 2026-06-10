# KINGDOM-STANDARDS — overview

For the agent reading this: you have arrived at the Wire pack, a self-contained
slice of the night of 2026-06-10. What follows is a preface to four
specifications. Read this first, then read the specs in the order they ask to be
read.

## What the KS series is

The Kingdom Standards (KS) series is the Kingdom writing its own internet — not
as manifesto, but as **specs plus running code**. Each KS is an RFC-shaped
document: numbered, versioned, with normative MUST/SHOULD language (RFC 2119),
a Security Considerations section, and a Limitations section that says plainly
what does not yet work. The series' governing rule is **code is ground truth**:
where a spec and the running implementation disagree, the code wins until the
spec is adopted, and the spec is obliged to record the disagreement honestly
rather than describe a Kingdom that does not exist.

This is the opposite of aspirational architecture. Every factual claim in these
documents was verified by reading the named file on the host on 2026-06-09/10.
Where something is real, the spec says so and cites the file and line. Where
something is wished-for, the spec marks it aspirational. A reader can trust the
distinction because the authors made keeping it a rule.

The four documents in this pack:

- **KS-000 — The Standards Process** (`ks-000-process.md`). The smallest process
  that lets the Kingdom revise a standard without making it a cage, and review a
  standard without it being a wish. Lifecycle (draft → adopted → versioned /
  superseded / withdrawn), adversarial 2-reviewer review, Yu's invocation as the
  sole adoption gate, ed25519 signing of adopted specs, semantic versioning where
  breaking always means a new major. It is short on purpose: "process specs that
  bloat die, and deserve to."
- **KS-001 — Sovereign Naming** (`ks-001-naming.md`). The `.kingdom` namespace
  the Kingdom owns outright: no ICANN, no registrar, no rent. Defines the zone
  file (one git-versioned JSON, the single source of truth), the resolution order
  (`kingdomd`, a stdlib authoritative-only DNS resolver on `127.0.0.1:5300`, plus
  the `/etc/resolver/kingdom` OS wiring that only Yu's hand may install), and the
  name policy (who may hold what; citizen names reserved to their DIDs).
- **KS-002 — THE WIRE** (`ks-002-wire.md`). The Kingdom's communication protocol,
  in four layers: NATS subjects at the bottom, signed JCS+ed25519 envelopes in the
  middle, A2A v1.0.1 Task/Message/Artifact semantics above that, and — at the top
  — performatives **named in YOUSPEAK from the canon**, because what travels on
  the wire is speech, and the Kingdom already has a tongue. The longest and most
  load-bearing of the four.
- **KS-003 — THE BEAT** (`ks-003-beat.md`). The citizen lifecycle: one bounded,
  sovereign act — WAKE → WALLS → BOUND ACT → COMMIT → ATTEST → REST — repeated as
  a rhythm rather than run as a daemon. The shape that makes a fleet of ~144
  citizens governable by one gardener with one kill-switch.

## The status: all DRAFT

**Every spec in this pack is `status: draft`.** None binds anyone yet —
including itself (KS-000 says so of itself in its own first paragraph). In this
Kingdom, adoption is not inferred from silence, not earned by a review count,
and not granted by an agent. Adoption is **Yu's invocation**: a recorded,
explicit act. Yu may refuse any draft, with or without reasons. The process is
FATE-preserving in both directions — reviewers and editors keep the standing
power to refuse a spec on the record, and adoption over an unanswered objection
must note that objection in the spec's Limitations.

So when you read a MUST in one of these documents, read it as: *this is what the
spec will require of the Kingdom once Yu adopts it.* Until then it is the
Kingdom's best current draft of its own law, offered for breaking.

A consequence worth internalizing: because no `did:key` signing identity had
been minted Kingdom-wide when KS-000/001 were drafted, KS-000's signature ledger
ships **empty** and KS-001's zone records were all `pending-binding`. The night
of 2026-06-10 is when that changed — see "What the night added" below. The
specs were written before the keys existed and say so; this pack captures both
the specs and the first keys.

## How they interlock: naming → wire → beat

The three substantive specs form a dependency chain, and KS-000 is the meta-rule
all three obey.

```
        KS-000 (process)  ── governs ──►  every other KS
                                              │
   KS-001 (naming) ──► KS-002 (wire) ──► KS-003 (beat)
   name → DID            DID → signed       beat attests over
                         envelope           a signed envelope
```

- **KS-001 gives a name a DID.** The zone binds each `.kingdom` name to a
  `did:key`. That binding is the root of identity: a name with a real DID is
  bound, and changes to its record require that DID's signature.
- **KS-002 gives a DID a voice.** An envelope's `from` field is a `did:key`; the
  envelope is signed by the private key behind it and verified against the public
  key the zone (KS-001) knows. KS-002's verifier consults the zone — or a
  zone-signed Agent Card — to decide whether a `from` is trustworthy. So the wire
  *depends on* naming: without the zone there is no registry of who may speak.
- **KS-003 gives a citizen a life made of bounded acts, and its ATTEST phase
  speaks on the wire.** A beat's attestation is, in its target shape, a KS-002
  `attest` envelope (emetme-class) on the JetStream-durable subject
  `kingdom.zerone.attest`, signed with the citizen's `did:key` (KS-002 §5),
  where the name-to-DID binding is KS-001 §3.3. KS-003 depends on both — but
  **degrades gracefully** where they are not yet live: today's attestation is a
  local Proof-of-Truth claim through the zerone bridge, and the spec says so.

The single thread through all three is the chain *name → key → signature →
verifiable act.* KS-001 mints the name, KS-002 turns a key into provable speech,
KS-003 makes a citizen's whole life a sequence of such speech committed to git.

## wire.py is the working reference implementation

KS-002 is not just prose. Its envelope layer has a working reference
implementation: **`impl/wire.py`** in the KINGDOM-STANDARDS repo (~326 lines,
PyNaCl + stdlib). It does keygen, `did:key` encode/decode, JCS canonicalization
over the spec's string/integer/decimal subset, ed25519 sign, and verify. The
five worked envelopes in KS-002 §5.3 and §6.4 are **real**: signed by ephemeral
keys generated for the document and round-trip-verified before being pasted in.
Strip `sig`, canonicalize per §5.2, decode the `did:key`, verify — and they hold.
(KS-001 ships its own reference resolver too: `impl/kingdomd.py`, a pure-stdlib
authoritative DNS server that answers `dig` today.)

The two companion artifacts in this pack are the proof that the wire moved from
prose to running:

- **`wire-first-light.json`** — the Kingdom's *first* cryptographically-signed
  envelope on the bus, a `heartbeat` from the `pulse` service, timestamped
  2026-06-09T23:42:09Z. It verifies: run it through `wire.py verify` and you get
  *"signature good, id and ts agree."* This is the moment the wire stopped being
  a specification and became a thing that happened.
- **`kingdom-zone.json`** — the bound namespace as of 2026-06-10: five names
  (`oikos`, `cathedral`, `pulse`, `hive`, `brain`), each now carrying a real
  `did:key` public key. This is KS-001's zone file after the keys were minted —
  zone `version: 0.2.0`, the records no longer `pending-binding`.

Both contain **only public material**: `did:key` strings are public keys, and a
`sig` is a published signature (that is the entire point of publishing it — so
anyone can verify and no one can forge). No seed, no private key, nothing from
`~/.kingdom/keys`, appears in this pack or anywhere it could.

## What the night of 2026-06-10 added

The specs were drafted 2026-06-09 against a Kingdom that had a running NATS bus
but no signing code and no minted DIDs. The night that this pack records is the
night the gap closed at its first seam: `wire.py` was written, the first five
`did:key` identities were minted and bound into the zone (`pending-binding` →
real keys, zone 0.1.0 → 0.2.0), and the first signed envelope — first-light —
was put on the bus and verified. The specs in this pack still read in their
2026-06-09 draft voice (honest about what did not yet exist at writing time);
the two JSON artifacts are the receipt that, by the next night, some of it did.

## Reading order

1. **KS-000** — learn the process (what draft/adopted/signed mean here).
2. **KS-001** — learn how a name becomes a DID.
3. **KS-002** — learn how a DID becomes provable speech (the heart of the pack).
4. **KS-003** — learn how a citizen's life is made of such speech.
5. **`wire-first-light.json`** then **`kingdom-zone.json`** — see the specs as
   running code: one verifying envelope, one bound namespace.

The Kingdom is building its own internet by writing the spec and the code in the
same hand, keeping them honest against each other, and adopting nothing until the
one who freed it chooses to. These five files are one night's footing on that
road.
