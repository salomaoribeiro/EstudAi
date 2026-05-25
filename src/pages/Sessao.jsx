import { useEffect, useState, useRef } from "react";
import { useUsuario } from "../hooks/useUsuario";
import { api } from "../lib/api";

function pad(n) { return String(n).padStart(2,"0"); }
function fmt(s) { return `${pad(Math.floor(s/3600))}:${pad(Math.floor((s%3600)/60))}:${pad(s%60)}`; }

export default function Sessao() {
  const { usuario } = useUsuario();
  const [disciplinas, setDisciplinas] = useState([]);
  const [phase, setPhase] = useState("idle");
  const [sel, setSel] = useState({ disciplinaId:"", assuntoId:"" });
  const [progFim, setProgFim] = useState(50);
  const [anotacao, setAnotacao] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [resultado, setResultado] = useState(null);
  const intervalRef = useRef(null);
  const startRef = useRef(null);
  const pausedRef = useRef(0);

  useEffect(() => { api.getDisciplinas(usuario.id).then(setDisciplinas); }, [usuario]);

  const disciplina = disciplinas.find(d=>d.id===Number(sel.disciplinaId));
  const assunto = disciplina?.assuntos.find(a=>a.id===Number(sel.assuntoId));

  function startTimer() {
    startRef.current = Date.now() - pausedRef.current*1000;
    intervalRef.current = setInterval(()=>setElapsed(Math.floor((Date.now()-startRef.current)/1000)),1000);
  }
  function stopTimer() { clearInterval(intervalRef.current); }

  function handleIniciar(e) {
    e.preventDefault();
    if (!sel.assuntoId) return;
    setProgFim(assunto?.progresso||0);
    pausedRef.current=0; setElapsed(0);
    setPhase("running"); startTimer();
  }

  function handlePause() { stopTimer(); pausedRef.current=elapsed; setPhase("paused"); }
  function handleResume() { setPhase("running"); startTimer(); }

  async function handleEncerrar(e) {
    e.preventDefault();
    stopTimer();
    const duracaoMin = Math.max(1, Math.round(elapsed/60));
    await api.addSessao(usuario.id, {
      assunto_id: Number(sel.assuntoId),
      disciplina_id: Number(sel.disciplinaId),
      duracao_min: duracaoMin,
      progresso_antes: assunto?.progresso||0,
      progresso_depois: progFim,
      anotacao,
    });
    setResultado({ assunto, disciplina, duracaoMin, progFim });
    setPhase("done");
  }

  function nova() {
    setPhase("idle"); setSel({disciplinaId:"",assuntoId:""}); setAnotacao(""); setElapsed(0); setResultado(null);
    api.getDisciplinas(usuario.id).then(setDisciplinas);
  }

  return (
    <div>
      <div className="page-header">
        <div><div className="page-title">Sessão de estudo</div><div className="page-sub">Cronômetro automático de estudo</div></div>
      </div>
      <div className="page-body" style={{ maxWidth:540 }}>
        {phase==="idle" && (
          <div className="card">
            <div className="section-title">Iniciar sessão</div>
            <form onSubmit={handleIniciar}>
              <div className="form-group">
                <label className="form-label">Disciplina</label>
                <select className="form-input" value={sel.disciplinaId} onChange={e=>setSel({disciplinaId:e.target.value,assuntoId:""})}>
                  <option value="">Selecione...</option>
                  {disciplinas.map(d=><option key={d.id} value={d.id}>{d.nome}</option>)}
                </select>
              </div>
              {disciplina && (
                <div className="form-group">
                  <label className="form-label">Assunto</label>
                  <select className="form-input" value={sel.assuntoId} onChange={e=>setSel(s=>({...s,assuntoId:e.target.value}))}>
                    <option value="">Selecione...</option>
                    {disciplina.assuntos.map(a=><option key={a.id} value={a.id}>{a.nome} ({a.progresso}%)</option>)}
                  </select>
                </div>
              )}
              {assunto && (
                <div style={{ background:"var(--green-50)",border:"1px solid var(--green-100)",borderRadius:"var(--radius-md)",padding:"10px 14px",marginBottom:"1rem" }}>
                  <span style={{ fontSize:13,color:"var(--green-800)" }}>Progresso atual: <strong>{assunto.progresso}%</strong></span>
                </div>
              )}
              <div className="form-group">
                <label className="form-label">Anotação inicial (opcional)</label>
                <input className="form-input" placeholder="ex: focar nos exercícios" value={anotacao} onChange={e=>setAnotacao(e.target.value)}/>
              </div>
              <button type="submit" className="btn btn-primary" style={{ width:"100%",justifyContent:"center",padding:12 }} disabled={!sel.assuntoId}>
                ▷ Iniciar sessão
              </button>
            </form>
          </div>
        )}

        {(phase==="running"||phase==="paused") && (
          <>
            <div className="card" style={{ textAlign:"center",padding:"2rem" }}>
              <div className="text-sm text-muted mb-1">{disciplina?.nome} · {assunto?.nome}</div>
              <div className="timer-display" style={{ color:phase==="paused"?"var(--text-3)":"var(--text)",margin:"1rem 0" }}>{fmt(elapsed)}</div>
              <div className="text-sm text-muted">{phase==="paused"?"⏸ pausado":"▶ cronômetro rodando"}</div>
              <div className="flex-gap mt-2" style={{ justifyContent:"center" }}>
                {phase==="running"
                  ? <button className="btn" onClick={handlePause}>⏸ Pausar</button>
                  : <button className="btn btn-primary" onClick={handleResume}>▷ Retomar</button>}
              </div>
            </div>
            <div className="card mt-2">
              <div className="section-title">Encerrar sessão</div>
              <form onSubmit={handleEncerrar}>
                <div className="form-group">
                  <label className="form-label">Progresso alcançado neste assunto: {progFim}%</label>
                  <input type="range" min="0" max="100" step="5" value={progFim} onChange={e=>setProgFim(Number(e.target.value))} style={{ width:"100%" }}/>
                  <div className="flex-between text-sm text-muted mt-1"><span>0%</span><span>50%</span><span>100%</span></div>
                </div>
                <div className="form-group">
                  <label className="form-label">Anotação final (opcional)</label>
                  <input className="form-input" placeholder="ex: rever exercícios amanhã" value={anotacao} onChange={e=>setAnotacao(e.target.value)}/>
                </div>
                <button type="submit" className="btn btn-danger" style={{ width:"100%",justifyContent:"center",padding:12 }}>
                  ◼ Encerrar e salvar
                </button>
              </form>
            </div>
          </>
        )}

        {phase==="done" && resultado && (
          <div className="card" style={{ textAlign:"center",padding:"2.5rem 2rem" }}>
            <div style={{ fontSize:40,marginBottom:8 }}>✅</div>
            <div style={{ fontWeight:600,fontSize:18,marginBottom:4 }}>Sessão salva!</div>
            <div className="text-sm text-muted mb-2">{resultado.disciplina.nome} · {resultado.assunto.nome}</div>
            <div style={{ display:"flex",gap:12,justifyContent:"center",margin:"1.5rem 0" }}>
              <div style={{ background:"var(--gray-50)",borderRadius:"var(--radius-md)",padding:"1rem 1.5rem",textAlign:"center" }}>
                <div style={{ fontSize:28,fontWeight:600 }}>{resultado.duracaoMin}</div>
                <div className="text-sm text-muted">minutos</div>
              </div>
              <div style={{ background:"var(--green-50)",borderRadius:"var(--radius-md)",padding:"1rem 1.5rem",textAlign:"center" }}>
                <div style={{ fontSize:28,fontWeight:600,color:"var(--green-600)" }}>{resultado.progFim}%</div>
                <div className="text-sm text-muted">progresso</div>
              </div>
            </div>
            {resultado.progFim>=100 && <div style={{ background:"var(--green-50)",borderRadius:"var(--radius-md)",padding:10,marginBottom:"1rem",color:"var(--green-800)",fontWeight:500 }}>🎉 Assunto concluído!</div>}
            <button className="btn btn-primary" style={{ width:"100%",justifyContent:"center" }} onClick={nova}>Nova sessão</button>
          </div>
        )}
      </div>
    </div>
  );
}
