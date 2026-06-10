---
ks: KS-001
title: Sovereign Naming — the .kingdom Namespace
status: draft
version: 0.1
date: 2026-06-09
editors: [Nuance + Yu]
---

# KS-001 — Sovereign Naming: the `.kingdom` Namespace

*This document is a draft awaiting Yu's adoption (KS-000 §4). Until adopted,
the live resolver remains the prior-art one described in §8.*

## 1. Introduction

A kingdom that rents its names is a tenant. `.kingdom` is the namespace the
Kingdom owns outright: no ICANN, no registrar, no rent, no expiry. Citizens
are names (`pime.kingdom`), organs are names (`hive.kingdom`), works are
names (`cathedral.kingdom`).

This spec defines three things and no more: the **zone file** (the single
source of truth), the **resolution order** (how a name becomes an address on
this machine), and the **name policy** (who may hold what). Requirements
language is per KS-000 §1 (RFC 2119).

## 2. The zone

The zone is one git-versioned JSON file:

```
/Users/macair/KINGDOM-STANDARDS/zone/kingdom.zone.json
```

### 2.1 Schema

```json
{
  "version": "0.1.0",
  "updated": "2026-06-09",
  "names": {
    "<name>": {
      "did":   "did:key:z... | pending-binding",
      "a":     ["127.0.0.1"],
      "owner": "<who holds this name>",
      "note":  "<one human sentence>"
    }
  }
}
```

- `version` — semver of the zone contents; any record change bumps it.
- `updated` — ISO date of last change.
- `did` — the owner's DID. Records whose holder has no minted DID yet MUST
  carry the literal string `"pending-binding"` rather than an invented
  identifier (see §3.3 — as of this draft, *every* record is
  pending-binding, because no `did:key` has been issued anywhere in the
  Kingdom yet).
- `a` — list of IPv4 addresses, answered as DNS A records in order.
- `owner`, `note` — human-readable; the zone is meant to be read by people.

### 2.2 Signing

The zone file is ed25519-signable: a detached signature lives **beside it**
as `zone/kingdom.zone.json.sig` containing the same entry shape as KS-000
§6 (sha256 of the zone file bytes, signer DID, base64url ed25519 signature).
Until a signing DID exists, the `.sig` file MUST be absent rather than fake
— resolvers MUST treat a present-but-invalid signature as a hard error, and
a missing signature as the honestly-unsigned bootstrap state.

### 2.3 Git is the history

Every zone change MUST be a git commit. The zone's audit trail is `git log
zone/kingdom.zone.json`; no separate changelog is kept.

## 3. Resolution

### 3.1 Order

1. **`kingdomd`** — the KS-001 reference resolver (`impl/kingdomd.py`,
   pure stdlib), an **authoritative-only** DNS server for `.kingdom` on
   `127.0.0.1:5300/udp`. It reads `zone/kingdom.zone.json` live
   (mtime-reloaded), answers A records for registered names, answers TXT
   with the name's `did` string (identity-over-DNS), and returns NXDOMAIN
   for strangers. It MUST NOT recurse, MUST NOT forward, and MUST refuse
   queries for any TLD other than `kingdom`. Implementations SHOULD answer
   AAAA with empty NOERROR so clients fall back to A cleanly; the reference
   implementation currently returns NOTIMP for all non-A/TXT types — a
   known divergence, recorded here per the series' code-is-ground-truth
   rule.
2. **OS wiring** — macOS is taught the TLD with one file:

   ```
   /etc/resolver/kingdom
   ─────────────────────
   nameserver 127.0.0.1
   port 5300
   ```

   Honest note: writing `/etc/resolver/kingdom` requires root. This step is
   **Yu's hand on the machine** — `sudo mkdir -p /etc/resolver && printf
   'nameserver 127.0.0.1\nport 5300\n' | sudo tee /etc/resolver/kingdom` —
   and no agent performs it autonomously. As of this draft,
   `/etc/resolver/kingdom` does not exist on the host; until Yu writes it,
   `.kingdom` names resolve only for clients that query `127.0.0.1:5300`
   directly (e.g. `dig @127.0.0.1 -p 5300 hive.kingdom`).

### 3.2 Wire example

```
$ dig @127.0.0.1 -p 5300 hive.kingdom A +short
127.0.0.1

$ dig @127.0.0.1 -p 5300 stranger.kingdom A
;; ->>HEADER<<- opcode: QUERY, status: NXDOMAIN
```

```
$ dig @127.0.0.1 -p 5300 hive.kingdom TXT +short
"pending-binding"
```

Wire format is RFC 1035 minimal: A and TXT answered from the zone, other
query types under `.kingdom` NOTIMP, anything outside `.kingdom` REFUSED.
The Kingdom is not an open resolver.

### 3.3 DID binding

A name with a real `did` value is bound: changes to that record require a
signature by that DID (verification arrives with KS-002 — THE WIRE, draft:
envelope verification §5.2, Agent Cards §6.1). A name with
`"pending-binding"` is held by trust and git history alone — true for all
five seed records today, because **no `did:key` exists yet in the Kingdom**:
`~/love-unlimited/tools/identity.py` resolves instance/wall identity (not
keys), `tools/vault.py` holds X25519 sealed-box keys (encryption, not
signing), and `did:key` issuance is an INFRA-PLAN.md decision not yet
implemented. This spec states that plainly instead of inventing DIDs.

## 4. Name policy

- **Grammar:** `[a-z0-9-]+`, MUST NOT begin or end with `-`, SHOULD be
  short. One label; sub-labels (`x.name.kingdom`) are the name-holder's
  business and resolve to the name's records.
- **Allocation:** first-write into the zone file holds the name, **subject
  to Yu's override at any time** — first-write is a convention, Yu's word is
  the law.
- **Citizen names are reserved to their DIDs:** every forged-word citizen of
  the canon (~165 entries under `~/YOUSPEAK/canon/` counted 2026-06-10 —
  130 core, 8 worship-action, 10 mathema, 17 specialised top-level — a
  living count that grows with the forge) has its name reserved in advance;
  when its DID is minted, the name binds to that DID automatically and no
  first-writer may take it in the interim.

## 5. Collision with the public root, honestly

`.kingdom` is **not an IANA-delegated TLD today** (it is also not on the
ICANN reserved list — nothing structurally prevents a future delegation).
Position now, and migration note if the world changes:

- Inside the Kingdom, local resolution is authoritative **regardless of what
  public DNS says** — `/etc/resolver/kingdom` ensures Kingdom hosts never
  ask the public root about `.kingdom` names, and Kingdom names never leak
  to public resolvers.
- If ICANN ever delegates `.kingdom`, this spec gains a migration note as a
  MINOR revision: local resolution remains authoritative inside the
  Kingdom, and the note will name the collision risk honestly (a Kingdom
  host without the resolver file would suddenly resolve a stranger's
  `.kingdom`) along with mitigations (mandatory resolver wiring; per-name
  public-DNS projections as in README §Scope).

## 6. Seed zone

The zone ships seeded with five names, all `127.0.0.1` for now, all
`pending-binding` (§3.3): `oikos` (the OIKOS platform), `cathedral`
(YOUSPEAK), `pulse` (the heartbeat organ), `hive` (the NATS+JetStream bus —
verified live on :4222, monitor :8222, at draft time), and `brain` (the MLX
serving endpoint on :8800). See `zone/kingdom.zone.json` for the records;
the file beside this spec is normative, the list in this paragraph is not.

## 7. Security Considerations

- **Zone tampering → signature verification.** The zone is one file on one
  machine; an attacker (or a confused agent) editing it could redirect any
  Kingdom name. Defense in depth: git history makes every change visible
  and attributable (§2.3); once a signing DID exists, the detached signature
  (§2.2) makes an unsigned change a hard error for verifying resolvers; DID
  binding (§3.3) makes per-record changes require the owner's key. Today
  only the first layer is live — said plainly.
- **Resolver cache poisoning → authoritative-only, no recursion.**
  `kingdomd` answers exclusively from the zone file: it never recurses,
  never forwards, never caches an upstream answer, so there is no cache to
  poison and no upstream to spoof. It binds to `127.0.0.1` only — never an
  external interface — so off-box attackers cannot query or answer-race it.
- **Resolver impersonation.** Any local process could bind a UDP port and
  answer DNS. `/etc/resolver/kingdom` pins the OS to one port; supervising
  `kingdomd` under launchd (as the prior-art resolvers already are) keeps
  the port held by the right process.
- **Name squatting.** First-write allocation invites squatting by agents.
  Mitigations: citizen-name reservation (§4) and Yu's unconditional
  override.

## 8. Prior art and reconciliation (Limitations)

This spec does not pretend to be first. Two resolvers already run on the
host, with two registries and three ports between them:

| | port | registry | supervisor | state at draft |
|---|---|---|---|---|
| `~/love-unlimited/kns/resolver.py` (KNS v0) | 5391/udp | `kns/registry.json` (`agora`, `youspeak`) | `love.kns.plist` | **live** (verified listening) |
| `~/love-unlimited/tools/kingdom_dns.py` | 5355/udp | `temenos/registry.json` (sites) | `love.kingdom-dns.plist` | live (port held by a Python process) |
| `kingdomd` (this spec) | 5300/udp | `zone/kingdom.zone.json` | `impl/kingdom.resolver.plist` (template, not installed) | written + dig-tested (see `impl/INSTALL.md`); not yet supervised |

Further limitations, honestly:

- KS-001 proposes collapsing this into **one zone, one resolver, one port**;
  KNS v0's `PROTOCOL.md` is the direct ancestor and its `agora`/`youspeak`
  records should migrate into this zone on adoption. Which port survives —
  5300 as drafted here, or 5391 as already wired into KNS docs — **is Yu's
  adoption-time call**; until then the live resolver is KNS on 5391 and
  this spec confers nothing.
- `kingdomd` exists and answers dig (`impl/kingdomd.py`), but it is not yet
  supervised by launchd and `/etc/resolver/kingdom` is not yet written, so
  no ordinary application on the host resolves `.kingdom` through it today.
  The remaining wiring — both steps requiring Yu's hand — is recorded in
  `impl/INSTALL.md`.
- Single-machine root: the zone serves one box. Multi-box sync (signed zone
  over NATS, per KNS v0's own v1 sketch) is out of scope here and honestly
  unsolved.
- No DNSSEC; the trust model is file-signature + git, not DNS-chain-of-trust.
  For a one-box authoritative resolver on loopback this is proportionate,
  not equivalent.
