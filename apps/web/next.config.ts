import type { NextConfig } from "next";

const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "img-src 'self' data: blob: https:",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://*.stripe.com",
  "style-src 'self' 'unsafe-inline'",
  "connect-src 'self' https://*.supabase.co https://*.stripe.com https://api.stripe.com",
  "frame-src https://js.stripe.com https://*.stripe.com",
  "form-action 'self' https://*.stripe.com",
  "upgrade-insecure-requests",
].join("; ");

const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "api.qrserver.com", pathname: "/v1/create-qr-code/**" },
    ],
  },
  async redirects() {
    return [
      {
        source: "/imovel/:public_id",
        destination: "/imoveis/:public_id",
        permanent: true,
      },
      {
        source: "/anuncio/:public_id",
        destination: "/imoveis/:public_id",
        permanent: true,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Content-Security-Policy", value: contentSecurityPolicy },
        ],
      },
    ];
  },
};

export default nextConfig;
