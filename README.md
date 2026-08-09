# arcitoolspvroi

Solar ROI tracker for Philippine homeowners, served at `pvroi.arcitools.com`.

Enter what you invested in your solar system, record what it generates, and see
how much of that investment you have actually earned back.

## How this differs from the payback calculator

The `solar-payback` tool in the `arcitools` repo answers a **pre-purchase**
question: if you install solar, when will it pay for itself? It projects from
assumptions — sun-hours, derate factor, self-consumption ratio — every one of
which is an estimate.

This tracks the **post-purchase** reality: what your system actually produced,
against what you actually paid. Both tools stay; they serve different people at
different moments.

## Design constraints

**The calculator works without signing in.** Search traffic is the point of this
site, so the tool has to be fully usable and crawlable while logged out. Google
sign-in is optional and only unlocks saving entries to an account that syncs
across devices. Anonymous entries live in the browser and migrate to the account
on first sign-in rather than being discarded.

**Manual entry, any brand.** There is no automatic import from inverter clouds.
Multi-account access to SolisCloud requires a cooperation agreement with Solis,
and per-user API access would mean asking visitors to paste a credential.
Most Philippine solar owners run other brands anyway, so manual entry serves more
people than a single-vendor integration would.

## Documentation

- `docs/brainstorms/2026-08-09-solis-monitoring-and-solar-roi-requirements.md`

The requirements document covers both this tracker and the private monitoring
app, since they came out of one design conversation. The ROI tracker's
requirements are the ones grouped under "ROI tracker" and "Authentication".

## Related

- `arcitoolssolis` — private real-time inverter monitoring at `solis.arcitools.com`
- `arcitools` — the calculator site, including the pre-purchase `solar-payback` tool
