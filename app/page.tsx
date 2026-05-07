import Link from 'next/link'

export default function HomePage() {
  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-slate-50 p-8 shadow-sm">
        <h1 className="text-4xl font-semibold text-slate-600">
          Benvenuto in Integrative Suite
        </h1>
        <p className="mt-3 max-w-2xl text-slate-600">
          Piattaforma per studi medici multi-tenant con gestione lead, pazienti,
          calendario, fatture e profitti.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-2xl font-semibold">Login</h2>
          <p className="mt-2 text-slate-600">
            Accedi con Supabase per iniziare a gestire lo studio.
          </p>
          <Link
            href="/login"
            className="mt-4 inline-flex rounded-full bg-brand px-5 py-3 text-sm font-semibold text-slate-800 transition hover:bg-brand-hover"
          >
            Vai al login
          </Link>
        </article>

        <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-2xl font-semibold">Scaffolding pronto</h2>
          <p className="mt-2 text-slate-600">
            Librerie di base, schema Prisma e layout iniziale sono pronti per
            sviluppare le pagine CRUD e le API.
          </p>
        </article>
      </section>
    </div>
  )
}
