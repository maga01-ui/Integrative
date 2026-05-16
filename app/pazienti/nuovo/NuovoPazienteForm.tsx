'use client'
// Form creazione paziente — client component.
// Gestisce il cambio tipo (PRIVATO / AZIENDA) per rendere obbligatori
// i campi giusti senza ricaricare la pagina.

import { useState } from 'react'
import SelectProvincia from '@/components/ui/SelectProvincia'
import SelectNazione from '@/components/ui/SelectNazione'
import TelefonoInput from '@/components/ui/TelefonoInput'

// ── Stile input / select condiviso ────────────────────────────────────────────
const cls = 'mt-1.5 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-200'

// ── Componente Campo riutilizzabile ──────────────────────────────────────────
function Campo({
  label, name, type = 'text', required = false,
  placeholder = '', maxLength, defaultValue = '',
}: {
  label: string; name: string; type?: string; required?: boolean
  placeholder?: string; maxLength?: number; defaultValue?: string
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700">{label}</label>
      <input
        type={type} name={name} required={required}
        placeholder={placeholder} maxLength={maxLength}
        defaultValue={defaultValue} className={cls}
      />
    </div>
  )
}

// ── Valori predefiniti (usati nella pagina modifica) ─────────────────────────
interface DefaultValues {
  tipo?: string; nome?: string; cognome?: string; dataNascita?: string
  codiceFiscale?: string; ragioneSociale?: string; partitaIva?: string
  codiceSDI?: string; pec?: string; referente?: string
  telefono?: string; telefonoWa?: string; email?: string
  indirizzo?: string; cap?: string; citta?: string; provincia?: string
  stato?: string; origine?: string; note?: string
  sesso?: string         // M = Maschio, F = Femmina
  operatoreId?: string   // operatore di riferimento
  teamId?: string        // team di riferimento
}

// Opzione di selezione per Operatore o Team.
// "studioId" è il riferimento allo Studio a cui appartiene questa opzione:
// serve quando l'utente loggato è cross-studio (SUPERADMIN/MARKETING) e
// stiamo filtrando operatori/team in base allo studio scelto nella tendina.
interface Opzione { id: string; label: string; studioId?: string }

// ── Props del form ────────────────────────────────────────────────────────────
interface Props {
  // La server action viene passata dalla page (file separato per mantenere 'use server')
  action:       (formData: FormData) => Promise<void>
  // Lista origini acquisizione configurate in impostazioni
  origini:      { id: string; nome: string }[]
  // Operatori (per il campo "Operatore di riferimento").
  // Se è presente "studi" (sotto), questa lista contiene gli operatori di
  // TUTTI gli studi e viene filtrata client-side; altrimenti contiene solo
  // quelli dello studio dell'utente loggato.
  operatori:    Opzione[]
  // Team — stessa logica di operatori (vedi sopra).
  team:         Opzione[]
  // Studi disponibili. Passato SOLO quando l'utente loggato è cross-studio
  // (SUPERADMIN/MARKETING) e quindi deve scegliere a quale studio assegnare
  // il nuovo paziente. Per gli utenti normali è undefined → niente tendina.
  studi?:       { id: string; nome: string }[]
  // Valori precompilati (solo nella pagina modifica)
  defaultValues?: DefaultValues
  // Testo del pulsante di invio (es. "Aggiorna paziente")
  submitLabel?:  string
  // ID del paziente (solo in modifica) — passato come campo nascosto per evitare problemi bind
  pazienteId?:  string
  // URL del pulsante Annulla (default: /pazienti)
  cancelHref?:  string
  // Se true, NON mostriamo i campi operatore/team nel form (sono già nel
  // box in alto della scheda paziente e si modificano da lì)
  nascondiOperatoreTeam?: boolean
}

// ── Componente principale ─────────────────────────────────────────────────────
export default function NuovoPazienteForm({
  action,
  origini,
  operatori,
  team,
  studi,
  defaultValues,
  submitLabel,
  pazienteId,
  cancelHref,
  nascondiOperatoreTeam,
}: Props) {
  // Traccia il tipo selezionato per mostrare/nascondere i campi e gestire i required
  const [tipo, setTipo] = useState<'PRIVATO' | 'AZIENDA'>(
    (defaultValues?.tipo as 'PRIVATO' | 'AZIENDA') ?? 'PRIVATO'
  )
  // Sesso del paziente (solo PRIVATO)
  const [sesso, setSesso] = useState<string>(defaultValues?.sesso ?? '')

  // Modalità "cross-studio": il form mostra la tendina Studio e filtra
  // operatori/team in base alla scelta. È attiva quando la pagina ci ha
  // passato l'array "studi" (cioè per SUPERADMIN/MARKETING).
  const modalitaCrossStudio = Array.isArray(studi)
  const [studioId, setStudioId] = useState<string>('')

  // Liste effettive di operatori/team da mostrare nella tendina.
  // In modalità normale = liste piene; in cross-studio = filtrate per studio.
  // Se l'utente non ha ancora scelto lo studio, le mostriamo vuote (così
  // capisce subito che deve prima scegliere lo studio).
  const operatoriVisibili = modalitaCrossStudio
    ? (studioId ? operatori.filter(o => o.studioId === studioId) : [])
    : operatori
  const teamVisibili = modalitaCrossStudio
    ? (studioId ? team.filter(t => t.studioId === studioId) : [])
    : team

  const isPrivato = tipo === 'PRIVATO'
  const isAzienda = tipo === 'AZIENDA'

  return (
    <form action={action} className="space-y-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">

      {/* Campo nascosto con l'ID paziente — usato solo in modalità modifica */}
      {pazienteId && <input type="hidden" name="_pazienteId" value={pazienteId} />}

      {/* ── Studio (solo per utenti cross-studio: SUPERADMIN/MARKETING) ──
          Per gli utenti normali questo blocco non viene mostrato perché lo
          studioId viene preso direttamente dal profilo dell'utente loggato. */}
      {modalitaCrossStudio && (
        <div>
          <label className="block text-sm font-medium text-slate-700">Studio di riferimento *</label>
          <select
            name="studioId"
            value={studioId}
            onChange={e => setStudioId(e.target.value)}
            required
            className={cls}
          >
            <option value="">— Seleziona studio —</option>
            {studi!.map(s => (
              <option key={s.id} value={s.id}>{s.nome}</option>
            ))}
          </select>
          {!studioId && (
            <p className="mt-1 text-xs text-slate-500">
              Scegli prima lo studio: operatori e team verranno filtrati di conseguenza.
            </p>
          )}
        </div>
      )}

      {/* ── Tipo paziente ────────────────────────────────────────────── */}
      <div>
        <p className="mb-2 text-sm font-medium text-slate-700">Tipo paziente *</p>
        <div className="flex gap-4">
          {(['PRIVATO', 'AZIENDA'] as const).map(t => (
            <label key={t} className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="radio" name="tipo" value={t}
                checked={tipo === t}
                onChange={() => setTipo(t)}
                required
              />
              {t}
            </label>
          ))}
        </div>
      </div>

      {/* ── Sesso (solo PRIVATO) — obbligatorio ─────────────────────── */}
      {isPrivato && (
        <div>
          <p className="mb-2 text-sm font-medium text-slate-700">Sesso *</p>
          <div className="flex gap-6">
            {[{ val: 'M', label: 'Maschio' }, { val: 'F', label: 'Femmina' }].map(({ val, label }) => (
              <label key={val} className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="radio" name="sesso" value={val}
                  checked={sesso === val}
                  onChange={() => setSesso(val)}
                  required   // obbligatorio: il form non può essere inviato senza scegliere
                />
                {label}
              </label>
            ))}
          </div>
        </div>
      )}

      {/* ── Dati anagrafici (PRIVATO) ────────────────────────────────── */}
      {isPrivato && (
        <fieldset className="space-y-4">
          <legend className="text-sm font-semibold uppercase tracking-wide text-slate-600">
            Dati anagrafici
          </legend>
          <div className="grid gap-4 md:grid-cols-2">
            <Campo label="Nome *"    name="nome"    required defaultValue={defaultValues?.nome} />
            <Campo label="Cognome *" name="cognome" required defaultValue={defaultValues?.cognome} />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Campo label="Data di nascita *" name="dataNascita" type="date" required defaultValue={defaultValues?.dataNascita} />
            <Campo label="Codice fiscale *"  name="codiceFiscale" required placeholder="RSSMRA…" defaultValue={defaultValues?.codiceFiscale} />
          </div>
        </fieldset>
      )}

      {/* ── Dati azienda (AZIENDA) ───────────────────────────────────── */}
      {isAzienda && (
        <fieldset className="space-y-4">
          <legend className="text-sm font-semibold uppercase tracking-wide text-slate-600">
            Dati azienda
          </legend>
          <Campo label="Ragione sociale *" name="ragioneSociale" required defaultValue={defaultValues?.ragioneSociale} />
          <div className="grid gap-4 md:grid-cols-2">
            <Campo label="Partita IVA *" name="partitaIva" required defaultValue={defaultValues?.partitaIva} />
            <Campo label="Codice SDI"    name="codiceSDI"         defaultValue={defaultValues?.codiceSDI} />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Campo label="PEC"       name="pec"       type="email" defaultValue={defaultValues?.pec} />
            <Campo label="Referente" name="referente"             defaultValue={defaultValues?.referente} />
          </div>
        </fieldset>
      )}

      {/* ── Contatti (tutti) ─────────────────────────────────────────── */}
      <fieldset className="space-y-4">
        <legend className="text-sm font-semibold uppercase tracking-wide text-slate-600">
          Contatti
        </legend>
        <div className="grid gap-4 md:grid-cols-2">
          <TelefonoInput label="Telefono *" name="telefono" required defaultValue={defaultValues?.telefono} />
          <Campo label="Email"      name="email"    type="email"         defaultValue={defaultValues?.email} />
        </div>
      </fieldset>

      {/* ── Indirizzo (tutti) ────────────────────────────────────────── */}
      <fieldset className="space-y-4">
        <legend className="text-sm font-semibold uppercase tracking-wide text-slate-600">
          Indirizzo
        </legend>
        <Campo label="Via / Indirizzo *" name="indirizzo" required defaultValue={defaultValues?.indirizzo} />
        <div className="grid gap-4 md:grid-cols-3">
          <Campo label="CAP *"       name="cap"       required maxLength={5} defaultValue={defaultValues?.cap} />
          <Campo label="Città *"     name="citta"     required              defaultValue={defaultValues?.citta} />
          <SelectProvincia required defaultValue={defaultValues?.provincia} />
        </div>
        <SelectNazione required defaultValue={defaultValues?.stato ?? 'Italia'} />
      </fieldset>

      {/* ── Operatore di riferimento e Team ──────────────────────────────
          Questi due valori vengono impostati alla creazione del paziente e
          poi restano stabili. Possono essere modificati solo dal box in
          alto nella scheda paziente. Nelle singole prestazioni si può
          comunque scegliere un operatore diverso per quel singolo evento. */}
      {!nascondiOperatoreTeam && (
        <fieldset className="space-y-4">
          <legend className="text-sm font-semibold uppercase tracking-wide text-slate-600">
            Operatore e team di riferimento
          </legend>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-700">Team di riferimento *</label>
              <select
                name="teamId"
                defaultValue={defaultValues?.teamId ?? ''}
                required
                className={cls}
              >
                <option value="">— Seleziona team —</option>
                {teamVisibili.map(t => (
                  <option key={t.id} value={t.id}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Operatore di riferimento *</label>
              <select
                name="operatoreId"
                defaultValue={defaultValues?.operatoreId ?? ''}
                required
                className={cls}
              >
                <option value="">— Seleziona operatore —</option>
                {operatoriVisibili.map(o => (
                  <option key={o.id} value={o.id}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>
        </fieldset>
      )}

      {/* ── Origine acquisizione ─────────────────────────────────────── */}
      <fieldset className="space-y-4">
        <legend className="text-sm font-semibold uppercase tracking-wide text-slate-600">
          Origine
        </legend>
        <div>
          <label className="block text-sm font-medium text-slate-700">Da dove viene questo paziente?</label>
          <select name="origine" defaultValue={defaultValues?.origine ?? ''} className={cls}>
            <option value="">— Seleziona origine —</option>
            {origini.map(o => (
              <option key={o.id} value={o.nome}>{o.nome}</option>
            ))}
          </select>
        </div>
      </fieldset>

      {/* ── Note ─────────────────────────────────────────────────────── */}
      <fieldset className="space-y-4">
        <legend className="text-sm font-semibold uppercase tracking-wide text-slate-600">
          Note
        </legend>
        <div>
          <label className="block text-sm font-medium text-slate-700">Note libere</label>
          <textarea
            name="note"
            rows={3}
            placeholder="Informazioni aggiuntive sul paziente…"
            defaultValue={defaultValues?.note ?? ''}
            className={cls}
          />
        </div>
      </fieldset>

      {/* ── Pulsanti ─────────────────────────────────────────────────── */}
      <div className="flex justify-end gap-3 pt-2">
        <a
          href={cancelHref ?? '/pazienti'}
          className="rounded-full border border-slate-300 px-6 py-2.5 text-sm text-slate-600 hover:bg-slate-50"
        >
          Annulla
        </a>
        <button
          type="submit"
          className="rounded-full bg-brand px-6 py-2.5 text-sm font-semibold text-slate-800 hover:bg-brand-hover"
        >
          {submitLabel ?? 'Salva paziente'}
        </button>
      </div>
    </form>
  )
}
