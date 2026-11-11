const STATES = [
  { key: 'moving', label: 'Driving' },
  { key: 'idle', label: 'Idle' },
  { key: 'charging', label: 'Charging' },
  { key: 'error', label: 'Stopped', alarm: true },
];

export function FleetSummary({ site, robots, activity, onSelectActivity }) {
  const attention = site.warning + site.critical;
  const tone = site.critical > 0 ? 'crit' : site.warning > 0 ? 'warn' : 'ok';
  const count = (state) => robots.filter((r) => r.telemetry.state === state).length;

  return (
    <div className="summary">
      <section className={`attention-card tone-${tone}`} aria-labelledby="attention-heading">
        <h2 id="attention-heading" className="attention-headline">
          {attention === 0 ? (
            <>All {site.total} robots are fine</>
          ) : (
            <>
              <span className="attention-num">{attention}</span> of {site.total} robots need attention
            </>
          )}
        </h2>

        <div className="attention-meter" aria-hidden="true">
          <span className="m-crit" style={{ flexGrow: site.critical }} />
          <span className="m-warn" style={{ flexGrow: site.warning }} />
          <span className="m-ok" style={{ flexGrow: site.ok }} />
        </div>

        {attention > 0 && (
          <p className="attention-foot">
            {site.critical} critical · {site.warning} warning
          </p>
        )}
      </section>

      <div className="state-tiles" role="group" aria-label="Filter robots by activity">
        {STATES.map(({ key, label, alarm }) => {
          const n = count(key);
          const selected = activity === key;
          const cls = [
            'state-tile',
            n === 0 ? 'is-zero' : '',
            alarm && n > 0 ? 'is-alarm' : '',
            selected ? 'is-selected' : '',
          ].filter(Boolean).join(' ');
          return (
            <button key={key} type="button" className={cls} aria-pressed={selected} onClick={() => onSelectActivity(key)}>
              <span className="state-tile-num">{n}</span>
              <span className="state-tile-label">{label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
