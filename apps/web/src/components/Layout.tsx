import type { Page } from "../App";

interface Props { page: Page; setPage: (p: Page) => void; user: any; onLogout: () => void; children: React.ReactNode; }

const T = { bg:"#0a0c10", card:"#0e1118", border:"#1e2535", text:"#e2e8f4", muted:"#7a8aa8", dim:"#4a5568", blue:"#3b82f6", green:"#22c55e", blueGlow:"rgba(59,130,246,0.15)", blueDim:"#1d3a6e" };

const NAV: { id: Page; label: string }[] = [
  { id: "dashboard", label: "Dashboard" },
  { id: "devices",   label: "Devices" },
  { id: "enroll",    label: "Enroll" },
  { id: "policies",  label: "Policies" },
  { id: "groups",    label: "Groups" },
  { id: "audit",     label: "Audit Log" },
  { id: "webhooks",  label: "Webhooks" },
  { id: "users",     label: "Users" },
  { id: "health",    label: "System Health" },
];

export default function Layout({ page, setPage, user, onLogout, children }: Props) {
  return (
    <div style={{ display:"flex", minHeight:"100vh", background:T.bg, color:T.text, fontFamily:"'Inter',system-ui,sans-serif" }}>
      {/* Sidebar */}
      <div style={{ width:220, background:T.card, borderRight:`1px solid ${T.border}`, display:"flex", flexDirection:"column", position:"sticky", top:0, height:"100vh" }}>
        <div style={{ padding:"18px 18px 14px", borderBottom:`1px solid ${T.border}` }}>
          <div style={{ fontWeight:800, fontSize:15, color:T.text, letterSpacing:"-0.3px" }}>CorpEMD</div>
          <div style={{ fontSize:10, color:T.dim, letterSpacing:"0.08em", marginTop:2 }}>ENTERPRISE MDM</div>
        </div>
        <nav style={{ flex:1, padding:"10px 8px", display:"flex", flexDirection:"column", gap:2 }}>
          {NAV.map(n => (
            <button key={n.id} onClick={() => setPage(n.id)} style={{
              display:"block", width:"100%", textAlign:"left", padding:"9px 12px", borderRadius:8,
              border: page === n.id ? `1px solid ${T.blueDim}` : "1px solid transparent",
              background: page === n.id ? T.blueGlow : "transparent",
              color: page === n.id ? T.blue : T.muted,
              fontWeight: page === n.id ? 600 : 400, fontSize:13, cursor:"pointer",
            }}>
              {n.label}
            </button>
          ))}
        </nav>
        <div style={{ padding:"12px 16px", borderTop:`1px solid ${T.border}` }}>
          <div style={{ fontSize:11, color:T.muted, marginBottom:2 }}>{user.email}</div>
          <div style={{ fontSize:10, color:T.dim, marginBottom:8, textTransform:"uppercase", letterSpacing:"0.06em" }}>{user.role.replace("_"," ")}</div>
          <button onClick={onLogout} style={{ fontSize:12, color:T.dim, background:"transparent", border:"none", cursor:"pointer", padding:0 }}>Sign out</button>
        </div>
      </div>

      {/* Main */}
      <div style={{ flex:1, display:"flex", flexDirection:"column", minWidth:0 }}>
        <div style={{ height:54, background:T.card, borderBottom:`1px solid ${T.border}`, display:"flex", alignItems:"center", padding:"0 24px", gap:12 }}>
          <span style={{ fontWeight:700, fontSize:14, color:T.text, textTransform:"capitalize", flex:1 }}>
            {NAV.find(n => n.id === page)?.label}
          </span>
          <div style={{ display:"flex", alignItems:"center", gap:7, padding:"5px 12px", background:"rgba(34,197,94,0.08)", border:"1px solid rgba(34,197,94,0.2)", borderRadius:8 }}>
            <span style={{ width:7, height:7, borderRadius:"50%", background:T.green, display:"inline-block" }} />
            <span style={{ fontSize:11, color:T.green, fontWeight:700 }}>LIVE</span>
          </div>
        </div>
        <main style={{ flex:1, padding:24, overflowY:"auto" }}>{children}</main>
      </div>
    </div>
  );
}
