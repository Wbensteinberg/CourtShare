import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Disable Turbopack - use webpack instead (Turbopack has issues with Tailwind CSS v4)
  // Set empty turbopack config to explicitly use webpack
  turbopack: {},
  
  compiler: {
    removeConsole: process.env.NODE_ENV === "production",
  },
  // Reduce file watching overhead (only works with webpack, not Turbopack)
  webpack: (config, { dev, isServer }) => {
    if (dev && !isServer) {
      // Speed up development builds - batch file changes
      config.watchOptions = {
        aggregateTimeout: 300,
      };
    }
    return config;
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "firebasestorage.googleapis.com",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
