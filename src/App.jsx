import { Link, Outlet } from 'react-router';
import { useFleetSnapshot } from './api/FleetApiContext.jsx';
import { paths } from './paths.js';

export default function App() {
  const snapshot = useFleetSnapshot();

  return (
    <div className="app">
      <header className="topbar">
        <Link to={paths.home()} className="brand">Olivaw Fleet</Link>
      </header>

      {snapshot.robots.length === 0 ? (
        <main className="page">
          <p className="waiting">Waiting for the first robot to report…</p>
        </main>
      ) : (
        <Outlet context={snapshot} />
      )}
    </div>
  );
}
