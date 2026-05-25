import { useEffect, useState } from "react";
import { useUsuario } from "../hooks/useUsuario";
import { api } from "../lib/api";

const CORES = ["#3B6D11","#185FA5","#854F0B","#534AB7","#993556","#0F6E56","#A32D2D","#5F5F58"];
const STATUS = { nao_iniciado:"Não iniciado", em_andamento:"Em andamento", concluido:"Concluído" };
const BADGE = { nao_iniciado:"badge-gray", em_andamento:"badge-amber", concluido:"badge-green" };

export default function Disciplinas() {
  const { usuario } = useUsuario();
  const [disciplinas, setDisciplinas] = useState([]);
  const [busca, setBusca] = useState("");
  const [expandidos, setExpandidos] = useState({});
  const [modalDisciplina, setModalDisciplina] = useState(false);
  const [modalAssunto, setModalAssunto] = useState(null);
  const [modalProg, setModalProg] = useState(null);
  const [formD, setFormD] = useState({ nome:"", cor:CORES[0] });
  const [formA, setFormA] = useState({ nome:"" });
  const [progVal, setProgVal] = useState(0);
  const [loading, setLoading] = useState(false);

  async function load() { setDisciplinas(await api.getDisciplinas(usuario.id)); }
  useEffect(() => { load(); }, [usuario]);

  async function addDisciplina(e) {
    e.preventDefault();
    if (!formD.nome.trim()) return;
    setLoading(true);
    await api.addDisciplina(usuario.id, formD);
    setFormD({ nome:"", cor:CORES[0] }); setModalDisciplina(false); await load(); setLoading(false);
  }

  async function addAssunto(e) {
    e.preventDefault();
    if (!formA.nome.trim()) return;
    setLoading(true);
    await api.addAssunto(modalAssunto.id, formA);
    setFormA({ nome:"" }); setModalAssunto(null); await load(); setLoading(false);
  }

  async function updateProg(e) {
    e.preventDefault();
    await api.updateAssunto(modalProg.id, { progresso: progVal });
    setModalProg(null); await load();
  }

  async function delDisciplina(id) {
    if (!window.confirm("Remover disciplina e todos os assuntos?")) return;
    await api.deleteDisciplina(usuario.id, id); await load();
  }

  async function delAssunto(id) {
    if (!window.confirm("Remover este assunto?")) return;
    await api.deleteAssunto(id); await load();
  }

  // Filtrar disciplinas baseado na busca
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
        <div><div className="page-title">📚 Minhas Disciplinas</div><div className="page-sub">Suas disciplinas pessoais e assuntos de estudo</div></div>
        <button className="btn btn-primary" onClick={() => setModalDisciplina(true)}>+ Nova disciplina</button>
      </div>

      <div className="page-body">
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

        {disciplinas.length === 0 && <div className="empty-state"><p>Nenhuma disciplina cadastrada ainda.</p></div>}
        {disciplinas.length > 0 && disciplinasFiltradas.length === 0 && (
          <div className="empty-state"><p>Nenhuma disciplina ou assunto encontrado para "{busca}"</p></div>
        )}

        <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
          {disciplinasFiltradas.map(d => {
            const conc = d.assuntos.filter(a=>a.status==="concluido").length;
            const pct = d.assuntos.length ? Math.round((conc/d.assuntos.length)*100) : 0;
            const isExpandido = expandidos[d.id];

            return (
              <div key={d.id}>
                {/* Header clicável */}
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
                  <button className="btn btn-sm" onClick={(e) => { e.stopPropagation(); setModalAssunto(d); }}>+ Assunto</button>
                  <button className="btn btn-sm btn-danger" onClick={(e) => { e.stopPropagation(); delDisciplina(d.id); }}>✕</button>
                </div>

                {/* Conteúdo expandível */}
                {isExpandido && (
                  <div style={{ marginLeft:12, marginTop:8, borderLeft:`2px solid ${d.cor}`, paddingLeft:12, paddingBottom:12, display:"flex", flexDirection:"column", gap:8, background:"var(--surface)", borderRadius:8, padding:12, marginTop:8 }}>
                    {d.assuntos.length === 0 ? (
                      <div style={{ fontSize:13, color:"var(--text-3)" }}>Nenhum assunto cadastrado. Clique em "+ Assunto" para adicionar.</div>
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
                          <button className="btn btn-sm btn-danger" onClick={() => delAssunto(a.id)}>✕</button>
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

      {modalDisciplina && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setModalDisciplina(false)}>
          <div className="modal">
            <div className="modal-title">Nova disciplina</div>
            <form onSubmit={addDisciplina}>
              <div className="form-group">
                <label className="form-label">Nome</label>
                <input className="form-input" placeholder="ex: Português" value={formD.nome} onChange={e=>setFormD(f=>({...f,nome:e.target.value}))} autoFocus/>
              </div>
              <div className="form-group">
                <label className="form-label">Cor</label>
                <div className="flex-gap" style={{ flexWrap:"wrap",gap:8 }}>
                  {CORES.map(c=>(
                    <div key={c} onClick={()=>setFormD(f=>({...f,cor:c}))}
                      style={{ width:28,height:28,borderRadius:"50%",background:c,cursor:"pointer",outline:formD.cor===c?`3px solid ${c}`:"none",outlineOffset:2 }}/>
                  ))}
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn" onClick={()=>setModalDisciplina(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={loading}>{loading?"Salvando...":"Adicionar"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {modalAssunto && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setModalAssunto(null)}>
          <div className="modal">
            <div className="modal-title">Novo assunto — {modalAssunto.nome}</div>
            <form onSubmit={addAssunto}>
              <div className="form-group">
                <label className="form-label">Nome do assunto</label>
                <input className="form-input" placeholder="ex: Concordância verbal" value={formA.nome} onChange={e=>setFormA({nome:e.target.value})} autoFocus/>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn" onClick={()=>setModalAssunto(null)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={loading}>{loading?"Salvando...":"Adicionar"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

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
