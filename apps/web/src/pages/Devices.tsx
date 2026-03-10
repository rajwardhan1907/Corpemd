import { useState, useEffect, useCallback } from "react";
import * as api from "../lib/api";

const T = { card:"#0e1118", border:"#1e2535", text:"#e2e8f4", muted:"#7a8aa8", dim:"#4a5568", blue:"#3b82f6", green:"#22c55e", red:"#ef4444", amber:"#f59e0b", redDim:"#7f1d1d", inp:"#131720" };
const inp: React.CSSProperties = { background:T.inp, border:`1px solid ${T.border}`, borderRadius:8, color:T.text, padding:"8px 12px", fontSize:13, outline:"none", fontFamily:"inherit" };

export default function DevicesPage({ user }: { user: any }) {
  const [devices, setDevices] = useState<any[]>([]);
  const [search, setSearch]   = useState("");
  const [loading, setLoading] = useState(true);
  const [toast, setToast]     = useState<string | null>(null);
  const canWipe = ["super_admin","admin"].includes(user.role);
  const canAct  = user.role !== "read_only";

  const load = useCallback(() => {
    setLoading(true);
    api.listDevices(search ? { search } : undefined)
      .then(r => setDevices(r.devices))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [search]);

  useEffect(() => { load(); }, [load]);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3500); };

  const cmd = async (id: string, type: string, name: string) => {
    if (type === "WIPE" && !confirm(`Factory reset ${name}? This cannot be undone.`)) return;
    try {
      await api.issueCommand(id, type);
      showToast(`${type} queued for ${name}`);
      if (type === "WIPE") setTimeout(load, 2000);
    } catch (e: any) { alert(e.message); }
  };

  const compColor = (c: string) => c === "compliant" ? T.green : c === "non-compliant" ? T.red : T.amber;

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      <div style={{ display:"flex", gap:10, alignItems:"center" }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, model, serial…" style={{ ...inp, flex:1 }} />
        <span style={{ fontSize:12, color:T.muted }}>{devices.length} devices</span>
      </div>

      <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:12, overflow:"hidden" }}>
        <div style={{ overflowX:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
            <thead>
              <tr style={{ borderBottom:`1px solid ${T.border}` }}>
                {["Name","Model","OS","Group","Battery","Compliance","Policy","Status",canAct?"Actions":""].map(h => (
                  <th key={h} style={{ textAlign:"left", padding:"10px 14px", fontSize:10, fontWeight:700, color:T.muted, textTransform:"uppercase", letterSpacing:"0.07em", whiteSpace:"nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading
                ? <tr><td colSpan={9} style={{ padding:24, textAlign:"center", color:T.muted }}>Loading…</td></tr>
                : devices.length === 0
                  ? <tr><td colSpan={9} style={{ padding:24, textAlign:"center", color:T.dim }}>No devices found.</td></tr>
                  : devices.map(d => (
                    <tr key={d.id} style={{ borderBottom:`1px solid ${T.border}` }}>
                      <td style={{ padding:"11px 14px", fontFamily:"monospace", color:T.text, fontWeight:600 }}>{d.name}</td>
                      <td style={{ padding:"11px 14px", color:T.muted }}>{d.model ?? "—"}</td>
                      <td style={{ padding:"11px 14px", color:T.muted }}>{d.os_version ?? "—"}</td>
                      <td style={{ padding:"11px 14px", color:T.muted }}>{d.group_name ?? "—"}</td>
                      <td style={{ padding:"11px 14px" }}>
                        {d.battery_level != null
                          ? <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                              <div style={{ width:40, height:4, background:"#1e2535", borderRadius:99 }}>
                                <div style={{ height:"100%", width:`${d.battery_level * 100}%`, background: d.battery_level > 0.5 ? T.green : d.battery_level > 0.2 ? T.amber : T.red, borderRadius:99 }} />
                              </div>
                              <span style={{ color:T.dim, fontSize:11 }}>{Math.round(d.battery_level * 100)}%</span>
                            </div>
                          : <span style={{ color:T.dim }}>—</span>}
                      </td>
                      <td style={{ padding:"11px 14px" }}>
                        <span style={{ fontWeight:700, fontSize:11, color:compColor(d.compliance_status), textTransform:"uppercase" }}>{d.compliance_status}</span>
                      </td>
                      <td style={{ padding:"11px 14px", color:T.muted, fontSize:11 }}>{d.policy_name ?? "—"}</td>
                      <td style={{ padding:"11px 14px" }}>
                        <span style={{ fontWeight:700, fontSize:11, color: d.status === "online" ? T.green : T.dim }}>{d.status}</span>
                      </td>
                      {canAct && (
                        <td style={{ padding:"11px 14px" }}>
                          <div style={{ display:"flex", gap:5 }}>
                            {["LOCK","SYNC","REBOOT"].map(t => (
                              <button key={t} onClick={() => cmd(d.id, t, d.name)} style={{ background:"transparent", border:`1px solid ${T.border}`, borderRadius:5, color:T.muted, padding:"3px 8px", fontSize:10, cursor:"pointer", fontWeight:600 }}>{t}</button>
                            ))}
                            {canWipe && (
                              <button onClick={() => cmd(d.id, "WIPE", d.name)} style={{ background:"transparent", border:`1px solid ${T.redDim}`, borderRadius:5, color:T.red, padding:"3px 8px", fontSize:10, cursor:"pointer", fontWeight:600 }}>WIPE</button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))
              }
            </tbody>
          </table>
        </div>
      </div>

      {toast && (
        <div style={{ position:"fixed", bottom:24, right:24, background:"#131720", border:`1px solid ${T.border}`, borderRadius:10, padding:"12px 18px", fontSize:13, color:T.text, zIndex:999, boxShadow:"0 8px 32px rgba(0,0,0,0.4)" }}>
          ✓ {toast}
        </div>
      )}
    </div>
  );
}
