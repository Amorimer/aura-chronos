import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Aura Chronos - Assistente Pessoal",
    short_name: "Aura Chronos",
    description: "Assistente pessoal: a autoridade absoluta em otimizar o seu tempo.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f6f4ef",
    theme_color: "#0e1726",
    lang: "pt-BR",
    categories: ["productivity"],
    icons: [
      { src: "/icons/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/512m", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Agenda", url: "/agenda" },
      { name: "Tarefas", url: "/tarefas" },
    ],
  };
}
