import { beforeEach, describe, expect, it } from 'vitest';
import { createFleetStore } from './fleetStore.js';

let t;
let store;
const msg = (overrides = {}) => ({
  robotId: 'R1', siteId: 's1', seq: 1, ts: t, battery: 50, position: { x: 1, y: 1 }, state: 'idle', ...overrides,
});

beforeEach(() => {
  t = 1_000_000;
  store = createFleetStore({ now: () => t, sites: [{ id: 's1', name: 'Site 1' }] });
});

describe('fleet store', () => {
  it('stores the latest state', () => {
    store.ingest(msg());
    t += 1000;
    store.ingest(msg({ seq: 2, ts: t, battery: 49 }));
    store.flush();
    const [robot] = store.getSnapshot().robots;
    expect(robot.telemetry.battery).toBe(49);
  });

  it('drops duplicates and late arrivals', () => {
    store.ingest(msg({ seq: 5 }));
    expect(store.ingest(msg({ seq: 5 })).accepted).toBe(false);
    expect(store.ingest(msg({ seq: 4, ts: t - 1000 })).accepted).toBe(false);
    store.flush();
    expect(store.getSnapshot().stats.duplicates).toBe(2);
  });

  it('accepts a sequence reset when the timestamp moves forward (reboot)', () => {
    store.ingest(msg({ seq: 500 }));
    t += 60_000;
    expect(store.ingest(msg({ seq: 0, ts: t })).accepted).toBe(true);
  });

  it('rejects invalid messages without touching state', () => {
    expect(store.ingest(msg({ battery: -3 })).accepted).toBe(false);
    store.flush();
    expect(store.getSnapshot().robots).toHaveLength(0);
    expect(store.getSnapshot().stats.rejected).toBe(1);
  });

  it('notices silence on sweep and records lost contact and recovery', () => {
    store.ingest(msg());
    t += 31_000;
    store.sweep();
    let snap = store.getSnapshot();
    expect(snap.robots[0].assessment.connectivity).toBe('offline');
    expect(snap.events[0].message).toBe('Lost contact');

    store.ingest(msg({ seq: 40, ts: t }));
    store.flush();
    snap = store.getSnapshot();
    expect(snap.robots[0].assessment.connectivity).toBe('online');
    expect(snap.events[0].message).toBe('Back online');
  });

  it('records faults and battery thresholds once, on the transition', () => {
    store.ingest(msg({ battery: 21 }));
    store.ingest(msg({ seq: 2, battery: 19.5 }));
    store.ingest(msg({ seq: 3, battery: 19 }));
    store.ingest(msg({ seq: 4, battery: 18, state: 'error', errorCode: 'E_STOP' }));
    store.flush();
    expect(store.getSnapshot().events.map((e) => e.message)).toEqual(['Fault: E_STOP', 'Battery low (19.50%)']);
  });

  it('notifies subscribers on flush with a new snapshot object', () => {
    let calls = 0;
    store.subscribe(() => calls++);
    const before = store.getSnapshot();
    store.ingest(msg());
    store.flush();
    expect(calls).toBe(1);
    expect(store.getSnapshot()).not.toBe(before);
  });
});
