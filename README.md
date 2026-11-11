# Olivaw Fleet

A live fleet dashboard for robots at a warehouse site, built for the Olivaw Engineering Challenge.

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # Vitest – business rules + ingestion
npm run build
```

You'll need Node 18+. There's no backend, no database and no API keys – it all runs in the browser.

I used AI to help write the documentation.

## What's in here

I spent most of my time on part 3, the UI. Parts 1 and 2 are in there too, just slimmer. I didn't want to skip them, because a dashboard fed by perfectly clean fake data doesn't really prove anything. Real telemetry is messy: robots drop off, messages show up twice or in the wrong order, batteries die. I wanted the UI to have to deal with that.

So there are three pieces:

- `src/simulator/` – 12 robots at one site. They drive between waypoints, head to a charger when they drop under 15%, and now and then fault or lose connection. The "network" is flaky on purpose: roughly 1% of messages get duplicated and a few come through malformed. Each robot reports about once a second, with some jitter.
- `src/server/` – the ingestion side. Validation, dedup by sequence number, latest state per robot, an event log, and the health rules. Plain JS, no React anywhere in it.
- `src/components/` – the UI itself: a fleet overview, plus a minimal robot page (ID and condition) that the overview links to.

The only place these touch is `src/api/fleetApi.js`. The UI only ever calls `subscribe` and `getSnapshot`. If this were hooked up to a real backend, I'd rewrite those two functions on top of a WebSocket or SSE stream and leave the components alone.

## What I think a fleet manager actually needs

The brief tells you what the system is for and leaves the rest up to you. So I kept coming back to one question: if I'm the person watching this fleet, what do I need to know right now?

On the overview, my answers were:

1. **Is anything wrong?** A card at the top says how many robots need attention, coloured by the worst problem (red for critical, amber for warnings, green when all is fine), with a bar showing the split. Next to it, four tiles count how many robots are driving, idle, charging and stopped. Stopped turns red when it isn't zero.
2. **Which robots, and why?** The table puts the most urgent robot at the top, then sorts by lowest battery. Flagged robots say *why* in plain English ("Battery low", "No contact for 2 min") instead of just turning red. Clicking an activity tile filters the table to that activity, and a checkbox narrows it to robots that need attention. The two filters combine.
3. **What just happened?** A feed of recent events.

Clicking a robot opens its own page, which for now only shows its ID and condition (e.g. "Critical: Fault: BATTERY_DEPLETED, Battery critical").

## Some decisions worth explaining

**The server decides what counts as "bad".** Severity and reasons come out of `assess()` in `status.js`, and the components just display what they're given. That keeps all the thresholds in one place, and they're tested.

**Liveness goes off when the server got the message, not the robot's timestamp.** Robot clocks drift, and what the person watching actually cares about is whether we're hearing from the robot *now*. After 5 seconds of silence a robot is stale; after 30 it's offline. Silence doesn't send any messages, obviously, so a `sweep()` runs every second to re-check everyone.

**Duplicates and out-of-order messages.** If a message's sequence number and timestamp are both no newer than the last one I accepted, it gets dropped. The one exception: a lower sequence number with a *newer* timestamp is treated as a reboot (the counter reset), so the robot doesn't get ignored forever.

**Charging turns off battery warnings.** A robot sitting at 12% while plugged in isn't a problem, so it shouldn't look like one.

**Snapshots are batched.** 12 robots at 1 Hz would be about 12 React renders a second, which is pointless. The store rebuilds an immutable snapshot at most every 250 ms, and the UI reads it with `useSyncExternalStore`. No tearing, and no state library needed.

**Events fire on transitions, not levels.** "Battery low" gets logged once when the robot crosses the threshold, not on every message after that.

**React Router, but no state or chart libraries.** Routes are declared in one table (`src/routes.jsx`) and URLs are built through `src/paths.js`.

## What I faked or skipped

| Faked or skipped | Why |
| --- | --- |
| Network transport | Messages get serialised to JSON and delivered with `setTimeout` plus random latency. That gives you the parts that actually matter (delay, reordering, duplicates) without standing up any infrastructure. |
| Persistence | Everything lives in memory. Reload and you start over. The brief is about what's happening right now, and a database would've been extra setup that doesn't change the UI at all. |
| Battery drain speed | Sped up so a full charge cycle takes minutes, not hours. Otherwise you'd never see one during a review. |
| Auth, multi-tenancy, roles | Too much for a few hours, and none of it changes the core design. |
| Sending commands (pause, send to charger) | Commands bring up real safety and acknowledgement questions, and I didn't want to wave those away with a button. I kept it read-only on purpose. |
| Acknowledging and assigning alerts | This is what I'd build next – more on that below. |
| Floor map, obstacles, pathfinding | Robots just drive in straight lines between random points. Every message carries a position, but the UI doesn't show it yet. |
| TypeScript | Stuck with plain JS to keep things small. The telemetry contract is checked at runtime in `validateTelemetry`. |

## If I had more time (or this was going to production)

- **Multiple sites:** the brief only needs one, so the UI shows a single site. The store and simulator already work from a list of sites (`src/server/sites.js`) and every message carries a `siteId`, so the next step is a site switcher with per-site health at a glance, plus `/site/:siteId` routes.
- **Ingestion:** robots publish over MQTT, and an ingestion service validates against a shared schema (protobuf or JSON Schema) and writes to a stream.
- **Storage:** latest state in Redis, history in a time-series DB like TimescaleDB, downsampled for longer ranges.
- **Push:** send clients just the *changes* over a WebSocket, scoped to whichever sites they're allowed to see, rather than whole snapshots.
- **Alerting:** add hysteresis/debounce so a battery hovering around 20% doesn't keep flapping. Let people acknowledge and assign alerts, set thresholds per site or per robot model, and get notified about critical stuff.
- **Scale:** once you're at thousands of robots you'd want a virtualised table and filtering/sorting done on the server.
- **Robot detail:** the robot page only shows ID and condition today. It should grow into a full view: current battery, activity and position, a battery chart over the last few minutes (with gaps where telemetry stopped), the robot's recent path on a floor map, and its own event log.
- **History:** fleet-wide trends like availability and time spent in fault.
- **Testing:** component tests for the overview's sorting and filtering, and an end-to-end test that cuts a robot's connection and checks the UI notices within 30 seconds.

## Layout

```
src/
  api/          fleetApi.js (the boundary), React context + hook
  server/       status.js (rules), fleetStore.js (ingestion + storage), sites.js, tests
  simulator/    simulator.js
  components/   FleetOverview, FleetSummary, RobotTable, RobotDetail, EventList, Bits
  utils.js     display formatting only
```
