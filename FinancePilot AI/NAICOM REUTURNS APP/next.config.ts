import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // This repo sits inside a larger workspace tree that contains other
  // package-lock files; pin tracing to this app so builds don't scan
  // unrelated folders.
  outputFileTracingRoot: path.join(__dirname),
};

export default nextConfig;
