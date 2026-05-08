/** @type {import('next').NextConfig} */
const nextConfig = {
  // 'standalone' fa sì che `next build` produca in .next/standalone/ una versione
  // autosufficiente dell'app (server.js + solo le node_modules effettivamente usate).
  // Serve per fare immagini Docker piccole su Cloud Run.
  output: 'standalone',
  reactStrictMode: true,
  // FullCalendar v6 deve essere transpilato da Next.js per funzionare correttamente
  transpilePackages: [
    '@fullcalendar/core',
    '@fullcalendar/react',
    '@fullcalendar/timegrid',
    '@fullcalendar/daygrid',
    '@fullcalendar/interaction',
    '@fullcalendar/resource-timegrid',
  ],
}

module.exports = nextConfig
