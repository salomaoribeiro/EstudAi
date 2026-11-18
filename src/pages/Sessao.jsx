import { useEffect, useMemo, useRef, useState } from "react";
import { useUsuario } from "../hooks/useUsuario";
import { api } from "../lib/api";

function pad(value) { return String(value).padStart(2, "0"); }
function fmtTime(seconds) {
  return `${pad(Math.floor(seconds / 3600))}:${pad(Math.floor((seconds % 3600) / 60))}:${pad(seconds % 60)}`;
}
function fmtDuration(minutes) {
  const value = Number(minutes) || 0;
  const hours = Math.floor(value / 60);
  const mins = value % 60;
  if (!value) return "—";
  return hours ? `${hours}h${mins ? ` ${pad(mins)}min` : ""}` : `${mins}min`;
}
const EMPTY_SUMMARY = {
  assuntos_estudados: 0,
  sessoes: 0,
  paginas_lidas: 0,
  questoes_resolvidas: 0,
  acertos: 0,
  minutos_estudados: 0,
  minutos_planejados: 0,
};

export default function Sessao() {
  const { usuario } = useUsuario();
  const [disciplinas, setDisciplinas] = useState([]);
  const [resumo, setResumo] = useState(EMPTY_SUMMARY);
  const [sel, setSel] = useState({ disciplinaId: null, assuntoId: null });
  const [modo, setModo] = useState("lista");
  const [mostrarAssuntos, setMostrarAssuntos] = useState(false);
  const [referencia, setReferencia] = useState("");
  const [paginas, setPaginas] = useState(0);
  const [questoes, setQuestoes] = useState(0);
  const [acertos, setAcertos] = useState(0);
  const [tempoPlanejado, setTempoPlanejado] = useState("");
  const [tempoReal, setTempoReal] = useState("");
  const [concluir, setConcluir] = useState(false);
  const [anotacao, setAnotacao] = useState("");
  const [segundos, setSegundos] = useState(0);
  const [cronometroAtivo, setCronometroAtivo] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [mensagem, setMensagem] = useState("");
  const inicioCronometro = useRef(null);

  const disciplina = disciplinas.find(item => item.id === Number(sel.disciplinaId));
  const assuntos = disciplina?.assuntos || [];
  const assunto = assuntos.find(item => item.id === Number(sel.assuntoId));
  const indiceAssunto = assuntos.findIndex(item => item.id === Number(sel.assuntoId));
  const planejadoAtual = Number(tempoPlanejado) || 0;
  const porcentagemAcerto = Number(questoes) > 0 ? Math.round((Number(acertos) / Number(questoes)) * 100) : 0;

  const metricas = useMemo(() => ([
    { label: "ASSUNTOS ESTUDADOS", value: resumo.assuntos_estudados, hint: `${resumo.sessoes} sessões hoje`, color: "#3B6D11", icon: "◉" },
    { label: "PÁGINAS LIDAS", value: resumo.paginas_lidas, hint: "registradas hoje", color: "#185FA5", icon: "▤" },
    { label: "QUESTÕES", value: resumo.questoes_resolvidas, hint: `${resumo.acertos} acertos`, color: "#BA7517", icon: "✓" },
    { label: "TEMPO DE ESTUDO", value: fmtDuration(resumo.minutos_estudados), hint: planejadoAtual ? `planejado nesta sessão: ${fmtDuration(planejadoAtual)}` : "tempo real acumulado hoje", color: "#534AB7", icon: "◷" },
  ]), [resumo, planejadoAtual]);

  async function carregarDados() {
    const [lista, dadosHoje] = await Promise.all([
      api.getDisciplinas(usuario.id),
      api.getResumoEstudosHoje(usuario.id),
    ]);
    setDisciplinas(lista);
    setResumo(dadosHoje || EMPTY_SUMMARY);
    return lista;
  }

  useEffect(() => {
    let ativo = true;
    Promise.all([api.getDisciplinas(usuario.id), api.getResumoEstudosHoje(usuario.id)])
      .then(([lista, dadosHoje]) => {
        if (!ativo) return;
        setDisciplinas(lista);
        setResumo(dadosHoje || EMPTY_SUMMARY);
        const primeiraDisciplina = lista.find(item => item.assuntos.length > 0);
        const primeiroAssunto = primeiraDisciplina?.assuntos.find(item => item.progresso < 100) || primeiraDisciplina?.assuntos[0];
        if (primeiraDisciplina) setSel({ disciplinaId: primeiraDisciplina.id, assuntoId: primeiroAssunto?.id || null });
      })
      .catch(() => { if (ativo) setErro("Não foi possível carregar seus estudos. Tente atualizar a página."); });
    return () => { ativo = false; };
  }, [usuario]);

  useEffect(() => {
    if (!cronometroAtivo) return undefined;
    const interval = setInterval(() => {
      setSegundos(Math.floor((Date.now() - inicioCronometro.current) / 1000));
    }, 250);
    return () => clearInterval(interval);
  }, [cronometroAtivo]);

  function limparFormulario() {
    setReferencia("");
    setPaginas(0);
    setQuestoes(0);
    setAcertos(0);
    setTempoPlanejado("");
    setTempoReal("");
    setConcluir(false);
    setAnotacao("");
    setSegundos(0);
    setCronometroAtivo(false);
    setErro("");
    setMensagem("");
    setMostrarAssuntos(false);
  }

  function selecionarAssunto(disc, topic) {
    setSel({ disciplinaId: disc.id, assuntoId: topic?.id || null });
    limparFormulario();
  }

  function selecionarDisciplina(disc) {
    const inicial = disc.assuntos.find(item => item.progresso < 100) || disc.assuntos[0];
    selecionarAssunto(disc, inicial);
  }

  function alternarCronometro() {
    if (cronometroAtivo) {
      const final = Math.floor((Date.now() - inicioCronometro.current) / 1000);
      setSegundos(final);
      setTempoReal(String(Math.max(1, Math.ceil(final / 60))));
      setCronometroAtivo(false);
      return;
    }
    inicioCronometro.current = Date.now() - segundos * 1000;
    setCronometroAtivo(true);
    setMensagem("");
  }

  function proximoAssunto(listaAtualizada, disciplinaId, assuntoId) {
    const ordemDisciplinas = [...listaAtualizada];
    const indiceDisc = ordemDisciplinas.findIndex(item => item.id === disciplinaId);
    const assuntosDaAtual = ordemDisciplinas[indiceDisc]?.assuntos || [];
    const indiceAtual = assuntosDaAtual.findIndex(item => item.id === assuntoId);
    const depoisNaDisciplina = assuntosDaAtual.slice(indiceAtual + 1).find(item => item.progresso < 100);
    if (depoisNaDisciplina) return { disciplinaId, assuntoId: depoisNaDisciplina.id };

    const ordemSeguinte = [...ordemDisciplinas.slice(indiceDisc + 1), ...ordemDisciplinas.slice(0, indiceDisc)];
    for (const disc of ordemSeguinte) {
      const pendente = disc.assuntos.find(item => item.progresso < 100);
      if (pendente) return { disciplinaId: disc.id, assuntoId: pendente.id };
    }
    return null;
  }

  async function salvarSessao(event) {
    event.preventDefault();
    setErro("");
    setMensagem("");
    if (!disciplina || !assunto) {
      setErro("Selecione uma disciplina e um assunto para registrar o estudo.");
      return;
    }

    const minutosCronometro = cronometroAtivo
      ? Math.ceil((Date.now() - inicioCronometro.current) / 60000)
      : Math.ceil(segundos / 60);
    const minutosEstudados = Math.max(Number(tempoReal) || 0, minutosCronometro);
    const totalQuestoes = Number(questoes) || 0;
    const totalAcertos = Number(acertos) || 0;
    if (minutosEstudados < 1) {
      setErro("Informe o tempo de estudo ou use o cronômetro (mínimo de 1 minuto).");
      return;
    }
    if (totalAcertos > totalQuestoes) {
      setErro("O número de acertos não pode ser maior que o total de questões.");
      return;
    }

    setSalvando(true);
    setCronometroAtivo(false);
    try {
      await api.addSessao(usuario.id, {
        assunto_id: assunto.id,
        disciplina_id: disciplina.id,
        duracao_min: minutosEstudados,
        tempo_planejado_min: Number(tempoPlanejado) || 0,
        paginas_lidas: Number(paginas) || 0,
        questoes_resolvidas: totalQuestoes,
        acertos: totalAcertos,
        referencia,
        progresso_antes: assunto.progresso || 0,
        progresso_depois: concluir ? 100 : assunto.progresso || 0,
        assunto_concluido: concluir,
        anotacao,
      });
      const [lista, dadosHoje] = await Promise.all([
        api.getDisciplinas(usuario.id),
        api.getResumoEstudosHoje(usuario.id),
      ]);
      setDisciplinas(lista);
      setResumo(dadosHoje || EMPTY_SUMMARY);
      const avancar = event.nativeEvent.submitter?.value === "next";
      if (avancar) {
        const destino = proximoAssunto(lista, disciplina.id, assunto.id);
        if (destino) {
          setSel(destino);
          limparFormulario();
          setMensagem("Registro salvo. Próximo assunto carregado.");
        } else {
          limparFormulario();
          setMensagem("Registro salvo. Todos os assuntos pendentes deste edital foram estudados! 🎉");
        }
      } else {
        setTempoReal(String(minutosEstudados));
        setConcluir(concluir || assunto.progresso >= 100);
        setMensagem("Estudo registrado com sucesso.");
      }
    } catch (saveError) {
      setErro(saveError.message || "Não foi possível salvar o estudo.");
    } finally {
      setSalvando(false);
    }
  }

  function percentDisc(disc) {
    return disc.assuntos.length ? Math.round((disc.assuntos.filter(item => item.progresso >= 100).length / disc.assuntos.length) * 100) : 0;
  }

  function renderDisciplinaSelector() {
    return disciplinas.map((disc, index) => {
      const concluidos = disc.assuntos.filter(item => item.progresso >= 100).length;
      const ativa = disciplina?.id === disc.id;
      return (
        <button
          type="button"
          key={disc.id}
          className={`study-discipline ${ativa ? "active" : ""}`}
          style={{ "--discipline-color": disc.cor || ["#3B6D11", "#185FA5", "#854F0B", "#534AB7"][index % 4] }}
          onClick={() => selecionarDisciplina(disc)}
        >
          <span className="study-discipline-icon">◷</span>
          <span className="study-discipline-content">
            <strong>{disc.nome}</strong>
            <small>PROGRESSO · {concluidos}/{disc.assuntos.length} assuntos</small>
            <span className="prog-wrap"><span className="prog-fill" style={{ width: `${percentDisc(disc)}%`, background: "var(--discipline-color)" }} /></span>
          </span>
        </button>
      );
    });
  }

  return (
    <div className="study-page">
      <div className="page-header study-page-header">
        <div>
          <div className="page-title">Estudar</div>
          <div className="page-sub">Registre seu estudo e acompanhe o progresso de hoje.</div>
        </div>
        <div className="study-date-chip">{new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}</div>
      </div>

      <div className="page-body study-page-body">
        <section className="study-summary card" aria-label="Resumo dos estudos de hoje">
          <div className="study-summary-heading">
            <span className="study-summary-play">▷</span>
            <div><strong>Estudos em andamento</strong><small>{resumo.sessoes ? `${resumo.sessoes} registro${resumo.sessoes === 1 ? "" : "s"} hoje` : "Comece registrando seu primeiro estudo"}</small></div>
          </div>
          <div className="study-metrics">
            {metricas.map(item => (
              <div className="study-metric" key={item.label}>
                <small>{item.label}</small><strong style={{ color: item.color }}>{item.value}</strong><span>{item.hint}</span>
              </div>
            ))}
          </div>
        </section>

        {erro && <div className="study-alert error" role="alert">{erro}</div>}
        {mensagem && <div className="study-alert success" role="status">{mensagem}</div>}

        {!disciplinas.length ? (
          <div className="card study-empty">
            <div className="study-empty-icon">📚</div>
            <h2>Nenhuma disciplina para estudar</h2>
            <p>Selecione um edital no Dashboard para carregar as disciplinas e os assuntos do seu plano.</p>
          </div>
        ) : (
          <section className="study-workspace card">
            <div className="study-workspace-heading">
              <div><div className="section-title">▣ Disciplinas do dia</div><small>Escolha uma matéria para registrar seu progresso.</small></div>
              <div className="study-view-toggle" role="group" aria-label="Modo de visualização das disciplinas">
                <button type="button" className={modo === "abas" ? "active" : ""} onClick={() => setModo("abas")}>▣ Abas</button>
                <button type="button" className={modo === "lista" ? "active" : ""} onClick={() => setModo("lista")}>☷ Lista</button>
              </div>
            </div>

            {modo === "abas" && <div className="study-tabs">{renderDisciplinaSelector()}</div>}

            <div className={`study-layout ${modo === "abas" ? "tabs-mode" : "list-mode"}`}>
              {modo === "lista" && <aside className="study-discipline-list">{renderDisciplinaSelector()}</aside>}

              <div className="study-detail">
                {!disciplina ? (
                  <div className="study-no-selection">Selecione uma disciplina para começar.</div>
                ) : !assunto ? (
                  <div className="study-no-selection"><strong>{disciplina.nome}</strong><span>Esta disciplina ainda não possui assuntos cadastrados.</span></div>
                ) : (
                  <>
                    <header className="study-detail-header">
                      <div className="study-detail-title">
                        <span className="study-detail-icon">▣</span>
                        <div><h2>{disciplina.nome}</h2><span>PLANEJADO: {fmtDuration(planejadoAtual)}</span></div>
                      </div>
                      <button type="button" className="btn btn-sm study-all-topics" onClick={() => setMostrarAssuntos(!mostrarAssuntos)}>
                        ☷ {mostrarAssuntos ? "Fechar assuntos" : "Todos os assuntos"}
                      </button>
                    </header>

                    {mostrarAssuntos && (
                      <div className="study-topic-picker">
                        {assuntos.map((item, index) => (
                          <button type="button" key={item.id} className={item.id === assunto.id ? "active" : ""} onClick={() => selecionarAssunto(disciplina, item)}>
                            <span>{item.progresso >= 100 ? "✓" : `${index + 1}.`}</span><span>{item.nome}</span><small>{item.progresso >= 100 ? "Concluído" : `${item.progresso}%`}</small>
                          </button>
                        ))}
                      </div>
                    )}

                    <form className="study-form" onSubmit={salvarSessao}>
                      <div className="study-topic-nav">
                        <span className="study-topic-count">ASSUNTO {indiceAssunto + 1} DE {assuntos.length}</span>
                        <div className="study-topic-arrows">
                          <button type="button" className="btn btn-sm" disabled={indiceAssunto <= 0} onClick={() => selecionarAssunto(disciplina, assuntos[indiceAssunto - 1])}>‹ Anterior</button>
                          <button type="button" className="btn btn-sm" disabled={indiceAssunto >= assuntos.length - 1} onClick={() => selecionarAssunto(disciplina, assuntos[indiceAssunto + 1])}>Próximo ›</button>
                        </div>
                      </div>
                      <h3 className="study-topic-name">{assunto.nome}</h3>
                      <div className="study-form-grid">
                        <label className="study-field">
                          <span>NÚMERO DA AULA / LEI / VÍDEO</span>
                          <input value={referencia} onChange={event => setReferencia(event.target.value)} placeholder="Ex.: Aula 15, Lei 8.112/90, Vídeo 3" />
                        </label>
                        <label className="study-field">
                          <span>PÁGINAS LIDAS</span>
                          <input type="number" min="0" step="1" value={paginas} onChange={event => setPaginas(event.target.value)} />
                        </label>
                        <label className="study-field">
                          <span>QUESTÕES RESOLVIDAS</span>
                          <input type="number" min="0" step="1" value={questoes} onChange={event => setQuestoes(event.target.value)} />
                        </label>
                        <label className="study-field">
                          <span>ACERTOS <small>(máx.: {Number(questoes) || 0})</small></span>
                          <input type="number" min="0" max={Number(questoes) || 0} step="1" value={acertos} onChange={event => setAcertos(event.target.value)} />
                        </label>
                        <label className="study-field">
                          <span>TEMPO PLANEJADO (MINUTOS)</span>
                          <input type="number" min="0" step="5" value={tempoPlanejado} onChange={event => setTempoPlanejado(event.target.value)} placeholder="Ex.: 90" />
                        </label>
                        <label className="study-field study-time-field">
                          <span>TEMPO DE ESTUDO (MINUTOS) <b>*</b></span>
                          <div className="study-time-input-row">
                            <input type="number" min="1" step="1" value={tempoReal} onChange={event => setTempoReal(event.target.value)} placeholder="Obrigatório" />
                            <button type="button" className={`study-timer-button ${cronometroAtivo ? "running" : ""}`} onClick={alternarCronometro}>
                              {cronometroAtivo ? "Ⅱ Pausar" : segundos ? "▶ Retomar" : "▷ Cronometrar"}
                            </button>
                          </div>
                          {(cronometroAtivo || segundos > 0) && <small className="study-timer-readout">{fmtTime(cronometroAtivo ? Math.floor((Date.now() - inicioCronometro.current) / 1000) : segundos)}</small>}
                        </label>
                        <fieldset className="study-complete-field">
                          <legend>ASSUNTO CONCLUÍDO?</legend>
                          <label>
                            <input type="checkbox" checked={assunto.progresso >= 100 || concluir} disabled={assunto.progresso >= 100} onChange={event => setConcluir(event.target.checked)} />
                            <span>{assunto.progresso >= 100 ? "Sim, já concluído" : "Marcar como concluído nesta sessão"}</span>
                          </label>
                        </fieldset>
                        <label className="study-field study-notes-field">
                          <span>OBSERVAÇÕES (OPCIONAL)</span>
                          <textarea value={anotacao} onChange={event => setAnotacao(event.target.value)} placeholder="Dificuldades, insights, materiais utilizados..." rows="3" />
                        </label>
                      </div>

                      <div className="study-save-bar">
                        <div><strong>REGISTRAR PROGRESSO</strong><small>{porcentagemAcerto ? `${porcentagemAcerto}% de aproveitamento nas questões informadas.` : "O registro será associado a este assunto."}</small></div>
                        <div className="study-save-actions">
                          <button type="submit" name="action" value="save" className="btn" disabled={salvando}>{salvando ? "Salvando..." : "Salvar progresso"}</button>
                          <button type="submit" name="action" value="next" className="btn btn-primary" disabled={salvando}>{salvando ? "Salvando..." : "✓ Salvar e próximo"}</button>
                        </div>
                      </div>
                    </form>
                  </>
                )}
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
