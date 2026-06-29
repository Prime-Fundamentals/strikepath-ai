import Link from "next/link";
import type { Session } from "@/lib/types";
import { Icon } from "./Icons";

export function SessionTable({ sessions }: { sessions: Session[] }) {
  if (!sessions.length) return <div className="empty-state"><Icon name="sessions" width={36}/><h3>No sessions yet</h3><p>Start a live session to build your bowling history.</p><Link href="/app/live" className="primary-button small">Start session</Link></div>;
  return <div className="table-wrap"><table><thead><tr><th>Date</th><th>Center</th><th>Pattern</th><th>Shots</th><th>Status</th><th /></tr></thead><tbody>{sessions.map((session) => <tr key={session.id}><td>{new Date(session.started_at).toLocaleDateString()}</td><td><strong>{session.center_name}</strong>{session.lane_number && <small>Lane {session.lane_number}</small>}</td><td>{session.oil_pattern_name}<small>{session.oil_length_ft} ft</small></td><td>{session.shot_count}</td><td><span className={`status-badge ${session.status}`}>{session.status}</span></td><td><Link href={`/app/analytics?session=${session.id}`} className="icon-link"><Icon name="chevron" width={18}/></Link></td></tr>)}</tbody></table></div>;
}
