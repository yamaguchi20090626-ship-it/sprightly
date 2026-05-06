import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    // mobile/ directory is a separate Expo project — excluded from web build
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
