import { tk } from '../i18n/i18n'

// What Rookly Pro adds, and what stays free. The prices shown here are only labels: the
// amounts charged are the Stripe prices configured on the server (see PUBLISHING.md).
// The texts are translation keys: show them with t(text, { n: FREE_REVIEWS_PER_DAY }).

export const PRICE = { monthly: 'CHF 1.–', yearly: 'CHF 10.–' }

export const FREE_REVIEWS_PER_DAY = 3
/** the first boards and piece sets are free, the rest come with Pro */
export const FREE_THEMES = 3

export type ProFeature = 'reviews' | 'variations' | 'coach' | 'woodpecker' | 'endgames' | 'import' | 'design'

export const FEATURE_TEXT: Record<ProFeature, string> = {
  reviews: tk('Heute sind {n} Partie-Auswertungen frei. Mit Pro wertest du so viele aus, wie du willst.'),
  variations: tk('Im Gratis-Plan übst du die Hauptvariante jeder Eröffnung. Pro schaltet alle Varianten frei.'),
  coach: tk('Der KI-Coach liest deine Partien und stellt dein Training zusammen. Er gehört zu Pro.'),
  woodpecker: tk('Das Woodpecker-Training gehört zu Pro.'),
  endgames: tk('Der Endspieltrainer gehört zu Pro.'),
  import: tk('Ganze Serien deiner chess.com- und Lichess-Partien für den Coach auswerten: das gehört zu Pro.'),
  design: tk('Dieses Design gehört zu Pro. Die ersten drei Bretter und Figurensätze sind frei.'),
}

export const PRO_BENEFITS: { title: string; text: string }[] = [
  { title: tk('Unbegrenzte Auswertungen'), text: tk('statt {n} pro Tag') },
  { title: tk('KI-Coach'), text: tk('Tagesplan und Tipps aus deinen echten Partien') },
  { title: tk('Alle Eröffnungsvarianten'), text: tk('60 Eröffnungen mit allen Linien') },
  { title: tk('Woodpecker und Endspiele'), text: tk('Muster festigen, Endspiele gegen volle Stärke') },
  { title: tk('Partien für den Coach'), text: tk('ganze Serien von chess.com und Lichess auswerten') },
  { title: tk('Alle Designs'), text: tk('10 Bretter und 10 Figurensätze') },
]
