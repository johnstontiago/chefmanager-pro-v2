const withPWA = require("@ducanh2912/next-pwa").default({
  dest: "public",
  // Desactiva en desarrollo para no interferir con hot-reload
  disable: process.env.NODE_ENV === "development",
  // Registra el SW automáticamente
  register: true,
  skipWaiting: true,
  // No cachear respuestas de la API como datos "actuales"
  runtimeCaching: [
    {
      // Shell de la app: cache-first
      urlPattern: /^(?!\/api\/).*/,
      handler: "NetworkFirst",
      options: {
        cacheName: "app-shell",
        expiration: { maxEntries: 50, maxAgeSeconds: 7 * 24 * 60 * 60 },
      },
    },
    {
      // Rutas API: siempre red primero, sin cache de datos obsoletos
      urlPattern: /^\/api\/.*/,
      handler: "NetworkOnly",
    },
  ],
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["sharp", "puppeteer"],
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: { unoptimized: true },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            // camera=(self) permite el lector QR en /recepcion
            // bluetooth=(self) permite la impresora de etiquetas VAVUPO P1
            key: "Permissions-Policy",
            value: "camera=(self), microphone=(), geolocation=(), bluetooth=(self)",
          },
          {
            // HSTS: fuerza HTTPS durante 1 año, incluye subdominios
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob:",
              "font-src 'self'",
              "connect-src 'self'",
              "media-src 'self' blob:",
              "worker-src 'self' blob:",
              "frame-ancestors 'none'",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

module.exports = withPWA(nextConfig);
