import { describe, expect, it } from 'vitest';
import { assess, connectivity, compareRobots, validateTelemetry, THRESHOLDS } from './status.js';

const base = { robotId: 'R1', siteId: 's1', seq: 1, ts: 1000, battery: 50, position: { x: 1, y: 2 }, state: 'idle' };

describe('connectivity', () => {
  it('is online, stale, then offline as silence grows', () => {
    expect(connectivity(0, THRESHOLDS.staleAfterMs, THRESHOLDS)).toBe('online');
    expect(connectivity(0, THRESHOLDS.staleAfterMs + 1, THRESHOLDS)).toBe('stale');
    expect(connectivity(0, THRESHOLDS.offlineAfterMs + 1, THRESHOLDS)).toBe('offline');
    expect(connectivity(null, 0)).toBe('offline');
  });
});

describe('assess', () => {
  it('is ok for a healthy, reporting robot', () => {
    expect(assess(base, 0, 1000).severity).toBe('ok');
  });

  it('warns on low battery but not while charging', () => {
    expect(assess({ ...base, battery: 15 }, 0, 0).severity).toBe('warning');
    expect(assess({ ...base, battery: 15, state: 'charging' }, 0, 0).severity).toBe('ok');
  });

  it('takes the worst of several problems and keeps every reason', () => {
    const a = assess({ ...base, battery: 15, state: 'error', errorCode: 'E_STOP' }, 0, 10_000);
    expect(a.severity).toBe('critical');
    expect(a.reasons.map((r) => r.code)).toEqual(['stale', 'fault', 'battery']);
  });
});

describe('compareRobots', () => {
  it('puts critical first, then lowest battery', () => {
    const r = (id, severity, battery) => ({ id, assessment: { severity }, telemetry: { battery } });
    const sorted = [r('a', 'ok', 10), r('b', 'critical', 90), r('c', 'ok', 5)].sort(compareRobots);
    expect(sorted.map((x) => x.id)).toEqual(['b', 'c', 'a']);
  });
});

describe('validateTelemetry', () => {
  it('accepts a well-formed message', () => {
    expect(validateTelemetry(base).ok).toBe(true);
  });
  it.each([
    [{ ...base, battery: 101 }, 'battery out of range'],
    [{ ...base, battery: 'n/a' }, 'battery out of range'],
    [{ ...base, state: 'dancing' }, 'unknown state "dancing"'],
    [{ ...base, position: { x: 1 } }, 'invalid position'],
    [{ ...base, robotId: '' }, 'missing robotId'],
    [null, 'not an object'],
  ])('rejects %j', (msg, error) => {
    expect(validateTelemetry(msg)).toEqual({ ok: false, error });
  });
});
