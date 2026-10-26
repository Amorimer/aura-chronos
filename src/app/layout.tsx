import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";

export const metadata: Metadata = {
  title: "Aura Cronos",
  description: "Assistente pessoal: a autoridade absoluta em otimizar o seu tempo.",
  appleWebApp: { capable: true, title: "Aura Cronos", statusBarStyle: "default" },
  icons: { icon: [{ url: "/brand/favicon-48.png", sizes: "48x48" }, { url: "/brand/icon-192.png", sizes: "192x192" }], apple: "/brand/apple-180.png" },
  applicationName: "Aura Cronos",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f4ef" },
    { media: "(prefers-color-scheme: dark)", color: "#141412" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${GeistSans.variable} ${GeistMono.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
