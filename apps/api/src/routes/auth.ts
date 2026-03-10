import type { FastifyInstance } from "fastify";
import bcrypt from "bcryptjs";
import { logAudit } from "../services/audit.js";

export async function authRoutes(app: FastifyInstance) {
  app.post<{ Body: { email: string; password: string } }>("/login", async (req, reply) => {
    const { email, password } = req.body;
    const { rows } = await app.db.query(
      "SELECT id, email, password_hash, role FROM users WHERE email = $1 AND active = true", [email]
    );
    const user = rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash)))
      return reply.status(401).send({ error: "Invalid credentials" });
    const token   = app.jwt.sign({ sub: user.id, email: user.email, role: user.role }, { expiresIn: "8h" });
    const refresh = app.jwt.sign({ sub: user.id, type: "refresh" }, { expiresIn: "7d" });
    await app.db.query("UPDATE users SET last_login = NOW() WHERE id = $1", [user.id]);
    await logAudit(app.db, { actor: user.id, action: "USER_LOGIN", target: "session", ip: req.ip });
    return { token, refresh, user: { id: user.id, email: user.email, role: user.role } };
  });

  app.post<{ Body: { refresh: string } }>("/refresh", async (req, reply) => {
    try {
      const payload = app.jwt.verify(req.body.refresh) as { sub: string; type: string };
      if (payload.type !== "refresh") throw new Error();
      const { rows } = await app.db.query("SELECT id, email, role FROM users WHERE id = $1", [payload.sub]);
      if (!rows[0]) return reply.status(401).send({ error: "User not found" });
      const token = app.jwt.sign({ sub: rows[0].id, email: rows[0].email, role: rows[0].role }, { expiresIn: "8h" });
      return { token };
    } catch { return reply.status(401).send({ error: "Invalid refresh token" }); }
  });
}
