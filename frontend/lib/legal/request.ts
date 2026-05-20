export function getRequestAuditMetadata(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const forwardedIp = forwardedFor?.split(",")[0]?.trim();

  return {
    ipAddress: forwardedIp || request.headers.get("x-real-ip") || null,
    userAgent: request.headers.get("user-agent")
  };
}
