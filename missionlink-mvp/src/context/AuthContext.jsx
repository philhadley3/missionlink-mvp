import { createContext, useContext, useEffect, useState } from "react";
import { api } from "../lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);

  useEffect(() => {
    const t = localStorage.getItem("token");
    const u = localStorage.getItem("user");
    if (t) setToken(t);
    if (u) {
      try { setUser(JSON.parse(u)); } catch {}
    }
  }, []);

  async function loginRequest(email, password) {
    // Hits /api/auth/login (helper handles base + headers)
    const data = await api("/api/auth/login", {
      method: "POST",
      body: { email, password },
      credentials: "include",
    });
    const jwt = data?.access_token || data?.token;
    return { token: jwt, user: { role: data?.role, email } };
  }

  async function signupRequest(name, email, password) {
    // Hits /api/auth/register
    await api("/api/auth/register", {
      method: "POST",
      body: { name, email, password },
      credentials: "include",
    });
    // Immediately log them in
    return loginRequest(email, password);
  }

  const login = (jwt, userObj) => {
    setToken(jwt);
    setUser(userObj);
    localStorage.setItem("token", jwt);
    localStorage.setItem("user", JSON.stringify(userObj));
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem("token");
    localStorage.removeItem("user");
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, loginRequest, signupRequest }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
