import { useEffect, useState } from "react";
import { api } from "../lib/api";

export default function Grupo() {
  const [grupo, setGrupo] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getGrupo().then(g => { setGrupo(g); setLoading(false); });
  }, []);

  function iniciais(nome) { return nome.split(" ").slice(0,2).map(p=>p[0]).join("").toUpperCase(); }

  if (loading) return <div className="page-body" style={{ color:"var(--text-3)",paddingTop:"3rem",textAlign:"center" }}>Carregando...</div>;

  // Ordena o grupo pelo número de assuntos concluídos (maior primeiro)
  const sorted = [...grupo].sort((a,b)=>b.concluidos-a.concluidos);

  return (
    <div>
      <div className="page-header">
        <div><div className="page-title">Grupo</div><div className="page-sub">Progresso de todos os estudantes</div></div>
      </div>
      <div className="page-body">
        {grupo.length === 0 && <div className="empty-state"><p>Nenhum usuário cadastrado ainda.</p></div>}

        <div style={{ display:"flex",flexDirection:"column",gap:16 }}>
          {sorted.map((u,i) => {
            const meta = u.config?.meta_min_dia||60;
            const pctHoje = Math.min(100,Math.round((u.minHoje/meta)*100));
            const pctTotal = u.total ? Math.round((u.concluidos/u.total)*100) : 0;
            return (
              <div key={u.id} className="card">
                <div style={{ display:"flex",alignItems:"center",gap:14,marginBottom:16 }}>
                  <div style={{ position:"relative" }}>
                    <div style={{ width:44,height:44,borderRadius:"50%",background:u.cor,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,fontWeight:700,color:"#fff" }}>
                      {iniciais(u.nome)}
                    </div>
                    {i===0&&<div style={{ position:"absolute",top:-4,right:-4,fontSize:14 }}>👑</div>}
                  </div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:600,fontSize:16 }}>{u.nome}</div>
                    {u.config?.nome_prova&&<div className="text-sm text-muted">{u.config.nome_prova}</div>}
                  </div>
                  <div style={{ textAlign:"right" }}>
                    <div style={{ fontSize:22,fontWeight:700,color:u.cor }}>{u.concluidos}</div>
                    <div className="text-sm text-muted">assuntos concluídos</div>
                  </div>
                </div>

                <div className="two-col">
                  <div>
                    <div className="text-sm text-muted mb-1">Hoje · {u.minHoje}min / {meta}min</div>
                    <div className="prog-wrap"><div className="prog-fill" style={{ width:`${pctHoje}%`,background:u.cor }}/></div>
                    <div className="text-sm text-muted mt-1">{pctHoje}% da meta</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted mb-1">Assuntos · {u.concluidos}/{u.total} concluídos</div>
                    <div className="prog-wrap"><div className="prog-fill" style={{ width:`${pctTotal}%`,background:u.cor }}/></div>
                    <div className="text-sm text-muted mt-1">{pctTotal}% do total</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
