import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export default function SignUp() {
  const navigate = useNavigate();
  const { signupRequest, login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [accessCode, setAccessCode] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      // Now passing accessCode as 4th arg
      // signupRequest() hits /api/auth/register, then logs in (returns { token, user })
      const { token, user } = await signupRequest(
        name.trim(),
        email.trim(),
        password,
        accessCode.trim()
      );
      login(token, user);            // persist token + user
      navigate("/dashboard");        // adjust path if yours differs
    } catch (err) {
      // Prefer server-provided message if available
      let msg = err?.bodyText || err?.message || "Signup failed";
      try {
        const j = JSON.parse(msg);
        if (j?.message) msg = j.message;
        if (j?.error) msg = `${j.error}${j.message ? `: ${j.message}` : ""}`;
      } catch {}
      // Helpful mapping for common case:
      if (/access code/i.test(msg) || (err?.status === 403)) {
        msg = "Invalid access code";
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card" style={{ maxWidth: 400, margin: "2rem auto" }}>
      <h2 style={{ textAlign: "center" }}>Create Account</h2>

      <form onSubmit={handleSubmit} className="form" noValidate>
        <div className="form-row">
          <label htmlFor="name">Name</label>
          <input
            id="name"
            name="name"
            type="text"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>

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
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        <div className="form-row">
          <label htmlFor="accessCode">Access Code</label>
          <input
            id="accessCode"
            name="accessCode"
            type="text"
            value={accessCode}
            onChange={(e) => setAccessCode(e.target.value)}
            placeholder="Enter your access code"
            aria-describedby="accessCodeHelp"
            required
          />
          <div id="accessCodeHelp" style={{ marginTop: 6, fontSize: 12, opacity: 0.9 }}>
            Don’t have a code? Request one at{" "}
            <a href="mailto:contact@anchorsforlife.org">contact@anchorsforlife.org</a>
            .
          </div>
        </div>

        {error && <div style={{ color: "salmon", marginTop: 8 }}>{error}</div>}

        <button type="submit" className="btn" disabled={loading}>
          {loading ? "Creating..." : "Sign Up"}
        </button>
      </form>

      <div style={{ marginTop: "1rem", textAlign: "center" }}>
        <Link to="/login">Back to Sign In</Link>
      </div>
    </div>
  );
}
