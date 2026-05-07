/** @type {import('next').NextConfig} */
const nextConfig = {
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
