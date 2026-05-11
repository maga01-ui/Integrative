// Elenco completo delle 107 province italiane (sigla + nome)
const PROVINCE = [
  { s: 'AG', n: 'Agrigento' },
  { s: 'AL', n: 'Alessandria' },
  { s: 'AN', n: 'Ancona' },
  { s: 'AO', n: "Valle d'Aosta" },
  { s: 'AP', n: 'Ascoli Piceno' },
  { s: 'AQ', n: "L'Aquila" },
  { s: 'AR', n: 'Arezzo' },
  { s: 'AT', n: 'Asti' },
  { s: 'AV', n: 'Avellino' },
  { s: 'BA', n: 'Bari' },
  { s: 'BG', n: 'Bergamo' },
  { s: 'BI', n: 'Biella' },
  { s: 'BL', n: 'Belluno' },
  { s: 'BN', n: 'Benevento' },
  { s: 'BO', n: 'Bologna' },
  { s: 'BR', n: 'Brindisi' },
  { s: 'BS', n: 'Brescia' },
  { s: 'BT', n: 'Barletta-Andria-Trani' },
  { s: 'BZ', n: 'Bolzano' },
  { s: 'CA', n: 'Cagliari' },
  { s: 'CB', n: 'Campobasso' },
  { s: 'CE', n: 'Caserta' },
  { s: 'CH', n: 'Chieti' },
  { s: 'CL', n: 'Caltanissetta' },
  { s: 'CN', n: 'Cuneo' },
  { s: 'CO', n: 'Como' },
  { s: 'CR', n: 'Cremona' },
  { s: 'CS', n: 'Cosenza' },
  { s: 'CT', n: 'Catania' },
  { s: 'CZ', n: 'Catanzaro' },
  { s: 'EN', n: 'Enna' },
  { s: 'FC', n: 'Forlì-Cesena' },
  { s: 'FE', n: 'Ferrara' },
  { s: 'FG', n: 'Foggia' },
  { s: 'FI', n: 'Firenze' },
  { s: 'FM', n: 'Fermo' },
  { s: 'FR', n: 'Frosinone' },
  { s: 'GE', n: 'Genova' },
  { s: 'GO', n: 'Gorizia' },
  { s: 'GR', n: 'Grosseto' },
  { s: 'IM', n: 'Imperia' },
  { s: 'IS', n: 'Isernia' },
  { s: 'KR', n: 'Crotone' },
  { s: 'LC', n: 'Lecco' },
  { s: 'LE', n: 'Lecce' },
  { s: 'LI', n: 'Livorno' },
  { s: 'LO', n: 'Lodi' },
  { s: 'LT', n: 'Latina' },
  { s: 'LU', n: 'Lucca' },
  { s: 'MB', n: 'Monza e della Brianza' },
  { s: 'MC', n: 'Macerata' },
  { s: 'ME', n: 'Messina' },
  { s: 'MI', n: 'Milano' },
  { s: 'MN', n: 'Mantova' },
  { s: 'MO', n: 'Modena' },
  { s: 'MS', n: 'Massa-Carrara' },
  { s: 'MT', n: 'Matera' },
  { s: 'NA', n: 'Napoli' },
  { s: 'NO', n: 'Novara' },
  { s: 'NU', n: 'Nuoro' },
  { s: 'OR', n: 'Oristano' },
  { s: 'PA', n: 'Palermo' },
  { s: 'PC', n: 'Piacenza' },
  { s: 'PD', n: 'Padova' },
  { s: 'PE', n: 'Pescara' },
  { s: 'PG', n: 'Perugia' },
  { s: 'PI', n: 'Pisa' },
  { s: 'PN', n: 'Pordenone' },
  { s: 'PO', n: 'Prato' },
  { s: 'PR', n: 'Parma' },
  { s: 'PT', n: 'Pistoia' },
  { s: 'PU', n: 'Pesaro e Urbino' },
  { s: 'PV', n: 'Pavia' },
  { s: 'PZ', n: 'Potenza' },
  { s: 'RA', n: 'Ravenna' },
  { s: 'RC', n: 'Reggio Calabria' },
  { s: 'RE', n: 'Reggio Emilia' },
  { s: 'RG', n: 'Ragusa' },
  { s: 'RI', n: 'Rieti' },
  { s: 'RM', n: 'Roma' },
  { s: 'RN', n: 'Rimini' },
  { s: 'RO', n: 'Rovigo' },
  { s: 'SA', n: 'Salerno' },
  { s: 'SI', n: 'Siena' },
  { s: 'SO', n: 'Sondrio' },
  { s: 'SP', n: 'La Spezia' },
  { s: 'SR', n: 'Siracusa' },
  { s: 'SS', n: 'Sassari' },
  { s: 'SU', n: 'Sud Sardegna' },
  { s: 'SV', n: 'Savona' },
  { s: 'TA', n: 'Taranto' },
  { s: 'TE', n: 'Teramo' },
  { s: 'TN', n: 'Trento' },
  { s: 'TO', n: 'Torino' },
  { s: 'TP', n: 'Trapani' },
  { s: 'TR', n: 'Terni' },
  { s: 'TS', n: 'Trieste' },
  { s: 'TV', n: 'Treviso' },
  { s: 'UD', n: 'Udine' },
  { s: 'VA', n: 'Varese' },
  { s: 'VB', n: 'Verbano-Cusio-Ossola' },
  { s: 'VC', n: 'Vercelli' },
  { s: 'VE', n: 'Venezia' },
  { s: 'VI', n: 'Vicenza' },
  { s: 'VR', n: 'Verona' },
  { s: 'VT', n: 'Viterbo' },
  { s: 'VV', n: 'Vibo Valentia' },
]

// Stessa classe CSS degli altri campi input del progetto
const cls = 'mt-1.5 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-200'

export default function SelectProvincia({
  name = 'provincia',
  label = 'Provincia',
  required = false,
  defaultValue = '',
}: {
  name?: string
  label?: string
  required?: boolean
  defaultValue?: string
}) {
  return (
    <div>
      <label className="text-sm font-medium text-slate-700">
        {label}{required && ' *'}
      </label>
      <select name={name} required={required} defaultValue={defaultValue.toUpperCase()} className={cls}>
        <option value="">— seleziona —</option>
        {PROVINCE.map(p => (
          <option key={p.s} value={p.s}>{p.s} – {p.n}</option>
        ))}
      </select>
    </div>
  )
}
