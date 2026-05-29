import type { MetadataRoute } from "next";

// Manifest PWA: define el ícono y nombre cuando el cajero hace
// "Agregar a pantalla de inicio" en el celular. Next lo sirve en
// /manifest.webmanifest.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Bunsik Ramen",
    short_name: "Bunsik",
    description: "Programa de lealtad y punto de venta de Bunsik Ramen.",
    start_url: "/admin/pos",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ec4899",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
