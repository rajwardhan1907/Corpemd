import { useState, useEffect } from "react";
import * as api from "../lib/api";

const T = { card:"#0e1118", border:"#1e2535", text:"#e2e8f4", muted:"#7a8aa8", dim:"#4a5568", blue:"#3b82f6", green:"#22c55e", red:"#ef4444", amber:"#f59e0b" };

export default function Dashboard({ user }: { user: any }) {
  const [devices, setDevices] = useState<any[]>([]);
  const [health,  setHealth]  = useState<any>(null);

  useEffect(() => {
    api.listDevices().then(r => setDevices(r.devices)).catch(console.error);
    api.getHealth().then(setHealth).catch(console.error);
  }, []);

  const online     = devices.filter(d => d.status === "online").length;
  const compliant  = devices.filter(d => d.compliance_status === "compliant").length;
  const nonComp    = devices.filter(d => d.compliance_status === "non-compliant").length;

  const kpis = [
    { label:"Total Devices",   value: devices.length, color: T.blue },
    { label:"Online",          value: online,          color: T.green },
    { label:"Compliant",       value: compliant,        color: T.green },
    { label:"Non-Compliant",   value: nonComp,          color: T.red },
    { label:"System Status",   value: health?.status ?? "…", color: health?.status === "healthy" ? T.green : T.red },
  ];

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:14 }}>
        {kpis.map(k => (
          <div key={k.label} style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:12, padding:"16px 20px" }}>
            <div style={{ fontSize:11, color:T.muted, textTransform:"uppercase", letterSpacing:"0.08em", fontWeight:600, marginBottom:6 }}>{k.label}</div>
            <div style={{ fontSize:28, fontWeight:800, color:k.color, letterSpacing:"-0.5px" }}>{String(k.value)}</div>
          </div>
        ))}
      </div>

      <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:12, padding:20 }}>
        <div style={{ fontWeight:700, fontSize:14, color:T.text, marginBottom:16 }}>Welcome, {user.email}</div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:14, fontSize:13, color:T.muted }}>
          <div style={{ padding:"12px 14px", background:"#131720", borderRadius:8, border:`1px solid ${T.border}` }}>
            <div style={{ fontWeight:600, color:T.text, marginBottom:4 }}>Getting started</div>
            <div>1. Create a policy → 2. Create a group → 3. Generate an enrollment token → 4. Enroll a device</div>
          </div>
          <div style={{ padding:"12px 14px", background:"#131720", borderRadius:8, border:`1px solid ${T.border}` }}>
            <div style={{ fontWeight:600, color:T.text, marginBottom:4 }}>Your role</div>
            <div style={{ textTransform:"capitalize" }}>{user.role.replace("_"," ")} — you have {user.role === "read_only" ? "read-only" : user.role === "helpdesk" ? "limited action" : "full"} access.</div>
          </div>
          <div style={{ padding:"12px 14px", background:"#131720", borderRadius:8, border:`1px solid ${T.border}` }}>
            <div style={{ fontWeight:600, color:T.text, marginBottom:4 }}>Infrastructure</div>
            <div>PostgreSQL · Redis · BullMQ · Google AMAPI · Pub/Sub</div>
          </div>
        </div>
      </div>
    </div>
  );
}
