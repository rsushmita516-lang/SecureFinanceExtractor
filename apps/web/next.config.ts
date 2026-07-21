import type { NextConfig } from "next";


const nextConfig: NextConfig = {
 transpilePackages: ["@vessify/domain"],
 async rewrites() {
   const apiBaseUrl = process.env.API_BASE_URL ?? "http://localhost:8787";
   return [
     {
       source: "/api/auth/:path*",
       destination: `${apiBaseUrl}/api/auth/:path*`
     }
   ];
 }
};


export default nextConfig;
