/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'export',
  images: {
    unoptimized: true,
  },
  // Generate static pages with a single worker. The parallel worker pool can
  // exhaust OS process/handle limits on some Windows machines, crashing the
  // export with "spawn UNKNOWN"; one worker builds reliably at a small cost.
  experimental: {
    cpus: 1,
    workerThreads: false,
  },
};

module.exports = nextConfig;
