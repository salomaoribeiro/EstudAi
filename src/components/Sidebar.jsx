import { useLocation, useNavigate } from "react-router-dom";
import { useUsuario } from "../hooks/useUsuario";

const links = [
  { path: "/",            label: "Dashboard",      icon: "⊞" },
  { path: "/disciplinas", label: "Disciplinas",    icon: "◫" },
  { path: "/editais",     label: "Editais",        icon: "📋" },
  { path: "/sessao",      label: "Estudar",        icon: "▷" },
  { path: "/meta",        label: "Meta & prova",   icon: "◎" },
  { path: "/grupo",       label: "Grupo",          icon: "◈" },
];

function iniciais(nome) {
  return nome.split(" ").slice(0,2).map(p=>p[0]).join("").toUpperCase();
}

export default function Sidebar() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { usuario, logout } = useUsuario();
  const hoje = new Date().toLocaleDateString("pt-BR", { weekday:"long", day:"numeric", month:"short" });

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="logo-mark">E</div>
        estudaí
      </div>
      <nav style={{ flex:1 }}>
        {links.map(l => (
          <div key={l.path} className={`nav-item ${pathname===l.path?"active":""}`} onClick={()=>navigate(l.path)}>
            <span style={{ fontSize:16,width:17,textAlign:"center" }}>{l.icon}</span>
            {l.label}
          </div>
        ))}
      </nav>
      <div className="sidebar-footer">
        <div className="text-muted text-sm mb-1">{hoje}</div>
        {usuario && (
          <div className="user-chip" onClick={logout} title="Trocar usuário">
            <div style={{ width:26,height:26,borderRadius:"50%",background:usuario.cor,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:600,color:"#fff",flexShrink:0 }}>
              {iniciais(usuario.nome)}
            </div>
            <span className="text-sm" style={{ flex:1 }}>{usuario.nome}</span>
            <span className="text-muted text-sm">sair</span>
          </div>
        )}
      </div>
    </aside>
  );
}
