import { SITES } from '../server/sites.js';

// Per second. Battery drain is accelerated so a charge cycle takes minutes, not hours.
const SPEED_MPS = 1.2;
const DRAIN = { moving: 0.3, idle: 0.06, error: 0.04, charging: 0 };
const CHARGE_RATE = 1.5;
const GO_CHARGE_BELOW = 15;
const STOP_CHARGING_AT = 95;
const FAULT_PER_SEC = 1 / 900;
const DROPOUT_PER_SEC = 1 / 700;
const DUPLICATE_RATE = 0.01;
const MALFORMED_RATE = 0.0005;
const FAULT_CODES = ['E_STOP', 'LIDAR_BLOCKED', 'MOTOR_OVERCURRENT', 'LOCALIZATION_LOST'];

export function createSimulator({ send, sites = SITES, rng = Math.random, now = () => Date.now() }) {
  const robots = [];
  let counter = 1;
  const start = now();

  for (const site of sites) {
    for (let i = 0; i < site.robotCount; i++) {
      const p = randomPoint(site);
      robots.push({
        id: `AMR-${String(counter++).padStart(3, '0')}`,
        site,
        x: p.x,
        y: p.y,
        battery: 25 + rng() * 75,
        state: 'idle',
        target: null,
        goingToCharge: false,
        idleUntil: start + rng() * 3000,
        faultUntil: 0,
        errorCode: null,
        offlineUntil: 0,
        seq: 0,
        nextSendAt: start + rng() * 1000,
      });
    }
  }
  if (robots[2]) robots[2].battery = 21;
  if (robots[11]) robots[11].battery = 11.5;

  function randomPoint(site) {
    return { x: 2 + rng() * (site.width - 4), y: 2 + rng() * (site.height - 4) };
  }

  function nearestCharger(r) {
    let best = r.site.chargers[0];
    let bestD = Infinity;
    for (const c of r.site.chargers) {
      const d = Math.hypot(c.x - r.x, c.y - r.y);
      if (d < bestD) {
        best = c;
        bestD = d;
      }
    }
    return best;
  }

  function step(r, dt, t) {
    if (r.state === 'error') {
      if (t >= r.faultUntil) {
        if (r.errorCode === 'BATTERY_DEPLETED') {
          const c = nearestCharger(r);
          r.x = c.x;
          r.y = c.y;
          r.state = 'charging';
        } else {
          r.state = 'idle';
          r.idleUntil = t + 2000;
        }
        r.errorCode = null;
        r.target = r.goingToCharge ? r.target : null;
      }
    } else if (r.state === 'charging') {
      r.battery = Math.min(100, r.battery + CHARGE_RATE * dt);
      if (r.battery >= STOP_CHARGING_AT) {
        r.state = 'idle';
        r.idleUntil = t + 1500;
        r.target = null;
      }
    } else if (rng() < FAULT_PER_SEC * dt) {
      r.state = 'error';
      r.errorCode = FAULT_CODES[Math.floor(rng() * FAULT_CODES.length)];
      r.faultUntil = t + 15_000 + rng() * 30_000;
    } else {
      if (r.battery < GO_CHARGE_BELOW && !r.goingToCharge) {
        r.goingToCharge = true;
        r.target = { ...nearestCharger(r) };
        r.state = 'moving';
      }
      if (r.state === 'idle' && t >= r.idleUntil) {
        r.target = randomPoint(r.site);
        r.state = 'moving';
      }
      if (r.state === 'moving' && r.target) {
        const dx = r.target.x - r.x;
        const dy = r.target.y - r.y;
        const dist = Math.hypot(dx, dy);
        const travel = SPEED_MPS * dt;
        if (dist <= travel) {
          r.x = r.target.x;
          r.y = r.target.y;
          r.target = null;
          if (r.goingToCharge) {
            r.goingToCharge = false;
            r.state = 'charging';
          } else {
            r.state = 'idle';
            r.idleUntil = t + 2000 + rng() * 6000;
          }
        } else {
          r.x += (dx / dist) * travel;
          r.y += (dy / dist) * travel;
        }
      }
    }

    r.battery = Math.max(0, r.battery - DRAIN[r.state] * dt);
    if (r.battery === 0 && r.state !== 'charging' && r.state !== 'error') {
      r.state = 'error';
      r.errorCode = 'BATTERY_DEPLETED';
      r.faultUntil = t + 60_000;
    }

    if (t >= r.offlineUntil && rng() < DROPOUT_PER_SEC * dt) {
      r.offlineUntil = t + 8_000 + rng() * 40_000;
    }
  }

  function message(r, t) {
    return {
      robotId: r.id,
      siteId: r.site.id,
      seq: r.seq,
      ts: t,
      battery: Math.round(r.battery * 10) / 10,
      position: { x: Math.round(r.x * 100) / 100, y: Math.round(r.y * 100) / 100 },
      state: r.state,
      ...(r.errorCode ? { errorCode: r.errorCode } : {}),
    };
  }

  function transmit(r, t) {
    if (t < r.nextSendAt) return;
    r.nextSendAt = t + 1000 + (rng() - 0.5) * 300;
    r.seq++;
    if (t < r.offlineUntil) return;

    const msg = message(r, t);
    if (rng() < MALFORMED_RATE) {
      send({ ...msg, battery: 'n/a' });
      return;
    }
    send(msg);
    if (rng() < DUPLICATE_RATE) send(msg);
  }

  let last = now();
  function tick() {
    const t = now();
    const dt = Math.min(1, (t - last) / 1000); // clamp after a backgrounded tab
    last = t;
    for (const r of robots) {
      step(r, dt, t);
      transmit(r, t);
    }
  }

  return {
    start(intervalMs = 100) {
      const id = setInterval(tick, intervalMs);
      return () => clearInterval(id);
    },
  };
}
