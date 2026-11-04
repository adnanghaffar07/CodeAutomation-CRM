/** @type {import('next').NextConfig} */
module.exports = {
  // Lets a production build run while `npm run dev` is using .next (NEXT_DIST_DIR=.next-build npm run build).
  distDir: process.env.NEXT_DIST_DIR || ".next",
  experimental: {
    serverActions: { bodySizeLimit: "10mb" },
    // Always fetch a page's data when you navigate to it (no 30 s client cache).
    staleTimes: { dynamic: 0 },
  },
};
