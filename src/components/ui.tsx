import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import type { ChunkEntry } from "../png/analyze";

export function Card({
  title,
  icon: Icon,
  end,
  children,
  className = "",
}: {
  title?: ReactNode;
  icon?: LucideIcon;
  end?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`card ${className}`}>
      {title && (
        <header className="card-head">
          <h2 className="card-title">
            {Icon && <Icon size={18} />}
            {title}
          </h2>
          {end && <div className="end">{end}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

export interface KvItem {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  onClick?: () => void;
  title?: string;
}

export function KeyValueList({ items }: { items: KvItem[] }) {
  return (
    <dl className="kv">
      {items.map((item, i) => (
        <div
          key={i}
          className={`kv-row${item.onClick ? " linkable" : ""}`}
          onClick={item.onClick}
          title={item.title}
        >
          <dt>
            {item.label}
            {item.hint}
          </dt>
          <dd>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function StatCard({
  label,
  value,
  sub,
  icon: Icon,
}: {
  label: string;
  value: ReactNode;
  sub: ReactNode;
  icon: LucideIcon;
}) {
  return (
    <div className="card stat">
      <div className="stat-head">
        <span>{label}</span>
        <Icon size={18} />
      </div>
      <div className="stat-value">{value}</div>
      <div className="stat-sub">{sub}</div>
    </div>
  );
}

export function ChunkBadge({ chunk, type }: { chunk?: ChunkEntry; type?: string }) {
  const t = chunk?.type ?? type ?? "";
  const critical = chunk ? chunk.critical : t.charCodeAt(0) < 0x61;
  const bad = chunk ? !chunk.crcValid : false;
  return <span className={`chunk-badge${critical ? " critical" : ""}${bad ? " bad" : ""}`}>{t}</span>;
}
