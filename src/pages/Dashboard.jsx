import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useUsuario } from "../hooks/useUsuario";
import { api } from "../lib/api";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { differenceInDays } from "date-fns";

export default function Dashboard() {
  const { usuario } = useUsuario();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [config, setConfig] = useState(null);
  const [disciplinas, setDisciplinas] = useState([]);
  const [editais, setEditais] = useState([]);
  const [proximoEdital, setProximoEdital] = useState(null);
  const [modalDetalhe, setModalDetalhe] = useState(false);
  const [expandidos, setExpandidos] = useState({});

  useEffect(() => {
    if (!usuario) return;
    (async () => {
      const [s, c, d, e] = await Promise.all([
        api.getStats(usuario.id),
        api.getConfig(usuario.id),
        api.getDisciplinas(usuario.id),
        api.getEditais(usuario.id)
      ]);

      setStats(s);
      setConfig(c);
      setDisciplinas(d);
      setEditais(e);

      // Se tem edital selecionado, carrega seu progresso
      if (c.edital_selecionado && e.length > 0) {
        const edital = e.find(ed => ed.id === c.edital_selecionado);
        if (edital) {
          const progresso = await api.getEditalProgresso(edital.id, usuario.id);
          setProximoEdital({ ...edital, progresso: progresso.resumo, disciplinas: progresso.disciplinas });
        }
      } else if (e.length > 0) {
        // Se não tem selecionado, seleciona o primeiro
        await api.setEditalSelecionado(usuario.id, e[0].id);
        const progresso = await api.getEditalProgresso(e[0].id, usuario.id);
        setProximoEdital({ ...e[0], progresso: progresso.resumo, disciplinas: progresso.disciplinas });
      }
    })();
  }, [usuario]);

  async function selecionarEdital(editalId) {
    // Atualizar no backend
    const novaConfig = await api.setEditalSelecionado(usuario.id, editalId);
    // Atualizar state local
    setConfig(novaConfig);

    const edital = editais.find(e => e.id === editalId);
    if (edital) {
      const progresso = await api.getEditalProgresso(edital.id, usuario.id);
      setProximoEdital({ ...edital, progresso: progresso.resumo, disciplinas: progresso.disciplinas });
    }
  }

  async function marcarAssunto(assuntoId, concluido) {
    await api.updateAssunto(usuario.id, assuntoId, { progresso: concluido ? 100 : 0 });
    const progresso = await api.getEditalProgresso(proximoEdital.id, usuario.id);
    setProximoEdital(prev => ({ ...prev, progresso: progresso.resumo, disciplinas: progresso.disciplinas }));
  }

  if (!stats) return <div className="page-body" style={{ color:"var(--text-3)",paddingTop:"3rem",textAlign:"center" }}>Carregando...</div>;

  const meta = config?.meta_min_dia || 60;
  const pctHoje = Math.min(100, Math.round((stats.minHoje / meta) * 100));
  let diasRestantes = null;
  if (config?.data_prova) diasRestantes = differenceInDays(new Date(config.data_prova + "T00:00:00"), new Date());

  const todosAssuntos = disciplinas.flatMap(d => d.assuntos);

  return (
    <div>
      <div className="page-header" style={{ flexDirection:"column",alignItems:"stretch",gap:"1.5rem" }}>
        <div>
          <div className="page-title">Olá, {usuario.nome.split(" ")[0]} 👋</div>
          <div className="page-sub">Seu resumo de hoje</div>
        </div>

        {editais.length > 0 && (
          <div>
            <div style={{ fontSize:12,fontWeight:600,color:"var(--text-3)",marginBottom:12,textTransform:"uppercase",letterSpacing:".05em" }}>Seus Concursos</div>
            <div style={{ display:"flex",gap:12,overflowX:"auto",paddingBottom:8 }}>
              {editais.map(e => {
                const isSelected = config?.edital_selecionado === e.id;
                const diasRestantes = e.data_prova ? differenceInDays(new Date(e.data_prova + "T00:00:00"), new Date()) : null;
                return (
                  <div
                    key={e.id}
                    className="card"
                    style={{
                      padding:"14px 20px",
                      minWidth:200,
                      cursor:"pointer",
                      border:`2px solid ${isSelected ? "var(--green-600)" : "var(--border)"}`,
                      background:isSelected ? "var(--green-50)" : "var(--surface)",
                      transition:"all 0.2s",
                      flexShrink:0
                    }}
                    onClick={() => selecionarEdital(e.id)}
                  >
                    <div style={{ fontSize:13,fontWeight:600,marginBottom:4,color:isSelected?"var(--green-800)":"var(--text)" }}>{e.nome}</div>
                    <div style={{ fontSize:24,fontWeight:700,lineHeight:1,color:diasRestantes && diasRestantes<30?"var(--red-400)":"var(--green-600)",marginBottom:4 }}>
                      {diasRestantes !== null ? Math.max(0,diasRestantes) : "—"}
                    </div>
                    <div style={{ fontSize:11,color:"var(--text-3)" }}>dias</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
      <div className="page-body">
        <div className="metric-grid mb-2">
          <div className="metric-card">
            <div className="metric-label">Sequência</div>
            <div className="metric-value">{stats.streak} 🔥</div>
            <div className="metric-sub">dias seguidos</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Hoje</div>
            <div className="metric-value">{stats.minHoje}<span style={{ fontSize:14,fontWeight:400,color:"var(--text-3)" }}>min</span></div>
            <div className="metric-sub">meta: {meta}min · {pctHoje}%</div>
            <div className="prog-wrap mt-1"><div className="prog-fill" style={{ width:`${pctHoje}%` }}/></div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Total acumulado</div>
            <div className="metric-value">{Math.floor(stats.minTotal/60)}<span style={{ fontSize:14,fontWeight:400,color:"var(--text-3)" }}>h</span></div>
            <div className="metric-sub">{stats.minTotal} minutos</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Assuntos</div>
            <div className="metric-value">
              {todosAssuntos.filter(a=>a.status==="concluido").length}
              <span style={{ fontSize:14,fontWeight:400,color:"var(--text-3)" }}>/{todosAssuntos.length}</span>
            </div>
            <div className="metric-sub">concluídos</div>
          </div>
        </div>

        {proximoEdital && (
          <div className="card mt-2">
            <div style={{ display:"flex",justifyContent:"space-between",alignItems:"start",marginBottom:16 }}>
              <div>
                <div className="section-title">📋 Concurso Selecionado</div>
                <div style={{ fontSize:15,fontWeight:500,marginBottom:4 }}>{proximoEdital.nome}</div>
                <div style={{ fontSize:12,color:"var(--text-3)" }}>{proximoEdital.instituicao} • Prova em {new Date(proximoEdital.data_prova).toLocaleDateString("pt-BR")}</div>
              </div>
              <button className="btn btn-primary btn-sm" onClick={() => setModalDetalhe(true)}>
                Ver Detalhes
              </button>
            </div>
            <div style={{ marginBottom:12 }}>
              <div style={{ display:"flex",justifyContent:"space-between",marginBottom:6,fontSize:13 }}>
                <span>Progresso geral</span>
                <span style={{ fontWeight:600,color:"#3B6D11" }}>{proximoEdital.progresso.progressoGeral}%</span>
              </div>
              <div className="prog-wrap" style={{ height:8 }}>
                <div className="prog-fill" style={{ width:`${proximoEdital.progresso.progressoGeral}%` }}/>
              </div>
            </div>
            <div style={{ display:"grid",gridTemplateColumns:"repeat(3, 1fr)",gap:12 }}>
              <div style={{ fontSize:12,padding:"10px",background:"var(--gray-50)",borderRadius:"var(--radius-md)" }}>
                <div style={{ fontSize:18,fontWeight:600,color:"#10b981",marginBottom:2 }}>{proximoEdital.progresso.completadas}</div>
                <div style={{ color:"var(--text-3)",fontSize:11 }}>Disciplinas OK</div>
              </div>
              <div style={{ fontSize:12,padding:"10px",background:"var(--gray-50)",borderRadius:"var(--radius-md)" }}>
                <div style={{ fontSize:18,fontWeight:600,color:"#f59e0b",marginBottom:2 }}>{proximoEdital.progresso.total - proximoEdital.progresso.completadas - proximoEdital.progresso.urgentes}</div>
                <div style={{ color:"var(--text-3)",fontSize:11 }}>Em Progresso</div>
              </div>
              <div style={{ fontSize:12,padding:"10px",background:"var(--gray-50)",borderRadius:"var(--radius-md)" }}>
                <div style={{ fontSize:18,fontWeight:600,color:"#ef4444",marginBottom:2 }}>{proximoEdital.progresso.urgentes}</div>
                <div style={{ color:"var(--text-3)",fontSize:11 }}>Urgentes</div>
              </div>
            </div>
          </div>
        )}

        <div className="two-col mt-2">
          <div className="card">
            <div className="section-title">Minutos por dia — últimos 7 dias</div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={stats.ultimos7} barSize={28}>
                <XAxis dataKey="label" tick={{ fontSize:12,fill:"var(--text-3)" }} axisLine={false} tickLine={false}/>
                <YAxis hide/>
                <Tooltip formatter={v=>[`${v} min`,"Estudo"]} contentStyle={{ fontSize:13,borderRadius:8,border:"1px solid var(--border)" }}/>
                <Bar dataKey="min" radius={[4,4,0,0]}>
                  {(stats.ultimos7||[]).map((_,i)=><Cell key={i} fill={i===6?"#3B6D11":"#C0DD97"}/>)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="card">
            <div className="section-title">Suas Disciplinas de Estudo</div>
            {disciplinas.length===0 && <div className="empty-state" style={{ padding:"1.5rem" }}>Nenhuma disciplina criada. Vá para <strong>Minhas Disciplinas</strong> para começar.</div>}
            {disciplinas.map(d => {
              const conc = d.assuntos.filter(a=>a.status==="concluido").length;
              const pct = d.assuntos.length ? Math.round((conc/d.assuntos.length)*100) : 0;
              return (
                <div key={d.id} style={{ marginBottom:14 }}>
                  <div className="flex-between mb-1">
                    <div className="flex-gap"><div className="color-dot" style={{ background:d.cor }}/><span style={{ fontSize:13,fontWeight:500 }}>{d.nome}</span></div>
                    <span className="text-sm text-muted">{conc}/{d.assuntos.length}</span>
                  </div>
                  <div className="prog-wrap"><div className="prog-fill" style={{ width:`${pct}%`,background:d.cor }}/></div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {modalDetalhe && proximoEdital && (
        <div className="modal-overlay" onClick={() => setModalDetalhe(false)}>
          <div className="modal" style={{ maxWidth: 700, maxHeight: "90vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div style={{ marginBottom: 24, paddingBottom: 20, borderBottom: "2px solid var(--border)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 12 }}>
                <div>
                  <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>{proximoEdital.nome}</h2>
                  <div style={{ fontSize: 13, color: "var(--text-3)" }}>
                    {proximoEdital.instituicao}
                  </div>
                </div>
                <button className="btn btn-sm" style={{ background: "#3B6D11", color: "#fff" }} onClick={() => {
                  setModalDetalhe(false);
                  navigate("/disciplinas");
                }}>
                  📚 Estudar
                </button>
              </div>

              {/* Dias para prova */}
              {proximoEdital.data_prova && (
                <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
                  <div style={{ flex: 1, background: "var(--amber-50)", padding: 12, borderRadius: "var(--radius-md)", border: "2px solid #f59e0b" }}>
                    <div style={{ fontSize: 24, fontWeight: 700, color: "#f59e0b", marginBottom: 2 }}>
                      {Math.max(0, differenceInDays(new Date(proximoEdital.data_prova + "T00:00:00"), new Date()))}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-3)" }}>dias para prova</div>
                    <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 4 }}>
                      {new Date(proximoEdital.data_prova).toLocaleDateString("pt-BR")}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Progresso Geral */}
            <div style={{ marginBottom: 24, padding: 16, background: "linear-gradient(135deg, #3B6D1120 0%, #185FA520 100%)", borderRadius: "var(--radius-md)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <span style={{ fontSize: 14, fontWeight: 600 }}>Progresso Geral</span>
                <span style={{ fontSize: 28, fontWeight: 700, color: "#3B6D11" }}>{proximoEdital.progresso.progressoGeral}%</span>
              </div>
              <div style={{ fontSize: 13, color: "var(--text-3)", marginBottom: 12 }}>
                {proximoEdital.progresso.assuntosEstudados} de {proximoEdital.progresso.totalAssuntos} assuntos estudados
              </div>
              <div className="prog-wrap" style={{ height: 12 }}>
                <div className="prog-fill" style={{ width: `${proximoEdital.progresso.progressoGeral}%`, background: "linear-gradient(90deg, #3B6D11, #10b981)" }} />
              </div>
            </div>

            {/* Cards de Resumo */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Resumo por Status</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
                <div style={{ background: "var(--red-50)", padding: 14, borderRadius: "var(--radius-md)", border: "2px solid #ef4444", textAlign: "center" }}>
                  <div style={{ fontSize: 28, fontWeight: 700, color: "#ef4444", marginBottom: 4 }}>{proximoEdital.progresso.urgentes}</div>
                  <div style={{ fontSize: 12, color: "var(--text-3)", fontWeight: 500 }}>Não Iniciadas</div>
                  <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 4 }}>✗ {Math.round(proximoEdital.progresso.urgentes / proximoEdital.progresso.total * 100)}%</div>
                </div>
                <div style={{ background: "var(--amber-50)", padding: 14, borderRadius: "var(--radius-md)", border: "2px solid #f59e0b", textAlign: "center" }}>
                  <div style={{ fontSize: 28, fontWeight: 700, color: "#f59e0b", marginBottom: 4 }}>
                    {proximoEdital.progresso.total - proximoEdital.progresso.completadas - proximoEdital.progresso.urgentes}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-3)", fontWeight: 500 }}>Em Progresso</div>
                  <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 4 }}>⚠ {Math.round((proximoEdital.progresso.total - proximoEdital.progresso.completadas - proximoEdital.progresso.urgentes) / proximoEdital.progresso.total * 100)}%</div>
                </div>
                <div style={{ background: "var(--green-50)", padding: 14, borderRadius: "var(--radius-md)", border: "2px solid #10b981", textAlign: "center" }}>
                  <div style={{ fontSize: 28, fontWeight: 700, color: "#10b981", marginBottom: 4 }}>{proximoEdital.progresso.completadas}</div>
                  <div style={{ fontSize: 12, color: "var(--text-3)", fontWeight: 500 }}>Disciplinas Completas</div>
                  <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 4 }}>✓ {Math.round(proximoEdital.progresso.completadas / proximoEdital.progresso.total * 100)}%</div>
                </div>
              </div>
            </div>

            {/* Disciplinas */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Progresso por Disciplina</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {proximoEdital.disciplinas && proximoEdital.disciplinas.map((d, idx) => {
                  let statusColor = "#ef4444";
                  let statusLabel = "✗ Urgente";
                  let statusBg = "var(--red-50)";
                  if (d.progresso >= 75) {
                    statusColor = "#10b981";
                    statusLabel = "✓ Completa";
                    statusBg = "var(--green-50)";
                  } else if (d.progresso >= 25) {
                    statusColor = "#f59e0b";
                    statusLabel = "⚠ Em Progresso";
                    statusBg = "var(--amber-50)";
                  }

                  const isExpandido = expandidos[d.id];

                  return (
                    <div key={idx}>
                      <div
                        style={{
                          background: statusBg,
                          padding: 14,
                          borderRadius: "var(--radius-md)",
                          border: `2px solid ${statusColor}`,
                          cursor: "pointer",
                          transition: "all 0.2s"
                        }}
                        onClick={() => setExpandidos({...expandidos, [d.id]: !isExpandido})}
                        onMouseEnter={(el) => el.currentTarget.style.opacity = "0.8"}
                        onMouseLeave={(el) => el.currentTarget.style.opacity = "1"}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 8 }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                              <span style={{ fontSize: 12, color: "var(--text-3)" }}>{isExpandido ? "▼" : "▶"}</span>
                              <div style={{ fontWeight: 600, fontSize: 14 }}>{d.nome}</div>
                            </div>
                            <div style={{ fontSize: 12, color: "var(--text-3)", display: "flex", gap: 16 }}>
                              <span>{d.assuntos_estudados} de {d.assuntos_totais} assuntos</span>
                              <span>•</span>
                              <span>{d.horasEstudadas}h estudadas</span>
                            </div>
                          </div>
                          <div style={{ background: statusColor, color: "#fff", padding: "6px 12px", borderRadius: 16, fontSize: 11, fontWeight: 600, whiteSpace: "nowrap" }}>
                            {d.progresso}%
                          </div>
                        </div>
                        <div className="prog-wrap" style={{ height: 8 }}>
                          <div className="prog-fill" style={{ width: `${d.progresso}%`, background: statusColor }} />
                        </div>
                      </div>

                      {/* Detalhes expandidos */}
                      {isExpandido && (
                        <div style={{ marginTop: 8, marginLeft: 12, paddingLeft: 12, borderLeft: `3px solid ${statusColor}`, display: "flex", flexDirection: "column", gap: 12 }}>
                          <div style={{ fontSize: 13, fontWeight: 500, marginTop: 8 }}>Status: <span style={{ color: statusColor, fontWeight: 700 }}>{statusLabel}</span></div>
                          <div style={{ fontSize: 12, color: "var(--text-3)", lineHeight: 1.6 }}>
                            <div style={{ marginBottom: 8 }}>
                              <strong>Progresso:</strong> {d.progresso}% completo
                            </div>
                            <div style={{ marginBottom: 8 }}>
                              <strong>Assuntos:</strong> {d.assuntos_estudados} de {d.assuntos_totais} estudados
                            </div>
                            <div style={{ marginBottom: 8 }}>
                              <strong>Concluídos:</strong> {d.assuntos_estudados} assuntos
                            </div>
                            <div style={{ marginBottom: 8 }}>
                              <strong>Faltam:</strong> {d.assuntos_totais - d.assuntos_estudados} assuntos
                            </div>
                            <div>
                              <strong>Tempo:</strong> {d.horasEstudadas} horas investidas
                            </div>
                          </div>

                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                            <div style={{ background: "var(--gray-50)", borderRadius: "var(--radius-md)", padding: 12 }}>
                              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Concluídos ({d.assuntos?.filter(a => a.estudado).length || 0})</div>
                              {d.assuntos?.filter(a => a.estudado).length > 0 ? (
                                <ul style={{ margin: 0, padding: 0, listStyle: "none", paddingRight: 4, maxHeight: 160, overflowY: "auto", fontSize: 12, color: "var(--text-3)" }}>
                                  {d.assuntos.filter(a => a.estudado).map((assunto, index) => (
                                    <li key={index} style={{ marginBottom: 4 }}>
                                      <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                                        <input
                                          type="checkbox"
                                          checked={assunto.progresso === 100}
                                          onChange={() => marcarAssunto(assunto.id, assunto.progresso !== 100)}
                                          style={{ width: 14, height: 14, cursor: "pointer", flexShrink: 0 }}
                                        />
                                        <span style={{ textDecoration: assunto.progresso === 100 ? "line-through" : "none" }}>{assunto.nome}</span>
                                      </label>
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <div style={{ fontSize: 12, color: "var(--text-3)" }}>Nenhum assunto concluído ainda.</div>
                              )}
                            </div>
                            <div style={{ background: "var(--gray-50)", borderRadius: "var(--radius-md)", padding: 12 }}>
                              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Pendentes ({d.assuntos?.filter(a => !a.estudado).length || 0})</div>
                              {d.assuntos?.filter(a => !a.estudado).length > 0 ? (
                                <ul style={{ margin: 0, padding: 0, listStyle: "none", paddingRight: 4, maxHeight: 160, overflowY: "auto", fontSize: 12, color: "var(--text-3)" }}>
                                  {d.assuntos.filter(a => !a.estudado).map((assunto, index) => (
                                    <li key={index} style={{ marginBottom: 4 }}>
                                      <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                                        <input
                                          type="checkbox"
                                          checked={assunto.progresso === 100}
                                          onChange={() => marcarAssunto(assunto.id, assunto.progresso !== 100)}
                                          style={{ width: 14, height: 14, cursor: "pointer", flexShrink: 0 }}
                                        />
                                        <span style={{ textDecoration: assunto.progresso === 100 ? "line-through" : "none" }}>{assunto.nome}</span>
                                      </label>
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <div style={{ fontSize: 12, color: "var(--text-3)" }}>Nada pendente — disciplina completa!</div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Botões de ação */}
            <div style={{ display: "flex", gap: 8, marginTop: 24 }}>
              <button
                className="btn btn-primary"
                style={{ background: "#3B6D11", flex: 1 }}
                onClick={() => {
                  setModalDetalhe(false);
                  navigate("/disciplinas");
                }}
              >
                📚 Ir para Minhas Disciplinas
              </button>
              <button
                className="btn"
                style={{ background: "var(--border)", flex: 1 }}
                onClick={() => setModalDetalhe(false)}
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
