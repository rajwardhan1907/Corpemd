import type { FastifyInstance } from "fastify";
import { v4 as uuidv4 } from "uuid";
import { logAudit }     from "../services/audit.js";
import { requireRole }  from "../middleware/auth.js";

export async function groupsRoutes(app: FastifyInstance) {
  app.get("/", async () => {
    const { rows } = await app.db.query(
      `SELECT g.*, COUNT(d.id)::int as device_count, p.name as policy_name
       FROM groups g LEFT JOIN devices d ON d.group_id=g.id
       LEFT JOIN policies p ON g.policy_id=p.id GROUP BY g.id, p.name ORDER BY g.name`
    );
    return { groups: rows };
  });

  app.post<{ Body: { name: string; policy_id: string; description?: string } }>(
    "/", { preHandler: [requireRole(["super_admin","admin"])] },
    async (req, reply) => {
      const id = uuidv4();
      await app.db.query(
        "INSERT INTO groups (id,name,description,policy_id,created_by) VALUES ($1,$2,$3,$4,$5)",
        [id, req.body.name, req.body.description ?? null, req.body.policy_id, (req.user as any).sub]
      );
      await logAudit(app.db, { actor: (req.user as any).sub, action: "GROUP_CREATED", target: id, ip: req.ip });
      return reply.status(201).send({ group: { id, name: req.body.name } });
    }
  );

  app.patch<{ Params: { id: string }; Body: { name?: string; policy_id?: string } }>(
    "/:id", { preHandler: [requireRole(["super_admin","admin"])] },
    async (req, reply) => {
      const { id } = req.params;
      const updates: string[] = []; const p: any[] = [];
      if (req.body.name)      { p.push(req.body.name);      updates.push(`name=$${p.length}`); }
      if (req.body.policy_id) { p.push(req.body.policy_id); updates.push(`policy_id=$${p.length}`); }
      if (!updates.length) return reply.status(400).send({ error: "Nothing to update" });
      p.push(id);
      await app.db.query(`UPDATE groups SET ${updates.join(",")} WHERE id=$${p.length}`, p);
      if (req.body.policy_id) await app.policyQueue.add("push-to-group", { groupId: id, policyId: req.body.policy_id });
      await logAudit(app.db, { actor: (req.user as any).sub, action: "GROUP_MODIFIED", target: id, ip: req.ip });
      return { success: true };
    }
  );

  app.post<{ Params: { id: string }; Body: { device_ids: string[] } }>(
    "/:id/devices", { preHandler: [requireRole(["super_admin","admin"])] },
    async (req) => {
      for (const did of req.body.device_ids)
        await app.db.query("UPDATE devices SET group_id=$1 WHERE id=$2", [req.params.id, did]);
      await logAudit(app.db, { actor: (req.user as any).sub, action: "GROUP_BULK_ASSIGN", target: req.params.id, ip: req.ip, meta: { count: req.body.device_ids.length } });
      return { assigned: req.body.device_ids.length };
    }
  );

  app.delete<{ Params: { id: string } }>("/:id", { preHandler: [requireRole(["super_admin"])] }, async (req, reply) => {
    await app.db.query("DELETE FROM groups WHERE id=$1", [req.params.id]);
    return reply.status(204).send();
  });
}
