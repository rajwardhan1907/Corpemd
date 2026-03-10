import type { FastifyInstance } from "fastify";
import { logAudit }    from "../services/audit.js";
import { requireRole } from "../middleware/auth.js";
import { deviceName }  from "../services/amapi.js";

export async function devicesRoutes(app: FastifyInstance) {
  app.get("/", async (req) => {
    const q = req.query as Record<string, string>;
    let sql = `SELECT d.*, g.name as group_name, p.name as policy_name
               FROM devices d LEFT JOIN groups g ON d.group_id=g.id
               LEFT JOIN policies p ON d.policy_id=p.id WHERE 1=1`;
    const p: any[] = [];
    if (q.group)      { p.push(q.group);        sql += ` AND g.name=$${p.length}`; }
    if (q.compliance) { p.push(q.compliance);   sql += ` AND d.compliance_status=$${p.length}`; }
    if (q.status)     { p.push(q.status);       sql += ` AND d.status=$${p.length}`; }
    if (q.search)     { p.push(`%${q.search}%`);sql += ` AND (d.name ILIKE $${p.length} OR d.model ILIKE $${p.length})`; }
    sql += " ORDER BY d.enrolled_at DESC";
    const { rows } = await app.db.query(sql, p);
    return { devices: rows, total: rows.length };
  });

  app.get<{ Params: { id: string } }>("/:id", async (req, reply) => {
    const { rows } = await app.db.query(
      `SELECT d.*, g.name as group_name, p.name as policy_name
       FROM devices d LEFT JOIN groups g ON d.group_id=g.id
       LEFT JOIN policies p ON d.policy_id=p.id WHERE d.id=$1`, [req.params.id]
    );
    if (!rows[0]) return reply.status(404).send({ error: "Not found" });
    return { device: rows[0] };
  });

  app.patch<{ Params: { id: string }; Body: { group_id?: string; name?: string } }>(
    "/:id", { preHandler: [requireRole(["super_admin","admin"])] },
    async (req, reply) => {
      const { id } = req.params;
      const updates: string[] = []; const p: any[] = [];
      if (req.body.group_id) { p.push(req.body.group_id); updates.push(`group_id=$${p.length}`); }
      if (req.body.name)     { p.push(req.body.name);     updates.push(`name=$${p.length}`); }
      if (!updates.length) return reply.status(400).send({ error: "Nothing to update" });
      p.push(id);
      const { rows } = await app.db.query(
        `UPDATE devices SET ${updates.join(",")},updated_at=NOW() WHERE id=$${p.length} RETURNING *`, p
      );
      if (!rows[0]) return reply.status(404).send({ error: "Not found" });
      await logAudit(app.db, { actor: (req.user as any).sub, action: "DEVICE_UPDATED", target: id, ip: req.ip });
      return { device: rows[0] };
    }
  );

  app.delete<{ Params: { id: string } }>(
    "/:id", { preHandler: [requireRole(["super_admin","admin"])] },
    async (req, reply) => {
      const { rows } = await app.db.query("SELECT amapi_device_id FROM devices WHERE id=$1", [req.params.id]);
      if (!rows[0]) return reply.status(404).send({ error: "Not found" });
      await app.amapi.enterprises.devices.delete({ name: deviceName(rows[0].amapi_device_id) });
      await app.db.query("DELETE FROM devices WHERE id=$1", [req.params.id]);
      await logAudit(app.db, { actor: (req.user as any).sub, action: "DEVICE_UNENROLLED", target: req.params.id, ip: req.ip });
      return reply.status(204).send();
    }
  );

  app.post<{ Params: { id: string }; Body: { type: string } }>(
    "/:id/commands",
    async (req, reply) => {
      const { id } = req.params;
      const { type } = req.body;
      const user = req.user as any;
      if (type === "WIPE" && !["super_admin","admin"].includes(user.role))
        return reply.status(403).send({ error: "Admin+ required for WIPE" });
      if (user.role === "read_only")
        return reply.status(403).send({ error: "Read-only cannot issue commands" });
      const { rows } = await app.db.query("SELECT amapi_device_id FROM devices WHERE id=$1", [id]);
      if (!rows[0]) return reply.status(404).send({ error: "Not found" });
      const job = await app.commandQueue.add("issue-command", {
        deviceId: id, amapiDeviceId: rows[0].amapi_device_id, type, issuedBy: user.sub,
      });
      await logAudit(app.db, { actor: user.sub, action: `REMOTE_${type}`, target: id, ip: req.ip });
      return reply.status(202).send({ jobId: job.id, status: "queued", type });
    }
  );

  app.get<{ Params: { id: string } }>("/:id/commands", async (req) => {
    const { rows } = await app.db.query(
      "SELECT * FROM command_log WHERE device_id=$1 ORDER BY issued_at DESC LIMIT 50", [req.params.id]
    );
    return { commands: rows };
  });
}
