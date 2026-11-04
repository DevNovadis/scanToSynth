import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["exceljs"],
  outputFileTracingIncludes: {
    "/**": ["./data/**", "./scan-to-cloud.ps1"],
  },
};

export default nextConfig;
