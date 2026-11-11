const ACTIVITY = { moving: 'Driving', idle: 'Idle', charging: 'Charging', error: 'Stopped' };
export const SEVERITY_LABEL = { ok: 'OK', warning: 'Warning', critical: 'Critical' };

export function formatAge(ms) {
  if (ms == null) return 'never';
  if (ms < 2000) return 'just now';
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  return `${Math.floor(m / 60)} h ago`;
}

export function formatDuration(ms) {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)} min`;
}

export function formatClock(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
}

export function activityLabel(state) {
  return ACTIVITY[state] ?? state;
}

export function conditionText(assessment, ageMs) {
  if (assessment.severity === 'ok') return 'OK';
  return assessment.reasons
    .map((r) => (r.code === 'offline' && ageMs != null ? `No contact for ${formatDuration(ageMs)}` : r.text))
    .join(', ');
}

