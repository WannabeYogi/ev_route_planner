/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  transpilePackages: ['mapbox-gl'],
  experimental: {
    serverActions: true,
  },
  webpack: (config) => {
    config.resolve.fallback = { fs: false, child_process: false };
    return config;
  },
  env: {
    VERCEL_ENV: process.env.VERCEL_ENV || '',
    VERCEL: process.env.VERCEL || '',
    USE_JAVASCRIPT_IMPLEMENTATION: 'true'
  }
}

module.exports = nextConfig 