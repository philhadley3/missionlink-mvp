import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export default function Login() {
  const { login, loginRequest } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { token, user } = await loginRequest(email.trim(), password);
      login(token, user);               // persist to localStorage + context
      navigate("/dashboard");           // adjust if your route differs
    } catch (err) {
      // Prefer server message if our api.js threw HttpError with bodyText
      let msg = err?.bodyText || err?.message || "Login failed";
      try {
        const j = JSON.parse(msg);
        if (j?.message) msg = j.message;
        if (j?.error) msg = `${j.error}${j.message ? `: ${j.message}` : ""}`;
      } catch {}
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card" style={{ maxWidth: 400, margin: "2rem auto" }}>
      <h2 style={{ textAlign: "center" }}>Sign In</h2>

      <form onSubmit={handleSubmit} className="form" noValidate>
        <div className="form-row">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <div className="form-row">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        {error && <div style={{ color: "salmon", marginTop: 8 }}>{error}</div>}

        <button type="submit" className="btn" disabled={loading}>
          {loading ? "Signing In..." : "Sign In"}
        </button>
      </form>

      <div style={{ marginTop: "1rem", textAlign: "center" }}>
        <span>Don’t have an account?</span><br />
        <Link to="/signup" className="btn" style={{ marginTop: 8, display: "inline-block" }}>
          Create Account
        </Link>
      </div>
    </div>
  );
}
