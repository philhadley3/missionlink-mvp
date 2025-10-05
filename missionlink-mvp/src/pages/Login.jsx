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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const data = await loginRequest(email, password);
      console.log("[Login] response ->", data);
      // Expecting { token, user }
      login(data.token, data.user);
      navigate("/dashboard");
    } catch (err) {
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card" style={{ maxWidth: 400, margin: "2rem auto" }}>
      <h2 style={{ textAlign: "center" }}>Sign In</h2>

      <form onSubmit={handleSubmit} className="form">
        <div className="form-row">
          <label htmlFor="email">Email</label>
          <input id="email" type="email" value={email}
                 onChange={(e) => setEmail(e.target.value)} required />
        </div>

        <div className="form-row">
          <label htmlFor="password">Password</label>
          <input id="password" type="password" value={password}
                 onChange={(e) => setPassword(e.target.value)} required />
        </div>

        {error && <div style={{ color: "salmon" }}>{error}</div>}

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
