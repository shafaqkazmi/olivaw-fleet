import { THRESHOLDS, assess, batteryBand, compareRobots, validateTelemetry } from './status.js';

export function createFleetStore({
  now = () => Date.now(),
  sites = [],
  thresholds = THRESHOLDS,
  eventLimit = 500,
  flushDelayMs = 250,
} = {}) {
  const robots = new Map();
  const events = [];
  const stats = { accepted: 0, rejected: 0, duplicates: 0, lastRejection: null };
  const listeners = new Set();
  let eventSeq = 0;
  let flushTimer = null;
  let snapshot = build();

  function record(robot, severity, message) {
    events.push({ id: ++eventSeq, ts: now(), robotId: robot.id, siteId: robot.siteId, severity, message });
    if (events.length > eventLimit) events.splice(0, events.length - eventLimit);
  }

  function telemetryEvents(robot, prev, cur) {
    if (!prev) return;
    if (cur.state === 'error' && prev.state !== 'error') {
      record(robot, 'critical', `Fault: ${cur.errorCode ?? 'unknown'}`);
    }
    if (prev.state === 'error' && cur.state !== 'error') record(robot, 'ok', 'Fault cleared');
    if (cur.state === 'charging' && prev.state !== 'charging') {
      record(robot, 'ok', `Started charging at ${Math.round(cur.battery)}%`);
    }
    if (cur.state !== 'charging') {
      const before = batteryBand(prev.battery, thresholds);
      const after = batteryBand(cur.battery, thresholds);
      if (after === 'critical' && before !== 'critical') {
        record(robot, 'critical', `Battery critical (${cur.battery.toFixed(2)}%)`);
      } else if (after === 'low' && before === 'ok') {
        record(robot, 'warning', `Battery low (${cur.battery.toFixed(2)}%)`);
      }
    }
  }

  function evaluate(robot) {
    const next = assess(robot.latest, robot.receivedAt, now(), thresholds);
    const prev = robot.assessment;
    robot.assessment = next;
    if (!prev || prev.connectivity === next.connectivity) return;
    if (next.connectivity === 'offline') record(robot, 'critical', 'Lost contact');
    else if (next.connectivity === 'stale' && prev.connectivity === 'online') record(robot, 'warning', 'Telemetry delayed');
    else if (next.connectivity === 'online') {
      record(robot, 'ok', prev.connectivity === 'offline' ? 'Back online' : 'Telemetry resumed');
    }
  }

  function ingest(raw) {
    const result = validateTelemetry(raw);
    if (!result.ok) {
      stats.rejected++;
      stats.lastRejection = result.error;
      return { accepted: false, reason: result.error };
    }
    const msg = result.value;

    let robot = robots.get(msg.robotId);
    if (!robot) {
      robot = { id: msg.robotId, siteId: msg.siteId, latest: null, lastSeq: -1, receivedAt: null, assessment: null };
      robots.set(msg.robotId, robot);
    }

    // A lower seq with a newer timestamp is a reboot (counter reset), not a late message.
    if (robot.latest && msg.seq <= robot.lastSeq && msg.ts <= robot.latest.ts) {
      stats.duplicates++;
      return { accepted: false, reason: 'duplicate or out of order' };
    }

    const prev = robot.latest;
    robot.siteId = msg.siteId;
    robot.latest = msg;
    robot.lastSeq = msg.seq;
    robot.receivedAt = now();

    stats.accepted++;
    telemetryEvents(robot, prev, msg);
    evaluate(robot);
    scheduleFlush();
    return { accepted: true };
  }

  function sweep() {
    for (const robot of robots.values()) evaluate(robot);
    flush();
  }

  function build() {
    const t = now();
    const list = [...robots.values()].map((r) => ({
      id: r.id,
      siteId: r.siteId,
      telemetry: r.latest,
      receivedAt: r.receivedAt,
      ageMs: r.receivedAt == null ? null : t - r.receivedAt,
      assessment: r.assessment,
    }));
    list.sort(compareRobots);

    const bySite = new Map(
      sites.map((s) => [s.id, { id: s.id, name: s.name, total: 0, ok: 0, warning: 0, critical: 0 }]),
    );
    for (const r of list) {
      let site = bySite.get(r.siteId);
      if (!site) {
        site = { id: r.siteId, name: r.siteId, total: 0, ok: 0, warning: 0, critical: 0 };
        bySite.set(r.siteId, site);
      }
      site.total++;
      site[r.assessment.severity]++;
    }

    return {
      thresholds,
      robots: list,
      sites: [...bySite.values()],
      events: events.slice(-200).reverse(),
      stats: { ...stats },
    };
  }

  function flush() {
    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
    snapshot = build();
    for (const listener of listeners) listener();
  }

  function scheduleFlush() {
    if (flushTimer) return;
    flushTimer = setTimeout(flush, flushDelayMs);
  }

  return {
    ingest,
    sweep,
    flush,
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    startSweeping(intervalMs = 1000) {
      const id = setInterval(sweep, intervalMs);
      return () => clearInterval(id);
    },
  };
}
