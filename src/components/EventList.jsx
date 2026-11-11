import { Link } from 'react-router';
import { paths } from '../paths.js';
import { formatClock } from '../utils.js';

export function EventList({ events, emptyText }) {
  if (events.length === 0) return <p className="empty">{emptyText}</p>;
  return (
    <ol className="events">
      {events.map((e) => (
        <li key={e.id} className={`event sev-${e.severity}`}>
          <time dateTime={new Date(e.ts).toISOString()}>{formatClock(e.ts)}</time>
          <Link to={paths.robot(e.robotId)} className="event-robot">{e.robotId}</Link>
          <span className="event-message">{e.message}</span>
        </li>
      ))}
    </ol>
  );
}
