export const PERMESSI_DEFAULT = {
  ADMIN: {
    dashboard: 'WRITE',
    leads: 'WRITE',
    pazienti: 'WRITE',
    calendario: 'WRITE',
    fatture: 'WRITE',
    impostazioni: 'WRITE',
    bi: 'READ',
    profitti: 'READ',
    chat: 'WRITE'
  },
  MARKETING: {
    dashboard: 'READ',
    leads: 'WRITE',
    pazienti: 'NONE',
    calendario: 'WRITE',
    fatture: 'NONE',
    impostazioni: 'READ',
    bi: 'READ',
    profitti: 'NONE',
    chat: 'WRITE'
  },
  MEDICO: {
    dashboard: 'READ',
    leads: 'NONE',
    pazienti: 'READ',
    calendario: 'WRITE',
    fatture: 'NONE',
    impostazioni: 'NONE',
    bi: 'NONE',
    profitti: 'READ',
    chat: 'WRITE'
  },
  STAFF: {
    dashboard: 'READ',
    leads: 'NONE',
    pazienti: 'READ',
    calendario: 'WRITE',
    fatture: 'NONE',
    impostazioni: 'NONE',
    bi: 'NONE',
    profitti: 'READ',
    chat: 'WRITE'
  }
} as const
