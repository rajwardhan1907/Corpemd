import type { FastifyInstance } from "fastify";
import { v4 as uuidv4 } from "uuid";
import crypto            from "crypto";
import { logAudit }      from "../services/audit.js";
import { requireRole }   from "../middleware/auth.js";

export async function webhookRoutes(app: FastifyInstance) {
  app.get("/", { preHandler: [requireRole(["super_admin","admin"])] }, async () => {
    const { rows } = await app.db.query(
      "SELECT id,url,events,active,delivery_count,last_delivery_at FROM webhook_endpoints ORDER BY created_at DESC"
    );
    return { webhooks: rows };
  });

  app.post<{ Body: { url: string; events: string[] } }>(
    "/", { preHandler: [requireRole(["super_admin","admin"])] },
    async (req, reply) => {
      const id = uuidv4();
      const secret = crypto.randomBytes(32).toString("hex");
      await app.db.query(
        "INSERT INTO webhook_endpoints (id,url,events,secret,active,created_by) VALUES ($1,$2,$3,$4,true,$5)",
        [id, req.body.url, JSON.stringify(req.body.events), secret, (req.user as any).sub]
      );
      await logAudit(app.db, { actor: (req.user as any).sub, action: "WEBHOOK_CREATED", target: id, ip: req.ip });
      return reply.status(201).send({ id, url: req.body.url, events: req.body.events, secret });
    }
  );

  app.patch<{ Params: { id: string }; Body: { active: boolean } }>(
    "/:id", { preHandler: [requireRole(["super_admin","admin"])] },
    async (req) => {
      await app.db.query("UPDATE webhook_endpoints SET active=$1 WHERE id=$2", [req.body.active, req.params.id]);
      return { success: true };
    }
  );

  app.delete<{ Params: { id: string } }>("/:id", { preHandler: [requireRole(["super_admin","admin"])] }, async (req, reply) => {
    await app.db.query("DELETE FROM webhook_endpoints WHERE id=$1", [req.params.id]);
    return reply.status(204).send();
  });

  app.post<{ Params: { id: string } }>("/:id/test", { preHandler: [requireRole(["super_admin","admin"])] }, async (req, reply) => {
    const { rows } = await app.db.query("SELECT * FROM webhook_endpoints WHERE id=$1", [req.params.id]);
    if (!rows[0]) return reply.status(404).send({ error: "Not found" });
    await app.webhookQueue.add("dispatch", {
      webhookId: rows[0].id, url: rows[0].url, secret: rows[0].secret,
      event: "test.ping", payload: { test: true, timestamp: new Date().toISOString() },
    });
    return { queued: true };
  });
}

export async function dispatchWebhookEvent(db: any, webhookQueue: any, event: string, data: any) {
  const { rows } = await db.query(
    "SELECT * FROM webhook_endpoints WHERE active=true AND events @> $1::jsonb", [JSON.stringify([event])]
  );
  for (const hook of rows) {
    await webhookQueue.add("dispatch", {
      webhookId: hook.id, url: hook.url, secret: hook.secret, event,
      payload: { event, timestamp: new Date().toISOString(), data },
    });
  }
}
