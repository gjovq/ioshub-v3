import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Badge/asset images come from IOSoccer's own hosts; they are served as
  // plain <img> so no remotePatterns config is required.
  poweredByHeader: false,
  compress: true,
  experimental: {
    // Keep server-side fan-out to the upstream API modest.
    proxyTimeout: 30000,
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
};

export default nextConfig;
