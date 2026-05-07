export type Ruolo = 'SUPERADMIN' | 'ADMIN' | 'MARKETING' | 'MEDICO' | 'STAFF'
export type LivelloPermesso = 'NONE' | 'READ' | 'WRITE'
export type PermessiRecord = Record<string, LivelloPermesso>
