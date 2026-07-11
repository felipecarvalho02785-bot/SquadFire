export function Topbar({ title, sub, action }: { title: string; sub?: string; action?: React.ReactNode }) {
  return (
    <div className="topbar">
      <div style={{ flex: 1 }}>
        <h1>{title}</h1>
        {sub && <div className="sub">{sub}</div>}
      </div>
      {action}
    </div>
  );
}
