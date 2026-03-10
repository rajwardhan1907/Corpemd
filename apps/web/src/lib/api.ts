const BASE = "/api/v1";
let _token: string | null = localStorage.getItem("corpemd_token");

export function setToken(t: string)  { _token = t; localStorage.setItem("corpemd_token", t); }
export function clearToken()          { _token = null; localStorage.removeItem("corpemd_token"); }
export function getToken()            { return _token; }

async function req<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(_token ? { Authorization: `Bearer ${_token}` } : {}),
      ...(opts.headers ?? {}),
    },
  });
  if (res.status === 401) { clearToken(); window.location.href = "/"; }
  if (!res.ok) { const e = await res.json().catch(() => ({ error: res.statusText })); throw new Error((e as any).error); }
  if (res.status === 204) return undefined as T;
  return res.json() as T;
}

// Auth
export const login        = (email: string, password: string) =>
  req<{ token: string; refresh: string; user: any }>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
export const refreshToken = (refresh: string) =>
  req<{ token: string }>("/auth/refresh", { method: "POST", body: JSON.stringify({ refresh }) });

// Devices
export const listDevices  = (params?: Record<string, string>) =>
  req<{ devices: any[]; total: number }>("/devices" + (params ? "?" + new URLSearchParams(params) : ""));
export const getDevice    = (id: string) => req<{ device: any }>(`/devices/${id}`);
export const updateDevice = (id: string, body: any) => req<{ device: any }>(`/devices/${id}`, { method: "PATCH", body: JSON.stringify(body) });
export const deleteDevice = (id: string) => req<void>(`/devices/${id}`, { method: "DELETE" });
export const issueCommand = (id: string, type: string) => req<any>(`/devices/${id}/commands`, { method: "POST", body: JSON.stringify({ type }) });
export const getCommands  = (id: string) => req<{ commands: any[] }>(`/devices/${id}/commands`);

// Enrollment
export const createToken = (body: any) => req<any>("/enrollment/token",  { method: "POST", body: JSON.stringify(body) });
export const listTokens  = ()          => req<{ tokens: any[] }>("/enrollment/tokens");

// Policies
export const listPolicies   = ()                              => req<{ policies: any[] }>("/policies");
export const createPolicy   = (body: any)                     => req<any>("/policies",         { method: "POST",  body: JSON.stringify(body) });
export const updatePolicy   = (id: string, body: any)         => req<any>(`/policies/${id}`,   { method: "PATCH", body: JSON.stringify(body) });
export const policyVersions = (id: string)                    => req<{ versions: any[] }>(`/policies/${id}/versions`);
export const rollbackPolicy = (id: string, version: number)   => req<any>(`/policies/${id}/rollback`, { method: "POST", body: JSON.stringify({ version }) });
export const archivePolicy  = (id: string)                    => req<void>(`/policies/${id}`,  { method: "DELETE" });

// Groups
export const listGroups   = ()                                => req<{ groups: any[] }>("/groups");
export const createGroup  = (body: any)                       => req<any>("/groups",          { method: "POST",  body: JSON.stringify(body) });
export const updateGroup  = (id: string, body: any)           => req<any>(`/groups/${id}`,    { method: "PATCH", body: JSON.stringify(body) });
export const assignDevices= (id: string, device_ids: string[])=> req<any>(`/groups/${id}/devices`, { method: "POST", body: JSON.stringify({ device_ids }) });

// Audit
export const listAudit = (params?: Record<string, string>) =>
  req<{ logs: any[]; total: number }>("/audit-logs" + (params ? "?" + new URLSearchParams(params) : ""));

// Webhooks
export const listWebhooks  = ()                        => req<{ webhooks: any[] }>("/webhooks");
export const createWebhook = (body: any)               => req<any>("/webhooks",        { method: "POST",   body: JSON.stringify(body) });
export const updateWebhook = (id: string, body: any)   => req<any>(`/webhooks/${id}`,  { method: "PATCH",  body: JSON.stringify(body) });
export const deleteWebhook = (id: string)              => req<void>(`/webhooks/${id}`, { method: "DELETE" });
export const testWebhook   = (id: string)              => req<any>(`/webhooks/${id}/test`, { method: "POST", body: "{}" });

// Users
export const listUsers  = ()                        => req<{ users: any[] }>("/users");
export const createUser = (body: any)               => req<any>("/users",       { method: "POST",  body: JSON.stringify(body) });
export const updateUser = (id: string, body: any)   => req<any>(`/users/${id}`, { method: "PATCH", body: JSON.stringify(body) });

// Health
export const getHealth = () => req<any>("/health");
