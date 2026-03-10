import type { Pool } from "pg";
interface AuditOpts { actor?: string; action: string; target?: string; ip?: string; meta?: Record<string, unknown>; result?: "SUCCESS" | "FAILED"; }
export async function logAudit(db: Pool, opts: AuditOpts) {
  try {
    await db.query(
      `INSERT INTO audit_logs (id,actor,action,target,ip_address,meta,result,created_at)
       VALUES (gen_random_uuid(),$1,$2,$3,$4,$5,$6,NOW())`,
      [opts.actor ?? null, opts.action, opts.target ?? null, opts.ip ?? null,
       JSON.stringify(opts.meta ?? {}), opts.result ?? "SUCCESS"]
    );
  } catch (err) { console.error("Audit log write failed:", err); }
}
