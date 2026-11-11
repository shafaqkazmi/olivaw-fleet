import { createFleetStore } from '../server/fleetStore.js';
import { SITES } from '../server/sites.js';
import { createSimulator } from '../simulator/simulator.js';

export function createFleetApi() {
  const store = createFleetStore({ sites: SITES });

  const simulator = createSimulator({
    send(msg) {
      const wire = JSON.stringify(msg);
      setTimeout(() => store.ingest(JSON.parse(wire)), 20 + Math.random() * 180);
    },
  });

  let started = false;

  return {
    start() {
      if (started) return;
      started = true;
      store.startSweeping(1000);
      simulator.start(100);
    },
    subscribe: store.subscribe,
    getSnapshot: store.getSnapshot,
  };
}
