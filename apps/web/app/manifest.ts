import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CURI AI 커리큘럼 안내",
    short_name: "CURI",
    description: "강의계획서 기반 AI 수업 내비게이터",
    start_url: "/",
    display: "standalone",
    background_color: "#FAF9F6",
    theme_color: "#101C2B",
    icons: [
      { src: "/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
