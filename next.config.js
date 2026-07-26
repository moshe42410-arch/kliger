/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
  webpack: (config, { dev }) => {
    if (dev) {
      config.watchOptions = {
        ...(config.watchOptions || {}),
        ignored: [
          '**/node_modules/**',
          '**/.git/**',
          '**/uploads/**',
          '**/data/**',
          '**/.next/**',
        ],
      };
    }
    return config;
  },
};

module.exports = nextConfig;
