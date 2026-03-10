const PUBLIC = ["/api/v1/auth/login", "/api/v1/health"];

export async function authenticate(req: any, reply: any) {
  if (PUBLIC.some(r => (req.url as string).startsWith(r))) return;
  try { await req.jwtVerify(); }
  catch { return reply.status(401).send({ error: "Unauthorized" }); }
}

export function requireRole(roles: string[]) {
  return async (req: any, reply: any) => {
    const user = req.user as { role: string } | undefined;
    if (!user || !roles.includes(user.role))
      return reply.status(403).send({ error: `Requires role: ${roles.join(" | ")}` });
  };
}
