import { BrowserRouter, Routes, Route } from "react-router-dom";
import "./index.css";
import { UserProvider, useUsuario } from "./hooks/useUsuario";
import Sidebar from "./components/Sidebar";
import SelecionarUsuario from "./pages/SelecionarUsuario";
import Dashboard from "./pages/Dashboard";
import Disciplinas from "./pages/Disciplinas";
import Sessao from "./pages/Sessao";
import Meta from "./pages/Meta";
import Grupo from "./pages/Grupo";
import Editais from "./pages/Editais";

function Shell() {
  const { usuario } = useUsuario();
  if (!usuario) return <SelecionarUsuario />;
  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main-content">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/disciplinas" element={<Disciplinas />} />
          <Route path="/editais" element={<Editais />} />
          <Route path="/sessao" element={<Sessao />} />
          <Route path="/meta" element={<Meta />} />
          <Route path="/grupo" element={<Grupo />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <UserProvider>
        <Shell />
      </UserProvider>
    </BrowserRouter>
  );
}
