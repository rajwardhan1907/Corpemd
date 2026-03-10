import Fastify       from "fastify";
import fastifyCors   from "@fastify/cors";
import fastifyJwt    from "@fastify/jwt";
import fastifyHelmet from "@fastify/helmet";
import { Pool }      from "pg";
import { createClient } from "redis";
import { Queue }     from "bullmq";
import { google }    from "googleapis";

import { authRoutes }     from "./routes/auth.js";
import { devicesRoutes }  from "./routes/devices.js";
import { policiesRoutes } from "./routes/policies.js";
import { groupsRoutes }   from "./routes/groups.js";
import { enrollRoutes }   from "./routes/enrollment.js";
import { auditRoutes }    from "./routes/audit.js";
import { webhookRoutes }  from "./routes/webhooks.js";
import { usersRoutes }    from "./routes/users.js";
import { healthRoutes }   from "./routes/health.js";
import { authenticate }   from "./middleware/auth.js";
import { pubsubWorker }   from "./workers/pubsub.js";
import { webhookWorker }  from "./workers/webhook.js";
import { commandWorker }  from "./workers/commands.js";

// ── Database pool ─────────────────────────────────────────────────────────────
export const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 2_000,
});

// ── Redis ─────────────────────────────────────────────────────────────────────
export const redis = createClient({ url: process.env.REDIS_URL ?? "redis://localhost:6379" });
redis.on("error", (err: Error) => console.error("Redis:", err));

// ── BullMQ queues ─────────────────────────────────────────────────────────────
const conn = { url: process.env.REDIS_URL ?? "redis://localhost:6379" };
export const commandQueue = new Queue("device-commands",  { connection: conn });
export const webhookQueue = new Queue("webhook-dispatch", { connection: conn });
export const policyQueue  = new Queue("policy-push",      { connection: conn });

// ── Google AMAPI client ───────────────────────────────────────────────────────
const gAuth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON ?? "{}"),
  scopes: ["https://www.googleapis.com/auth/androidmanagement"],
});
export const amapi = google.androidmanagement({ version: "v1", auth: gAuth });
export const ENTERPRISE_ID = process.env.AMAPI_ENTERPRISE_ID ?? "";

// ── Bootstrap ─────────────────────────────────────────────────────────────────
const app = Fastify({
  logger: {
    level: process.env.LOG_LEVEL ?? "info",
    transport: process.env.NODE_ENV === "development"
      ? { target: "pino-pretty", options: { colorize: true } }
      : undefined,
  },
});

async function bootstrap() {
  await redis.connect();

  await app.register(fastifyHelmet);
  await app.register(fastifyCors, { origin: process.env.CORS_ORIGIN ?? "*" });
  await app.register(fastifyJwt,  { secret: process.env.JWT_SECRET! });

  app.decorate("db",           db);
  app.decorate("redis",        redis);
  app.decorate("amapi",        amapi);
  app.decorate("commandQueue", commandQueue);
  app.decorate("webhookQueue", webhookQueue);
  app.decorate("policyQueue",  policyQueue);

  app.addHook("preHandler", authenticate);

  await app.register(authRoutes,     { prefix: "/api/v1/auth" });
  await app.register(devicesRoutes,  { prefix: "/api/v1/devices" });
  await app.register(policiesRoutes, { prefix: "/api/v1/policies" });
  await app.register(groupsRoutes,   { prefix: "/api/v1/groups" });
  await app.register(enrollRoutes,   { prefix: "/api/v1/enrollment" });
  await app.register(auditRoutes,    { prefix: "/api/v1/audit-logs" });
  await app.register(webhookRoutes,  { prefix: "/api/v1/webhooks" });
  await app.register(usersRoutes,    { prefix: "/api/v1/users" });
  await app.register(healthRoutes,   { prefix: "/api/v1/health" });

  pubsubWorker.start();
  webhookWorker.start();
  commandWorker.start(amapi);

  const port = Number(process.env.PORT ?? 3000);
  await app.listen({ port, host: "0.0.0.0" });
  app.log.info(`CorpEMD API listening on :${port}`);
}

bootstrap().catch(err => { console.error("Fatal:", err); process.exit(1); });
