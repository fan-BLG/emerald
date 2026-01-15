/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@emerald/shared'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'steamcdn-a.akamaihd.net',
      },
      {
        protocol: 'https',
        hostname: 'community.cloudflare.steamstatic.com',
      },
      {
        protocol: 'https',
        hostname: 'avatars.steamstatic.com',
      },
    ],
  },
};

module.exports = nextConfig;
