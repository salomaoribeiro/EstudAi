import { createContext, useContext, useState, useEffect } from "react";

const Ctx = createContext(null);

export function UserProvider({ children }) {
  const [usuario, setUsuario] = useState(() => {
    try { return JSON.parse(localStorage.getItem("estudai_usuario")); } catch { return null; }
  });

  function login(u) {
    setUsuario(u);
    localStorage.setItem("estudai_usuario", JSON.stringify(u));
  }

  function logout() {
    setUsuario(null);
    localStorage.removeItem("estudai_usuario");
  }

  return <Ctx.Provider value={{ usuario, login, logout }}>{children}</Ctx.Provider>;
}

export function useUsuario() { return useContext(Ctx); }
