import { useEffect, useState } from "react";
import { useUsuario } from "../hooks/useUsuario";
import { api } from "../lib/api";

const STATUS = { nao_iniciado:"Não iniciado", em_andamento:"Em andamento", concluido:"Concluído" };
const BADGE = { nao_iniciado:"badge-gray", em_andamento:"badge-amber", concluido:"badge-green" };

export default function Disciplinas() {
  const { usuario } = useUsuario();
  const [disciplinas, setDisciplinas] = useState([]);
  const [busca, setBusca] = useState("");
  const [expandidos, setExpandidos] = useState({});
  const [modalProg, setModalProg] = useState(null);
  const [progVal, setProgVal] = useState(0);

  async function load() { setDisciplinas(await api.getDisciplinas(usuario.id)); }
  useEffect(() => { load(); }, [usuario]);

  async function updateProg(e) {
    e.preventDefault();
    await api.updateAssunto(usuario.id, modalProg.id, { progresso: progVal });
    setModalProg(null); await load();
  }

  const disciplinasFiltradas = disciplinas.map(d => {
    const assuntosFiltrados = d.assuntos.filter(a =>
      a.nome.toLowerCase().includes(busca.toLowerCase())
    );
    return { ...d, assuntos: assuntosFiltrados };
  }).filter(d =>
    d.nome.toLowerCase().includes(busca.toLowerCase()) || d.assuntos.length > 0
  );

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">📚 Minhas Disciplinas</div>
          <div className="page-sub">Assuntos do edital selecionado</div>
        </div>
      </div>

      <div className="page-body">
        {disciplinas.length === 0 && (
          <div className="empty-state">
            <p>Nenhuma disciplina encontrada. Inscreva-se em um edital e selecione-o no Dashboard.</p>
          </div>
        )}

        {disciplinas.length > 0 && (
          <div style={{ marginBottom:16 }}>
            <input
              type="text"
              placeholder="🔍 Buscar disciplina ou assunto..."
              value={busca}
              onChange={e => setBusca(e.target.value)}
              style={{
                width:"100%",
                padding:"10px 14px",
                border:"1px solid var(--border)",
                borderRadius:"var(--radius-md)",
                fontSize:14,
                fontFamily:"inherit",
                backgroundColor:"var(--surface)",
                color:"var(--text)",
                boxSizing:"border-box"
              }}
            />
          </div>
        )}

        {disciplinas.length > 0 && disciplinasFiltradas.length === 0 && (
          <div className="empty-state"><p>Nenhuma disciplina ou assunto encontrado para "{busca}"</p></div>
        )}

        <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
          {disciplinasFiltradas.map(d => {
            const conc = d.assuntos.filter(a => a.status === "concluido").length;
            const pct = d.assuntos.length ? Math.round((conc / d.assuntos.length) * 100) : 0;
            const isExpandido = expandidos[d.id];

            return (
              <div key={d.id}>
                <div
                  className="card"
                  style={{
                    display:"flex",
                    alignItems:"center",
                    gap:12,
                    padding:"14px 16px",
                    cursor:"pointer",
                    background:"var(--bg-2)",
                    transition:"all 0.2s",
                    borderTop:`3px solid ${d.cor}`
                  }}
                  onClick={() => setExpandidos({...expandidos,[d.id]:!isExpandido})}
                  onMouseEnter={(el) => (el.currentTarget.style.background = "var(--gray-50)")}
                  onMouseLeave={(el) => (el.currentTarget.style.background = "var(--bg-2)")}
                >
                  <div style={{ fontSize:12, color:"var(--text-3)" }}>{isExpandido ? "▼" : "▶"}</div>
                  <div className="color-dot" style={{ background:d.cor,width:12,height:12 }}/>
                  <span style={{ fontWeight:600,fontSize:15,flex:1 }}>{d.nome}</span>
                  <span className="text-sm text-muted">{pct}% · {conc}/{d.assuntos.length}</span>
                </div>

                {isExpandido && (
                  <div style={{
                    marginTop:8,
                    background:"var(--surface)",
                    borderRadius:8,
                    padding:12,
                    borderLeft:`2px solid ${d.cor}`,
                    display:"flex",
                    flexDirection:"column",
                    gap:8
                  }}>
                    {d.assuntos.length === 0 ? (
                      <div style={{ fontSize:13, color:"var(--text-3)" }}>Nenhum assunto cadastrado.</div>
                    ) : (
                      d.assuntos.map(a => (
                        <div key={a.id} style={{ display:"flex", alignItems:"center", gap:12, paddingBottom:12, borderBottom:"0.5px solid var(--gray-100)" }}>
                          <div style={{ flex:1 }}>
                            <div style={{ fontSize:14, fontWeight:500, marginBottom:4 }}>{a.nome}</div>
                            <div style={{ fontSize:12, color:"var(--text-3)", display:"flex", gap:12 }}>
                              <span>{a.progresso}% estudado</span>
                              <span className={`badge ${BADGE[a.status]}`}>{STATUS[a.status]}</span>
                            </div>
                          </div>
                          <div style={{ width:100 }}>
                            <div className="prog-wrap"><div className="prog-fill" style={{ width:`${a.progresso}%`,background:d.cor }}/></div>
                          </div>
                          <button className="btn btn-sm" onClick={() => { setModalProg(a); setProgVal(a.progresso); }}>Editar</button>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {modalProg && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setModalProg(null)}>
          <div className="modal">
            <div className="modal-title">Progresso — {modalProg.nome}</div>
            <form onSubmit={updateProg}>
              <div className="form-group">
                <label className="form-label">Progresso: {progVal}%</label>
                <input type="range" min="0" max="100" step="5" value={progVal} onChange={e=>setProgVal(Number(e.target.value))} style={{ width:"100%" }}/>
                <div className="flex-between text-sm text-muted mt-1"><span>0%</span><span>50%</span><span>100%</span></div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn" onClick={()=>setModalProg(null)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Salvar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
