---
date: 2026-08-09
topic: solis-monitoring-and-solar-roi
---

# Solis monitoring and solar ROI — requirements

## Summary

Two products. `solis.arcitools.com` is a private dashboard where pressing sync
triggers a live Modbus read of the owner's inverter and returns the value in
about a second. `pvroi.arcitools.com` is a public tracker where any solar owner
records what they invested and what their system produces, and watches actual
payback accumulate.

---

## Problem Frame

The SolisCloud app shows data that is up to five minutes old. That is not an app
defect — the datalogger uploads to Solis on a five-minute cycle, so the cloud has
nothing fresher to serve. Every consumer of that cloud inherits the delay.

The inverter itself answers Modbus TCP queries on the local network in under a
second. Reading it directly during this brainstorm returned battery SOC, PV
yield, grid import, and the inverter's own clock, all current. The distance
between one second and five minutes is the entire reason to build the monitor.

The deeper complaint is not latency but ambiguity: the Solis app never says how
old its numbers are, so a reading that looks current may be minutes stale. A
dashboard that states the age of what it shows is worth more than one that is
merely faster.

The ROI side has a different gap. The existing `solar-payback` calculator in the
`arcitools` repo projects returns *before* purchase, from editable assumptions —
`sunHoursPerDay: 4.5`, `systemDerateFactor: 0.8`, `selfConsumptionRatio: 0.65`.
Every one of those is a guess. Nothing tracks what an installed system actually
returned, and owners who already spent the money have no way to see whether the
projection held.

---

## Key Decisions

**Both applications run on the home machine; the public server only forwards.**
The inverter sits on a private address unreachable from the internet, and the
home connection has a dynamic public IP. Rather than splitting the system into a
remote server plus a local agent, the applications run beside the inverter and
the public host acts as a front door: it terminates TLS and forwards requests
down a tunnel the home machine opened outbound. This removes the agent protocol
entirely — no command channel, no heartbeat negotiation, no buffering across
disconnects — because the code that serves a request is already on the
inverter's network.

Verified end to end on 2026-08-09: the public host in Singapore served a request
that read the inverter in San Pablo and returned in 608 ms, of which 431 ms was
the inverter read itself. No port forwarding, static IP, or dynamic-DNS was
involved.

**The Modbus connection is held open, not reopened per read.** The RS485 gateway
takes several seconds to accept a new TCP connection. Measured on the same day:
a cold read took 5.3 seconds, while reads over an already-open connection
settled at roughly 0.5 seconds. Reopening per request would miss the
responsiveness target by an order of magnitude.

**Reads only, function 04 only.** Modbus has no authentication, and function 06
and 16 can rewrite inverter configuration including grid parameters. The agent
must be incapable of issuing writes rather than merely declining to — a
narrow protocol on the agent, not a rule someone can relax later. This is also
why the inverter port is never exposed to the internet.

**Every Modbus response is validated before use.** During the brainstorm, two
processes polling concurrently caused the RS485 gateway to return one request's
reply to a different caller, producing a daily-PV figure of 1413.1 kWh. The
gateway multiplexes a single serial bus and cannot serve parallel requests.
Access must be serialized through one connection, each request must carry a
unique transaction ID, and the response's transaction ID, unit ID, function code
and byte count must all match before the values are trusted. Corrupt reads here
are plausible-looking wrong numbers, not errors.

**Two products, two subdomains, two repositories.** The monitor is private,
needs a login, a database and a live agent, and is useless to anyone else
because it depends on hardware inside one house. The ROI tracker is public,
anonymous, static, and valuable to any solar owner. Merging them would put a
login wall in front of a page whose purpose is organic search traffic.

**Both sites authenticate with Google, but they gate differently.** The monitor
is closed: sign-in is required to see anything, and only addresses on an
allowlist are admitted, because it exposes one household's live data. The ROI
tracker stays open: the calculator works fully without signing in, and Google
sign-in only unlocks saving entries to an account. Gating the tracker's
calculator behind a login would hide it from search, which is the traffic it
exists to earn.

**The ROI tracker stores anonymous entries in the browser and signed-in entries
on the server.** Anonymous visitors keep working against browser storage, so the
tool is useful on first visit with no friction. Signing in migrates those local
entries to the account and syncs them across devices, which matters for data a
user adds monthly over several years and would otherwise lose by clearing their
browser or switching phones.

**The ROI tracker does not integrate with SolisCloud.** Automatic import would
require either a formal cooperation agreement with Solis for multi-account
OAuth, or asking each visitor to file a support ticket for their own API key and
then paste a secret into the site. The first is outside the project's control;
the second creates a credential-custody liability. Most Philippine solar owners
run other brands regardless, so manual entry serves more people than a
Solis-only import would.

---

## Actors

- A1. Owner — the single authenticated user of the monitor.
- A2. Visitor — a user of the public ROI tracker, anonymous or signed in.
- A3. Monitor application — runs on the home machine, speaks Modbus to the
  inverter, and stores history locally.
- A4. Public host — terminates TLS for both domains and forwards requests down
  the tunnel. Holds no application data.
- A5. Inverter — the Solis hybrid unit, reachable only on the local network.

---

## Key Flows

- F1. On-demand sync
  - **Trigger:** A1 presses sync in the dashboard.
  - **Actors:** A1, A4, A3, A5
  - **Steps:** Public host forwards the request down the tunnel; the application
    performs a validated Modbus read over its open connection; values return the
    same way; dashboard renders them with an age of roughly one second.
  - **Outcome:** Displayed values were measured after the press, not before it.
  - **Covered by:** R1, R2, R7, R8, R10

- F2. Background sampling
  - **Trigger:** The sampling interval elapses.
  - **Actors:** A3, A5
  - **Steps:** The application reads the inverter, timestamps the sample, and
    appends it to local history.
  - **Outcome:** Continuous history exists whether or not anyone is watching,
    and regardless of whether the tunnel is up.
  - **Covered by:** R3, R9, R10

- F3. Recovery after the public IP changes
  - **Trigger:** The ISP assigns a new public address, silently killing the
    tunnel.
  - **Actors:** A3, A4
  - **Steps:** Keepalives stop being acknowledged; the tunnel tears down and
    redials from the new address; the public host resumes forwarding.
  - **Outcome:** Remote access resumes without intervention, and sampling was
    never interrupted because it does not depend on the tunnel.
  - **Covered by:** R4, R5, R6

- F4. Tracking actual return
  - **Trigger:** A2 records a period's generation on the ROI tracker.
  - **Actors:** A2
  - **Steps:** Visitor enters total investment once, then adds generation
    figures per period; the tracker computes cumulative savings against their
    electricity rate and shows progress toward break-even.
  - **Outcome:** Payback is measured from entered readings rather than projected
    from assumptions.
  - **Covered by:** R13, R14, R15, R16, R20, R21

---

## Requirements

**Connectivity**

- R1. The home machine holds an outbound tunnel to the public host, through
  which all public traffic is forwarded.
- R2. A sync request completes end to end in about one second under normal
  conditions.
- R3. The application samples the inverter on a recurring interval independent
  of any user action.
- R4. The tunnel detects a silently dropped link within roughly thirty seconds
  and reconnects automatically, backing off so repeated failures do not hammer
  the host.
- R5. The tunnel restarts on machine boot without anyone logging in.
- R6. The forwarded port binds to the public host's loopback interface only, so
  the application is reachable through the web server and never directly from
  the internet.

**Data integrity**

- R7. The application issues only Modbus function 04 reads and has no code path
  capable of writing to the inverter.
- R8. Every response is validated on transaction ID, unit ID, function code and
  byte count before its values are used; a failed check discards the response
  and retries.
- R9. Modbus access is serialized so that no two requests are ever in flight
  against the gateway at once.
- R10. The Modbus connection is held open across reads and re-established only
  after a failure.

**Monitoring dashboard**

- R11. Every displayed reading shows how old it is, and the dashboard visibly
  distinguishes a live value from a stale one.
- R12. When the agent is disconnected, the dashboard says so rather than
  presenting the last known values as current.


**ROI tracker**

- R13. A visitor enters total investment once and generation figures per period.
- R14. The tracker computes cumulative savings and remaining time to break-even
  from entered data.
- R15. The calculator produces results without signing in, and its content is
  reachable by search engines.
- R16. Anonymous entries persist in the visitor's browser between visits.
- R17. The tracker works for any inverter brand, since all input is manual.

**Authentication**

- R18. Both sites sign users in with Google; neither stores a password.
- R19. The monitor admits only addresses on an allowlist and shows nothing to
  anyone else, signed in or not.
- R20. Signing in on the tracker is optional and unlocks saving entries to an
  account that syncs across devices.
- R21. Entries created anonymously migrate to the account on first sign-in
  rather than being discarded.
- R22. A session survives closing the browser, so neither site demands a fresh
  sign-in on every visit.

**Security**

- R23. No inbound connection to the home network is ever required, and the
  inverter's Modbus port is never exposed to the internet.

**Storage and retention**

- R24. Samples are kept at full resolution for 48 hours, condensed to
  one-minute averages from two to thirty days, and kept as daily totals
  thereafter.
- R25. Roll-up runs automatically so storage reaches a steady state rather than
  growing without bound.
- R26. Daily totals are never discarded, since the ROI history depends on them.

---

## Acceptance Examples

- AE1. Sync while the inverter is unreachable
  - **Covers R11, R12.**
  - **Given** the inverter has not answered for two minutes,
  - **When** the owner presses sync,
  - **Then** the dashboard reports the inverter as unreachable and does not
    present the last stored reading as a current one.

- AE2. Public IP rotates mid-session
  - **Covers R4, R5.**
  - **Given** the tunnel is up and the application is sampling,
  - **When** the ISP assigns a new public address,
  - **Then** the tunnel redials within roughly thirty seconds, and history shows
    no gap because sampling never depended on it.

- AE3. Gateway returns a mismatched response
  - **Covers R8, R9.**
  - **Given** a response arrives whose transaction ID does not match the request,
  - **When** the agent processes it,
  - **Then** the response is discarded and retried, and no value from it reaches
    storage or the dashboard.

- AE4. Reading the inverter while the owner is away from home
  - **Covers R1, R2, R23.**
  - **Given** the owner is on mobile data, far from the house,
  - **When** they press sync,
  - **Then** a fresh reading returns, having travelled through the tunnel the
    home machine opened, with no inbound access to the home network.

---

## Scope Boundaries

**Deferred for later**

- Historical charting beyond what daily roll-ups support.
- Alerting on conditions such as battery depletion or generation loss.
- Importing the owner's own SolisCloud history to backfill the period before
  this system existed.

**Outside this product's identity**

- Monitoring for other people's inverters. Each would require an agent inside
  their own network, which makes this a multi-tenant product with agent
  distribution and support obligations.
- Any control of the inverter. This reads; it does not adjust charge schedules,
  working modes or grid settings.
- Replacing `solar-payback` in the `arcitools` repo. That tool answers a
  pre-purchase question and keeps its audience and its rankings.

---

## Dependencies / Assumptions

- The home machine must be powered and awake for both applications. The owner's
  desktop runs continuously and is the intended host. Neither application should
  depend on anything specific to that machine, so relocating to a small
  always-on device later is a configuration change rather than a rewrite.
- The inverter's local address is currently DHCP-assigned and could change. A
  DHCP reservation pinning it should be in place before the application depends
  on it.
- Home-line uptime becomes the availability ceiling for both sites. For the
  private monitor this costs little, since an outage that hides the dashboard
  usually also means the owner is home. For the public tracker it is a real
  cost: outages and residential upload speeds affect search rankings, and the
  option of moving that site back to the public host should stay open.
- Both subdomains already resolve to the public host, so certificate issuance
  can proceed there. Certificates live on the public host; the home machine
  never handles them.
- The database runs on the home machine alongside the applications. The public
  host stores no application data, which keeps it small enough to remain within
  the existing monthly budget.
- Retention still matters despite ample disk at home, because unbounded
  high-frequency samples slow queries long before they exhaust storage.
- Google OAuth credentials must exist before either site can authenticate. They
  are created in the Google Cloud console against a project the owner controls,
  and each site needs its own redirect URI registered. This is an external
  dependency the build cannot satisfy on its own.
- Adding accounts to the ROI tracker means it needs server-side storage and can
  no longer be a purely static site, which is a departure from how the other
  calculators are built.

---

## Outstanding Questions

**Deferred to planning**

- The battery power register's sign convention is unconfirmed. Observed values
  were negative while the reported daily discharge total stayed at zero, so
  negative may indicate charging rather than discharging. A longer observation
  across a clear charge and discharge cycle will settle it.
- Which register set the dashboard surfaces beyond the confirmed core of PV
  input, AC output, battery state, grid exchange, temperature and frequency.

---

## Sources / Research

- Live device readings taken during the brainstorm confirmed the Solis 33xxx
  input-register map over function 04: PV yield, house load, grid import,
  battery state of charge and health, inverter clock, temperature and grid
  frequency. Function 03 returns an illegal-address exception throughout.
- The inverter's own clock runs a few minutes fast against real time, which is
  worth correcting and worth remembering when interpreting its timestamps.
- Register 33022 onward holds the inverter's real-time clock, which is how the
  register map's alignment was confirmed.
- `arcitools` repo, `src/data/solar-presets.ts` — the assumption set the ROI
  tracker replaces with measured values, and the source of the default
  electricity rate.
- `arcitools` repo, `src/data/meralco-rates.ts` — rate component breakdown,
  including the note that exported energy is credited near the generation charge
  rather than the retail rate.
- `arcitools` repo, `docs/brainstorms/2026-04-13-arcitools-multi-tool-server-brainstorm.md`
  — the standing decision that the calculator site stays static with no backend,
  which is why the monitor lives outside it.
- SolisCloud Platform API documentation — third-party multi-account access
  requires a cooperation agreement with Solis; single-account access requires a
  per-user approval request.
