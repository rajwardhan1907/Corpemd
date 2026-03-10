export type Role = "super_admin" | "admin" | "helpdesk" | "read_only";
export type ComplianceStatus = "compliant" | "non-compliant" | "warning" | "unknown";
export type DeviceStatus = "online" | "offline" | "wiped";
export type CommandType = "LOCK" | "WIPE" | "REBOOT" | "SYNC";
export type EnrollmentMethod = "qr" | "zero_touch" | "nfc" | "manual";
export type PolicyStatus = "active" | "draft" | "archived";

export interface Device {
  id: string; amapiDeviceId: string; name: string; model?: string;
  serial?: string; imei?: string; osVersion?: string; batteryLevel?: number;
  groupId?: string; groupName?: string; policyId?: string; policyName?: string;
  complianceStatus: ComplianceStatus; status: DeviceStatus;
  enrolledAt: string; lastSeenAt?: string;
}

export interface Policy {
  id: string; name: string; description?: string; config: PolicyConfig;
  amapiPolicyName: string; version: number; status: PolicyStatus;
  deviceCount?: number; updatedAt: string;
}

export interface PolicyConfig {
  wifiSsid?: string; wifiSecurity?: string; wifiPassword?: string;
  cameraDisabled?: boolean; screenshotDisabled?: boolean; usbDisabled?: boolean;
  factoryResetDisabled?: boolean; passwordMinLength?: number;
  updatePolicy?: "auto" | "windowed"; appWhitelist?: string;
}

export interface Group {
  id: string; name: string; description?: string;
  policyId?: string; policyName?: string; deviceCount?: number;
}

export interface User {
  id: string; email: string; name: string; role: Role;
  lastLogin?: string; active: boolean;
}

export interface AuditLog {
  id: string; actor?: string; actorEmail?: string; action: string;
  target?: string; ipAddress?: string; result: "SUCCESS" | "FAILED"; createdAt: string;
}

export interface WebhookEndpoint {
  id: string; url: string; events: string[]; active: boolean;
  deliveryCount: number; lastDeliveryAt?: string;
}

export interface EnrollmentToken {
  tokenId: string; tokenValue: string; shortCode: string; expiresAt: string;
  method: EnrollmentMethod; qrPayload?: string;
  zeroTouchExtras?: Record<string, string>;
  nfcNdefPayload?: string; manualInstructions?: string;
}
