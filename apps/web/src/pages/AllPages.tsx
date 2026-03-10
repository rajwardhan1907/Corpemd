import { useState, useEffect } from "react";
import * as api from "../lib/api";

const T = { card:"#0e1118", border:"#1e2535", elev:"#131720", text:"#e2e8f4", muted:"#7a8aa8", dim:"#4a5568", blue:"#3b82f6", green:"#22c55e", red:"#ef4444", amber:"#f59e0b", redDim:"#7f1d1d", blueDim:"#1d3a6e" };
const inp: React.CSSProperties = { background:T.elev, border:`1px solid ${T.border}`, borderRadius:7, color:T.text, padding:"8px 10px", fontSize:12, outline:"none", width:"100%", boxSizing:"border-box", fontFamily:"inherit" };
const card: React.CSSProperties = { background:T.card, border:`1px solid ${T.border}`, borderRadius:12, padding:20 };
const label: React.CSSProperties = { fontSize:11, color:T.muted, display:"block", marginBottom:5, fontWeight:600, textTransform:"uppercase", letterSpacing:"0.06em" };

// ─── ENROLL ──────────────────────────────────────────────────────────────────
export function EnrollPage() {
  const [groups,   setGroups]   = useState<any[]>([]);
  const [policies, setPolicies] = useState<any[]>([]);
  const [method,   setMethod]   = useState("qr");
  const [groupId,  setGroupId]  = useState("");
  const [policyId, setPolicyId] = useState("");
  const [ttl,      setTtl]      = useState(24);
  const [result,   setResult]   = useState<any>(null);
  const [loading,  setLoading]  = useState(false);

  useEffect(() => {
    api.listGroups().then(r   => { setGroups(r.groups);     if (r.groups[0])   setGroupId(r.groups[0].id); });
    api.listPolicies().then(r => { setPolicies(r.policies); if (r.policies[0]) setPolicyId(r.policies[0].id); });
  }, []);

  const generate = async () => {
    if (!groupId || !policyId) return alert("Select a group and policy first.");
    setLoading(true);
    try { setResult(await api.createToken({ group_id: groupId, policy_id: policyId, method, ttl_hours: ttl })); }
    catch (e: any) { alert(e.message); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20 }}>
      <div style={card}>
        <div style={{ fontWeight:700, fontSize:14, color:T.text, marginBottom:16 }}>Enrollment Configuration</div>
        {[
          ["Method", <select value={method} onChange={e => setMethod(e.target.value)} style={inp}><option value="qr">QR Code</option><option value="zero_touch">Zero-Touch</option><option value="nfc">NFC Bump</option><option value="manual">Manual Token</option></select>],
          ["Group",  <select value={groupId} onChange={e => setGroupId(e.target.value)} style={inp}>{groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}</select>],
          ["Policy", <select value={policyId} onChange={e => setPolicyId(e.target.value)} style={inp}>{policies.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>],
          ["Token valid (hours)", <input type="number" value={ttl} onChange={e => setTtl(Number(e.target.value))} min={1} max={168} style={inp} />],
        ].map(([l, el]) => (
          <div key={String(l)} style={{ marginBottom:14 }}>
            <label style={label}>{String(l)}</label>
            {el as JSX.Element}
          </div>
        ))}
        <button onClick={generate} disabled={loading || !groupId || !policyId} style={{ width:"100%", background:T.blue, color:"#fff", border:"none", borderRadius:8, padding:"10px", fontWeight:700, fontSize:13, cursor:"pointer", opacity: loading ? 0.6 : 1 }}>
          {loading ? "Generating…" : "Generate Token"}
        </button>
      </div>

      <div style={card}>
        <div style={{ fontWeight:700, fontSize:14, color:T.text, marginBottom:16 }}>Token</div>
        {!result
          ? <div style={{ color:T.dim, fontSize:13, textAlign:"center", marginTop:40 }}>Configure and generate a token.</div>
          : <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
              <div style={{ textAlign:"center", background:"#0a0c10", borderRadius:10, padding:"18px 20px" }}>
                <div style={{ fontSize:11, color:T.muted, marginBottom:6 }}>SHORT CODE</div>
                <div style={{ fontSize:36, fontWeight:800, color:T.blue, letterSpacing:"0.25em", fontFamily:"monospace" }}>{result.shortCode}</div>
              </div>
              <div style={{ background:"#0a0c10", borderRadius:8, padding:12 }}>
                <div style={{ fontSize:10, color:T.muted, marginBottom:4, fontWeight:600 }}>FULL TOKEN</div>
                <div style={{ fontFamily:"monospace", fontSize:11, color:T.text, wordBreak:"break-all" }}>{result.tokenValue}</div>
              </div>
              {result.method === "zero_touch" && (
                <div style={{ background:"#0a0c10", borderRadius:8, padding:12 }}>
                  <div style={{ fontSize:10, color:T.muted, marginBottom:4, fontWeight:600 }}>ZERO-TOUCH DPC EXTRAS (paste in portal)</div>
                  <pre style={{ fontFamily:"monospace", fontSize:10, color:T.text, margin:0, whiteSpace:"pre-wrap" }}>{JSON.stringify(result.zeroTouchExtras, null, 2)}</pre>
                </div>
              )}
              <div style={{ background:"rgba(34,197,94,0.07)", border:"1px solid rgba(34,197,94,0.2)", borderRadius:7, padding:"8px 12px", fontSize:12, color:T.green }}>
                ✓ Expires: {new Date(result.expiresAt).toLocaleString()}
              </div>
            </div>
        }
      </div>
    </div>
  );
}

// ─── POLICIES ─────────────────────────────────────────────────────────────────
export function PoliciesPage({ user }: { user: any }) {
  const [policies, setPolicies] = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [editing, setEditing]   = useState<string | null>(null);
  const [cfg, setCfg]           = useState<Record<string,any>>({});
  const [toast, setToast]       = useState<string|null>(null);
  const canEdit = ["super_admin","admin"].includes(user.role);

  const load = () => api.listPolicies().then(r => setPolicies(r.policies)).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(null), 3000); };

  const push = async (p: any) => {
    try { await api.updatePolicy(p.id, { config: cfg[p.id] ?? JSON.parse(p.config ?? "{}") }); load(); showToast(`${p.name} pushed`); setEditing(null); }
    catch (e: any) { alert(e.message); }
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
      {loading ? <div style={{ color:T.muted }}>Loading…</div> : policies.map(p => (
        <div key={p.id} style={card}>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <div style={{ flex:1 }}>
              <div style={{ fontWeight:700, fontSize:14, color:T.text }}>{p.name}</div>
              <div style={{ fontSize:11, color:T.muted, marginTop:2 }}>v{p.version} · {p.device_count ?? 0} devices · <span style={{ color: p.status === "active" ? T.green : T.dim }}>{p.status}</span></div>
            </div>
            {canEdit && <>
              <button onClick={() => setEditing(editing === p.id ? null : p.id)} style={{ background:"transparent", border:`1px solid ${T.border}`, borderRadius:7, color:T.muted, padding:"6px 14px", fontSize:12, cursor:"pointer" }}>Edit</button>
              <button onClick={() => push(p)} style={{ background:T.blue, border:"none", borderRadius:7, color:"#fff", padding:"6px 14px", fontSize:12, cursor:"pointer", fontWeight:600 }}>Push</button>
            </>}
          </div>
          {editing === p.id && (
            <div style={{ marginTop:16, display:"flex", flexDirection:"column", gap:12 }}>
              {[["Wi-Fi SSID","wifiSsid","text"],["Min Password Length","passwordMinLength","number"]].map(([l,k,t]) => (
                <div key={k}>
                  <label style={label}>{l}</label>
                  <input type={t} defaultValue={JSON.parse(p.config ?? "{}")[k] ?? ""} onChange={e => setCfg(c => ({ ...c, [p.id]: { ...(c[p.id] ?? {}), [k]: t==="number"?Number(e.target.value):e.target.value } }))} style={inp} />
                </div>
              ))}
              {[["Camera Disabled","cameraDisabled"],["Screenshot Disabled","screenshotDisabled"],["USB Disabled","usbDisabled"],["Factory Reset Disabled","factoryResetDisabled"]].map(([l,k]) => (
                <label key={k} style={{ display:"flex", alignItems:"center", gap:8, cursor:"pointer", fontSize:12, color:T.muted }}>
                  <input type="checkbox" defaultChecked={JSON.parse(p.config ?? "{}")[k] ?? false} onChange={e => setCfg(c => ({ ...c, [p.id]: { ...(c[p.id] ?? {}), [k]: e.target.checked } }))} style={{ accentColor:T.blue }} />{l}
                </label>
              ))}
              <div>
                <label style={label}>App Whitelist (one package per line)</label>
                <textarea defaultValue={JSON.parse(p.config ?? "{}").appWhitelist ?? ""} onChange={e => setCfg(c => ({ ...c, [p.id]: { ...(c[p.id] ?? {}), appWhitelist: e.target.value } }))} rows={4} style={{ ...inp, resize:"vertical", fontFamily:"monospace" }} />
              </div>
              <div style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
                <button onClick={() => setEditing(null)} style={{ background:"transparent", border:`1px solid ${T.border}`, borderRadius:7, color:T.muted, padding:"6px 14px", fontSize:12, cursor:"pointer" }}>Cancel</button>
                <button onClick={() => push(p)} style={{ background:T.blue, border:"none", borderRadius:7, color:"#fff", padding:"6px 14px", fontSize:12, cursor:"pointer", fontWeight:600 }}>Save & Push</button>
              </div>
            </div>
          )}
        </div>
      ))}
      {toast && <div style={{ position:"fixed", bottom:24, right:24, background:"#131720", border:`1px solid ${T.border}`, borderRadius:10, padding:"12px 18px", fontSize:13, color:T.text, zIndex:999 }}>✓ {toast}</div>}
    </div>
  );
}

// ─── GROUPS ───────────────────────────────────────────────────────────────────
export function GroupsPage({ user }: { user: any }) {
  const [groups, setGroups] = useState<any[]>([]);
  const canEdit = ["super_admin","admin"].includes(user.role);
  useEffect(() => { api.listGroups().then(r => setGroups(r.groups)); }, []);
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
      {groups.map(g => (
        <div key={g.id} style={card}>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <div style={{ flex:1 }}>
              <div style={{ fontWeight:700, fontSize:14, color:T.text }}>{g.name}</div>
              <div style={{ fontSize:11, color:T.muted, marginTop:2 }}>{g.device_count ?? 0} devices · Policy: {g.policy_name ?? "none"}</div>
            </div>
            <span style={{ fontWeight:700, fontSize:11, color:T.blue, background:T.blueDim, borderRadius:5, padding:"3px 9px" }}>{g.device_count ?? 0} devices</span>
          </div>
        </div>
      ))}
      {groups.length === 0 && <div style={{ color:T.dim, fontSize:13 }}>No groups yet. Create groups via the API or expand this page.</div>}
    </div>
  );
}

// ─── AUDIT ────────────────────────────────────────────────────────────────────
export function AuditPage() {
  const [logs, setLogs]     = useState<any[]>([]);
  const [filter, setFilter] = useState("");
  const load = (f?: string) => api.listAudit({ limit:"100", ...(f ? { action: f } : {}) }).then(r => setLogs(r.logs));
  useEffect(() => { load(); }, []);

  const resultColor = (r: string) => r === "SUCCESS" ? T.green : T.red;
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
      <div style={{ display:"flex", gap:10 }}>
        <input value={filter} onChange={e => { setFilter(e.target.value); load(e.target.value); }} placeholder="Filter by action…" style={{ background:T.elev, border:`1px solid ${T.border}`, borderRadius:8, color:T.text, padding:"8px 12px", fontSize:13, outline:"none", width:220 }} />
        <a href="/api/v1/audit-logs/export.csv" download style={{ background:"transparent", border:`1px solid ${T.border}`, borderRadius:7, color:T.muted, padding:"8px 14px", fontSize:12, cursor:"pointer", textDecoration:"none" }}>Export CSV</a>
        <span style={{ alignSelf:"center", fontSize:12, color:T.muted }}>{logs.length} entries</span>
      </div>
      <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:12, overflow:"hidden" }}>
        <div style={{ overflowX:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
            <thead><tr style={{ borderBottom:`1px solid ${T.border}` }}>
              {["Time","Actor","Action","Target","IP","Result"].map(h => <th key={h} style={{ textAlign:"left", padding:"10px 14px", fontSize:10, fontWeight:700, color:T.muted, textTransform:"uppercase", letterSpacing:"0.07em" }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {logs.map(l => (
                <tr key={l.id} style={{ borderBottom:`1px solid ${T.border}` }}>
                  <td style={{ padding:"10px 14px", fontFamily:"monospace", fontSize:11, color:T.dim }}>{new Date(l.created_at).toLocaleTimeString()}</td>
                  <td style={{ padding:"10px 14px", color:T.muted }}>{l.actor_email ?? l.actor ?? "system"}</td>
                  <td style={{ padding:"10px 14px", fontFamily:"monospace", fontSize:11, color:T.blue }}>{l.action}</td>
                  <td style={{ padding:"10px 14px", color:T.muted }}>{l.target ?? "—"}</td>
                  <td style={{ padding:"10px 14px", fontFamily:"monospace", fontSize:11, color:T.dim }}>{l.ip_address ?? "—"}</td>
                  <td style={{ padding:"10px 14px" }}><span style={{ fontWeight:700, fontSize:11, color:resultColor(l.result) }}>{l.result}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── WEBHOOKS ─────────────────────────────────────────────────────────────────
export function WebhooksPage({ user }: { user: any }) {
  const [hooks, setHooks]       = useState<any[]>([]);
  const [url, setUrl]           = useState("");
  const [events, setEvents]     = useState<string[]>([]);
  const canEdit = ["super_admin","admin"].includes(user.role);
  const ALL_EVENTS = ["device.enrolled","device.wiped","compliance.changed","remote.action.completed","device.checkin"];
  const load = () => api.listWebhooks().then(r => setHooks(r.webhooks));
  useEffect(() => { load(); }, []);

  const toggle = async (id: string, active: boolean) => { await api.updateWebhook(id, { active }); load(); };
  const del    = async (id: string) => { if (confirm("Delete webhook?")) { await api.deleteWebhook(id); load(); } };
  const test   = async (id: string) => { await api.testWebhook(id); alert("Test ping queued."); };
  const add    = async () => { if (!url || !events.length) return; await api.createWebhook({ url, events }); setUrl(""); setEvents([]); load(); };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
      {hooks.map(h => (
        <div key={h.id} style={card}>
          <div style={{ display:"flex", alignItems:"flex-start", gap:12 }}>
            <div style={{ flex:1 }}>
              <div style={{ fontFamily:"monospace", fontSize:12, color:T.text, marginBottom:6 }}>{h.url}</div>
              <div style={{ display:"flex", gap:5, flexWrap:"wrap", marginBottom:8 }}>
                {h.events.map((e: string) => <span key={e} style={{ background:T.blueDim, color:T.blue, borderRadius:4, padding:"2px 7px", fontSize:10, fontWeight:600 }}>{e}</span>)}
              </div>
              <div style={{ fontSize:11, color:T.dim }}>{h.delivery_count} deliveries · <span style={{ color: h.active ? T.green : T.dim }}>{h.active ? "ACTIVE" : "PAUSED"}</span></div>
            </div>
            {canEdit && <div style={{ display:"flex", gap:6 }}>
              <button onClick={() => toggle(h.id, !h.active)} style={{ background:"transparent", border:`1px solid ${T.border}`, borderRadius:6, color:T.muted, padding:"5px 12px", fontSize:11, cursor:"pointer" }}>{h.active ? "Pause" : "Resume"}</button>
              <button onClick={() => test(h.id)} style={{ background:"transparent", border:`1px solid ${T.border}`, borderRadius:6, color:T.muted, padding:"5px 12px", fontSize:11, cursor:"pointer" }}>Test</button>
              <button onClick={() => del(h.id)} style={{ background:"transparent", border:`1px solid #7f1d1d`, borderRadius:6, color:T.red, padding:"5px 12px", fontSize:11, cursor:"pointer" }}>Delete</button>
            </div>}
          </div>
        </div>
      ))}

      {canEdit && (
        <div style={card}>
          <div style={{ fontWeight:700, fontSize:13, color:T.text, marginBottom:14 }}>Add Webhook</div>
          <div style={{ marginBottom:10 }}>
            <label style={label}>Endpoint URL</label>
            <input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://your-service.com/webhook" style={inp} />
          </div>
          <div style={{ marginBottom:14 }}>
            <label style={label}>Events</label>
            <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
              {ALL_EVENTS.map(e => (
                <label key={e} style={{ display:"flex", alignItems:"center", gap:6, cursor:"pointer", padding:"5px 10px", borderRadius:6, border:`1px solid ${events.includes(e) ? T.blue : T.border}`, background: events.includes(e) ? "rgba(59,130,246,0.1)" : T.elev, fontSize:12, color: events.includes(e) ? T.blue : T.muted }}>
                  <input type="checkbox" checked={events.includes(e)} onChange={ev => setEvents(a => ev.target.checked ? [...a, e] : a.filter(x => x !== e))} style={{ accentColor:T.blue }} />{e}
                </label>
              ))}
            </div>
          </div>
          <div style={{ fontSize:11, color:T.dim, fontFamily:"monospace", marginBottom:14 }}>
            Signature: X-CorpEMD-Signature: HMAC-SHA256(secret, body)
          </div>
          <button onClick={add} disabled={!url || !events.length} style={{ background:T.blue, border:"none", borderRadius:7, color:"#fff", padding:"8px 18px", fontSize:13, fontWeight:600, cursor:"pointer" }}>Add Webhook</button>
        </div>
      )}
    </div>
  );
}

// ─── USERS ────────────────────────────────────────────────────────────────────
export function UsersPage({ user }: { user: any }) {
  const [users, setUsers] = useState<any[]>([]);
  const canManage = user.role === "super_admin";
  const roleColor: Record<string,string> = { super_admin:T.amber, admin:T.blue, helpdesk:T.green, read_only:T.dim };
  useEffect(() => { api.listUsers().then(r => setUsers(r.users)); }, []);
  const perms: Record<string, Record<string,boolean>> = {
    super_admin: { "View devices":true, "Lock/Reboot":true, "Wipe":true, "Edit policies":true, "Manage users":true },
    admin:       { "View devices":true, "Lock/Reboot":true, "Wipe":true, "Edit policies":true, "Manage users":false },
    helpdesk:    { "View devices":true, "Lock/Reboot":true, "Wipe":false, "Edit policies":false, "Manage users":false },
    read_only:   { "View devices":true, "Lock/Reboot":false, "Wipe":false, "Edit policies":false, "Manage users":false },
  };
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:12, overflow:"hidden" }}>
        <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
          <thead><tr style={{ borderBottom:`1px solid ${T.border}` }}>
            {["User","Role","Last Login","Status"].map(h => <th key={h} style={{ textAlign:"left", padding:"10px 16px", fontSize:10, fontWeight:700, color:T.muted, textTransform:"uppercase", letterSpacing:"0.07em" }}>{h}</th>)}
          </tr></thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} style={{ borderBottom:`1px solid ${T.border}` }}>
                <td style={{ padding:"12px 16px" }}>
                  <div style={{ fontWeight:600, color:T.text }}>{u.name}</div>
                  <div style={{ color:T.dim, fontSize:11 }}>{u.email}</div>
                </td>
                <td style={{ padding:"12px 16px" }}><span style={{ fontWeight:700, fontSize:11, color:roleColor[u.role], textTransform:"uppercase" }}>{u.role.replace("_"," ")}</span></td>
                <td style={{ padding:"12px 16px", color:T.dim, fontSize:11 }}>{u.last_login ? new Date(u.last_login).toLocaleString() : "never"}</td>
                <td style={{ padding:"12px 16px" }}><span style={{ fontWeight:700, fontSize:11, color: u.active ? T.green : T.dim }}>{u.active ? "active" : "inactive"}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ ...card }}>
        <div style={{ fontWeight:700, fontSize:13, color:T.text, marginBottom:14 }}>Role Permissions Matrix</div>
        <div style={{ overflowX:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
            <thead><tr style={{ borderBottom:`1px solid ${T.border}` }}>
              <th style={{ textAlign:"left", padding:"8px 12px", color:T.muted, fontSize:11 }}>Permission</th>
              {Object.keys(perms).map(r => <th key={r} style={{ padding:"8px 12px", color:roleColor[r], fontSize:11, fontWeight:700, textTransform:"uppercase" }}>{r.replace("_"," ")}</th>)}
            </tr></thead>
            <tbody>
              {Object.keys(perms.super_admin).map(perm => (
                <tr key={perm} style={{ borderBottom:`1px solid ${T.border}` }}>
                  <td style={{ padding:"8px 12px", color:T.muted }}>{perm}</td>
                  {Object.keys(perms).map(r => (
                    <td key={r} style={{ padding:"8px 12px", textAlign:"center", color: perms[r][perm] ? T.green : T.redDim, fontWeight:700, fontSize:13 }}>
                      {perms[r][perm] ? "✓" : "✗"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── HEALTH ───────────────────────────────────────────────────────────────────
export function HealthPage() {
  const [health, setHealth] = useState<any>(null);
  useEffect(() => {
    const poll = () => api.getHealth().then(setHealth).catch(console.error);
    poll();
    const iv = setInterval(poll, 15_000);
    return () => clearInterval(iv);
  }, []);

  if (!health) return <div style={{ color:T.muted }}>Loading…</div>;

  const services = Object.entries(health.services ?? {});
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12 }}>
        {[
          ["Status",  health.status,              health.status === "healthy" ? T.green : T.red],
          ["Uptime",  `${Math.floor(health.uptime)}s`, T.blue],
          ["Postgres",health.services?.postgres,  health.services?.postgres === "ok" ? T.green : T.red],
          ["Redis",   health.services?.redis,     health.services?.redis === "ok" ? T.green : T.red],
        ].map(([l, v, c]) => (
          <div key={String(l)} style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:12, padding:"14px 16px" }}>
            <div style={{ fontSize:10, color:T.muted, textTransform:"uppercase", letterSpacing:"0.08em", fontWeight:600, marginBottom:4 }}>{l}</div>
            <div style={{ fontSize:22, fontWeight:800, color:String(c), letterSpacing:"-0.5px" }}>{String(v)}</div>
          </div>
        ))}
      </div>
      <div style={card}>
        <div style={{ fontWeight:700, fontSize:13, color:T.text, marginBottom:12 }}>Services</div>
        {services.map(([name, status]) => (
          <div key={name} style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 0", borderBottom:`1px solid ${T.border}` }}>
            <span style={{ width:8, height:8, borderRadius:"50%", background: status === "ok" ? T.green : T.red, flexShrink:0 }} />
            <span style={{ fontSize:13, color:T.text, flex:1 }}>{name}</span>
            <span style={{ fontSize:12, fontWeight:700, color: status === "ok" ? T.green : T.red }}>{String(status).toUpperCase()}</span>
          </div>
        ))}
      </div>
      <div style={{ ...card, fontSize:11, color:T.dim, fontFamily:"monospace" }}>
        Last checked: {new Date(health.ts).toLocaleString()} · Auto-refreshes every 15s
      </div>
    </div>
  );
}

export default EnrollPage;
