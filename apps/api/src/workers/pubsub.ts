import { PubSub }               from "@google-cloud/pubsub";
import { db, webhookQueue }     from "../index.js";
import { evaluateCompliance }   from "../services/amapi.js";
import { dispatchWebhookEvent } from "../routes/webhooks.js";

const pubsub = new PubSub({
  projectId:   process.env.GOOGLE_CLOUD_PROJECT_ID,
  credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON ?? "{}"),
});

export const pubsubWorker = {
  start() {
    const sub = pubsub.subscription(process.env.PUBSUB_SUBSCRIPTION ?? "corpemd-device-events");
    sub.on("message", async (message) => {
      try {
        await handleEvent(JSON.parse(Buffer.from(message.data).toString()));
        message.ack();
      } catch (err) { console.error("Pub/Sub handler error:", err); message.nack(); }
    });
    sub.on("error", (err: Error) => console.error("Pub/Sub error:", err));
    console.log("Pub/Sub consumer started");
  },
};

async function handleEvent(data: any) {
  const amapiId = (data.deviceName as string | undefined)?.split("/").pop();
  if (!amapiId) return;
  switch (data.notificationType) {
    case "ENROLLMENT": {
      const { rows: tok } = await db.query("SELECT * FROM enrollment_tokens WHERE amapi_token_name=$1", [data.enrollment?.enrollmentTokenName]);
      const t = tok[0];
      await db.query(
        `INSERT INTO devices (id,amapi_device_id,name,group_id,policy_id,compliance_status,status,enrolled_at)
         VALUES (gen_random_uuid(),$1,$2,$3,$4,'compliant','online',NOW()) ON CONFLICT (amapi_device_id) DO NOTHING`,
        [amapiId, `DEVICE-${amapiId.slice(-4).toUpperCase()}`, t?.group_id ?? null, t?.policy_id ?? null]
      );
      await dispatchWebhookEvent(db, webhookQueue, "device.enrolled", { amapiDeviceId: amapiId });
      break;
    }
    case "STATUS_REPORT": {
      const report = data.statusReport;
      const compliance = evaluateCompliance(report);
      const { rows } = await db.query(
        `UPDATE devices SET status='online',last_seen_at=NOW(),os_version=$2,battery_level=$3,compliance_status=$4,hardware_info=$5
         WHERE amapi_device_id=$1 RETURNING id,compliance_status`,
        [amapiId, report?.softwareInfo?.androidVersion ?? null, report?.batteryInfos?.[0]?.batteryLevel ?? null,
         compliance, JSON.stringify(report?.hardwareInfo ?? {})]
      );
      if (rows[0] && rows[0].compliance_status !== compliance)
        await dispatchWebhookEvent(db, webhookQueue, "compliance.changed", { deviceId: rows[0].id, to: compliance });
      break;
    }
    case "COMMAND": {
      const cmd = data.command;
      await db.query("UPDATE command_log SET status=$1,completed_at=NOW() WHERE amapi_command_id=$2",
        [cmd?.status === "SUCCESSFUL" ? "success" : "failed", cmd?.commandId]);
      if (cmd?.type === "RESET_PASSWORD" && cmd?.status === "SUCCESSFUL") {
        await db.query("DELETE FROM devices WHERE amapi_device_id=$1", [amapiId]);
        await dispatchWebhookEvent(db, webhookQueue, "device.wiped", { amapiDeviceId: amapiId });
      } else {
        await dispatchWebhookEvent(db, webhookQueue, "remote.action.completed",
          { amapiDeviceId: amapiId, commandType: cmd?.type, status: cmd?.status });
      }
      break;
    }
  }
}
