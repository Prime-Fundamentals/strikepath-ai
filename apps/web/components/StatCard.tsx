import { Icon } from "./Icons";

export function StatCard({ label, value, detail, icon = "spark" }: { label: string; value: string | number; detail?: string; icon?: string }) {
  return (
    <article className="stat-card glass-panel">
      <span className="stat-icon"><Icon name={icon} width={22} /></span>
      <div><small>{label}</small><strong>{value}</strong>{detail && <p>{detail}</p>}</div>
    </article>
  );
}
