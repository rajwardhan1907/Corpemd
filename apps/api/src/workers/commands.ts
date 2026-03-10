import { Worker } from "bullmq";
import { db }      from "../index.js";

const TYPE_MAP: Record<string, string> = { LOCK: "LOCK", WIPE: "RESET_PASSWORD", REBOOT: "REBOOT", SYNC: "SYNC" };

export const commandWorker = {
  start(amapi: any) {
    const worker = new Worker("device-commands", async (job) => {
      const { deviceId, amapiDeviceId, type, issuedBy } = job.data;
      const { data } = await amapi.enterprises.devices.issueCommand({
        name: `enterprises/${process.env.AMAPI_ENTERPRISE_ID}/devices/${amapiDeviceId}`,
        requestBody: {
          type: TYPE_MAP[type] ?? type,
          ...(type === "WIPE" ? { resetPasswordFlags: ["WIPE_DATA"] } : {}),
        },
      });
      await db.query(
        "INSERT INTO command_log (device_id,type,amapi_command_id,status,issued_by,issued_at) VALUES ($1,$2,$3,'pending',$4,NOW())",
        [deviceId, type, data.name?.split("/").pop(), issuedBy]
      );
      return { commandId: data.name };
    }, { connection: { url: process.env.REDIS_URL }, concurrency: 20 });
    worker.on("failed", (job, err) => console.error(`Command ${job?.id} failed:`, err.message));
    console.log("Command worker started");
  },
};
