import { tk } from './i18n/i18n'

// Name and contact details in one place, for the UI, the legal pages and the stores.

export const APP_NAME = 'Rookly'
/** a translation key: show it with t(APP_TAGLINE) */
export const APP_TAGLINE = tk('Schach trainieren, jeden Tag ein Zug besser')
/** the public address once a domain is set up; until then the GitHub Pages copy */
export const APP_URL = import.meta.env.VITE_APP_URL || 'https://ohfab.github.io/chess/'
export const SUPPORT_EMAIL = import.meta.env.VITE_SUPPORT_EMAIL || 'hallo@rookly.app'
