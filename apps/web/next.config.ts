import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // @snote/core ships TypeScript sources; let Next compile them.
  transpilePackages: ['@snote/core'],
  reactStrictMode: true,
  images: { unoptimized: true },
};

export default nextConfig;
