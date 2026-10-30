import type { NextConfig } from 'next';

// Set for GitHub Pages builds, e.g. "/SNote" (site served from a sub-path, as static files).
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || undefined;

const nextConfig: NextConfig = {
  // @snote/core ships TypeScript sources; let Next compile them.
  transpilePackages: ['@snote/core'],
  reactStrictMode: true,
  images: { unoptimized: true },
  ...(process.env.STATIC_EXPORT === 'true' ? { output: 'export', trailingSlash: true } : {}),
  basePath,
};

export default nextConfig;
