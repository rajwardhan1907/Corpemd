import type { FastifyInstance } from "fastify";

export async function auditRoutes(app: FastifyInstance) {
  app.get("/", async (req) => {
    const q = req.query as Record<string, string>;
    let sql = "SELECT al.*, u.email as actor_email FROM audit_logs al LEFT JOIN users u ON u.id::text=al.actor WHERE 1=1";
    const p: any[] = [];
    if (q.action) { p.push(`%${q.action}%`); sql += ` AND al.action ILIKE $${p.length}`; }
    sql += ` ORDER BY al.created_at DESC LIMIT $${p.length+1} OFFSET $${p.length+2}`;
    p.push(parseInt(q.limit ?? "50"), parseInt(q.offset ?? "0"));
    const { rows } = await app.db.query(sql, p);
    const { rows: ct } = await app.db.query("SELECT COUNT(*)::int FROM audit_logs");
    return { logs: rows, total: ct[0].count };
  });

  app.get("/export.csv", async (req, reply) => {
    const { rows } = await app.db.query("SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 10000");
    const csv = ["id,actor,action,target,ip_address,result,created_at",
      ...rows.map(r => `${r.id},${r.actor ?? ""},${r.action},${r.target ?? ""},${r.ip_address ?? ""},${r.result},${r.created_at}`)
    ].join("\n");
    reply.header("Content-Type", "text/csv");
    reply.header("Content-Disposition", `attachment; filename="audit-${Date.now()}.csv"`);
    return csv;
  });
}
