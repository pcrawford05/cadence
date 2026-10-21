/** @type {import('next').NextConfig} */
export default {
  images: { unoptimized: true },
  // Keep visited pages for 30s in the client router cache, so tab switching is instant.
  // Server actions still revalidate the affected pages immediately.
  experimental: { staleTimes: { dynamic: 30, static: 180 } },
};
