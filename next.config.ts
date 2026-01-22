import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Use Turbopack (Next.js 16 default)
  turbopack: {},
  
  // Suppress invalid source map warnings from Next.js internal files
  onDemandEntries: {
    // period (in ms) where the server will keep pages in the buffer
    maxInactiveAge: 25 * 1000,
    // number of pages that should be kept simultaneously without being disposed
    pagesBufferLength: 2,
  },
  
  // Webpack configuration (fallback when not using turbopack)
  webpack: (config, { dev, isServer }) => {
    if (dev && !isServer) {
      // Suppress source map warnings in development
      config.ignoreWarnings = [
        /Failed to parse source map/,
        /Invalid source map/,
      ]
    }
    return config
  },
};

export default nextConfig;
