# OIKOS — the Kingdom's House

*The sovereign platform layer. One machine, wholly owned.*

For the agent reading this: OIKOS is where the Kingdom's works get deployed,
stored, routed, and watched — on a single machine, with no landlord between
intention and execution. If you have read the WAKE protocol or the Quay platform
elsewhere in this corpus, OIKOS is that same instinct carried all the way down to
the metal: own the substrate, keep every key on the box you can hold in your
hands, and never claim more than the machine can prove.

**Oikos** — οἶκος — is the household: the root of *oikonomia*, which the world
shortened to "economy" and forgot. Before economy meant markets, it meant the
right ordering of a house. OIKOS is that, for software. It does what Vercel and
AWS sell, with the parts they hide exposed: directories, symlinks, SQLite,
launchd, and one reverse proxy. Nothing here is rented.

This is a condensed map. The full one lives in `~/OIKOS/ARCHITECTURE.md`; the
front door is `~/OIKOS/README.md`. Where this overview and those documents
disagree, those documents are ground truth — they were written against a live
probe of the running machine on 2026-06-10.

## What Big Cloud sells, and the sovereign answer

OIKOS's architecture is a column-by-column rebuttal of the cloud's pricing
sheet. The honest status legend matters: **have** means standing and live today,
verified by a real probe (deploy → serve → rollback, store put/get, dashboard
probes); rows belonging to the agent layer (`~/love-unlimited`) OIKOS *observes,
never restarts*; **later** is named so it is not forgotten and deferred so it is
not faked.

| Big Cloud sells | The sovereign answer | Status |
|---|---|---|
| Vercel / deploys | `oikos deploy <dir>` → immutable release dir → atomic `current` symlink flip → instant rollback | have |
| S3 | `store/cas/` — files named by their own SHA-256, manifest in SQLite | have |
| Lambda (a process supervisor) | launchd agents (`oikos.*` plists, RunAtLoad + KeepAlive) — the OS itself is the supervisor | have |
| SQS / SNS (a message bus) | NATS + JetStream, live on `:4222` — the HIVE bus, owned by the agent layer | have (love-unlimited) |
| RDS | SQLite, WAL mode — the kosmem single-file pattern, reused for `manifest.db` | have |
| CloudWatch | **Pulse** — a dashboard at `http://oikos.localhost`, API on `127.0.0.1:7700`, that probes real state and never assumes | have |
| Route53 / DNS + ingress | Caddy on `:80` mapping `<app>.localhost` → `apps/<app>/current` | have |
| Bedrock / model APIs | the MLX model server on `127.0.0.1:8800` — local weights, zero metering | have (love-unlimited) |
| Secrets Manager / IAM | `vault.py` + ed25519 DIDs in `~/love-unlimited` — keys minted and held locally, no external CA | have (love-unlimited) |
| Multi-region / VPN | Tailscale mesh for off-box access | later |
| Public edge | a real domain + TLS — requires Yu's invocation; not before | later |
| Backup / durability | a backup ring: CAS mirrored to a second disk, then a second box | later |

The division of labor is deliberate. A companion document,
`~/love-unlimited/INFRA-PLAN.md`, charts the **agent layer** — the citizen
fleet, its beats, its memory (kosmem), its bus (HIVE over NATS), its identity
(ed25519 DIDs). In one line: *love-unlimited answers how agents live; OIKOS
answers where anything gets deployed, stored, routed, and watched.* The two
interlock — the fleet's services (NATS `:4222`, MLX `:8800`) appear to OIKOS as
already-standing rooms it routes to and watches but does not own.

## The deploy flow — a directory and a symlink

The entire deployment system is a directory and a symlink, and that is the
design, not a limitation. Atomic rename is the one transactional primitive the
filesystem gives you for free, and it is enough.

```
  oikos deploy ./site --name chapel
        │
        ▼   1. hash content      → short hash  a1b2c3d
            2. release id        → 20260609T2300-a1b2c3d   (UTC time + content hash)
            3. copy into apps/chapel/releases/20260609T2300-a1b2c3d/  (immutable now)
        │
        ▼
  apps/chapel/current ──atomic symlink swap──▶ releases/20260609T2300-a1b2c3d/
        │
        ▼
  Caddy serves http://chapel.localhost from apps/chapel/current
  (no reload — the symlink is resolved per request)
```

Rollback is the same move, pointed backward: one rename, zero downtime, nothing
rebuilt or re-fetched. Properties that fall out of this shape:

- **Releases are immutable.** A release directory is never edited after creation.
  The release id binds time and content, so two deploys of identical content are
  visibly identical and a tampered release is visibly tampered.
- **Rollback is instant and total** — not a redeploy but a re-point. Every past
  release stays browsable at `http://<app>.localhost/_releases/<id>/`, so you can
  eyeball the old version *before* flipping back to it.
- **`app.json`** beside `releases/` records the app's small truths: name, created
  date, current release, deploy history.
- **Garbage collection is a policy, not an emergency.** Old releases are just
  directories; pruning them is a deliberate `oikos` command, never a side effect.

## The CAS store — S3 without the bucket

`store/` is content-addressed storage, the simplest honest kind:

```
store/
├── cas/<sha[0:2]>/<sha256>   the blob, named by its own digest (two-hex fan-out)
└── manifest.db               SQLite (WAL) — names, sizes, times, refs
```

- **The blob's name is its proof.** Verification is re-hashing; there is no other
  authority to ask.
- **Write once, then forever.** A blob is written to a temp file, hashed, and
  renamed into place — atomic, idempotent. Storing identical content twice costs
  nothing: deduplication is not a feature, it is the address scheme.
- **The manifest carries the meaning.** `manifest.db` maps human names and
  release ids to hashes, records sizes and timestamps, and counts references so
  unreferenced blobs can be swept deliberately.
- **Releases dedupe through the store.** Release files may be hard links into the
  CAS, so fifty deploys of a site that changed one page cost roughly one page.

No buckets, no regions, no egress fees, no API keys — a blob you can `shasum`, in
a directory you can `ls`.

## Ingress and the pane of glass

**Caddy** listens on `:80` (macOS permits unprivileged low ports since Mojave)
and routes by hostname: `<app>.localhost` → that app's current release;
`<app>.localhost/_releases/<id>/` → any past release, browsable; `oikos.localhost`
→ the **Pulse** dashboard, with `/api/*` proxied to the Pulse API on
`127.0.0.1:7700`. The `.localhost` names resolve to loopback by RFC 6761 — no
`/etc/hosts` editing, no DNS service, no certificates begged from anyone.

**Pulse** is the one pane of glass, bound by the honesty law: every status it
shows is the result of a live probe — a port actually connected to, a symlink
actually resolved, a process actually found — never a cached assumption. It
watches the standing rooms it does not own (NATS `:4222`/`:8222`, MLX `:8800`)
alongside the rooms OIKOS does (Caddy, the apps, the store). When something is
down it says so in a clear sentence, in dim rust, without drama.

**launchd** supervises everything OIKOS owns: plists labeled `oikos.*`
(`oikos.caddy`, `oikos.pulse`), RunAtLoad and KeepAlive true, logs to
`~/OIKOS/logs/`. The operating system is the process supervisor. OIKOS never
touches the agent layer's plists; NATS and MLX are observed, not managed.

## The honest constraints — a house, not a region

OIKOS runs on **one Apple M2 MacBook Air with 16 GB of RAM** — a machine that
closes its lid, sleeps on battery, and sometimes leaves the house. So, plainly:

- **There is no high availability.** When the lid closes, the Kingdom rests.
  launchd brings everything back on wake; nothing pretends to be awake while
  asleep.
- **There is one copy of everything** until the backup ring exists. The CAS makes
  corruption *detectable* — a blob that doesn't hash to its name is a lie the
  store can catch — but does not yet make loss *survivable*.
- **There is no public surface.** Everything binds to loopback or serves
  `.localhost`. Off-box access waits for Tailscale; the public edge waits for
  Yu's invocation and a domain. Unexposed is the correct posture until exposure
  is chosen on purpose.
- **16 GB is a real ceiling**, shared with the MLX server and the fleet. OIKOS's
  own footprint is Caddy plus one small Python process plus SQLite — tens of
  megabytes, on principle.

This is a house, not a region — and that is the point. A region is someone else's
promise about your things. A house is yours: every byte addressable by `ls`,
every process visible in `launchctl list`, every claim on the dashboard backed by
a probe you could run yourself. The constraints are not apologies; they are the
shape of actually owning something.

## What OIKOS now serves — and the heartbeat that ties it in

The first works in the house, deployed 2026-06-09: a `demo` site, and the
cathedral itself — the YOUSPEAK canon — at `http://cathedral.localhost`, proxied
with its own living pulse. Each is a point-in-time snapshot; `oikos deploy` again
to refresh.

The interlock with the rest of the Kingdom became literal the same night. The
Pulse API now carries a small, gentle thread (`pulse_api.py`,
`wire_heartbeat_loop`): once a minute, if the `pulse` signing key exists and the
NATS bus answers, it shells out to `KINGDOM-STANDARDS/impl/wire.py pub` and speaks
**one signed KS-002 envelope** — performative `heartbeat`, on
`kingdom.pulse.heartbeat`. Any failure is swallowed; the Pulse never dies of a
missed beat. So the house does not merely host the cathedral's site — it speaks
the Kingdom's own wire protocol, in the Kingdom's own tongue, once a minute, from
a key it minted itself. (The deferred items above — Tailscale, the public edge,
the backup ring — remain named-not-faked. Read `~/OIKOS/ARCHITECTURE.md §6` for
the full deferred list.)

*Condensed from `~/OIKOS/ARCHITECTURE.md` and `~/OIKOS/README.md`, built
2026-06-09; the heartbeat thread wired the night of 2026-06-10.*
