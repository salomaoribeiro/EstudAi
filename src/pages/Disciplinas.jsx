import { useEffect, useState } from "react";
import { useUsuario } from "../hooks/useUsuario";
import { api } from "../lib/api";

const STATUS = { nao_iniciado:"Não iniciado", em_andamento:"Em andamento", concluido:"Concluído" };
const BADGE = { nao_iniciado:"badge-gray", em_andamento:"badge-amber", concluido:"badge-green" };

export default function Disciplinas() {
  const { usuario } = useUsuario();
  const [disciplinas, setDisciplinas] = useState([]);
  const [editalId, setEditalId] = useState(null);
  const [busca, setBusca] = useState("");
  const [expandidos, setExpandidos] = useState({});

  // Modal: progresso de assunto
  const [modalProg, setModalProg] = useState(null);
  const [progVal, setProgVal] = useState(0);

  // Modal: adicionar/editar disciplina
  const [modalDisc, setModalDisc] = useState(null); // { mode: 'add'|'edit', disc? }
  const [discNome, setDiscNome] = useState("");

  // Modal: adicionar assuntos
  const [modalAssuntos, setModalAssuntos] = useState(null); // { disc }
  const [assuntosText, setAssuntosText] = useState("");

  // Modal: editar assunto
  const [modalEditAssunto, setModalEditAssunto] = useState(null); // { assunto, discId }
  const [assuntoNome, setAssuntoNome] = useState("");

  // Confirmações de exclusão
  const [confirmDelDisc, setConfirmDelDisc] = useState(null);
  const [confirmDelAssunto, setConfirmDelAssunto] = useState(null); // { assunto, discId }

  async function load() {
    const [discs, config] = await Promise.all([
      api.getDisciplinas(usuario.id),
      api.getConfig(usuario.id),
    ]);
    setDisciplinas(discs);
    setEditalId(config.edital_selecionado || null);
  }

  useEffect(() => { load(); }, [usuario]);

  // — Progresso —
  async function updateProg(e) {
    e.preventDefault();
    await api.updateAssunto(usuario.id, modalProg.id, { progresso: progVal });
    setModalProg(null);
    await load();
  }

  // — Disciplinas —
  async function handleSaveDisc(e) {
    e.preventDefault();
    if (!discNome.trim()) return;
    if (modalDisc.mode === "add") {
      await api.addDisciplina(editalId, discNome.trim());
    } else {
      await api.updateDisciplina(modalDisc.disc.id, discNome.trim());
    }
    setModalDisc(null);
    setDiscNome("");
    await load();
  }

  async function handleDelDisc() {
    await api.deleteDisciplina(confirmDelDisc.id);
    setConfirmDelDisc(null);
    await load();
  }

  // — Assuntos —
  async function handleAddAssuntos(e) {
    e.preventDefault();
    const lista = assuntosText.split("\n").map(s => s.trim()).filter(Boolean);
    if (!lista.length) return;
    await api.addAssuntosDisc(modalAssuntos.disc.id, lista);
    setModalAssuntos(null);
    setAssuntosText("");
    await load();
  }

  async function handleSaveAssunto(e) {
    e.preventDefault();
    if (!assuntoNome.trim()) return;
    await api.updateAssuntoDisc(modalEditAssunto.discId, modalEditAssunto.assunto.id, assuntoNome.trim());
    setModalEditAssunto(null);
    setAssuntoNome("");
    await load();
  }

  async function handleDelAssunto() {
    await api.deleteAssuntoDisc(confirmDelAssunto.discId, confirmDelAssunto.assunto.id);
    setConfirmDelAssunto(null);
    await load();
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
        {editalId && (
          <button className="btn btn-primary" onClick={() => { setModalDisc({ mode: "add" }); setDiscNome(""); }}>
            + Nova Disciplina
          </button>
        )}
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
                width:"100%", padding:"10px 14px",
                border:"1px solid var(--border)", borderRadius:"var(--radius-md)",
                fontSize:14, fontFamily:"inherit",
                backgroundColor:"var(--surface)", color:"var(--text)", boxSizing:"border-box"
              }}
            />
          </div>
        )}

        {disciplinas.length > 0 && disciplinasFiltradas.length === 0 && (
          <div className="empty-state"><p>Nenhuma disciplina ou assunto encontrado para "{busca}"</p></div>
        )}

        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {disciplinasFiltradas.map(d => {
            const conc = d.assuntos.filter(a => a.status === "concluido").length;
            const pct = d.assuntos.length ? Math.round((conc / d.assuntos.length) * 100) : 0;
            const isExpandido = expandidos[d.id];

            return (
              <div key={d.id}>
                <div
                  className="card"
                  style={{
                    display:"flex", alignItems:"center", gap:12,
                    padding:"14px 16px", cursor:"pointer",
                    background:"var(--bg-2)", transition:"all 0.2s",
                    borderTop:`3px solid ${d.cor}`
                  }}
                  onClick={() => setExpandidos({...expandidos,[d.id]:!isExpandido})}
                  onMouseEnter={(el) => (el.currentTarget.style.background = "var(--gray-50)")}
                  onMouseLeave={(el) => (el.currentTarget.style.background = "var(--bg-2)")}
                >
                  <div style={{ fontSize:12, color:"var(--text-3)" }}>{isExpandido ? "▼" : "▶"}</div>
                  <div className="color-dot" style={{ background:d.cor, width:12, height:12 }}/>
                  <span style={{ fontWeight:600, fontSize:15, flex:1 }}>{d.nome}</span>
                  <span className="text-sm text-muted">{pct}% · {conc}/{d.assuntos.length}</span>
                  <button
                    className="btn btn-sm"
                    style={{ padding:"4px 8px", fontSize:13 }}
                    onClick={e => { e.stopPropagation(); setModalDisc({ mode:"edit", disc:d }); setDiscNome(d.nome); }}
                    title="Renomear disciplina"
                  >✎</button>
                  <button
                    className="btn btn-sm"
                    style={{ padding:"4px 8px", fontSize:13 }}
                    onMouseEnter={e => { e.currentTarget.style.background="#ef4444"; e.currentTarget.style.color="#fff"; }}
                    onMouseLeave={e => { e.currentTarget.style.background=""; e.currentTarget.style.color=""; }}
                    onClick={e => { e.stopPropagation(); setConfirmDelDisc(d); }}
                    title="Remover disciplina"
                  >🗑</button>
                </div>

                {isExpandido && (
                  <div style={{
                    marginTop:8, background:"var(--surface)",
                    borderRadius:8, padding:12,
                    borderLeft:`2px solid ${d.cor}`,
                    display:"flex", flexDirection:"column", gap:8
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
                            <div className="prog-wrap"><div className="prog-fill" style={{ width:`${a.progresso}%`, background:d.cor }}/></div>
                          </div>
                          <button className="btn btn-sm" onClick={() => { setModalProg(a); setProgVal(a.progresso); }}>Editar</button>
                          <button
                            className="btn btn-sm"
                            style={{ padding:"4px 8px", fontSize:13 }}
                            onClick={() => { setModalEditAssunto({ assunto:a, discId:d.id }); setAssuntoNome(a.nome); }}
                            title="Renomear assunto"
                          >✎</button>
                          <button
                            className="btn btn-sm"
                            style={{ padding:"4px 8px", fontSize:13 }}
                            onMouseEnter={e => { e.currentTarget.style.background="#ef4444"; e.currentTarget.style.color="#fff"; }}
                            onMouseLeave={e => { e.currentTarget.style.background=""; e.currentTarget.style.color=""; }}
                            onClick={() => setConfirmDelAssunto({ assunto:a, discId:d.id })}
                            title="Remover assunto"
                          >🗑</button>
                        </div>
                      ))
                    )}
                    <button
                      className="btn btn-sm"
                      style={{ alignSelf:"flex-start", marginTop:4 }}
                      onClick={() => { setModalAssuntos({ disc:d }); setAssuntosText(""); }}
                    >+ Adicionar Assunto</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal: progresso */}
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

      {/* Modal: adicionar/renomear disciplina */}
      {modalDisc && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setModalDisc(null)}>
          <div className="modal">
            <div className="modal-title">{modalDisc.mode==="add" ? "Nova Disciplina" : "Renomear Disciplina"}</div>
            <form onSubmit={handleSaveDisc}>
              <div className="form-group">
                <label className="form-label">Nome</label>
                <input
                  type="text"
                  value={discNome}
                  onChange={e=>setDiscNome(e.target.value)}
                  placeholder="Ex: Matemática"
                  autoFocus
                />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn" onClick={()=>setModalDisc(null)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Salvar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: adicionar assuntos */}
      {modalAssuntos && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setModalAssuntos(null)}>
          <div className="modal">
            <div className="modal-title">Adicionar Assuntos — {modalAssuntos.disc.nome}</div>
            <form onSubmit={handleAddAssuntos}>
              <div className="form-group">
                <label className="form-label">Um assunto por linha</label>
                <textarea
                  value={assuntosText}
                  onChange={e=>setAssuntosText(e.target.value)}
                  placeholder={"Frações\nEquações do 1º grau\nGeometria plana"}
                  style={{ minHeight:120, fontFamily:"monospace", fontSize:13 }}
                  autoFocus
                />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn" onClick={()=>setModalAssuntos(null)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Adicionar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: editar nome do assunto */}
      {modalEditAssunto && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setModalEditAssunto(null)}>
          <div className="modal">
            <div className="modal-title">Renomear Assunto</div>
            <form onSubmit={handleSaveAssunto}>
              <div className="form-group">
                <label className="form-label">Nome</label>
                <input
                  type="text"
                  value={assuntoNome}
                  onChange={e=>setAssuntoNome(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn" onClick={()=>setModalEditAssunto(null)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Salvar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmação: remover disciplina */}
      {confirmDelDisc && (
        <div className="modal-overlay" onClick={()=>setConfirmDelDisc(null)}>
          <div className="modal" onClick={e=>e.stopPropagation()} style={{ maxWidth:380 }}>
            <div style={{ marginBottom:20 }}>
              <div style={{ fontSize:17, fontWeight:600, marginBottom:8 }}>Remover disciplina?</div>
              <div style={{ fontSize:14, color:"var(--text-3)" }}>
                "<strong>{confirmDelDisc.nome}</strong>" e todos os seus assuntos serão removidos deste edital.
              </div>
            </div>
            <div style={{ display:"flex", gap:8 }}>
              <button className="btn" style={{ flex:1 }} onClick={()=>setConfirmDelDisc(null)}>Cancelar</button>
              <button className="btn btn-primary" style={{ flex:1, background:"#ef4444" }} onClick={handleDelDisc}>Remover</button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmação: remover assunto */}
      {confirmDelAssunto && (
        <div className="modal-overlay" onClick={()=>setConfirmDelAssunto(null)}>
          <div className="modal" onClick={e=>e.stopPropagation()} style={{ maxWidth:380 }}>
            <div style={{ marginBottom:20 }}>
              <div style={{ fontSize:17, fontWeight:600, marginBottom:8 }}>Remover assunto?</div>
              <div style={{ fontSize:14, color:"var(--text-3)" }}>
                "<strong>{confirmDelAssunto.assunto.nome}</strong>" será removido desta disciplina.
              </div>
            </div>
            <div style={{ display:"flex", gap:8 }}>
              <button className="btn" style={{ flex:1 }} onClick={()=>setConfirmDelAssunto(null)}>Cancelar</button>
              <button className="btn btn-primary" style={{ flex:1, background:"#ef4444" }} onClick={handleDelAssunto}>Remover</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
