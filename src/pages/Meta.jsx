import { useEffect, useState } from "react";
import { useUsuario } from "../hooks/useUsuario";
import { api } from "../lib/api";
import { differenceInDays, format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function Meta() {
  const { usuario } = useUsuario();
  const [form, setForm] = useState({ nome_prova:"", data_prova:"", meta_min_dia:60 });
  const [stats, setStats] = useState(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    Promise.all([api.getConfig(usuario.id), api.getStats(usuario.id)]).then(([c,s]) => {
      if (c) setForm(f=>({...f,...c})); setStats(s);
    });
  }, []);

  async function handleSave(e) {
    e.preventDefault();
    await api.setConfig(usuario.id, form);
    setSaved(true); setTimeout(()=>setSaved(false),2500);
  }

  const meta = Number(form.meta_min_dia)||60;
  const minHoje = stats?.minHoje||0;
  const pctHoje = Math.min(100,Math.round((minHoje/meta)*100));

  let diasRestantes = null;
  let dataFmt = null;
  if (form.data_prova) {
    const d = new Date(form.data_prova+"T00:00:00");
    diasRestantes = differenceInDays(d, new Date());
    dataFmt = format(d,"dd 'de' MMMM 'de' yyyy",{locale:ptBR});
  }

  return (
    <div>
      <div className="page-header">
        <div><div className="page-title">Meta & prova</div><div className="page-sub">Configure sua meta diária e data-alvo</div></div>
      </div>
      <div className="page-body" style={{ maxWidth:540 }}>
        <div className="card mb-2">
          <div className="section-title">Configurações</div>
          <form onSubmit={handleSave}>
            <div className="form-group">
              <label className="form-label">Nome da prova / objetivo</label>
              <input className="form-input" placeholder="ex: Concurso TRF, ENEM 2026..." value={form.nome_prova} onChange={e=>setForm(f=>({...f,nome_prova:e.target.value}))}/>
            </div>
            <div className="form-group">
              <label className="form-label">Data da prova</label>
              <input className="form-input" type="date" value={form.data_prova} onChange={e=>setForm(f=>({...f,data_prova:e.target.value}))}/>
            </div>
            <div className="form-group">
              <label className="form-label">Meta diária: {meta} minutos ({Math.floor(meta/60)>0?`${Math.floor(meta/60)}h `:"" }{meta%60>0?`${meta%60}min`:""})</label>
              <input type="range" min="15" max="480" step="15" value={meta} onChange={e=>setForm(f=>({...f,meta_min_dia:Number(e.target.value)}))} style={{ width:"100%" }}/>
              <div className="flex-between text-sm text-muted mt-1"><span>15min</span><span>4h</span><span>8h</span></div>
            </div>
            <button type="submit" className="btn btn-primary" style={{ width:"100%",justifyContent:"center" }}>
              {saved?"✓ Salvo!":"Salvar configurações"}
            </button>
          </form>
        </div>

        {diasRestantes !== null && (
          <div className="card mb-2" style={{ borderTop:"3px solid var(--green-600)" }}>
            <div className="text-sm text-muted mb-1">{form.nome_prova||"Prova"} · {dataFmt}</div>
            <div style={{ display:"flex",alignItems:"baseline",gap:8 }}>
              <span style={{ fontSize:52,fontWeight:700,lineHeight:1,color:diasRestantes<30?"var(--red-400)":"var(--green-600)" }}>{Math.max(0,diasRestantes)}</span>
              <span style={{ fontSize:18,color:"var(--text-3)" }}>dias restantes</span>
            </div>
            {diasRestantes<7&&diasRestantes>=0&&<div className="text-sm mt-1" style={{ color:"var(--amber-400)" }}>⚠️ Menos de uma semana!</div>}
          </div>
        )}

        <div className="card">
          <div className="section-title">Hoje</div>
          <div style={{ fontSize:28,fontWeight:600,marginBottom:4 }}>{minHoje}<span style={{ fontSize:16,fontWeight:400,color:"var(--text-3)" }}> / {meta} min</span></div>
          <div className="prog-wrap mt-1 mb-1"><div className="prog-fill" style={{ width:`${pctHoje}%` }}/></div>
          <div className="text-sm text-muted">{pctHoje}% da meta diária{pctHoje>=100?" · ✓ Meta batida!":""}</div>
        </div>
      </div>
    </div>
  );
}
