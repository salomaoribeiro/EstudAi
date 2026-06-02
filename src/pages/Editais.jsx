import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useUsuario } from "../hooks/useUsuario";
import { api } from "../lib/api";

export default function Editais() {
  const { usuario } = useUsuario();
  const navigate = useNavigate();
  const [editais, setEditais] = useState([]);
  const [busca, setBusca] = useState("");
  const [detalhe, setDetalhe] = useState(null);
  const [modal, setModal] = useState(false);
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState({ nome: "", instituicao: "", data_prova: "", descricao: "", disciplinas: "" });
  const [loading, setLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [editalMap, setEditalMap] = useState({});

  async function load() {
    // Carrega todos os editais (com informação de inscrição)
    const data = await api.getTodosEditais(usuario.id);
    setEditais(data);
    // Cria um mapa para busca O(1)
    const map = {};
    data.forEach(e => map[e.id] = e);
    setEditalMap(map);
  }

  useEffect(() => {
    load();
  }, [usuario]);

  async function handleAddEdital(e) {
    e.preventDefault();
    if (!form.nome.trim()) return;
    setLoading(true);
    try {
      const disciplinas = form.disciplinas
        .split("\n")
        .map(d => d.trim())
        .filter(d => d);

      if (editando) {
        await api.updateEdital(editando, { ...form, disciplinas });
      } else {
        await api.addEdital({ ...form, disciplinas });
      }

      setForm({ nome: "", instituicao: "", data_prova: "", descricao: "", disciplinas: "" });
      setEditando(null);
      setModal(false);
      await load();
    } finally {
      setLoading(false);
    }
  }

  async function toggleInscrever(edital) {
    try {
      if (edital.inscrito) {
        await api.desinscreverEdital(usuario.id, edital.id);
      } else {
        await api.inscreverEdital(usuario.id, edital.id);
      }
      await load();
    } catch (e) {
      console.error(e);
    }
  }

  function openEdit(edital) {
    setDetalhe(null); // Fecha a view de detalhe
    setEditando(edital.id);
    setForm({
      nome: edital.nome,
      instituicao: edital.instituicao,
      data_prova: edital.data_prova,
      descricao: edital.descricao,
      disciplinas: edital.disciplinas.map(d => d.nome).join("\n")
    });
    setModal(true);
  }

  function closeModal() {
    setModal(false);
    setEditando(null);
    setForm({ nome: "", instituicao: "", data_prova: "", descricao: "", disciplinas: "" });
  }

  async function handleDelEdital(id) {
    setConfirmDelete(id);
  }

  async function confirmDeleteEdital() {
    if (!confirmDelete) return;
    setDeletingId(confirmDelete);
    try {
      await api.deleteEdital(confirmDelete);
      await load();
    } finally {
      setConfirmDelete(null);
      setDeletingId(null);
    }
  }

  async function openDetalhe(editalId) {
    try {
      const data = await api.getEditalProgresso(editalId, usuario.id);
      // Enriquece com dados do edital completo
      const editalCompleto = editalMap[editalId];
      setDetalhe({ ...data, edital: { ...data.edital, disciplinas: editalCompleto?.disciplinas || [] } });
    } catch (e) {
      console.error(e);
    }
  }

  if (detalhe) {
    return (
      <TelaDetalheEdital
        edital={detalhe}
        onBack={() => setDetalhe(null)}
        onEdit={() => {
          const editalCompleto = editalMap[detalhe.edital.id];
          if (editalCompleto) openEdit(editalCompleto);
        }}
      />
    );
  }

  // Filtrar editais baseado na busca
  const editaisFiltrados = editais.filter(e =>
    e.nome.toLowerCase().includes(busca.toLowerCase()) ||
    e.instituicao.toLowerCase().includes(busca.toLowerCase())
  );

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">📋 Editais</div>
          <div className="page-sub">Acompanhe sua preparação para concursos</div>
        </div>
        <button className="btn btn-primary" onClick={() => setModal(true)}>
          + Novo Edital
        </button>
      </div>

      <div className="page-body">
        {editais.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <input
              type="text"
              placeholder="🔍 Buscar edital ou instituição..."
              value={busca}
              onChange={e => setBusca(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 14px",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-md)",
                fontSize: 14,
                fontFamily: "inherit",
                backgroundColor: "var(--surface)",
                color: "var(--text)",
                boxSizing: "border-box"
              }}
            />
          </div>
        )}

        {editais.length === 0 && (
          <div className="empty-state">
            <p>Nenhum edital cadastrado ainda.</p>
            <button className="btn btn-primary" onClick={() => setModal(true)}>
              Criar primeiro edital
            </button>
          </div>
        )}

        {editais.length > 0 && editaisFiltrados.length === 0 && (
          <div className="empty-state">
            <p>Nenhum edital encontrado para "{busca}"</p>
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
          {editaisFiltrados.map((e) => {
            const dias = e.data_prova ? Math.ceil((new Date(e.data_prova) - new Date()) / 86400000) : null;
            return (
              <div
                key={e.id}
                className="card"
                style={{
                  cursor: "pointer",
                  transition: "all 0.2s",
                  borderColor: e.inscrito ? "#3B6D11" : "var(--border)",
                  background: e.inscrito ? "var(--green-50)" : "var(--surface)",
                  display: "flex",
                  flexDirection: "column"
                }}
                onMouseEnter={(el) => (el.currentTarget.style.borderColor = "#2563eb")}
                onMouseLeave={(el) => (el.currentTarget.style.borderColor = e.inscrito ? "#3B6D11" : "var(--border)")}
              >
                <div style={{ marginBottom: 12, flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 4 }}>{e.nome}</div>
                  <div style={{ fontSize: 12, color: "var(--text-3)" }}>
                    {e.instituicao}
                    {dias !== null && dias >= 0 && ` • ${dias} dias`}
                    {dias !== null && dias < 0 && ` • Encerrado`}
                  </div>
                </div>

                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 12, color: "var(--text-3)", fontWeight: 500 }}>
                    {e.total_disciplinas} disciplinas
                  </div>
                </div>

                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={e.inscrito}
                      onChange={(ev) => {
                        ev.stopPropagation();
                        toggleInscrever(e);
                      }}
                      style={{ width: 18, height: 18, cursor: "pointer" }}
                    />
                    <span style={{ fontSize: 14, fontWeight: 500 }}>
                      {e.inscrito ? "Inscrito" : "Inscrever-se"}
                    </span>
                  </label>
                  <button
                    className="btn btn-sm"
                    style={{ background: "var(--border)", color: "var(--text)" }}
                    onClick={(ev) => {
                      ev.stopPropagation();
                      openDetalhe(e.id);
                    }}
                  >
                    Ver →
                  </button>
                  <button
                    className="btn btn-sm"
                    style={{
                      background: "var(--border)",
                      color: "var(--text)",
                      transition: "all 0.2s",
                      padding: "6px 10px"
                    }}
                    onMouseEnter={(el) => {
                      el.currentTarget.style.background = "#ef4444";
                      el.currentTarget.style.color = "#fff";
                    }}
                    onMouseLeave={(el) => {
                      el.currentTarget.style.background = "var(--border)";
                      el.currentTarget.style.color = "var(--text)";
                    }}
                    onClick={(ev) => {
                      ev.stopPropagation();
                      handleDelEdital(e.id);
                    }}
                  >
                    🗑
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {confirmDelete && (
        <div className="modal-overlay" onClick={() => setConfirmDelete(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 18, fontWeight: 600, color: "var(--text)", marginBottom: 8 }}>
                Remover edital?
              </div>
              <div style={{ fontSize: 14, color: "var(--text-3)" }}>
                Esta ação não pode ser desfeita. Todos os usuários inscritos perderão acesso a este edital.
              </div>
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                className="btn"
                onClick={() => setConfirmDelete(null)}
                style={{ background: "var(--border)", color: "var(--text)", flex: 1 }}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={confirmDeleteEdital}
                disabled={deletingId === confirmDelete}
                style={{ background: "#ef4444", flex: 1 }}
              >
                {deletingId === confirmDelete ? "Removendo..." : "Remover"}
              </button>
            </div>
          </div>
        </div>
      )}

      {modal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2 style={{ marginBottom: 20 }}>{editando ? "Editar Edital" : "Novo Edital"}</h2>
            <form onSubmit={handleAddEdital}>
              <div className="form-group">
                <label>Nome do Edital *</label>
                <input
                  type="text"
                  placeholder="Ex: Técnico Bancário TI"
                  value={form.nome}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>Instituição</label>
                <input
                  type="text"
                  placeholder="Ex: Banco do Brasil, TRT, SERPRO"
                  value={form.instituicao}
                  onChange={(e) => setForm({ ...form, instituicao: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>Data da Prova</label>
                <input
                  type="date"
                  value={form.data_prova}
                  onChange={(e) => setForm({ ...form, data_prova: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>Disciplinas Cobradas *</label>
                <textarea
                  placeholder={`Digite as disciplinas separadas por Enter\n\nEx:\nPortuguês\nMatemática\nTecnologia da Informação`}
                  value={form.disciplinas}
                  onChange={(e) => setForm({ ...form, disciplinas: e.target.value })}
                  style={{ minHeight: 120, fontFamily: "monospace", fontSize: 13 }}
                />
              </div>

              <div className="form-group">
                <label>Descrição</label>
                <textarea
                  placeholder="Informações adicionais (opcional)"
                  value={form.descricao}
                  onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                  style={{ minHeight: 80 }}
                />
              </div>

              <div style={{ display: "flex", gap: 8 }}>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? (editando ? "Atualizando..." : "Criando...") : (editando ? "Atualizar" : "Criar Edital")}
                </button>
                <button
                  type="button"
                  className="btn"
                  onClick={closeModal}
                  style={{ background: "var(--border)", color: "var(--text)" }}
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function TelaDetalheEdital({ edital, onBack, onEdit }) {
  const { usuario } = useUsuario();
  const { resumo, disciplinas } = edital;
  const [busca, setBusca] = useState("");
  const [criandoDisciplinas, setCriandoDisciplinas] = useState(false);
  const [expandidos, setExpandidos] = useState({});

  const disciplinasFiltradas = disciplinas.filter((d) => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return true;
    const buscaDisciplina = d.nome.toLowerCase().includes(termo);
    const disciplinaEdicao = edital.edital.disciplinas.find((disc) => disc.nome === d.nome);
    const buscaAssuntos = disciplinaEdicao?.assuntos?.some((ass) => ass.nome.toLowerCase().includes(termo));
    return buscaDisciplina || buscaAssuntos;
  });

  async function criarDisciplinasAutomaticas() {
    if (!edital.edital.disciplinas || edital.edital.disciplinas.length === 0) {
      alert("Nenhuma disciplina cadastrada neste edital");
      return;
    }

    setCriandoDisciplinas(true);
    try {
      let totalAssuntosAdicionados = 0;

      for (const disc of edital.edital.disciplinas) {
        // Criar a disciplina
        const disciplinaCriada = await api.addDisciplina(usuario.id, { nome: disc.nome });

        // Se a disciplina tem assuntos, adicionar todos eles
        if (disc.assuntos && disc.assuntos.length > 0) {
          const nomesAssuntos = disc.assuntos.map(a => a.nome);
          await api.addAssunto(disciplinaCriada.id, { assuntos: nomesAssuntos });
          totalAssuntosAdicionados += disc.assuntos.length;
        }
      }

      const msg = `✓ Sucesso!\n\n${edital.edital.disciplinas.length} disciplinas criadas\n${totalAssuntosAdicionados} assuntos adicionados\n\nAgora você pode:\n✓ Ir para "Minhas Disciplinas" para estudar\n✓ Acompanhar seu progresso aqui`;
      alert(msg);
    } catch (e) {
      console.error(e);
      alert("Erro ao criar disciplinas: " + e.message);
    } finally {
      setCriandoDisciplinas(false);
    }
  }

  const getStatusBadge = (status) => {
    if (status === "completa") return { bg: "#065f46", color: "#10b981", label: "✓ Completa" };
    if (status === "em_progresso") return { bg: "#78350f", color: "#f59e0b", label: "⚠ Em Progresso" };
    return { bg: "#7f1d1d", color: "#ef4444", label: "✗ Urgente" };
  };

  return (
    <div>
      <div className="page-header">
        <div style={{ cursor: "pointer", color: "#2563eb", fontSize: 18 }} onClick={onBack}>
          ← Editais
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            className="btn btn-primary"
            onClick={criarDisciplinasAutomaticas}
            disabled={criandoDisciplinas}
            style={{ background: "#3B6D11" }}
          >
            {criandoDisciplinas ? "Criando..." : "📚 Criar Disciplinas"}
          </button>
          <button className="btn btn-primary" onClick={onEdit}>
            ✎ Editar
          </button>
        </div>
      </div>

      <div className="page-body">
        <div style={{ marginBottom: 30, paddingBottom: 20, borderBottom: "1px solid var(--border)" }}>
          <h1 style={{ fontSize: 24, marginBottom: 8 }}>{edital.edital.nome}</h1>
          <div style={{ fontSize: 13, color: "var(--text-3)" }}>
            {edital.edital.instituicao}
            {edital.edital.data_prova && ` • Prova: ${new Date(edital.edital.data_prova).toLocaleDateString("pt-BR")}`}
          </div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <input
            type="text"
            placeholder="🔍 Buscar disciplina ou assunto..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            style={{
              width: "100%",
              padding: "10px 14px",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-md)",
              fontSize: 14,
              fontFamily: "inherit",
              backgroundColor: "var(--surface)",
              color: "var(--text)",
              boxSizing: "border-box"
            }}
          />
        </div>

        {busca && disciplinasFiltradas.length === 0 && (
          <div className="empty-state" style={{ marginBottom: 20 }}>
            <p>Nenhuma disciplina ou assunto encontrado para "{busca}"</p>
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 30 }}>
          <div className="card" style={{ textAlign: "center", padding: 16 }}>
            <div style={{ fontSize: 28, fontWeight: 600, color: "#2563eb", marginBottom: 4 }}>
              {resumo.progressoGeral}%
            </div>
            <div style={{ fontSize: 12, color: "var(--text-3)" }}>Progresso Geral</div>
          </div>
          <div className="card" style={{ textAlign: "center", padding: 16 }}>
            <div style={{ fontSize: 28, fontWeight: 600, color: "#10b981", marginBottom: 4 }}>
              {resumo.completadas}
            </div>
            <div style={{ fontSize: 12, color: "var(--text-3)" }}>Disciplinas Completas</div>
          </div>
          <div className="card" style={{ textAlign: "center", padding: 16 }}>
            <div style={{ fontSize: 28, fontWeight: 600, color: "#ef4444", marginBottom: 4 }}>
              {resumo.urgentes}
            </div>
            <div style={{ fontSize: 12, color: "var(--text-3)" }}>Faltando Estudar</div>
          </div>
        </div>

        <h3 style={{ marginBottom: 16, fontSize: 14 }}>Progresso por Disciplina</h3>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {disciplinasFiltradas.map((d) => {
            const badge = getStatusBadge(d.status);
            const isExpandido = expandidos[d.id];
            return (
              <div key={d.id}>
                <div
                  className="card"
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: 12,
                    background: "var(--bg-2)",
                    cursor: "pointer",
                    transition: "all 0.2s",
                  }}
                  onClick={() => setExpandidos({ ...expandidos, [d.id]: !isExpandido })}
                  onMouseEnter={(el) => (el.currentTarget.style.background = "var(--gray-50)")}
                  onMouseLeave={(el) => (el.currentTarget.style.background = "var(--bg-2)")}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 500, marginBottom: 6, display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 12, color: "var(--text-3)" }}>{isExpandido ? "▼" : "▶"}</span>
                      {d.nome}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-3)", display: "flex", gap: 16 }}>
                      <span>{d.progresso}% estudado</span>
                      <span>{d.horasEstudadas.toFixed(1)} horas</span>
                    </div>
                  </div>
                  <div
                    style={{
                      background: badge.bg,
                      color: badge.color,
                      padding: "4px 12px",
                      borderRadius: 12,
                      fontSize: 11,
                      fontWeight: 600,
                    }}
                  >
                    {badge.label}
                  </div>
                </div>

                {isExpandido && (
                  <div style={{ marginLeft: 12, marginTop: 8, borderLeft: "2px solid var(--border)", paddingLeft: 12, paddingBottom: 12, display: "flex", flexDirection: "column", gap: 8, background: "var(--surface)", borderRadius: 8, padding: 12, marginTop: 8 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text)" }}>
                      Assuntos requeridos ({d.assuntos_totais}):
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-3)", lineHeight: 1.6, maxHeight: 200, overflowY: "auto" }}>
                      <ul style={{ margin: 0, marginLeft: 20 }}>
                        {edital.edital.disciplinas
                          .find(disc => disc.nome === d.nome)
                          ?.assuntos.map((ass, idx) => (
                            <li key={idx} style={{ marginBottom: 4 }}>
                              {ass.nome}
                            </li>
                          )) || []}
                      </ul>
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
                      ✓ Você estudou <strong>{d.assuntos_estudados} de {d.assuntos_totais}</strong> assuntos dessa disciplina
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
