import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["web-tree-sitter"],
  output: "standalone",
  poweredByHeader: false,
  // The Desk serves no remote or user-supplied images: keep the optimizer off.
  images: { unoptimized: true },
  devIndicators: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "no-referrer" },
        ],
      },
    ];
  },
};

export default nextConfig;
