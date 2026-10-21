// The openings the trainer offers, in the chosen language. The German originals and the
// moves live in catalog-data.ts; names and texts read through the translations here.
import { translateFields } from '../i18n/i18n'
import { CATALOG } from './catalog-data'

export type { Group, OpeningDef, Side, VariationDef } from './catalog-data'

for (const opening of CATALOG) {
  translateFields(opening, 'name', 'about')
  for (const v of opening.variations) translateFields(v, 'name', 'note')
}

export { CATALOG }
