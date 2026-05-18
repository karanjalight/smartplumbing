import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Smart Plumbing Client",
    short_name: "Smart Client",
    description: "Client portal for Smart Plumbing water billing and service requests.",
    start_url: "/clients/login",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#0A4266",
    icons: [
      {
        src: "/icon-192.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
      {
        src: "/icon-512.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
  };
}
