import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext.jsx";
import NavBar from "./components/NavBar.jsx";
import GlobeView from "./pages/GlobeView.jsx";
import MissionaryDashboard from "./pages/MissionaryDashboard.jsx";
import Login from "./pages/Login.jsx";
import SignUp from "./pages/SignUp.jsx";

function PrivateRoute({ children }) {
  const { token } = useAuth();
  return token ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <div style={{ display: "flex", minHeight: "100dvh", flexDirection: "column" }}>
          <NavBar />
          <main style={{ flex: "1 1 auto" }}>
            <Routes>
              <Route path="/" element={<Navigate to="/globe" replace />} />
              <Route path="/globe" element={<GlobeView />} />
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<SignUp />} />

              {/* 🔐 Private missionary dashboard */}
              <Route
                path="/dashboard"
                element={
                  <PrivateRoute>
                    <MissionaryDashboard />
                  </PrivateRoute>
                }
              />

              <Route path="*" element={<Navigate to="/globe" replace />} />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}
