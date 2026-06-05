/** @type {import('next').NextConfig} */
const isProduction = process.env.NODE_ENV === "production";

const defaultAllowedDevOrigins = ["192.168.*.*", "10.*.*.*", "172.*.*.*"];
const allowedDevOrigins = Array.from(
  new Set([
    ...defaultAllowedDevOrigins,
    ...(process.env.NEXT_ALLOWED_DEV_ORIGINS || "")
      .split(",")
      .map((origin) => origin.trim().toLowerCase())
      .filter(Boolean)
  ])
);

const connectSources = [
  "'self'",
  "https://*.supabase.co",
  "wss://*.supabase.co",
  "https://*.tradingview.com",
  "wss://*.tradingview.com",
  "https://va.vercel-scripts.com"
];

if (!isProduction) {
  connectSources.push("http:", "ws:");
}

const cspDirectives = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://s3.tradingview.com https://*.tradingview.com https://va.vercel-scripts.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.tradingview.com https://s3.tradingview.com",
  "font-src 'self' data:",
  `connect-src ${connectSources.join(" ")}`,
  "frame-src https://*.tradingview.com"
];

if (isProduction) {
  cspDirectives.push("upgrade-insecure-requests");
}

const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: cspDirectives.join("; ")
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()"
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin"
  },
  ...(isProduction
    ? [
        {
          key: "Strict-Transport-Security",
          value: "max-age=63072000; includeSubDomains; preload"
        }
      ]
    : []),
  {
    key: "X-Content-Type-Options",
    value: "nosniff"
  },
  {
    key: "X-Frame-Options",
    value: "DENY"
  },
  {
    key: "X-DNS-Prefetch-Control",
    value: "on"
  }
];

const nextConfig = {
  allowedDevOrigins: isProduction ? undefined : allowedDevOrigins,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders
      }
    ];
  }
};

export default nextConfig;
