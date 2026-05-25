import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useUsuario } from "../hooks/useUsuario";

const CORES = ["#3B6D11","#185FA5","#854F0B","#534AB7","#993556","#0F6E56","#A32D2D"];

export default function SelecionarUsuario() {
  const { login } = useUsuario();
  const [usuarios, setUsuarios] = useState([]);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ nome: "", cor: CORES[0] });
  const [loading, setLoading] = useState(false);

  async function load() {
    setUsuarios(await api.getUsuarios());
  }
  useEffect(() => { load(); }, []);

  async function handleAdd(e) {
    e.preventDefault();
    if (!form.nome.trim()) return;
    setLoading(true);
    try {
      const u = await api.addUsuario(form);
      await load();
      login(u);
    } catch (e) { alert(e.message); }
    setLoading(false);
  }

  function iniciais(nome) {
    return nome.split(" ").slice(0, 2).map(p => p[0]).join("").toUpperCase();
  }

  return (
    <div className="user-select-screen">
      <div className="user-select-card">
        <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
          <div style={{ width: 48, height: 48, background: "#3B6D11", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px", color: "#fff", fontSize: 22, fontWeight: 700 }}>E</div>
          <div className="user-select-title">estudaí</div>
          <div className="user-select-sub">Quem vai estudar hoje?</div>
        </div>

        {usuarios.map(u => (
          <button key={u.id} className="user-btn" onClick={() => login(u)}>
            <div className="user-avatar" style={{ background: u.cor }}>
              {iniciais(u.nome)}
            </div>
            {u.nome}
          </button>
        ))}

        <button className="user-btn" style={{ borderStyle: "dashed", color: "var(--text-3)", marginTop: 4 }} onClick={() => setModal(true)}>
          <div style={{ width: 32, height: 32, borderRadius: "50%", border: "1.5px dashed var(--gray-400)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, color: "var(--gray-400)" }}>+</div>
          Novo usuário
        </button>
      </div>

      {modal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div className="modal">
            <div className="modal-title">Novo usuário</div>
            <form onSubmit={handleAdd}>
              <div className="form-group">
                <label className="form-label">Seu nome</label>
                <input className="form-input" placeholder="ex: Ana Silva" value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} autoFocus />
              </div>
              <div className="form-group">
                <label className="form-label">Cor do perfil</label>
                <div className="flex-gap" style={{ flexWrap: "wrap", gap: 8 }}>
                  {CORES.map(c => (
                    <div key={c} onClick={() => setForm(f => ({ ...f, cor: c }))}
                      style={{ width: 28, height: 28, borderRadius: "50%", background: c, cursor: "pointer", outline: form.cor === c ? `3px solid ${c}` : "none", outlineOffset: 2 }} />
                  ))}
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn" onClick={() => setModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? "Criando..." : "Criar"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
