/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    // Don't run ESLint during build - only during development
    ignoreDuringBuilds: true,
  },
};

module.exports = nextConfig;
