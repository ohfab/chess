import { tk } from '../i18n/i18n'

// What Enpixant Pro adds. Playing, analysis, game reviews, openings and all training stay free;
// Pro is the AI coach (it costs money per use) and the extra designs. The prices shown here
// are only labels: the amounts charged are the Stripe prices configured on the server
// (see PUBLISHING.md). The texts are translation keys.

/**
 * The AI coach (the daily plan and the questions about a position) is built but stays off
 * until it launches; until then the app only announces it. VITE_AI=on at build time turns it on.
 */
export const AI_ENABLED = import.meta.env.VITE_AI === 'on'

/**
 * Enpixant starts free: no subscription, every design open, nothing locked. VITE_PRO=on at build
 * time brings Pro back (with Stripe set up as in PUBLISHING.md); the AI coach needs it on.
 */
export const PRO_ENABLED = import.meta.env.VITE_PRO === 'on'

export const PRICE = { monthly: 'CHF 1.–', yearly: 'CHF 10.–' }

/** the first boards and piece sets are free, the rest come with Pro */
export const FREE_THEMES = 3

export type ProFeature = 'coach' | 'ask' | 'design'

export const FEATURE_TEXT: Record<ProFeature, string> = {
  coach: tk('Der KI-Coach liest deine Partien und stellt dein Training zusammen. Er gehört zu Pro.'),
  ask: tk('Fragen an den KI-Coach gehören zu Pro: er erklärt dir jede Stellung, mit Stockfish im Hintergrund.'),
  design: tk('Dieses Design gehört zu Pro. Die ersten drei Bretter und Figurensätze sind frei.'),
}

export const PRO_BENEFITS: { title: string; text: string }[] = [
  ...(AI_ENABLED
    ? [
        { title: tk('KI-Coach'), text: tk('Tagesplan und Tipps aus deinen echten Partien') },
        { title: tk('Coach-Fragen'), text: tk('Frag zu jeder Stellung, warum ein Zug gut oder schlecht ist') },
      ]
    : []),
  { title: tk('Alle Designs'), text: tk('11 Bretter und 10 Figurensätze') },
  { title: tk('Enpixant unterstützen'), text: tk('Analyse, Eröffnungen und alles Training bleiben für alle gratis') },
]
