// Translations. The German text is the key: components call t with the German text and
// get it in the chosen language, or the German original when a translation is missing.
// Placeholders in braces are filled from `vars`, e.g. "{n} Partien" with { n: 3 }.
// Call t while rendering, never at module level: the language can change at any time and
// the app then simply renders again. Text in data tables is translated with translateFields.
//
// Dictionaries live in src/i18n/parts/<group>.<lang>.json, one file per area of the app,
// so several areas can be translated side by side; they are merged here.
// `npm run i18n` lists every key without a translation.
//
// Glossary (keep these consistent everywhere):
//   de             en            fr                     it
//   Brillant       Brilliant     Génial                 Geniale
//   Stark          Great         Très bon coup          Ottima
//   Bester Zug     Best          Meilleur coup          Migliore
//   Exzellent      Excellent     Excellent              Eccellente
//   Gut            Good          Bon                    Buona
//   Buchzug        Book          Théorique              Teoria
//   Ungenauigkeit  Inaccuracy    Imprécision            Imprecisione
//   Fehler         Mistake       Erreur                 Errore
//   Verpasst       Miss          Occasion manquée       Occasione mancata
//   Patzer         Blunder       Gaffe                  Errore grave
//   Genauigkeit    Accuracy      Précision              Precisione
//   Auswertung     Game Review   Bilan de partie        Revisione partita
//   Eröffnung      Opening       Ouverture              Apertura
//   Mittelspiel    Middlegame    Milieu de partie       Mediogioco
//   Endspiel       Endgame       Finale                 Finale
//   Taktik         Tactics       Tactique               Tattica
//   Strategie      Strategy      Stratégie              Strategia
//   Weiß / Schwarz White / Black Les Blancs / Les Noirs Il Bianco / Il Nero
//   (Spiel-)Partie Game          Partie                 Partita
//   Zug            Move          Coup                   Mossa
//   Gegner         Opponent      Adversaire             Avversario
//   Tagesaufgabe   Daily puzzle  Problème du jour       Problema del giorno
//   Patzer-Schutz  Blunder guard Anti-gaffe             Anti-errore
//   Du-Form: English "you", French "tu", Italian "tu".

export type Lang = 'de' | 'en' | 'fr' | 'it'

export const LANGS: { id: Lang; name: string; locale: string }[] = [
  { id: 'de', name: 'Deutsch', locale: 'de-CH' },
  { id: 'en', name: 'English', locale: 'en-GB' },
  { id: 'fr', name: 'Français', locale: 'fr-CH' },
  { id: 'it', name: 'Italiano', locale: 'it-CH' },
]

type Dict = Record<string, string>

const parts = import.meta.glob<Dict>('./parts/*.json', { eager: true, import: 'default' })
const dicts: Record<Lang, Dict> = { de: {}, en: {}, fr: {}, it: {} }
for (const [path, dict] of Object.entries(parts)) {
  const lang = path.match(/\.(\w+)\.json$/)?.[1] as Lang | undefined
  if (lang && dicts[lang]) Object.assign(dicts[lang], dict)
}

/** The browser's language if it is one of ours, else English (German for German speakers). */
export function detectLang(): Lang {
  const wanted = (typeof navigator !== 'undefined' ? navigator.languages ?? [navigator.language] : []).map((l) => l.slice(0, 2))
  return (wanted.find((l) => LANGS.some((x) => x.id === l)) as Lang | undefined) ?? 'en'
}

let current: Lang = 'de'

export function setLang(lang: Lang) {
  current = LANGS.some((l) => l.id === lang) ? lang : 'de'
  if (typeof document !== 'undefined') document.documentElement.lang = current
}

export const getLang = () => current

/** Locale for dates and numbers: Swiss variants, English as in Britain. */
export const locale = () => LANGS.find((l) => l.id === current)!.locale

const fill = (text: string, vars?: Record<string, string | number>) =>
  vars ? text.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : text

export function t(key: string, vars?: Record<string, string | number>): string {
  const text = current === 'de' ? key : (dicts[current][key] ?? key)
  return fill(text, vars)
}

/** Singular or plural, e.g. "1 Zug" or "{n} Züge". */
export const tn = (n: number, one: string, many: string, vars?: Record<string, string | number>) =>
  t(n === 1 ? one : many, { n, ...vars })

/** Marks a German string in data as a key; show it with t(value) later. */
export const tk = (key: string) => key

/**
 * Makes the listed string fields of a data object read through t, so every place that
 * shows them gets the chosen language. Only for display text, never for ids or keys.
 * The file that holds the German text names the fields for `npm run i18n` in a comment
 * line such as "// i18n-fields: name, about".
 */
export function translateFields<T extends object>(obj: T, ...fields: (keyof T & string)[]): T {
  for (const f of fields) {
    const raw = obj[f]
    if (typeof raw === 'string') Object.defineProperty(obj, f, { get: () => t(raw), enumerable: true, configurable: true })
  }
  return obj
}
