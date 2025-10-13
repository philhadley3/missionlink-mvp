import { useAuth } from "../context/AuthContext.jsx";

export default function Dashboard() {
  const { user } = useAuth();
  return (
    <div style={{ padding: 16 }}>
      <h2>Dashboard</h2>
      <p>
        Welcome{user?.name ? `, ${user.name}` : ""}! Edit profile, upload avatar,
        manage country assignments, and create reports.
      </p>
    </div>
  );
}