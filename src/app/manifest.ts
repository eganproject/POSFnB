import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Santap POS",
    short_name: "Santap",
    description: "POS F&B dengan pemesanan QR meja dan dapur realtime",
    start_url: "/login",
    display: "standalone",
    background_color: "#fbf8f4",
    theme_color: "#f26b1d",
    orientation: "any",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
  };
}
