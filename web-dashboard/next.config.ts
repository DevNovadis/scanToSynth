import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["exceljs"],
  outputFileTracingIncludes: {
    "/**": ["./data/**"],
  },
};

export default nextConfig;
