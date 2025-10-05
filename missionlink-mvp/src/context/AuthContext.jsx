import { createContext, useContext, useEffect, useState } from "react";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);

  // Prefer .env, but HARD fallback prevents hitting :5173
  const API = import.meta.env.VITE_API_URL || "http://127.0.0.1:5001";

  useEffect(() => {
    const t = localStorage.getItem("token");
    const u = localStorage.getItem("user");
    if (t) setToken(t);
    if (u) {
      try { setUser(JSON.parse(u)); } catch {}
    }
  }, []);

  async function loginRequest(email, password) {
  const url = `${API}/api/auth/login`;   // <-- /api/auth/login
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
    credentials: "include",
  });
  if (!res.ok) throw new Error(`Login failed: ${res.status} ${await res.text()}`);
  const data = await res.json(); // { access_token, role }
  // normalize to { token, user }
  return { token: data.access_token, user: { role: data.role, email } };
}

  async function signupRequest(name, email, password) {
  const url = `${API}/api/auth/register`; // <-- /api/auth/register
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, password }),
    credentials: "include",
  });
  if (!res.ok) throw new Error(`Signup failed: ${res.status} ${await res.text()}`);
  // your API returns { message }, so log the user in by calling loginRequest:
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
