import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  typedRoutes: true,
  images: {
    localPatterns: [
      {
        pathname: "/api/image"
      }
    ]
  }
};

export default nextConfig;
