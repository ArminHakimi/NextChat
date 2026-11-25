import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "NextChat",
    short_name: "NextChat",
    description: "simple chat app",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f4efe6",
    theme_color: "#7a2830",
    icons: [
      {
        src: "/pwa-icons/192",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/pwa-icons/512",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/pwa-icons/512",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
