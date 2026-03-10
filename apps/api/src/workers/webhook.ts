import { Worker } from "bullmq";
import crypto      from "crypto";
import fetch       from "node-fetch";
import { db }      from "../index.js";

export const webhookWorker = {
  start() {
    const worker = new Worker("webhook-dispatch", async (job) => {
      const { webhookId, url, secret, event, payload } = job.data;
      const body = JSON.stringify(payload);
      const sig  = "sha256=" + crypto.createHmac("sha256", secret).update(body).digest("hex");
      const res  = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type":        "application/json",
          "X-CorpEMD-Event":     event,
          "X-CorpEMD-Signature": sig,
          "X-CorpEMD-Delivery":  job.id ?? "",
          "User-Agent":          "CorpEMD/1.0",
        },
        body,
        signal: AbortSignal.timeout(10_000),
      });
      await db.query(
        "UPDATE webhook_endpoints SET delivery_count=delivery_count+1,last_delivery_at=NOW() WHERE id=$1",
        [webhookId]
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return { status: res.status };
    }, {
      connection: { url: process.env.REDIS_URL },
      concurrency: 10,
      defaultJobOptions: { attempts: 3, backoff: { type: "exponential", delay: 5_000 } },
    });
    worker.on("failed", (job, err) => console.error(`Webhook ${job?.id} failed:`, err.message));
    console.log("Webhook worker started");
  },
};
