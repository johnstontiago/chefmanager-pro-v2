import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { Toaster } from "@/components/ui/toaster";

const inter = Inter({ subsets: ["latin"] });

// Normaliza la URL base: si la variable de entorno viene sin protocolo
// (ej. "midominio.up.railway.app"), le antepone https:// para que
// `new URL()` no lance ERR_INVALID_URL durante el build.
function getBaseUrl(): string {
  const raw = process.env.NEXTAUTH_URL || "http://localhost:3000";
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://${raw}`;
}

export const dynamic = "force-dynamic";

export const viewport: Viewport = {
  themeColor: "#1e40af",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  metadataBase: new URL(getBaseUrl()),
  title: "ChefManager Pro - Sistema de Gestión de Inventario",
  description: "Sistema profesional de gestión de inventario para restaurantes",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "ChefManager Pro",
  },
  icons: {
    icon: "/favicon.png",
    shortcut: "/favicon.png",
    apple: "/icons/icon-180.png",
  },
  openGraph: {
    title: "ChefManager Pro",
    description: "Sistema profesional de gestión de inventario para restaurantes",
    images: ["/og-image.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head></head>
      <body className={inter.className} suppressHydrationWarning>
        <Providers>
          {children}
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
