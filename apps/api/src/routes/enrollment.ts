import type { FastifyInstance } from "fastify";
import { v4 as uuidv4 } from "uuid";
import { logAudit }     from "../services/audit.js";
import { requireRole }  from "../middleware/auth.js";
import { ENTERPRISE_ID } from "../index.js";

export async function enrollRoutes(app: FastifyInstance) {
  app.post<{ Body: { group_id: string; policy_id: string; method: string; ttl_hours?: number } }>(
    "/token", { preHandler: [requireRole(["super_admin","admin"])] },
    async (req, reply) => {
      const { group_id, policy_id, method, ttl_hours = 24 } = req.body;
      const { rows } = await app.db.query("SELECT amapi_policy_name FROM policies WHERE id=$1", [policy_id]);
      if (!rows[0]) return reply.status(404).send({ error: "Policy not found" });

      const { data } = await app.amapi.enterprises.enrollmentTokens.create({
        parent: `enterprises/${ENTERPRISE_ID}`,
        requestBody: {
          duration: `${ttl_hours * 3600}s`,
          policyName: rows[0].amapi_policy_name,
          additionalData: JSON.stringify({ group_id, policy_id }),
        },
      });

      const id = uuidv4();
      const expiresAt = new Date(Date.now() + ttl_hours * 3_600_000).toISOString();
      await app.db.query(
        "INSERT INTO enrollment_tokens (id,amapi_token_name,token_value,group_id,policy_id,method,expires_at,created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)",
        [id, data.name, data.value, group_id, policy_id, method, expiresAt, (req.user as any).sub]
      );
      await logAudit(app.db, { actor: (req.user as any).sub, action: "ENROLLMENT_TOKEN_CREATED", target: id, ip: req.ip });

      const token = data.value!;
      return {
        tokenId: id, tokenValue: token,
        shortCode: token.slice(-6).toUpperCase(),
        expiresAt, method,
        qrPayload: JSON.stringify({
          "android": { "v": 1, "t": "AE_QR_PROVISIONING" },
          "android.app.extra.PROVISIONING_DEVICE_ADMIN_COMPONENT_NAME":
            "com.google.android.apps.work.clouddpc/.receivers.CloudDpcDeviceAdminReceiver",
          "android.app.extra.PROVISIONING_DEVICE_ADMIN_SIGNATURE_CHECKSUM":
            "I5YvS0Of0LkFkRKFEFKdL6MiFljtR7Zqp9wrYKbSFXI=",
          "android.app.extra.PROVISIONING_DEVICE_ADMIN_PACKAGE_DOWNLOAD_LOCATION":
            "https://play.google.com/managed/downloadManagingApp?identifier=setup",
          "android.app.extra.PROVISIONING_ADMIN_EXTRAS_BUNDLE": {
            "com.google.android.apps.work.clouddpc.EXTRA_ENROLLMENT_TOKEN": token,
          },
        }),
        zeroTouchExtras: { "com.google.android.apps.work.clouddpc.EXTRA_ENROLLMENT_TOKEN": token },
        nfcNdefPayload: `application/vnd.android.package-archive\nToken: ${token}`,
        manualInstructions: "Settings → System → Provision Device → Enter token",
      };
    }
  );

  app.get("/tokens", { preHandler: [requireRole(["super_admin","admin"])] }, async () => {
    const { rows } = await app.db.query(
      `SELECT et.*, g.name as group_name, p.name as policy_name
       FROM enrollment_tokens et
       LEFT JOIN groups g ON et.group_id=g.id
       LEFT JOIN policies p ON et.policy_id=p.id
       WHERE et.expires_at > NOW() ORDER BY et.created_at DESC`
    );
    return { tokens: rows };
  });
}
