import type { FastifyInstance } from "fastify";
import { v4 as uuidv4 }   from "uuid";
import { logAudit }       from "../services/audit.js";
import { requireRole }    from "../middleware/auth.js";
import { buildAmapiPolicy } from "../services/amapi.js";
import { ENTERPRISE_ID }  from "../index.js";

export async function policiesRoutes(app: FastifyInstance) {
  app.get("/", async () => {
    const { rows } = await app.db.query(
      `SELECT p.*, COUNT(d.id)::int as device_count FROM policies p
       LEFT JOIN devices d ON d.policy_id=p.id GROUP BY p.id ORDER BY p.updated_at DESC`
    );
    return { policies: rows };
  });

  app.post<{ Body: { name: string; config: Record<string, any> } }>(
    "/", { preHandler: [requireRole(["super_admin","admin"])] },
    async (req, reply) => {
      const { name, config } = req.body;
      const id = uuidv4();
      const { data } = await app.amapi.enterprises.policies.patch({
        name: `enterprises/${ENTERPRISE_ID}/policies/${id}`,
        requestBody: buildAmapiPolicy(config),
      });
      await app.db.query(
        "INSERT INTO policies (id,name,config,amapi_policy_name,version,status,created_by) VALUES ($1,$2,$3,$4,1,'active',$5)",
        [id, name, JSON.stringify(config), data.name, (req.user as any).sub]
      );
      await app.db.query(
        "INSERT INTO policy_versions (policy_id,version,config,created_by) VALUES ($1,1,$2,$3)",
        [id, JSON.stringify(config), (req.user as any).sub]
      );
      await logAudit(app.db, { actor: (req.user as any).sub, action: "POLICY_CREATED", target: id, ip: req.ip });
      return reply.status(201).send({ policy: { id, name, version: 1 } });
    }
  );

  app.patch<{ Params: { id: string }; Body: { config: Record<string, any> } }>(
    "/:id", { preHandler: [requireRole(["super_admin","admin"])] },
    async (req, reply) => {
      const { id } = req.params;
      const { rows } = await app.db.query("SELECT * FROM policies WHERE id=$1", [id]);
      if (!rows[0]) return reply.status(404).send({ error: "Not found" });
      const newVer = rows[0].version + 1;
      await app.amapi.enterprises.policies.patch({ name: rows[0].amapi_policy_name, requestBody: buildAmapiPolicy(req.body.config) });
      await app.db.query("UPDATE policies SET config=$1,version=$2,updated_at=NOW() WHERE id=$3", [JSON.stringify(req.body.config), newVer, id]);
      await app.db.query("INSERT INTO policy_versions (policy_id,version,config,created_by) VALUES ($1,$2,$3,$4)", [id, newVer, JSON.stringify(req.body.config), (req.user as any).sub]);
      await logAudit(app.db, { actor: (req.user as any).sub, action: "POLICY_UPDATED", target: id, ip: req.ip });
      return { policy: { id, version: newVer } };
    }
  );

  app.get<{ Params: { id: string } }>("/:id/versions", async (req) => {
    const { rows } = await app.db.query(
      "SELECT pv.*, u.email as created_by_email FROM policy_versions pv LEFT JOIN users u ON u.id=pv.created_by WHERE pv.policy_id=$1 ORDER BY pv.version DESC",
      [req.params.id]
    );
    return { versions: rows };
  });

  app.post<{ Params: { id: string }; Body: { version: number } }>(
    "/:id/rollback", { preHandler: [requireRole(["super_admin","admin"])] },
    async (req, reply) => {
      const { id } = req.params;
      const { version } = req.body;
      const { rows: vRows } = await app.db.query("SELECT * FROM policy_versions WHERE policy_id=$1 AND version=$2", [id, version]);
      if (!vRows[0]) return reply.status(404).send({ error: "Version not found" });
      const { rows: pRows } = await app.db.query("SELECT * FROM policies WHERE id=$1", [id]);
      const newVer = pRows[0].version + 1;
      const config = JSON.parse(vRows[0].config);
      await app.amapi.enterprises.policies.patch({ name: pRows[0].amapi_policy_name, requestBody: buildAmapiPolicy(config) });
      await app.db.query("UPDATE policies SET config=$1,version=$2,updated_at=NOW() WHERE id=$3", [JSON.stringify(config), newVer, id]);
      await app.db.query("INSERT INTO policy_versions (policy_id,version,config,created_by,rollback_from) VALUES ($1,$2,$3,$4,$5)", [id, newVer, JSON.stringify(config), (req.user as any).sub, version]);
      await logAudit(app.db, { actor: (req.user as any).sub, action: "POLICY_ROLLED_BACK", target: id, ip: req.ip, meta: { rolledBackTo: version, newVersion: newVer } });
      return { message: `Rolled back to v${version} — now v${newVer}`, version: newVer };
    }
  );

  app.delete<{ Params: { id: string } }>("/:id", { preHandler: [requireRole(["super_admin","admin"])] }, async (req, reply) => {
    await app.db.query("UPDATE policies SET status='archived' WHERE id=$1", [req.params.id]);
    await logAudit(app.db, { actor: (req.user as any).sub, action: "POLICY_ARCHIVED", target: req.params.id, ip: req.ip });
    return reply.status(204).send();
  });
}
