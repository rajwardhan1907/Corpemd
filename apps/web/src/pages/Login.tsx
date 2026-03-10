import { useState } from "react";

const T = { bg:"#0a0c10", card:"#0e1118", border:"#1e2535", text:"#e2e8f4", muted:"#7a8aa8", blue:"#3b82f6", red:"#ef4444", redDim:"#7f1d1d" };
const inp: React.CSSProperties = { width:"100%", background:"#131720", border:`1px solid ${T.border}`, borderRadius:8, color:T.text, padding:"10px 12px", fontSize:13, outline:"none", boxSizing:"border-box", fontFamily:"inherit" };

interface Props { onLogin: (email: string, password: string) => Promise<void>; }

export default function Login({ onLogin }: Props) {
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);

  const submit = async () => {
    if (!email || !password) return;
    setLoading(true); setError("");
    try { await onLogin(email, password); }
    catch (e: any) { setError(e.message ?? "Login failed"); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:T.bg }}>
      <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:14, padding:36, width:360 }}>
        <div style={{ fontWeight:800, fontSize:22, color:T.text, marginBottom:4 }}>CorpEMD</div>
        <div style={{ color:T.muted, fontSize:13, marginBottom:24 }}>Enterprise Android MDM</div>

        {error && (
          <div style={{ background:"rgba(239,68,68,0.08)", border:`1px solid ${T.redDim}`, borderRadius:8, padding:"10px 14px", color:T.red, fontSize:13, marginBottom:14 }}>
            {error}
          </div>
        )}

        <div style={{ marginBottom:10 }}>
          <label style={{ fontSize:11, color:T.muted, display:"block", marginBottom:5, fontWeight:600, textTransform:"uppercase", letterSpacing:"0.06em" }}>Email</label>
          <input value={email} onChange={e => setEmail(e.target.value)} type="email" placeholder="admin@corp.local" style={inp} />
        </div>
        <div style={{ marginBottom:20 }}>
          <label style={{ fontSize:11, color:T.muted, display:"block", marginBottom:5, fontWeight:600, textTransform:"uppercase", letterSpacing:"0.06em" }}>Password</label>
          <input value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === "Enter" && submit()} type="password" placeholder="••••••••" style={inp} />
        </div>

        <button onClick={submit} disabled={loading || !email || !password} style={{ width:"100%", background:T.blue, color:"#fff", border:"none", borderRadius:8, padding:"11px", fontWeight:700, fontSize:14, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.6 : 1 }}>
          {loading ? "Signing in…" : "Sign In"}
        </button>

        <div style={{ marginTop:16, fontSize:11, color:T.muted, textAlign:"center" }}>
          Default: admin@corp.local / changeme123
        </div>
      </div>
    </div>
  );
}
