import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "api.qrserver.com", pathname: "/v1/create-qr-code/**" },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
  async redirects() {
    return [
      {
        source: "/imoveis/novo",
        destination: "/properties/new",
        permanent: true,
      },
      {
        source: "/planos",
        destination: "/plans",
        permanent: true,
      },
      {
        source: "/dashboard/imoveis",
        destination: "/properties",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
