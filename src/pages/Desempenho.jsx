import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { differenceInCalendarDays, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useUsuario } from "../hooks/useUsuario";
import { api } from "../lib/api";

const ABAS = ["Resumo", "Tendências", "Disciplinas", "Atividade", "Relatório"];

function dataLocal(date) {
  const ano = date.getFullYear();
  const mes = String(date.getMonth() + 1).padStart(2, "0");
  const dia = String(date.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

function dataDeHoje() {
  return dataLocal(new Date());
}

function dataDeDiasAtras(dias) {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - dias);
  return dataLocal(date);
}

function horas(minutos) {
  const valor = Number(minutos) || 0;
  return `${(valor / 60).toFixed(1)}h`;
}

function percentual(value) {
  return value == null ? "—" : `${value}%`;
}

function criarAtividade90Dias(registros = []) {
  const mapa = new Map(registros.map(item => [item.dia, item]));
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  return Array.from({ length: 90 }, (_, indice) => {
    const dia = new Date(hoje);
    dia.setDate(hoje.getDate() - (89 - indice));
    const chave = dataLocal(dia);
    const dados = mapa.get(chave) || {};
    return {
      dia: chave,
      data: dia,
      minutos_estudados: Number(dados.minutos_estudados) || 0,
      questoes_resolvidas: Number(dados.questoes_resolvidas) || 0,
      acertos: Number(dados.acertos) || 0,
      paginas_lidas: Number(dados.paginas_lidas) || 0,
      assuntos_estudados: Number(dados.assuntos_estudados) || 0,
    };
  });
}

function gerarTendencia(atividade) {
  return atividade.slice(-30).map(item => ({
    ...item,
    label: format(item.data, "dd/MM", { locale: ptBR }),
    erros: Math.max(0, item.questoes_resolvidas - item.acertos),
  }));
}

export default function Desempenho() {
  const { usuario } = useUsuario();
  const [editais, setEditais] = useState([]);
  const [editalId, setEditalId] = useState("");
  const [dados, setDados] = useState(null);
  const [aba, setAba] = useState("Resumo");
  const [carregandoEditais, setCarregandoEditais] = useState(true);
  const [carregandoDados, setCarregandoDados] = useState(false);
  const [erro, setErro] = useState("");
  const [periodoRelatorio, setPeriodoRelatorio] = useState("ano");
  const [dataInicioRelatorio, setDataInicioRelatorio] = useState(() => dataDeDiasAtras(365));
  const [dataFimRelatorio, setDataFimRelatorio] = useState(dataDeHoje);
  const [relatorio, setRelatorio] = useState(null);
  const [carregandoRelatorio, setCarregandoRelatorio] = useState(false);
  const [erroRelatorio, setErroRelatorio] = useState("");

  useEffect(() => {
    let ativo = true;
    async function carregarEditais() {
      setCarregandoEditais(true);
      try {
        const [lista, config] = await Promise.all([
          api.getTodosEditais(usuario.id),
          api.getConfig(usuario.id),
        ]);
        if (!ativo) return;
        setEditais(lista);
        const escolhido = lista.find(edital => Number(edital.id) === Number(config.edital_selecionado)) || lista[0];
        if (escolhido) {
          setEditalId(String(escolhido.id));
          if (Number(config.edital_selecionado) !== Number(escolhido.id)) {
            await api.setEditalSelecionado(usuario.id, escolhido.id);
          }
        }
      } catch (loadError) {
        if (ativo) setErro(loadError.message || "Não foi possível carregar os editais.");
      } finally {
        if (ativo) setCarregandoEditais(false);
      }
    }
    carregarEditais();
    return () => { ativo = false; };
  }, [usuario]);

  useEffect(() => {
    if (!editalId) {
      setDados(null);
      return undefined;
    }
    let ativo = true;
    setCarregandoDados(true);
    setErro("");
    api.getDesempenhoEdital(usuario.id, editalId)
      .then(resultado => { if (ativo) setDados(resultado); })
      .catch(loadError => { if (ativo) setErro(loadError.message || "Não foi possível carregar o desempenho do edital."); })
      .finally(() => { if (ativo) setCarregandoDados(false); });
    return () => { ativo = false; };
  }, [usuario, editalId]);

  useEffect(() => {
    if (aba !== "Relatório" || !editalId || !dataInicioRelatorio || !dataFimRelatorio) return undefined;
    let ativo = true;
    setCarregandoRelatorio(true);
    setErroRelatorio("");
    api.getRelatorioEdital(usuario.id, editalId, dataInicioRelatorio, dataFimRelatorio)
      .then(resultado => { if (ativo) setRelatorio(resultado); })
      .catch(loadError => { if (ativo) { setRelatorio(null); setErroRelatorio(loadError.message || "Não foi possível carregar o relatório."); } })
      .finally(() => { if (ativo) setCarregandoRelatorio(false); });
    return () => { ativo = false; };
  }, [aba, usuario, editalId, dataInicioRelatorio, dataFimRelatorio]);

  const atividade = useMemo(() => criarAtividade90Dias(dados?.atividade), [dados]);
  const tendencia = useMemo(() => gerarTendencia(atividade), [atividade]);
  const maxMinutos = Math.max(1, ...atividade.map(item => item.minutos_estudados));
  const prova = dados?.edital?.data_prova ? new Date(`${dados.edital.data_prova}T00:00:00`) : null;
  const diasParaProva = prova ? differenceInCalendarDays(prova, new Date()) : null;

  async function mudarEdital(event) {
    const novoId = event.target.value;
    setEditalId(novoId);
    setDados(null);
    if (!novoId) return;
    try {
      await api.setEditalSelecionado(usuario.id, Number(novoId));
    } catch (saveError) {
      setErro(saveError.message || "Não foi possível salvar o edital selecionado.");
    }
  }

  function escolherPeriodo(periodo) {
    setPeriodoRelatorio(periodo);
    setRelatorio(null);
    if (periodo === "30") setDataInicioRelatorio(dataDeDiasAtras(29));
    if (periodo === "90") setDataInicioRelatorio(dataDeDiasAtras(89));
    if (periodo === "ano") setDataInicioRelatorio(dataDeDiasAtras(365));
    if (periodo !== "personalizado") setDataFimRelatorio(dataDeHoje());
  }

  function mudarDataInicio(event) {
    setPeriodoRelatorio("personalizado");
    setDataInicioRelatorio(event.target.value);
  }

  function mudarDataFim(event) {
    setPeriodoRelatorio("personalizado");
    setDataFimRelatorio(event.target.value);
  }

  const resumo = dados?.resumo;
  const metricas = resumo ? [
    { rotulo: "Cobertura", valor: `${resumo.cobertura}%`, detalhe: `${resumo.assuntos_estudados}/${resumo.total_assuntos} assuntos vistos`, icone: "↗", cor: "var(--purple-600, #534AB7)" },
    { rotulo: "Acerto global", valor: percentual(resumo.acerto_percentual), detalhe: `${resumo.acertos}/${resumo.questoes_resolvidas} questões`, icone: "◎", cor: "var(--green-600)" },
    { rotulo: "Horas estudadas", valor: horas(resumo.minutos_estudados), detalhe: `${resumo.minutos_estudados} minutos no edital`, icone: "◷", cor: "var(--amber-400)" },
    { rotulo: "Páginas lidas", valor: resumo.paginas_lidas.toLocaleString("pt-BR"), detalhe: "Total registrado no edital", icone: "▤", cor: "var(--blue-600)" },
    { rotulo: "Assuntos concluídos", valor: resumo.assuntos_concluidos, detalhe: `${resumo.total_assuntos - resumo.assuntos_concluidos} pendentes`, icone: "✓", cor: "var(--green-600)" },
  ] : [];

  const disciplinasOrdenadas = [...(dados?.disciplinas || [])].sort((a, b) => {
    const acertoA = a.acerto_percentual ?? -1;
    const acertoB = b.acerto_percentual ?? -1;
    return acertoB - acertoA || b.progresso - a.progresso || a.nome.localeCompare(b.nome, "pt-BR");
  });
  const errosQuestoes = Math.max(0, (resumo?.questoes_resolvidas || 0) - (resumo?.acertos || 0));
  const materiasComEstudo = (dados?.disciplinas || []).filter(disciplina => disciplina.sessoes > 0).length;
  const dadosAcerto = resumo?.questoes_resolvidas
    ? [
        { nome: "Acertos", valor: resumo.acertos, cor: "#10b981" },
        { nome: "Erros", valor: errosQuestoes, cor: "#ef3325" },
      ].filter(item => item.valor > 0)
    : [{ nome: "Sem questões", valor: 1, cor: "var(--gray-200)" }];

  return (
    <div className="performance-page">
      <header className="page-header performance-header">
        <div>
          <span className="performance-eyebrow">DESEMPENHO</span>
          <h1 className="page-title">Seu desempenho</h1>
          <p className="page-sub">Análise consolidada das suas metas e resultados por edital.</p>
        </div>
        <label className="performance-edital-picker">
          <span>Edital analisado</span>
          <select className="form-input" value={editalId} onChange={mudarEdital} disabled={carregandoEditais || !editais.length}>
            {!editais.length && <option value="">Nenhum edital cadastrado</option>}
            {editais.map(edital => <option key={edital.id} value={edital.id}>{edital.nome}</option>)}
          </select>
          {diasParaProva != null && <small>{diasParaProva >= 0 ? `Prova em ${diasParaProva} dias` : "Data da prova já passou"}</small>}
        </label>
      </header>

      <main className="page-body performance-body">
        {erro && <div className="study-alert error" role="alert">{erro}</div>}
        {carregandoEditais || carregandoDados ? (
          <div className="card performance-empty">Carregando desempenho do edital...</div>
        ) : !editais.length ? (
          <div className="card performance-empty">
            <strong>Nenhum edital cadastrado</strong>
            <span>Cadastre ou selecione um edital na área Editais para acompanhar seu desempenho.</span>
          </div>
        ) : resumo && (
          <>
            <section className="performance-metrics">
              {metricas.map(item => (
                <article className="performance-metric card" key={item.rotulo}>
                  <div className="performance-metric-top"><span>{item.rotulo}</span><i style={{ color: item.cor }}>{item.icone}</i></div>
                  <strong>{item.valor}</strong>
                  <small>{item.detalhe}</small>
                  <span className="performance-watermark" aria-hidden="true">{item.icone}</span>
                </article>
              ))}
            </section>

            <nav className="performance-tabs" aria-label="Seções de desempenho">
              {ABAS.map(item => <button type="button" className={aba === item ? "active" : ""} key={item} onClick={() => setAba(item)}>{item}</button>)}
            </nav>

            {aba === "Resumo" && (
              <div className="performance-panels performance-summary-panels">
                <section className="card performance-panel performance-general-panel">
                  <div className="performance-section-title"><span>◎</span><div><strong>Desempenho geral</strong><small>RESULTADOS REGISTRADOS NO EDITAL SELECIONADO</small></div></div>
                  <div className="performance-general-content">
                    <div className="performance-general-metrics">
                      <article><span>Questões resolvidas</span><strong>{resumo.questoes_resolvidas}</strong></article>
                      <article><span>Acertos</span><strong className="correct">{resumo.acertos}</strong></article>
                      <article><span>Matérias estudadas</span><strong>{materiasComEstudo}</strong></article>
                      <article><span>Erros</span><strong className="incorrect">{errosQuestoes}</strong></article>
                    </div>
                    <div className="performance-accuracy-chart">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={dadosAcerto} dataKey="valor" nameKey="nome" cx="50%" cy="50%" innerRadius="63%" outerRadius="88%" paddingAngle={resumo.questoes_resolvidas ? 2 : 0} stroke="var(--surface)" strokeWidth={3}>
                            {dadosAcerto.map(item => <Cell key={item.nome} fill={item.cor} />)}
                          </Pie>
                          <Tooltip
                            formatter={(value, name) => [value, name]}
                            contentStyle={{
                              backgroundColor: "var(--surface)",
                              color: "var(--text)",
                              opacity: 1,
                              fontSize: 12,
                              borderRadius: 8,
                              border: "1px solid var(--border)",
                              boxShadow: "0 6px 20px rgba(0, 0, 0, 0.22)",
                            }}
                            labelStyle={{ color: "var(--text)", fontWeight: 600 }}
                            itemStyle={{ color: "var(--text)" }}
                            wrapperStyle={{ zIndex: 20 }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="performance-accuracy-center">
                        <strong>{percentual(resumo.acerto_percentual)}</strong>
                        <span>de acerto</span>
                      </div>
                    </div>
                    <div className="performance-accuracy-legend">
                      <span><i className="correct-dot" />Acertos <strong>{resumo.acertos}</strong></span>
                      <span><i className="incorrect-dot" />Erros <strong>{errosQuestoes}</strong></span>
                    </div>
                  </div>
                </section>
                <section className="card performance-panel performance-edital-progress">
                  <div className="performance-section-title"><span>↗</span><div><strong>Batida do edital</strong><small>COBERTURA DO CONTEÚDO PROGRAMÁTICO</small></div></div>
                  <div className="performance-progress-label"><strong>{resumo.cobertura}% da cobertura</strong><span>{resumo.assuntos_estudados} de {resumo.total_assuntos} assuntos estudados</span></div>
                  <div className="prog-wrap performance-progress-track"><div className="prog-fill" style={{ width: `${resumo.cobertura}%` }} /></div>
                  <div className="performance-status-grid">
                    <div><small>CONCLUÍDOS</small><strong>{resumo.assuntos_concluidos}</strong></div>
                    <div><small>EM ANDAMENTO</small><strong>{resumo.assuntos_estudados - resumo.assuntos_concluidos}</strong></div>
                    <div><small>NÃO INICIADOS</small><strong>{resumo.total_assuntos - resumo.assuntos_estudados}</strong></div>
                  </div>
                </section>

                <section className="card performance-panel performance-last-seven-panel">
                  <div className="performance-section-title"><span>◷</span><div><strong>Últimos 7 dias</strong><small>MINUTOS DE ESTUDO NESTE EDITAL</small></div></div>
                  <div className="performance-chart performance-chart-short">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={tendencia.slice(-7)} margin={{ top: 8, right: 12, left: -20, bottom: 0 }}>
                        <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--text-3)" }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 10, fill: "var(--text-3)" }} axisLine={false} tickLine={false} />
                        <Tooltip formatter={value => [`${value} min`, "Estudo"]} contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid var(--border)" }} />
                        <Bar dataKey="minutos_estudados" fill="var(--green-600)" radius={[5, 5, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </section>

                <section className="card performance-panel performance-priority-disciplines-panel">
                  <div className="performance-section-title"><span>▣</span><div><strong>Disciplinas para acompanhar</strong><small>MAIOR COBERTURA PENDENTE</small></div></div>
                  <div className="performance-mini-disciplines">
                    {[...dados.disciplinas].sort((a, b) => a.progresso - b.progresso).slice(0, 5).map(disciplina => (
                      <div className="performance-mini-discipline" key={disciplina.id}>
                        <div><strong>{disciplina.nome}</strong><span>{disciplina.assuntos_estudados}/{disciplina.total_assuntos}</span></div>
                        <div className="prog-wrap"><div className="prog-fill" style={{ width: `${disciplina.progresso}%` }} /></div>
                      </div>
                    ))}
                    {!dados.disciplinas.length && <div className="performance-no-data">Este edital ainda não possui disciplinas.</div>}
                  </div>
                </section>
              </div>
            )}

            {aba === "Tendências" && (
              <div className="performance-panels">
                <section className="card performance-panel performance-chart-panel">
                  <div className="performance-section-title"><span>↗</span><div><strong>Volume de estudo</strong><small>MINUTOS REGISTRADOS POR DIA — ÚLTIMOS 30 DIAS</small></div></div>
                  <div className="performance-chart">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={tendencia} margin={{ top: 12, right: 18, left: -14, bottom: 0 }}>
                        <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="label" interval={4} tick={{ fontSize: 10, fill: "var(--text-3)" }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 10, fill: "var(--text-3)" }} axisLine={false} tickLine={false} />
                        <Tooltip formatter={value => [`${value} min`, "Estudo"]} contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid var(--border)" }} />
                        <Line type="monotone" dataKey="minutos_estudados" name="Minutos" stroke="var(--green-600)" strokeWidth={3} dot={false} activeDot={{ r: 5 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  {!resumo.minutos_estudados && <div className="performance-chart-empty">Seus registros de estudo deste edital aparecerão aqui.</div>}
                </section>
                <section className="card performance-panel performance-chart-panel">
                  <div className="performance-section-title"><span>◎</span><div><strong>Questões por dia</strong><small>QUESTÕES RESOLVIDAS E ACERTOS — ÚLTIMOS 30 DIAS</small></div></div>
                  <div className="performance-chart">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={tendencia} margin={{ top: 12, right: 18, left: -14, bottom: 0 }}>
                        <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="label" interval={4} tick={{ fontSize: 10, fill: "var(--text-3)" }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 10, fill: "var(--text-3)" }} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid var(--border)" }} />
                        <Line type="monotone" dataKey="questoes_resolvidas" name="Questões" stroke="var(--blue-600)" strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="acertos" name="Acertos" stroke="var(--green-600)" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  {!resumo.questoes_resolvidas && <div className="performance-chart-empty">Registre questões na tela Estudar para criar esta tendência.</div>}
                </section>
                <section className="card performance-panel performance-chart-panel">
                  <div className="performance-section-title"><span>✓</span><div><strong>Acertos e erros por dia</strong><small>QUESTÕES CERTAS E ERRADAS — ÚLTIMOS 30 DIAS</small></div></div>
                  <div className="performance-chart">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={tendencia} margin={{ top: 12, right: 18, left: -14, bottom: 0 }}>
                        <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="label" interval={4} tick={{ fontSize: 10, fill: "var(--text-3)" }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 10, fill: "var(--text-3)" }} axisLine={false} tickLine={false} allowDecimals={false} />
                        <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid var(--border)" }} />
                        <Line type="monotone" dataKey="acertos" name="Certas" stroke="var(--green-600)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                        <Line type="monotone" dataKey="erros" name="Erradas" stroke="var(--red-400)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  {!resumo.questoes_resolvidas && <div className="performance-chart-empty">Registre questões e acertos na tela Estudar para acompanhar esta evolução.</div>}
                </section>
                <section className="card performance-panel performance-chart-panel">
                  <div className="performance-section-title"><span>▤</span><div><strong>Páginas lidas por dia</strong><small>EVOLUÇÃO DA LEITURA — ÚLTIMOS 30 DIAS</small></div></div>
                  <div className="performance-chart">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={tendencia} margin={{ top: 12, right: 18, left: -14, bottom: 0 }}>
                        <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="label" interval={4} tick={{ fontSize: 10, fill: "var(--text-3)" }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 10, fill: "var(--text-3)" }} axisLine={false} tickLine={false} allowDecimals={false} />
                        <Tooltip formatter={value => [`${value} páginas`, "Leitura"]} contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid var(--border)" }} />
                        <Bar dataKey="paginas_lidas" name="Páginas lidas" fill="var(--blue-600)" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  {!resumo.paginas_lidas && <div className="performance-chart-empty">Registre as páginas lidas na tela Estudar para acompanhar esta evolução.</div>}
                </section>
              </div>
            )}

            {aba === "Disciplinas" && (
              <section className="card performance-panel">
                <div className="performance-section-title"><span>▣</span><div><strong>Desempenho por disciplina</strong><small>ACERTO, COBERTURA, QUESTÕES E TEMPO INVESTIDO</small></div></div>
                <div className="performance-discipline-grid">
                  {disciplinasOrdenadas.map(disciplina => (
                    <article className="performance-discipline-card" key={disciplina.id}>
                      <div className="performance-discipline-head"><span>DISCIPLINA</span><strong className={disciplina.acerto_percentual != null && disciplina.acerto_percentual >= 70 ? "good" : ""}>{percentual(disciplina.acerto_percentual)}<small>ACERTO</small></strong></div>
                      <h3>{disciplina.nome}</h3>
                      <div className="performance-discipline-row"><span>ACERTO</span><strong>{disciplina.acertos}/{disciplina.questoes_resolvidas}</strong></div>
                      <div className="performance-discipline-row"><span>COBERTURA</span><strong>{disciplina.assuntos_estudados}/{disciplina.total_assuntos}</strong></div>
                      <div className="prog-wrap"><div className="prog-fill" style={{ width: `${disciplina.progresso}%` }} /></div>
                      <div className="performance-discipline-foot"><span>{disciplina.questoes_resolvidas} questões</span><span>{horas(disciplina.minutos_estudados)}</span></div>
                    </article>
                  ))}
                  {!disciplinasOrdenadas.length && <div className="performance-no-data">Este edital ainda não possui disciplinas cadastradas.</div>}
                </div>
              </section>
            )}

            {aba === "Atividade" && (
              <section className="card performance-panel">
                <div className="performance-section-title"><span>▦</span><div><strong>Mapa de atividade — últimos 90 dias</strong><small>{atividade.filter(item => item.minutos_estudados > 0).length} dias ativos · Total: {horas(atividade.reduce((total, item) => total + item.minutos_estudados, 0) )}</small></div></div>
                <div className="performance-heatmap" role="list" aria-label="Atividade diária nos últimos 90 dias">
                  {atividade.map(item => {
                    const nivel = item.minutos_estudados === 0 ? 0 : Math.min(4, Math.ceil((item.minutos_estudados / maxMinutos) * 4));
                    const titulo = `${format(item.data, "d 'de' MMMM", { locale: ptBR })}: ${item.minutos_estudados} min, ${item.questoes_resolvidas} questões, ${item.paginas_lidas} páginas`;
                    return <span key={item.dia} className={`performance-heat-cell level-${nivel}`} title={titulo} role="listitem" />;
                  })}
                </div>
                <div className="performance-heat-legend"><span>MENOS</span>{[0, 1, 2, 3, 4].map(level => <i key={level} className={`performance-heat-cell level-${level}`} />)}<span>MAIS</span></div>
                <div className="performance-activity-summary">
                  <div><small>QUESTÕES</small><strong>{resumo.questoes_resolvidas}</strong></div>
                  <div><small>PÁGINAS</small><strong>{resumo.paginas_lidas}</strong></div>
                  <div><small>ACERTO GLOBAL</small><strong>{percentual(resumo.acerto_percentual)}</strong></div>
                </div>
              </section>
            )}

            {aba === "Relatório" && (
              <section className="card performance-panel performance-report-panel">
                <div className="performance-section-title"><span>▤</span><div><strong>Relatório de estudos</strong><small>ASSUNTOS, DISCIPLINAS, TEMPO E DIAS SEM REGISTRO</small></div></div>
                <div className="performance-report-filters">
                  <div className="performance-period-buttons" role="group" aria-label="Período do relatório">
                    {[{ id: "30", label: "30 dias" }, { id: "90", label: "90 dias" }, { id: "ano", label: "Último ano" }, { id: "personalizado", label: "Personalizado" }].map(item => (
                      <button type="button" className={periodoRelatorio === item.id ? "active" : ""} key={item.id} onClick={() => escolherPeriodo(item.id)}>{item.label}</button>
                    ))}
                  </div>
                  <label><span>De</span><input type="date" value={dataInicioRelatorio} max={dataFimRelatorio || undefined} onChange={mudarDataInicio} /></label>
                  <label><span>Até</span><input type="date" value={dataFimRelatorio} min={dataInicioRelatorio || undefined} max={dataDeHoje()} onChange={mudarDataFim} /></label>
                </div>

                {erroRelatorio && <div className="study-alert error" role="alert">{erroRelatorio}</div>}
                {carregandoRelatorio ? (
                  <div className="performance-empty">Carregando relatório...</div>
                ) : relatorio && (
                  <>
                    <div className="performance-report-summary">
                      <div><small>DIAS COM REGISTRO</small><strong>{relatorio.resumo.dias_com_registro}</strong></div>
                      <div><small>DIAS SEM REGISTRO</small><strong>{relatorio.resumo.dias_sem_registro}</strong></div>
                      <div><small>TEMPO ESTUDADO</small><strong>{horas(relatorio.resumo.minutos_estudados)}</strong></div>
                      <div><small>PÁGINAS</small><strong>{relatorio.resumo.paginas_lidas}</strong></div>
                      <div><small>QUESTÕES / ACERTOS</small><strong>{relatorio.resumo.questoes_resolvidas} / {relatorio.resumo.acertos}</strong></div>
                    </div>
                    <p className="performance-report-note">“Sem registro” indica que nenhuma sessão foi salva nesse dia; não confirma que você não estudou fora do sistema.</p>
                    <div className="performance-report-days">
                      {relatorio.dias.map(dia => (
                        <details className={`performance-report-day ${dia.sem_registro ? "no-study" : "studied"}`} key={dia.dia}>
                          <summary>
                            <span className="performance-report-date">{format(new Date(`${dia.dia}T00:00:00`), "EEE, dd/MM/yyyy", { locale: ptBR })}</span>
                            <span className={`performance-day-status ${dia.sem_registro ? "empty" : "done"}`}>{dia.sem_registro ? "Sem registro" : `${dia.sessoes} ${dia.sessoes === 1 ? "sessão" : "sessões"}`}</span>
                            <span className="performance-report-topics">{dia.assuntos.length ? dia.assuntos.map(item => `${item.disciplina}: ${item.assunto}`).join(" · ") : "Nenhum assunto registrado"}</span>
                            <strong className="performance-report-duration">{dia.minutos_estudados ? horas(dia.minutos_estudados) : "—"}</strong>
                            <span className="performance-report-extra">{dia.paginas_lidas} pág. · {dia.questoes_resolvidas} questões</span>
                            <span className="performance-report-chevron">⌄</span>
                          </summary>
                          {!dia.sem_registro && (
                            <div className="performance-report-details">
                              {dia.assuntos.map(item => (
                                <div className="performance-report-topic" key={`${item.disciplina}-${item.assunto}`}>
                                  <div><strong>{item.disciplina}</strong><span>{item.assunto}</span></div>
                                  <span>{horas(item.minutos_estudados)} · {item.paginas_lidas} pág. · {item.acertos}/{item.questoes_resolvidas} acertos</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </details>
                      ))}
                    </div>
                  </>
                )}
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}
