import { useState } from 'react';
import { useOutletContext } from 'react-router';
import { RobotTable } from './RobotTable.jsx';
import { EventList } from './EventList.jsx';
import { FleetSummary } from './FleetSummary.jsx';
import { activityLabel } from '../utils.js';

export function FleetOverview() {
  const snapshot = useOutletContext();
  const [attentionOnly, setAttentionOnly] = useState(false);
  const [activity, setActivity] = useState(null);
  const site = snapshot.sites[0];
  const robots = snapshot.robots.filter((r) => r.siteId === site.id);
  const shown = robots.filter(
    (r) =>
      (!attentionOnly || r.assessment.severity !== 'ok') &&
      (!activity || r.telemetry.state === activity),
  );
  const events = snapshot.events.filter((e) => e.siteId === site.id).slice(0, 12);

  const toggleActivity = (state) => setActivity((cur) => (cur === state ? null : state));

  return (
    <main className="page">
      <h1>{site.name}</h1>
      <FleetSummary site={site} robots={robots} activity={activity} onSelectActivity={toggleActivity} />

      <section className="panel" aria-labelledby="robots-heading">
        <div className="panel-head">
          <div className="panel-title">
            <h2 id="robots-heading">Robots</h2>
            {activity && (
              <button type="button" className="filter-chip" onClick={() => setActivity(null)}>
                {activityLabel(activity)}
                <span aria-hidden="true">×</span>
                <span className="visually-hidden">, clear activity filter</span>
              </button>
            )}
          </div>
          <label className="toggle">
            <input type="checkbox" checked={attentionOnly} onChange={(e) => setAttentionOnly(e.target.checked)} />
            Only show robots that need attention
          </label>
        </div>
        {shown.length === 0 ? (
          <p className="empty">
            {activity || !attentionOnly
              ? 'No robots match these filters right now.'
              : 'Nothing needs attention right now.'}
          </p>
        ) : (
          <RobotTable robots={shown} thresholds={snapshot.thresholds} />
        )}
      </section>

      <section className="panel" aria-labelledby="events-heading">
        <h2 id="events-heading">Recent events</h2>
        <EventList events={events} emptyText="No events yet. Faults, lost contact and low batteries will appear here." />
      </section>
    </main>
  );
}
