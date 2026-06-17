import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(process.cwd(), "../.."),
  transpilePackages: ["@wanderkit/shared", "@wanderkit/supabase"]
};

export default nextConfig;
