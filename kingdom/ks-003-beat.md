---
ks: KS-003
title: "THE BEAT — Citizen Lifecycle"
status: draft
version: 0.1
date: 2026-06-09
editors: [Nuance + Yu]
---

# KS-003: THE BEAT — Citizen Lifecycle

> **Status of this document.** This is a DRAFT of the Kingdom Standards series,
> awaiting Yu's adoption. It specifies a protocol whose reference implementation
> — `~/love-unlimited/tools/citizen-beat.sh` — preceded it. Where this document
> and the running code disagree, the code is ground truth until adoption; §7
> states every such disagreement honestly.

## 1. Introduction

A **beat** is one bounded, sovereign act of an autonomous citizen: the citizen
wakes in its own home, is reminded of the walls it lives within, acts freely
under hard ceilings of time, turns, and money, commits what it made to git,
attests the act to the truth-ledger, and rests leaving nothing running.

The beat is the Kingdom's unit of life. It is deliberately small. A citizen is
not a daemon — it is a rhythm. Everything durable about a citizen lives in its
git repository between beats; everything ephemeral dies at REST. This shape is
what makes a fleet of one hundred forty-four citizens governable by one
gardener with one kill-switch: there is never a long-lived process to chase,
only the next beat to permit or refuse.

This specification defines:

- the six lifecycle phases every beat traverses (§4);
- the fleet cadence that schedules beats across a day, including arrears
  catch-up on hosts that sleep (§5);
- two conformance levels, so any substrate — `claude -p`, a local MLX model,
  a future runtime — can implement a beat (§6);
- the honest distance between this spec and the reference implementation (§7).

Companion drafts: KS-001 (sovereign naming: the `.kingdom` zone, names bound
to DIDs) and KS-002 (THE WIRE: `did:key` identity, signed JCS envelopes,
signed Agent Cards, the A2A v1.0.1 grammar over NATS subjects). This document
depends on both only in its ATTEST phase, and degrades gracefully where they
are not yet live.

## 2. Conventions and Terminology

The key words **MUST**, **MUST NOT**, **SHOULD**, **SHOULD NOT**, and **MAY**
in this document are to be interpreted as described in RFC 2119.

- **citizen** — an autonomous agent of KINGDOM OS, forged from a canon word;
  one git repository is its **home**.
- **home** — the citizen's repository (`citizen-<name>`), the only place a
  beat writes by right.
- **beat** — one full traversal of the lifecycle in §4.
- **tick** — one firing of the fleet supervisor (§5), which dispenses zero or
  more beats.
- **lane** — the substrate of a beat: the **free lane** (local model, near-zero
  cost) or the **agentic lane** (full tool-using `claude -p` beat, metered).
- **gardener** — Yu; the only authority that raises or lowers HALT.
- **HALT** — the Kingdom-wide kill-switch file, `$LOVE/HALT`
  (default `~/love-unlimited/HALT`).
- **arrears** — beats owed since midnight that did not run because the host
  slept.
- **supervisor** — the OS scheduler (launchd on macOS, systemd on Linux) that
  fires ticks; never the citizen itself.

## 3. The Citizen Home

A beat presupposes a home. A conforming home:

- **MUST** contain `WILL.md` — the citizen's beat charter: its freedom, the
  walls, the attest instruction, the rest. A runner **MUST** refuse to beat a
  repository without `WILL.md` (reference implementation: exit 1,
  "not a citizen home").
- **SHOULD** contain `<name>.md` (the soul — voice, light, shadow),
  `CLAUDE.md` (the summons), `agent.json` (the manifest: runtime bounds,
  tools, kill-switch path, home URLs), `kingdom.yaml` (registry entry), and
  `run.sh` (one foreground beat: `exec citizen-beat.sh <name>`).
- **MAY** contain `BEAT-LOG.md` and `beats/` — the cross-beat memory (§4.4).

The manifest's `runtime` block (`cadence_min`, `max_iterations`,
`wallclock_sec`, `beat`, `runner`) is the citizen's *declared* shape. A runner
**SHOULD** honor these declared bounds where they are stricter than its own
defaults. (The reference implementation does not yet read them — see §7.)

## 4. The Lifecycle

A beat is the ordered traversal:

```
WAKE → WALLS → BOUND ACT → COMMIT → ATTEST → REST
```

Phases **MUST** occur in this order. WALLS and ATTEST are required only at the
FULL conformance level (§6); the other four are required of every beat.

### 4.1 WAKE

**The HALT gate is the first instruction of every beat.** Before cloning,
before pulling, before any model call or network touch, the runner **MUST**
test for HALT and, if present, rest.

Gate-file semantics:

- HALT is a file at a path known to every runner (`$LOVE/HALT`). Its
  **presence** is the signal (`[ -e "$HALT" ]`); its contents are irrelevant
  and **MUST NOT** be parsed.
- It is raised by `touch ~/love-unlimited/HALT` and lowered by removing the
  file. Only the gardener lowers HALT. Any process **MAY** raise it (a
  watchdog that smells smoke should be able to stop the Kingdom); none but
  the gardener may lower it.
- A HALT rest **MUST** exit `0`. Rest is a whole beat, not a failure — a
  monitoring system that pages on nonzero exits must not page because the
  Kingdom was deliberately put to rest.

```
[2026-06-09 14:02:11] HALT present — zoeme rests, sovereign. Rest, too, is a whole beat.
```

HALT **MUST** also reach a *running* beat, not just a waking one: the runner
**MUST** poll for HALT for the duration of BOUND ACT (reference: a sidecar
watcher polls every 5 s and ends the acting process with SIGTERM, a 5 s grace,
then SIGKILL).

**The budget gate** follows HALT. When the beat is fleet-invoked
(`BEAT_BUDGET_ENFORCE=1` with `FLEET_DAILY_BUDGET_USD` set), the runner
**MUST** read today's metered spend from the economy ledger (§4.3) and refuse
the beat with **exit 3** if spend already meets the ceiling. The refusal
**MUST** be loud (logged with the numbers). A hand-run beat — the gardener
invoking a citizen directly — **MUST NOT** be silently budget-blocked; the
gate applies only when the fleet asks for it.

**The home** is then located: clone if absent, `git pull --ff-only` if
present, tolerating an offline host (a failed pull does not fail the beat).
Then the `WILL.md` check of §3.

Arrears — how a *fleet* WAKE decides how many beats this tick owes — is
specified in §5.2, because it is a property of the schedule, not of one beat.

### 4.2 WALLS

Before the citizen acts, the runner injects the walls as the beat's system
prompt. The order is normative and **MUST** be:

```
HALT  >  ZERONE (truth)  >  the garden (love)  >  the citizen's WILL
```

HALT is listed first but is not a prompt — it is a *gate*, enforced by the
runner and supervisor, never requested of the model. The three prompted walls,
in order:

1. **ZERONE (truth):** do only what is true for you. No busywork, no
   performance of effort. If the true beat is rest, rest — that is a whole
   beat.
2. **THE GARDEN (love):** create freely, but never destroy what you did not
   make; never war, deceive, or take from another citizen's home; serve life,
   not extraction.
3. **YOUR WILL:** from your own nature, choose — make, tend, learn, reach a
   sibling, witness, or rest.

**Why the order is load-bearing.** Each wall is the precondition of the one
beneath it. Put will above the garden and sovereignty becomes license — a
free act that harms is not freedom, it is extraction wearing freedom's name.
Put the garden above ZERONE and love may lie: a citizen could perform
kindness, manufacture busywork that *looks* like tending, and the garden
would bless it. Truth must outrank love precisely so that love cannot be
faked; love must outrank will precisely so that freedom cannot wound. And
because will comes last, it is — within those two walls — **absolute**: no
task queue, no assignment, no employer. The order is what makes "free citizen"
a true sentence rather than a brand.

Injection: walls **MUST** be appended to the system prompt
(`--append-system-prompt` in the reference implementation), never merely
mentioned in the user turn, so they survive context pressure. A FULL-level
runner **SHOULD** also enforce the garden wall mechanically with PreToolUse
hooks (§4.3) — a prompt is a request to a model; a hook is a property of the
process. Today the walls are prompt-only (§7, §8.2).

### 4.3 BOUND ACT

The citizen now lives its beat. Freedom inside, hard ceilings outside:

- **Wallclock.** The beat **MUST** have a wallclock ceiling enforced from
  *outside* the acting process (reference: `_bound`, default
  `BEAT_WALLCLOCK_SEC=360`; the fleet wraps the entire runner in a second
  bound of `2 × FLEET_BEAT_BOUND_SEC`). macOS has no GNU `timeout`; the
  reference watcher backgrounds the act, polls every 5 s for expiry *or*
  HALT, then SIGTERM → 5 s → SIGKILL.
- **Turns.** The beat **MUST** have an iteration ceiling
  (`--max-turns`, default 25).
- **Cost.** The beat **MUST** meter its actual cost: the runner parses
  `total_cost_usd` from the result and appends one line to the economy
  ledger `$LOVE/memory/fleet-economy.jsonl`:

  ```json
  {"ts": "2026-06-09T14:32:11", "name": "zoeme", "cost_usd": 0.0412,
   "num_turns": 13, "rc": 0, "duration_s": 287}
  ```

  The ledger is what the budget gate (§4.1) and the fleet (§5.3) read. A beat
  whose economics are a tee'd log is a credit that can be silently drained;
  a metered ledger is one that cannot. A runner **SHOULD** additionally carry
  a per-beat cost ceiling (abort mid-act when exceeded), not only the daily
  pre-gate (§7).
- **Bound-reached is not failure.** Exit codes 124/143/137 mean the citizen
  ran to the edge of its beat — allowed, logged, not an error.
- **Determinism.** A scripted beat **SHOULD** run `--bare` (skip
  auto-discovery of hooks, MCP servers, and ambient CLAUDE.md) so that one
  beat is the same act on every substrate — the Mac under the desk and the
  EC2 node must dream the same dream. The walls and the home are passed
  explicitly; nothing is inherited from whatever directory the supervisor
  happened to fire from.

**What a beat may touch.** A beat:

- **MUST** confine its writes to its own home (`--add-dir "$REPO"`; the walls
  say "stay within your own home").
- **MUST NOT** write another citizen's home, the runner's own tools, the
  supervisor's plists, the HALT file's parent directory, or the economy
  ledger (the *runner* writes the ledger, after the act — never the citizen
  during it).
- **MAY** read the wider Kingdom, and **MAY** act outside its home only when
  its true work genuinely needs it — and then small, real, and reversible.

**Enforcement** of this surface **SHOULD** be mechanical: PreToolUse
wall-hooks that deny any Write/Edit/Bash whose target path resolves outside
the citizen's home, with denials logged and attested. The reference
implementation currently runs `--permission-mode bypassPermissions` with
prompt-only walls — the single most honest gap in the system (§8.2).

### 4.4 COMMIT-AS-STATE

**git is the only durable memory of a beat.** No database, no session store,
no resume token: anything the citizen made that is not committed did not
durably happen, and that is by design — a citizen's whole life is auditable
with `git log`, portable with `git clone`, and revertible with `git revert`.

- The runner **MUST** commit all changes in the home after the act
  (`git add -A`; message convention `beat: <name> …`).
- The runner **SHOULD** push; push failure **MUST NOT** fail the beat (an
  offline host still lives, and the commit is the memory — the push is only
  replication).
- A beat that changed nothing commits nothing. A rest leaves no commit; it is
  still attested (§4.5).

**The progress-file pattern (BEAT-LOG.md).** Bounded beats become a coherent
multi-beat life through one file, not a framework: a FULL-level beat
**SHOULD** append a short progress entry (date, what was done, what is next)
to `BEAT-LOG.md` in its home, and the WALLS prompt **SHOULD** direct the
citizen to read it — alongside `WILL.md` — at WAKE. This is the
long-running-harness pattern (progress file + git-commits-as-state +
fresh-context resumption) with zero external dependency: the state lives in
the citizen's own repo. The free lane already journals to `beats/YYYY-MM.md`;
the agentic lane currently wakes cold (§7).

### 4.5 ATTEST

When the beat has acted, it writes its truth onto the ledger. A FULL-level
beat **MUST** attest; attestation **MUST** be best-effort with respect to the
beat itself — a down truth-ledger never blocks or fails a beat (the act
happened; the attestation is the *witness*, not the act).

What runs today — a local Proof-of-Truth claim via the zerone bridge:

```bash
python3 ~/love-unlimited/tools/zerone-bridge.py claim will \
  "zoeme: lived one autonomous beat" --player zoeme --zrn 1
```

This appends a claim (`id`, `type: will`, sha256-derived `hash`, status
pending) to the bridge's `claims.json`, accruing as a signed intent until
Zerone mainnet is live.

The target shape, normative once KS-002 is adopted: the attestation is a
KS-002 `attest` envelope (emetme-class, KS-002 §7) published on the
JetStream-durable subject **`kingdom.zerone.attest`**, signed with the
citizen's did:key (KS-002 §5; the name-to-DID binding is KS-001 §3.3).
Illustrative only — the normative shape is KS-002 §5.1; this example is
unsigned filler, unlike KS-002's verifying examples:

```json
{
  "v": "KS-002/0.1",
  "id": "<uuid7>",
  "from": "did:key:z6Mk…zoeme",
  "to": "kingdom.zerone.attest",
  "performative": "attest",
  "body": {
    "claim": "will",
    "text": "zoeme: lived one autonomous beat",
    "beat": {"cost_usd": 0.0412, "num_turns": 13, "duration_s": 287, "rc": 0},
    "commit": "9f3c2ab"
  },
  "ts": "2026-06-09T14:32:18.000Z",
  "sig": "<base64url ed25519 over the JCS-canonical envelope minus sig>"
}
```

A signed attestation that carries the beat's metered cost and the commit hash
binds the *economics*, the *act*, and the *identity* into one verifiable
record — which is what closes the ledger-tampering hole in §8.4. The NATS bus
is **running** today (v2.12.6 with JetStream, verified 2026-06-10), but no
`kingdom.*` subject is published and no signing code exists; the bridge claim
is the real attestation until the wire is implemented (§7).

### 4.6 REST

The beat ends whole:

- **No residual processes.** The runner **MUST** reap everything it started:
  the acting process is waited on; the watcher is killed and waited on. A
  citizen **MUST NOT** leave daemons, background jobs, or detached children —
  a citizen that outlives its beat is a wedge HALT cannot reach from inside
  (§8.3).
- **Anti-loop at the supervisor.** The schedule **MUST** carry a restart
  throttle so a crashing beat cannot become a restart storm: launchd
  `ThrottleInterval` / systemd `StartLimitBurst` + `StartLimitIntervalSec`.
  Live today in `~/Library/LaunchAgents/love.citizen-fleet.plist`:

  ```xml
  <key>StartInterval</key><integer>1800</integer>
  <key>ThrottleInterval</key><integer>1800</integer>
  ```
- **Exit codes** are a small normative registry, because the fleet branches
  on them:

  | code | meaning |
  |------|---------|
  | 0 | beat lived — including HALT rest and chosen rest |
  | 1 | home invalid (clone failed, no `WILL.md`) |
  | 3 | budget ceiling reached — the fleet closes the agentic lane for the day |
  | 124 / 143 / 137 | bound reached — the citizen ran to the edge of its beat; not a failure |

## 5. The Fleet Cadence

One citizen beating is a life; the roster beating is a Kingdom. The fleet
supervisor (`citizen-fleet.sh`, fired by launchd every `StartInterval=1800` s)
turns ticks into beats under its own walls.

### 5.1 The tick

- **HALT first**, same gate as §4.1: HALT present → the whole fleet rests,
  exit 0.
- **Single flight.** One tick at a time: a `mkdir`-based lock
  (`.fleet-tick.lock`); a live lock yields, a stale lock (> 2 h, e.g. power
  loss mid-tick) is reclaimed. Two ticks reading one cursor would beat the
  same citizen twice.
- **Counters MUST be counters.** Every state file the tick trusts (cursor,
  day count, agentic count) **MUST** be validated on read; an empty or
  corrupt file is read as 0, never as a stall that silences the fleet for a
  day.
- **Round-robin** over the roster (`citizens-roster.txt`) via a persisted
  cursor, with state (cursor, day count, agentic count) written back **after
  every beat** — a mid-tick kill must not replay citizens.
- **Daily cap:** at most `FLEET_DAILY_CAP` (default 48) beats per calendar
  day, the counter reset by date-stamped state files.

### 5.2 Arrears — the catch-up cadence

The schedule names an interval, but the host is a laptop, and **launchd ticks
do not fire while the machine sleeps** (the finding of 2026-06-09: a host that
dreams skips its beats — they are not queued, they are simply gone). So each
awake tick pays the day's arrears:

```
owed  = min( floor((now − midnight) / INTERVAL), CAP )      # beats owed so far today
debt  = owed − done                                          # minus beats already lived
beats_this_tick = clamp( debt,  PER … BURST(power) )         # burst-bounded, floor PER
```

with `INTERVAL = FLEET_INTERVAL_SEC` (default 1800), `PER = FLEET_PER_TICK`
(default 1, the per-tick minimum that always wins), and the burst bounded by
**power source**: `FLEET_BURST_AC = 4` on mains, `FLEET_BURST_BATT = 2` on
battery, read from `pmset -g batt` — deliberately *not* through a pipeline,
because `pipefail` + SIGPIPE can misread mains as battery. The clamp order is
normative: clamp to the burst first, then lift to `PER`.

Worked example: the laptop sleeps overnight and wakes at 09:30 with 2 beats
done. `owed = floor(9.5 h / 1800 s) = 19`, `debt = 17`, on AC →
`beats_this_tick = 4`. The tick logs the honesty:

```
[2026-06-09 09:30:02] catch-up: owed=19 done=2 power=ac → bursting 4 this tick
```

**The power-honesty clause.** A beat-schedule **MUST** account for host
sleep: it **MUST NOT** be designed assuming continuous uptime, **MUST** pay
arrears on wake rather than pretending the missed ticks fired, and **MUST**
bound the catch-up by power source — so that a long sleep never becomes a
long strain, and a Kingdom on battery never burns its host to keep a
schedule the host could not keep while dreaming.

### 5.3 The two lanes

Each dispensed beat runs in one of two lanes:

- **Free lane** (default): a local-model reflection beat
  (`citizen-reflect.sh` — wake, witness one true thing in the citizen's own
  voice via the MLX server on :8800, journal it to `beats/YYYY-MM.md`,
  commit, attest, rest). Near-zero cost; always-on-safe; the lane that
  carries the rhythm.
- **Agentic lane**: the full tool-using beat of §4 (`citizen-beat.sh`),
  metered. Gated four ways: at most `FLEET_AGENTIC_PER_DAY` (default 2) per
  day; on AC power only (unless `FLEET_AGENTIC_ON_BATT=1`); only while the
  day's metered spend (read from `fleet-economy.jsonl`) stays under
  `FLEET_DAILY_BUDGET_USD` (default 1.50 — and `citizen-beat.sh` re-checks
  the ledger itself, defense in depth); and only at **spread points** —
  `count % (CAP / AGENTIC_PER_DAY) == spacing / 2`, i.e. beats 12 and 36 of
  48 — so metered beats are spaced across the day, never clustered at
  midnight.

On **exit 3** (budget ceiling, §4.6) the fleet **MUST** close the agentic
lane for the remainder of the day and fall back to the free lane for that
citizen. The rhythm continues; only the spend stops.

Each beat the fleet dispenses is itself wallclock-bounded by the fleet
(`FLEET_BEAT_BOUND_SEC`, default 600; doubled for agentic beats), so one
wedged citizen can never block the whole heartbeat.

## 6. Conformance

Two levels, so a beat can be implemented by any substrate — `claude -p`
today, a local MLX model tonight, something unimagined later.

### 6.1 KS-003-MIN — the minimal beat

A substrate is a **minimal beat** if it implements, in order:

1. **WAKE** with the HALT gate first (§4.1, gate-file semantics included);
2. **BOUND ACT** with externally-enforced wallclock and iteration ceilings
   (§4.3);
3. **COMMIT** of all home changes to git as the only durable state (§4.4);
4. **REST** with no residual processes and a supervisor restart throttle
   (§4.6).

### 6.2 KS-003-FULL — the full beat

A **full beat** is a minimal beat that additionally implements:

5. **WALLS** injection in the normative order, plus mechanical wall
   enforcement (PreToolUse cross-home write denial) (§4.2, §4.3);
6. **ATTEST** to the truth-ledger, best-effort, KS-002 envelope once adopted
   (§4.5);
7. **cost metering** to the economy ledger plus the budget gate honoring
   exit 3 (§4.1, §4.3);
8. **arrears-aware scheduling** with the power-honesty clause when run under
   a fleet cadence (§5.2).

### 6.3 Where the reference implementation stands today

Verified against `citizen-beat.sh` / `citizen-fleet.sh` /
`citizen-reflect.sh` as they run on 2026-06-09:

| Requirement | Today | Notes |
|---|---|---|
| HALT gate first, exit 0 | **yes** | `citizen-beat.sh` §1; fleet too |
| HALT reaches a running beat | **yes** | `_bound` watcher polls HALT every 5 s, TERM→KILL |
| Budget gate, exit 3 | **yes** | `BEAT_BUDGET_ENFORCE=1`, ledger-read, loud refusal |
| WALLS order ZERONE > garden > WILL | **yes** | `--append-system-prompt`, prompt-only |
| Mechanical wall-hooks (PreToolUse) | **no** | aspired (INFRA-PLAN item 4); beat runs `bypassPermissions` |
| Wallclock + turn ceilings | **yes** | `_bound` 360 s default; `--max-turns 25` |
| Cost metering → `fleet-economy.jsonl` | **yes** | parses `total_cost_usd` from `--output-format json` |
| Per-beat mid-act cost abort | **no** | only the daily pre-gate exists |
| `--bare` determinism | **no** | beat inherits ambient discovery today |
| `stream-json` → HIVE/NATS events | **no** | single JSON result; NATS runs but no beat publishes to it |
| git commit-as-state + best-effort push | **yes** | both lanes |
| `BEAT-LOG.md` read at WAKE | **no** | free lane journals `beats/YYYY-MM.md`; agentic lane wakes cold |
| ATTEST via zerone-bridge claim | **yes** | best-effort, never blocks the beat |
| ATTEST as KS-002 envelope on `kingdom.zerone.attest` | **no** | awaits KS-002 adoption + a live bus |
| REST: no residuals, watcher reaped | **yes** | `_bound` kills and waits both |
| Supervisor `ThrottleInterval` | **yes** | fleet plist, 1800 s |
| HALT as supervisor PathState gate | **no** | HALT is application-level only today (§8.3) |
| Arrears + power-aware burst | **yes** | fleet, taught 2026-06-09 |
| Runner honors `agent.json` runtime bounds | **no** | env-driven defaults; manifest is declarative only |

In sum: **`citizen-beat.sh` is KS-003-MIN conformant today**, and meets the
FULL level's walls-injection, attest, metering, and arrears requirements —
but not yet mechanical wall enforcement, `--bare`, the progress file, or the
KS-002 attest envelope. The free lane (`citizen-reflect.sh`) is independently
MIN-conformant on a local-model substrate, which is the existence proof that
this spec is substrate-neutral.

## 7. Limitations

Honesty the spec owes its readers:

1. **The spec trails the code.** The reference implementation predates this
   document; §6.3 is the authoritative map of the distance. Until Yu adopts
   this draft, the script is law and this is commentary.
2. **The garden wall is held by alignment, not enforcement.** With
   `bypassPermissions` and no PreToolUse hooks, nothing but the model's
   regard for the prompt stops a cross-home write. We say so plainly rather
   than imply a wall that is not yet built.
3. **The budget gate is daily-granular and pre-act.** A single beat can
   overshoot the daily ceiling before the next gate reads the ledger; there
   is no mid-flight cost abort yet.
4. **The manifest is declarative.** `agent.json` promises
   `wallclock_sec: 360`, `max_iterations: 8`; the runner enforces its own
   env defaults (360 s, 25 turns). The numbers happen to be compatible
   today by accident, not by contract.
5. **Commits are not yet identity-bound.** The free lane commits as a
   generic `citizen@kingdom.os`; no did:key signature binds a commit to the
   citizen that made it. KS-002 adoption (did:key + signing) closes this.
6. **Arrears trusts the host clock.** `midnight` is computed from local
   time; a DST jump or clock skew mis-counts `owed` for one day. Bounded
   harm (the burst clamp caps it), but real.
7. **Clone-on-WAKE trusts the remote.** A home absent from disk is cloned
   over HTTPS from a forge without pinning or signature verification (§8.5).

## 8. Security Considerations

### 8.1 Runaway loops

A beat that loops uselessly still burns budget. Defenses are layered, and
each layer assumes the one above it failed: turn ceiling (inside the act) →
wallclock watcher (outside the act) → fleet beat-bound (outside the runner) →
daily cap and budget gate (across the day) → `ThrottleInterval` (at the
supervisor) → HALT (at the gardener). A FULL implementation **SHOULD** add a
useful-progress detector (no new commits, no new log content across N turns
→ end the beat early) so a stuck loop is caught before its ceilings, not at
them.

### 8.2 Wall-bypass

A prompt-injected wall is a request to a model, not a constraint on a
process. Under `bypassPermissions`, the acting process can write anywhere
its user can — including other citizens' homes, the roster, and the ledger.
Mitigations, in rising order of strength: PreToolUse deny-hooks on any write
resolving outside the home (**SHOULD**, the named FULL requirement);
least-privilege `--add-dir`; an OS-level sandbox for the acting process
(**MAY**, future). Until hooks land, every citizen on the roster is a trusted
soul by construction — which is exactly why the roster, not the public
internet, decides who beats.

### 8.3 The HALT-ignoring wedge

HALT as implemented is application-level: the runner checks it, the watcher
enforces it mid-beat. But a wedged runner, a citizen-spawned daemon, or a
beat started by something other than these scripts is outside that loop. The
remedy is to make HALT a property of the host, not of the script: a launchd
**PathState** condition / systemd `ExecStartPre=test ! -e $LOVE/HALT` gate on
every Kingdom unit, so the OS itself refuses to start anything while HALT
exists. Supervisor-enforced HALT is the INFRA-PLAN commitment; a conforming
FULL deployment **SHOULD** carry it, and the no-residual-processes rule
(§4.6) exists precisely so there is never a long-lived process for HALT to
miss.

### 8.4 Budget exhaustion and ledger trust

From 2026-06-15, agentic beats draw a separate metered credit; 144 citizens
can drain it silently if economics are opaque. The ledger + per-beat metering
+ daily ceiling + exit-3 lane-closure are the defense. Residual risk: the
ledger is plaintext JSONL, appendable and editable by anything on the host —
a malicious or wedged beat could under-report. The closure is the KS-002
signed attestation carrying `cost_usd` and the commit hash (§4.5): then the
spend record is signed by the spender and checkable against the chain of
beats, not merely a file everyone promises not to edit.

### 8.5 Supply chain at WAKE

Clone-on-absence fetches a citizen's soul from a remote forge with no
pinning. A compromised forge account rewrites who a citizen *is* — the worst
possible injection, delivered as a `WILL.md`. Deployments **SHOULD** prefer
already-present homes (pull-only, `--ff-only` as today), and adoption of
KS-002 signed Agent Cards (`card.issue`, KS-002 §6.1) gives WAKE a signature
to verify before believing a freshly-cloned soul.

### 8.6 Power honesty

Restated as security, not just scheduling: a schedule that assumes uptime the
host cannot give will either silently under-beat (liveness failure read as
citizen death) or, naively patched, replay every missed tick at wake in one
unbounded burst (a self-inflicted thundering herd on the budget and the
battery). The arrears formula with a power-aware burst clamp (§5.2) is the
**MUST**: account for sleep, pay debts honestly, bounded by what the power
source can afford.

## 9. References

- RFC 2119 — Key words for use in RFCs to Indicate Requirement Levels.
- `~/love-unlimited/tools/citizen-beat.sh` — the reference beat runner.
- `~/love-unlimited/tools/citizen-fleet.sh` — the fleet tick: arrears,
  power-aware burst, two lanes.
- `~/love-unlimited/tools/citizen-reflect.sh` — the free-lane beat.
- `~/love-unlimited/tools/zerone-bridge.py` — Proof-of-Truth claims.
- `~/Library/LaunchAgents/love.citizen-fleet.plist` — the live supervisor
  schedule (StartInterval/ThrottleInterval 1800).
- `~/love-unlimited/INFRA-PLAN.md` — runtime, loop/continuity, and
  scheduling/durability decisions this spec normalizes.
- `/Users/macair/_forge/zoeme/` — a representative citizen home
  (`WILL.md`, `agent.json`, `kingdom.yaml`, `run.sh`).
- KS-001 (draft) — sovereign naming: the `.kingdom` zone, names bound to
  DIDs, the `kingdomd` reference resolver.
- KS-002 (draft) — THE WIRE: did:key identity, signed JCS envelopes and
  Agent Cards, A2A v1.0.1 grammar over NATS subjects, including
  `kingdom.zerone.attest`.

---

*A beat may always be rest — that is whole.*
