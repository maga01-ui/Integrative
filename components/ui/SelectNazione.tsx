// Elenco delle nazioni in italiano, ordinato alfabeticamente con Italia in cima
const NAZIONI = [
  'Italia',
  'Afghanistan', 'Albania', 'Algeria', 'Andorra', 'Angola', 'Antigua e Barbuda',
  'Arabia Saudita', 'Argentina', 'Armenia', 'Australia', 'Austria', 'Azerbaijan',
  'Bahamas', 'Bahrain', 'Bangladesh', 'Barbados', 'Belgio', 'Belize', 'Benin',
  'Bhutan', 'Bielorussia', 'Bolivia', 'Bosnia ed Erzegovina', 'Botswana', 'Brasile',
  'Brunei', 'Bulgaria', 'Burkina Faso', 'Burundi',
  'Cambogia', 'Camerun', 'Canada', 'Capo Verde', 'Ciad', 'Cile', 'Cina',
  'Cipro', 'Colombia', 'Comore', 'Congo', 'Corea del Nord', 'Corea del Sud',
  'Costa Rica', "Costa d'Avorio", 'Croazia', 'Cuba',
  'Danimarca', 'Dominica',
  'Ecuador', 'Egitto', 'El Salvador', 'Emirati Arabi Uniti', 'Eritrea', 'Estonia',
  'Etiopia',
  'Fiji', 'Filippine', 'Finlandia', 'Francia',
  'Gabon', 'Gambia', 'Georgia', 'Germania', 'Ghana', 'Giamaica', 'Giappone',
  'Gibuti', 'Giordania', 'Grecia', 'Grenada', 'Guatemala', 'Guinea',
  'Guinea Bissau', 'Guinea Equatoriale', 'Guyana',
  'Haiti', 'Honduras',
  'India', 'Indonesia', 'Iran', 'Iraq', 'Irlanda', 'Islanda',
  'Isole Marshall', 'Isole Salomone', 'Israele',
  'Kazakhstan', 'Kenya', 'Kirghizistan', 'Kiribati', 'Kosovo', 'Kuwait',
  'Laos', 'Lesotho', 'Lettonia', 'Libano', 'Liberia', 'Libia', 'Liechtenstein',
  'Lituania', 'Lussemburgo',
  'Macedonia del Nord', 'Madagascar', 'Malawi', 'Maldive', 'Malaysia', 'Mali',
  'Malta', 'Marocco', 'Mauritania', 'Mauritius', 'Messico', 'Micronesia',
  'Moldova', 'Monaco', 'Mongolia', 'Montenegro', 'Mozambico', 'Myanmar',
  'Namibia', 'Nauru', 'Nepal', 'Nicaragua', 'Niger', 'Nigeria', 'Norvegia',
  'Nuova Zelanda',
  'Oman',
  'Pakistan', 'Palau', 'Panama', 'Papua Nuova Guinea', 'Paraguay', 'Paesi Bassi',
  'Peru', 'Polonia', 'Portogallo',
  'Qatar',
  'Regno Unito', 'Repubblica Centrafricana', 'Repubblica Ceca',
  'Repubblica Democratica del Congo', 'Repubblica Dominicana', 'Romania', 'Ruanda', 'Russia',
  'Saint Kitts e Nevis', 'Saint Lucia', 'Saint Vincent e Grenadine', 'Samoa',
  'San Marino', 'Sao Tome e Principe', 'Senegal', 'Serbia', 'Seychelles',
  'Sierra Leone', 'Singapore', 'Siria', 'Slovacchia', 'Slovenia', 'Somalia',
  'Spagna', 'Sri Lanka', 'Stati Uniti', 'Sudafrica', 'Sudan', 'Sudan del Sud',
  'Suriname', 'Svezia', 'Svizzera',
  'Tagikistan', 'Tanzania', 'Thailandia', 'Timor Est', 'Togo', 'Tonga',
  'Trinidad e Tobago', 'Tunisia', 'Turchia', 'Turkmenistan', 'Tuvalu',
  'Ucraina', 'Uganda', 'Ungheria', 'Uruguay', 'Uzbekistan',
  'Vanuatu', 'Vaticano', 'Venezuela', 'Vietnam',
  'Yemen',
  'Zambia', 'Zimbabwe',
]

// Stessa classe CSS degli altri campi input del progetto
const cls = 'mt-1.5 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-200'

export default function SelectNazione({
  name = 'stato',
  label = 'Stato',
  required = false,
  defaultValue = 'Italia',
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
      <select name={name} defaultValue={defaultValue || 'Italia'} className={cls}>
        {NAZIONI.map(n => (
          <option key={n} value={n}>{n}</option>
        ))}
      </select>
    </div>
  )
}
