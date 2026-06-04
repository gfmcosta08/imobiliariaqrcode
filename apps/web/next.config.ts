import type { NextConfig } from "next";

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
        ],
      },
    ];
  },
};

export default nextConfig;
