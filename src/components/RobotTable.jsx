import { activityLabel, conditionText, formatAge } from '../utils.js';
import { Link, useNavigate } from 'react-router';
import { paths } from '../paths.js';
import { BatteryMeter, SeverityDot } from './Bits.jsx';

export function RobotTable({ robots, thresholds }) {
  const navigate = useNavigate();
  return (
    <div className="table-wrap">
      <table className="robot-table">
        <thead>
          <tr>
            <th scope="col">Robot</th>
            <th scope="col">Condition</th>
            <th scope="col">Activity</th>
            <th scope="col" className="num">Battery</th>
            <th scope="col" className="num">Last report</th>
          </tr>
        </thead>
        <tbody>
          {robots.map((r) => {
            const { severity, connectivity } = r.assessment;
            const to = paths.robot(r.id);
            return (
              <tr key={r.id} className={`sev-${severity}`} onClick={(e) => { if (!e.defaultPrevented) navigate(to); }}>
                <th scope="row"><Link to={to}>{r.id}</Link></th>
                <td>
                  <span className="condition">
                    <SeverityDot severity={severity} />
                    {conditionText(r.assessment, r.ageMs)}
                  </span>
                </td>
                <td>{activityLabel(r.telemetry.state)}</td>
                <td className="num">
                  <BatteryMeter
                    value={r.telemetry.battery}
                    lastKnown={connectivity !== 'online'}
                    charging={r.telemetry.state === 'charging'}
                    thresholds={thresholds}
                  />
                </td>
                <td className={`num${connectivity !== 'online' ? ' is-late' : ''}`}>{formatAge(r.ageMs)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
