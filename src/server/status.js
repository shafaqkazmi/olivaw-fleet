export const THRESHOLDS = Object.freeze({
  staleAfterMs: 5_000,
  offlineAfterMs: 30_000,
  batteryLow: 20,
  batteryCritical: 10,
});

const ROBOT_STATES = ['moving', 'idle', 'charging', 'error'];

const SEVERITY_RANK = { ok: 0, warning: 1, critical: 2 };

function severityRank(severity) {
  return SEVERITY_RANK[severity] ?? 0;
}

// Uses server receive time, not the robot's timestamp, because robot clocks drift.
export function connectivity(receivedAt, now, t = THRESHOLDS) {
  if (receivedAt == null) return 'offline';
  const age = now - receivedAt;
  if (age <= t.staleAfterMs) return 'online';
  if (age <= t.offlineAfterMs) return 'stale';
  return 'offline';
}

export function batteryBand(battery, t = THRESHOLDS) {
  if (battery < t.batteryCritical) return 'critical';
  if (battery < t.batteryLow) return 'low';
  return 'ok';
}

export function assess(latest, receivedAt, now, t = THRESHOLDS) {
  const conn = connectivity(receivedAt, now, t);
  const reasons = [];
  let severity = 'ok';
  const raise = (level, code, text) => {
    reasons.push({ code, text });
    if (severityRank(level) > severityRank(severity)) severity = level;
  };

  if (conn === 'offline') raise('critical', 'offline', 'No contact');
  else if (conn === 'stale') raise('warning', 'stale', 'Telemetry delayed');

  if (latest?.state === 'error') {
    raise('critical', 'fault', latest.errorCode ? `Fault: ${latest.errorCode}` : 'Fault');
  }

  if (latest && latest.state !== 'charging') {
    const band = batteryBand(latest.battery, t);
    if (band === 'critical') raise('critical', 'battery', 'Battery critical');
    else if (band === 'low') raise('warning', 'battery', 'Battery low');
  }

  return { connectivity: conn, severity, reasons };
}

export function compareRobots(a, b) {
  const bySeverity = severityRank(b.assessment.severity) - severityRank(a.assessment.severity);
  if (bySeverity !== 0) return bySeverity;
  const byBattery = (a.telemetry?.battery ?? 0) - (b.telemetry?.battery ?? 0);
  if (byBattery !== 0) return byBattery;
  return a.id.localeCompare(b.id);
}

const isFiniteNumber = (v) => typeof v === 'number' && Number.isFinite(v);

export function validateTelemetry(msg) {
  if (msg == null || typeof msg !== 'object') return { ok: false, error: 'not an object' };
  const { robotId, siteId, seq, ts, battery, position, state, errorCode } = msg;
  if (typeof robotId !== 'string' || robotId.length === 0) return { ok: false, error: 'missing robotId' };
  if (typeof siteId !== 'string' || siteId.length === 0) return { ok: false, error: 'missing siteId' };
  if (!Number.isInteger(seq) || seq < 0) return { ok: false, error: 'invalid seq' };
  if (!isFiniteNumber(ts)) return { ok: false, error: 'invalid ts' };
  if (!isFiniteNumber(battery) || battery < 0 || battery > 100) return { ok: false, error: 'battery out of range' };
  if (!position || !isFiniteNumber(position.x) || !isFiniteNumber(position.y)) return { ok: false, error: 'invalid position' };
  if (!ROBOT_STATES.includes(state)) return { ok: false, error: `unknown state "${state}"` };
  if (errorCode != null && typeof errorCode !== 'string') return { ok: false, error: 'invalid errorCode' };

  return {
    ok: true,
    value: {
      robotId,
      siteId,
      seq,
      ts,
      battery,
      position: { x: position.x, y: position.y },
      state,
      errorCode: errorCode ?? null,
    },
  };
}
