/** @type {import('next').NextConfig} */
const nextConfig = {
  // 'standalone' fa sì che `next build` produca in .next/standalone/ una versione
  // autosufficiente dell'app (server.js + solo le node_modules effettivamente usate).
  // Serve per fare immagini Docker piccole su Cloud Run.
  output: 'standalone',
  reactStrictMode: true,
  // Salta il check ESLint durante `next build`. Motivo: package.json ha
  // eslint 8.x ma eslint-config-next 16.x richiede eslint >=9. Il lint serve
  // solo in fase di sviluppo; in build di produzione non vogliamo che blocchi.
  // (Se vuoi correggere alla radice, aggiorna eslint a ^9 in package.json.)
  eslint: {
    ignoreDuringBuilds: true,
  },
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
