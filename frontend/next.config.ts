import type { NextConfig } from "next";
import path from "path";

// Next.js usa inline scripts para hidratação do React — 'unsafe-inline' é necessário.
// Para um CSP mais restrito em produção, implementar nonces via middleware.
const cspDirectives = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  "font-src 'self'",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

const securityHeaders = [
  { key: "Content-Security-Policy", value: cspDirectives },
  { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive, nosnippet, noimageindex" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const isDev = process.env.NODE_ENV !== "production";
const devApiTarget = process.env.NEXT_DEV_API_PROXY || "http://localhost:3000";

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  turbopack: {
    root: path.resolve(__dirname),
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  async rewrites() {
    // Em dev, /api/* é proxiado para o backend local — mantém cookies same-origin
    // para o proxy.ts conseguir enxergar refresh_token / access_token.
    if (!isDev) return [];
    return [
      { source: "/api/:path*", destination: `${devApiTarget}/api/:path*` },
    ];
  },
};

export default nextConfig;
