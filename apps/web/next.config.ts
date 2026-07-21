import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    const apiBaseUrl = process.env.API_BASE_URL ?? "http://localhost:8787";
    return [
      {
        source: "/api/auth/register",
        destination: `${apiBaseUrl}/api/auth/register`,
      }
    ];
  }
};

export default nextConfig;
