import { Link, useOutletContext, useParams } from 'react-router';
import { paths } from '../paths.js';
import { conditionText, SEVERITY_LABEL } from '../utils.js';
import { SeverityDot } from './Bits.jsx';

export function RobotDetail() {
  const snapshot = useOutletContext();
  const { robotId } = useParams();
  const robot = snapshot.robots.find((r) => r.id === robotId);

  const severity = robot?.assessment.severity;

  return (
    <main className="page">
      <Link className="back" to={paths.home()}>← Back to fleet</Link>

      <section className={`detail-head${robot ? ` sev-${severity}` : ''}`}>
        <h1>{robotId}</h1>
        {robot ? (
          <p className="detail-condition">
            <SeverityDot severity={severity} />
            <span>
              {SEVERITY_LABEL[severity]}
              {severity !== 'ok' && `: ${conditionText(robot.assessment, robot.ageMs)}`}
            </span>
          </p>
        ) : (
          <p className="empty">No robot with this ID has reported to the system.</p>
        )}
      </section>
    </main>
  );
}
