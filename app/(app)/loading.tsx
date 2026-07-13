// Skeleton exibido INSTANTANEAMENTE ao trocar de aba, enquanto o servidor busca
// os dados. Sem isso, o App Router segura a tela antiga até o fim do fetch — o
// que dá a sensação de lentidão. Aqui a navegação responde na hora.
export default function Loading() {
  return (
    <div className="main">
      <div className="topbar"><div className="sk sk-title" /></div>
      <div className="content">
        <div className="sk sk-head" />
        <div className="kpis">
          {[0, 1, 2, 3].map((i) => (
            <div className="card sk-kpi" key={i}>
              <div className="sk sk-line sm" />
              <div className="sk sk-num" />
              <div className="sk sk-line short" />
            </div>
          ))}
        </div>
        <div className="grid cols-2">
          <div className="card sk-card">
            <div className="sk sk-line" /><div className="sk sk-line" /><div className="sk sk-line short" /><div className="sk sk-line" />
          </div>
          <div className="card sk-card">
            <div className="sk sk-line" /><div className="sk sk-line short" /><div className="sk sk-line" />
          </div>
        </div>
      </div>
    </div>
  );
}
