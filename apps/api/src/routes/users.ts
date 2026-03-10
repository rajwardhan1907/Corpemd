import type { FastifyInstance } from "fastify";
import { v4 as uuidv4 } from "uuid";
import bcrypt            from "bcryptjs";
import { logAudit }      from "../services/audit.js";
import { requireRole }   from "../middleware/auth.js";

export async function usersRoutes(app: FastifyInstance) {
  app.get("/", { preHandler: [requireRole(["super_admin","admin"])] }, async () => {
    const { rows } = await app.db.query(
      "SELECT id,email,name,role,last_login,active,created_at FROM users ORDER BY created_at DESC"
    );
    return { users: rows };
  });

  app.post<{ Body: { email: string; name: string; role: string; password: string } }>(
    "/", { preHandler: [requireRole(["super_admin"])] },
    async (req, reply) => {
      const id   = uuidv4();
      const hash = await bcrypt.hash(req.body.password, 12);
      await app.db.query(
        "INSERT INTO users (id,email,name,role,password_hash,active) VALUES ($1,$2,$3,$4,$5,true)",
        [id, req.body.email, req.body.name, req.body.role, hash]
      );
      await logAudit(app.db, { actor: (req.user as any).sub, action: "USER_CREATED", target: id, ip: req.ip });
      return reply.status(201).send({ user: { id, email: req.body.email, name: req.body.name, role: req.body.role } });
    }
  );

  app.patch<{ Params: { id: string }; Body: { role?: string; active?: boolean } }>(
    "/:id", { preHandler: [requireRole(["super_admin"])] },
    async (req) => {
      const { id } = req.params;
      const updates: string[] = []; const p: any[] = [];
      if (req.body.role   !== undefined) { p.push(req.body.role);   updates.push(`role=$${p.length}`); }
      if (req.body.active !== undefined) { p.push(req.body.active); updates.push(`active=$${p.length}`); }
      if (!updates.length) return { error: "Nothing to update" };
      p.push(id);
      await app.db.query(`UPDATE users SET ${updates.join(",")} WHERE id=$${p.length}`, p);
      await logAudit(app.db, { actor: (req.user as any).sub, action: "USER_UPDATED", target: id, ip: req.ip });
      return { success: true };
    }
  );
}
