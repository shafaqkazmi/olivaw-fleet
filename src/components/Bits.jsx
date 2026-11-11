import { batteryBand } from '../server/status.js';
import { SEVERITY_LABEL } from '../utils.js';

export function SeverityDot({ severity }) {
  return <span className={`sev-dot sev-${severity}`} role="img" aria-label={SEVERITY_LABEL[severity]} />;
}

export function BatteryMeter({ value, lastKnown, charging, thresholds }) {
  const band = batteryBand(value, thresholds);
  return (
    <span
      className={`battery${lastKnown ? ' is-last-known' : ''}`}
      title={lastKnown ? 'Last known value' : undefined}
    >
      <span className="battery-track" aria-hidden="true">
        <span className={`battery-fill band-${charging ? 'charging' : band}`} style={{ width: `${value}%` }} />
      </span>
      <span className="battery-value">{Math.round(value)}%</span>
    </span>
  );
}
