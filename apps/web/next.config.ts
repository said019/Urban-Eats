import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    '/api/loyalty/clients/[clientId]/apple-wallet': ['./wallet-assets/**/*'],
    '/api/loyalty/clients/[clientId]/google-wallet': ['./wallet-assets/**/*'],
  },
};

export default nextConfig;
