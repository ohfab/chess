// What Rookly Pro adds, and what stays free. The prices shown here are only labels: the
// amounts charged are the Stripe prices configured on the server (see PUBLISHING.md).

export const PRICE = { monthly: 'CHF 1.–', yearly: 'CHF 10.–' }

export const FREE_REVIEWS_PER_DAY = 3
/** the first boards and piece sets are free, the rest come with Pro */
export const FREE_THEMES = 3

export type ProFeature = 'reviews' | 'variations' | 'coach' | 'woodpecker' | 'endgames' | 'import' | 'design'

export const FEATURE_TEXT: Record<ProFeature, string> = {
  reviews: `Heute sind ${FREE_REVIEWS_PER_DAY} Partie-Auswertungen frei. Mit Pro wertest du so viele aus, wie du willst.`,
  variations: 'Im Gratis-Plan übst du die Hauptvariante jeder Eröffnung. Pro schaltet alle Varianten frei.',
  coach: 'Der KI-Coach liest deine Partien und stellt dein Training zusammen. Er gehört zu Pro.',
  woodpecker: 'Das Woodpecker-Training gehört zu Pro.',
  endgames: 'Der Endspieltrainer gehört zu Pro.',
  import: 'Ganze Serien deiner chess.com- und Lichess-Partien für den Coach auswerten: das gehört zu Pro.',
  design: 'Dieses Design gehört zu Pro. Die ersten drei Bretter und Figurensätze sind frei.',
}

export const PRO_BENEFITS: { title: string; text: string }[] = [
  { title: 'Unbegrenzte Auswertungen', text: `statt ${FREE_REVIEWS_PER_DAY} pro Tag` },
  { title: 'KI-Coach', text: 'Tagesplan und Tipps aus deinen echten Partien' },
  { title: 'Alle Eröffnungsvarianten', text: '60 Eröffnungen mit allen Linien' },
  { title: 'Woodpecker und Endspiele', text: 'Muster festigen, Endspiele gegen volle Stärke' },
  { title: 'Partien für den Coach', text: 'ganze Serien von chess.com und Lichess auswerten' },
  { title: 'Alle Designs', text: '10 Bretter und 10 Figurensätze' },
]
