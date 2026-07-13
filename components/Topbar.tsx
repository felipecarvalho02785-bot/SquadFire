export function Topbar({
  title,
  sub,
  right,
  action,
}: {
  title: string;
  sub?: string;
  right?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="topbar">
      <h1>{title}</h1>
      {sub && <span className="sub">· {sub}</span>}
      <div style={{ flex: 1 }} />
      {right}
      {action}
    </div>
  );
}
