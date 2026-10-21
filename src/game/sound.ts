import { translateFields } from '../i18n/i18n'

// Move sounds synthesised with Web Audio, in several sets. Nothing is downloaded:
// each set is a recipe of noise bursts, thumps and tones. "Filz" is the default.
// Set names are read through t().
// i18n-fields: name

let ctx: AudioContext | null = null
let noise: AudioBuffer | null = null

function audio() {
  if (!ctx) {
    ctx = new AudioContext()
    noise = ctx.createBuffer(1, ctx.sampleRate * 0.25, ctx.sampleRate)
    const data = noise.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  }
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

function envelope(ac: AudioContext, t: number, peak: number, attack: number, decay: number) {
  const g = ac.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(peak, t + attack)
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay)
  g.connect(ac.destination)
  return g
}

/** Filtered noise: the click or knock of a piece meeting the board. */
function burst(at: number, { freq = 1700, q = 1.2, gain = 0.5, decay = 0.07, type = 'bandpass' as BiquadFilterType } = {}) {
  const ac = audio()
  const t = ac.currentTime + at
  const src = ac.createBufferSource()
  src.buffer = noise
  const filter = ac.createBiquadFilter()
  filter.type = type
  filter.frequency.value = freq
  filter.Q.value = q
  src.connect(filter).connect(envelope(ac, t, gain, 0.002, decay))
  src.start(t)
  src.stop(t + decay + 0.03)
}

interface Tone {
  freq?: number
  /** glide target; the pitch stays put without it */
  to?: number
  gain?: number
  decay?: number
  type?: OscillatorType
  attack?: number
}

/** A pitched tone; `to` glides the pitch, `type` sets the timbre. */
function tone(at: number, { freq = 440, to, gain = 0.2, decay = 0.2, type = 'sine', attack = 0.004 }: Tone = {}) {
  const ac = audio()
  const t = ac.currentTime + at
  const osc = ac.createOscillator()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t)
  if (to !== undefined) osc.frequency.exponentialRampToValueAtTime(to, t + decay)
  osc.connect(envelope(ac, t, gain, attack, decay))
  osc.start(t)
  osc.stop(t + attack + decay + 0.03)
}

export type SoundKind = 'move' | 'capture' | 'check' | 'castle' | 'end' | 'wrong'

type Recipe = Record<SoundKind, () => unknown>

const chime = (notes: number[], gain = 0.08) => notes.forEach((f, i) => tone(0.2 + i * 0.09, { freq: f, gain, decay: 0.9, attack: 0.02 }))

const WOOD: Recipe = {
  move: () => (burst(0), tone(0, { freq: 140, to: 84, gain: 0.3, decay: 0.09 })),
  capture: () => (burst(0, { freq: 1300, gain: 0.7, decay: 0.09 }), tone(0, { freq: 110, to: 66, gain: 0.4, decay: 0.1 }), burst(0.045, { freq: 2100, gain: 0.35, decay: 0.05 })),
  castle: () => (burst(0), burst(0.09, { freq: 1500, gain: 0.4 })),
  check: () => (burst(0, { gain: 0.6 }), tone(0.02, { freq: 880, gain: 0.05, decay: 0.6 })),
  end: () => chime([523.25, 659.25, 783.99]),
  wrong: () => (burst(0, { freq: 600, gain: 0.45, decay: 0.12 }), tone(0, { freq: 90, to: 60, gain: 0.3, decay: 0.15 })),
}

export const SOUND_SETS: { id: string; name: string; recipe: Recipe }[] = [
  {
    id: 'felt',
    name: 'Filz',
    recipe: {
      move: () => (burst(0, { freq: 700, type: 'lowpass', q: 0.7, gain: 0.55, decay: 0.08 }), tone(0, { freq: 95, to: 70, gain: 0.25, decay: 0.08 })),
      capture: () => (burst(0, { freq: 900, type: 'lowpass', q: 0.7, gain: 0.75, decay: 0.1 }), tone(0, { freq: 80, to: 55, gain: 0.35, decay: 0.12 })),
      castle: () => (burst(0, { freq: 700, type: 'lowpass', gain: 0.5, decay: 0.07 }), burst(0.1, { freq: 700, type: 'lowpass', gain: 0.45, decay: 0.07 })),
      check: () => (burst(0, { freq: 800, type: 'lowpass', gain: 0.6, decay: 0.08 }), tone(0.02, { freq: 523.25, gain: 0.05, decay: 0.5 })),
      end: () => chime([392, 493.88, 587.33], 0.07),
      wrong: () => tone(0, { freq: 140, to: 90, gain: 0.3, decay: 0.18 }),
    },
  },
  {
    id: 'wood',
    name: 'Holz',
    recipe: WOOD,
  },
  {
    id: 'click',
    name: 'Klick',
    recipe: {
      move: () => burst(0, { freq: 3400, q: 3, gain: 0.55, decay: 0.03 }),
      capture: () => (burst(0, { freq: 2600, q: 2.5, gain: 0.7, decay: 0.04 }), burst(0.035, { freq: 3800, q: 3, gain: 0.4, decay: 0.03 })),
      castle: () => (burst(0, { freq: 3400, q: 3, gain: 0.5, decay: 0.03 }), burst(0.07, { freq: 3000, q: 3, gain: 0.45, decay: 0.03 })),
      check: () => (burst(0, { freq: 3400, q: 3, gain: 0.55, decay: 0.03 }), tone(0.01, { freq: 1320, gain: 0.06, decay: 0.25 })),
      end: () => chime([659.25, 987.77, 1318.5], 0.06),
      wrong: () => burst(0, { freq: 900, q: 2, gain: 0.5, decay: 0.08 }),
    },
  },
  {
    id: 'marimba',
    name: 'Marimba',
    recipe: {
      move: () => (tone(0, { freq: 392, gain: 0.22, decay: 0.35 }), tone(0, { freq: 1568, gain: 0.04, decay: 0.08 })),
      capture: () => (tone(0, { freq: 261.63, gain: 0.22, decay: 0.4 }), tone(0.06, { freq: 329.63, gain: 0.18, decay: 0.35 })),
      castle: () => (tone(0, { freq: 392, gain: 0.2, decay: 0.3 }), tone(0.1, { freq: 523.25, gain: 0.2, decay: 0.3 })),
      check: () => (tone(0, { freq: 880, gain: 0.18, decay: 0.4 }), tone(0.08, { freq: 1046.5, gain: 0.12, decay: 0.4 })),
      end: () => [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(0.15 + i * 0.1, { freq: f, gain: 0.16, decay: 0.6 })),
      wrong: () => tone(0, { freq: 196, to: 174.61, gain: 0.22, decay: 0.35 }),
    },
  },
  {
    id: 'retro',
    name: 'Retro',
    recipe: {
      move: () => tone(0, { freq: 660, gain: 0.07, decay: 0.06, type: 'square' }),
      capture: () => tone(0, { freq: 880, to: 220, gain: 0.08, decay: 0.12, type: 'square' }),
      castle: () => (tone(0, { freq: 660, gain: 0.07, decay: 0.05, type: 'square' }), tone(0.07, { freq: 990, gain: 0.07, decay: 0.05, type: 'square' })),
      check: () => (tone(0, { freq: 990, gain: 0.07, decay: 0.06, type: 'square' }), tone(0.08, { freq: 1320, gain: 0.07, decay: 0.08, type: 'square' })),
      end: () => [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(0.1 + i * 0.08, { freq: f, gain: 0.06, decay: 0.12, type: 'square' })),
      wrong: () => tone(0, { freq: 140, to: 90, gain: 0.08, decay: 0.2, type: 'sawtooth' }),
    },
  },
].map((set) => translateFields(set, 'name'))

let current = SOUND_SETS[0]

export function setSoundSet(id: string) {
  current = SOUND_SETS.find((s) => s.id === id) ?? SOUND_SETS[0]
}

export function playSound(kind: SoundKind, set = current) {
  try {
    set.recipe[kind]()
  } catch {
    // no audio available (e.g. blocked autoplay); moves stay silent
  }
}

export function soundFor(san: string): SoundKind {
  if (san.includes('+') || san.includes('#')) return 'check'
  if (san.startsWith('O-O')) return 'castle'
  if (san.includes('x')) return 'capture'
  return 'move'
}
