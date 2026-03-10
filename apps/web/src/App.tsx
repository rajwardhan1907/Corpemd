import { useState, useEffect } from "react";
import * as api from "./lib/api";
import Login    from "./pages/Login";
import Layout   from "./components/Layout";
import Dashboard  from "./pages/Dashboard";
import DevicesPage from "./pages/Devices";
import EnrollPage  from "./pages/Enroll";
import PoliciesPage from "./pages/Policies";
import GroupsPage   from "./pages/Groups";
import AuditPage    from "./pages/Audit";
import WebhooksPage from "./pages/Webhooks";
import UsersPage    from "./pages/Users";
import HealthPage   from "./pages/Health";

export type Page = "dashboard"|"devices"|"enroll"|"policies"|"groups"|"audit"|"webhooks"|"users"|"health";
export interface AuthUser { id: string; email: string; role: string; }

export default function App() {
  const [user, setUser]     = useState<AuthUser | null>(null);
  const [page, setPage]     = useState<Page>("dashboard");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("corpemd_token");
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        if (payload.exp * 1000 > Date.now())
          setUser({ id: payload.sub, email: payload.email, role: payload.role });
        else api.clearToken();
      } catch { api.clearToken(); }
    }
    setLoading(false);
  }, []);

  const handleLogin = async (email: string, password: string) => {
    const res = await api.login(email, password);
    api.setToken(res.token);
    localStorage.setItem("corpemd_refresh", res.refresh);
    setUser(res.user);
  };

  const handleLogout = () => { api.clearToken(); setUser(null); };

  if (loading) return null;
  if (!user)   return <Login onLogin={handleLogin} />;

  const pages: Record<Page, JSX.Element> = {
    dashboard: <Dashboard user={user} />,
    devices:   <DevicesPage user={user} />,
    enroll:    <EnrollPage />,
    policies:  <PoliciesPage user={user} />,
    groups:    <GroupsPage user={user} />,
    audit:     <AuditPage />,
    webhooks:  <WebhooksPage user={user} />,
    users:     <UsersPage user={user} />,
    health:    <HealthPage />,
  };

  return (
    <Layout page={page} setPage={setPage} user={user} onLogout={handleLogout}>
      {pages[page]}
    </Layout>
  );
}
