import type { androidmanagement_v1 } from "googleapis";
import { ENTERPRISE_ID } from "../index.js";

export const deviceName = (id: string) => `enterprises/${ENTERPRISE_ID}/devices/${id}`;

export function buildAmapiPolicy(cfg: Record<string, any>): androidmanagement_v1.Schema$Policy {
  const apps = (cfg.appWhitelist ?? "").split("\n")
    .map((p: string) => p.trim()).filter(Boolean)
    .map((packageName: string) => ({ packageName, installType: "FORCE_INSTALLED" }));
  return {
    applications: apps,
    passwordPolicies: [{ passwordMinimumLength: cfg.passwordMinLength ?? 8, passwordQuality: "ALPHANUMERIC" }],
    cameraDisabled: cfg.cameraDisabled ?? false,
    screenCaptureDisabled: cfg.screenshotDisabled ?? false,
    usbFileTransferDisabled: cfg.usbDisabled ?? false,
    factoryResetDisabled: cfg.factoryResetDisabled ?? false,
    personalUsagePolicies: { personalPlayStoreMode: "DISALLOW" },
    systemUpdate: { type: cfg.updatePolicy === "auto" ? "AUTOMATIC" : "WINDOWED" },
    ...(cfg.wifiSsid ? {
      openNetworkConfiguration: {
        NetworkConfigurations: [{ Name: cfg.wifiSsid, Type: "WiFi",
          WiFi: { SSID: cfg.wifiSsid, Security: cfg.wifiSecurity ?? "WPA-PSK", Passphrase: cfg.wifiPassword ?? "", AutoConnect: true },
        }],
      },
    } : {}),
  };
}

export function evaluateCompliance(report: any): string {
  if (!report) return "unknown";
  const major = parseInt((report?.softwareInfo?.androidVersion ?? "0").split(".")[0]);
  if (major < 11) return "non-compliant";
  if (!report?.deviceSettings?.isEncrypted) return "non-compliant";
  if (report?.deviceSettings?.isDeviceSecure === false) return "non-compliant";
  if ((report?.batteryInfos?.[0]?.batteryLevel ?? 1) < 0.05) return "warning";
  return "compliant";
}
