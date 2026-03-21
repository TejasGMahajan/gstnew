/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: { unoptimized: true },
  // Disable SWC minifier — Next.js 13.5.1 SWC corrupts template literals
  // with escaped backticks in server chunks (Radix UI Progress component).
  swcMinify: false,
};

module.exports = nextConfig;
