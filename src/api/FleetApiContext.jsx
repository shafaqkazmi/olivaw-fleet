import { createContext, useContext, useSyncExternalStore } from 'react';

const FleetApiContext = createContext(null);

export function FleetApiProvider({ api, children }) {
  return <FleetApiContext.Provider value={api}>{children}</FleetApiContext.Provider>;
}

export function useFleetSnapshot() {
  const api = useContext(FleetApiContext);
  if (!api) throw new Error('useFleetSnapshot must be used inside <FleetApiProvider>');
  return useSyncExternalStore(api.subscribe, api.getSnapshot);
}
