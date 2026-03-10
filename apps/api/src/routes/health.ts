import type { FastifyInstance } from "fastify";

export async function healthRoutes(app: FastifyInstance) {
  app.get("/", async (req, reply) => {
    const checks = await Promise.allSettled([app.db.query("SELECT 1"), app.redis.ping()]);
    const pg    = checks[0].status === "fulfilled" ? "ok" : "error";
    const redis = checks[1].status === "fulfilled" ? "ok" : "error";
    const status = pg === "ok" && redis === "ok" ? "healthy" : "degraded";
    return reply.status(status === "healthy" ? 200 : 503).send({
      status, services: { postgres: pg, redis }, uptime: process.uptime(), ts: new Date().toISOString(),
    });
  });
}
