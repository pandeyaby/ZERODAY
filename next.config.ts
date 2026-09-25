import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3", "web-tree-sitter"],
  output: "standalone",
};

export default nextConfig;
