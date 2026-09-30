/** @type {import('next').NextConfig} */
const apiBase = process.env.API_URL || 'http://localhost:3000';

const nextConfig = {
  reactStrictMode: false,
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${apiBase}/:path*`,
      },
      {
        source: '/media/:path*',
        destination: `${apiBase}/media/:path*`,
      },
    ];
  },
};

export default nextConfig;
