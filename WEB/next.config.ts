import type { NextConfig } from "next";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

const nextConfig: NextConfig = {
  output: "standalone",
  // Board images are stored by the API but served from this app's origin, so
  // next/image optimises them like local files, and a board holding them can
  // still be exported (a picture from another origin would block that).
  async rewrites() {
    return [
      {
        source: "/board-images/:imageId",
        destination: `${API_URL}/board-images/:imageId`,
      },
    ];
  },
};

export default nextConfig;
