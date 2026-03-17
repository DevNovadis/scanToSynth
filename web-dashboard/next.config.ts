import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  serverExternalPackages: ["exceljs"],
  outputFileTracingIncludes: {
    "/**": ["./data/**"],
  },
};

export default nextConfig;
