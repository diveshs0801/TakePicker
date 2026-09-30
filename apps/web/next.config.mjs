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
      {
        source: '/socket.io/:path*',
        destination: `${apiBase}/socket.io/:path*`,
      },
    ];
  },
};

export default nextConfig;
