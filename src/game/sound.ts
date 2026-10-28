import { translateFields } from '../i18n/i18n'
import { useGame } from './store'

// Move sounds and jingles synthesised with Web Audio, in several sets. Nothing is downloaded:
// each set is a recipe of noise bursts, thumps and tones. "Retro" is the default: chiptune
// voices like the old consoles had (pulse waves with a few duty cycles, a triangle bass and
// a shift-register noise channel), with pitch changes in frames of 1/60 s.
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

/** A soft bell-like run of notes, for the sets that are not chiptune. */
const chime = (notes: number[], gain = 0.08, at = 0.2, gap = 0.09, decay = 0.9) => notes.forEach((f, i) => tone(at + i * gap, { freq: f, gain, decay, attack: 0.02 }))

// ---------------------------------------------------------------- chiptune voices

/** Frequency of a MIDI note: 60 is middle C, 69 the A at 440 Hz. */
const mtof = (m: number) => 440 * 2 ** ((m - 69) / 12)
const FRAME = 1 / 60

let bus: AudioNode | null = null
/** All chip voices meet here: a gentle low-pass takes the edge off the pulse waves. */
function chipOut(ac: AudioContext) {
  if (!bus) {
    const lp = ac.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 7000
    lp.Q.value = 0.5
    lp.connect(ac.destination)
    bus = lp
  }
  return bus
}

const waves = new Map<number, PeriodicWave>()
/** A pulse wave with the given duty cycle (0.125, 0.25 or 0.5), as on the NES and the Game Boy. */
function pulseWave(ac: AudioContext, duty: number) {
  let wave = waves.get(duty)
  if (!wave) {
    const n = 40
    const real = new Float32Array(n)
    const imag = new Float32Array(n)
    for (let k = 1; k < n; k++) real[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * duty)
    wave = ac.createPeriodicWave(real, imag)
    waves.set(duty, wave)
  }
  return wave
}

interface Chip {
  /** seconds per frequency when several are given (an arpeggio, a run or a stepped sweep) */
  step?: number
  /** pulse width; 0 for the triangle (the bass channel) */
  duty?: number
  gain?: number
  /** seconds at full level; all the steps by default */
  hold?: number
  /** seconds to fade to silence after the hold */
  decay?: number
  /** a slight wobble on long notes */
  vibrato?: boolean
}

/** One chip voice: the frequencies one after another, frame-exact, then a short fade. */
function chip(at: number, freqs: number[], { step = FRAME, duty = 0.25, gain = 0.045, hold, decay = 0.04, vibrato = false }: Chip = {}) {
  const ac = audio()
  const t = ac.currentTime + at
  const osc = ac.createOscillator()
  if (duty) osc.setPeriodicWave(pulseWave(ac, duty))
  else osc.type = 'triangle'
  freqs.forEach((f, i) => osc.frequency.setValueAtTime(f, t + i * step))
  const h = Math.max(0.006, hold ?? freqs.length * step)
  if (vibrato && h > 0.18) {
    const f = freqs[freqs.length - 1]
    for (let s = 0.12, i = 0; s < h + decay; s += 2 * FRAME, i++) osc.frequency.setValueAtTime(f * (i % 2 ? 0.994 : 1.006), t + s)
  }
  const g = ac.createGain()
  g.gain.setValueAtTime(0, t)
  g.gain.linearRampToValueAtTime(gain, t + 0.004)
  g.gain.setValueAtTime(gain, t + h)
  g.gain.linearRampToValueAtTime(0, t + h + decay)
  osc.connect(g).connect(chipOut(ac))
  osc.start(t)
  osc.stop(t + h + decay + 0.02)
}

/** A pitch slide in frame steps, the way the old sound chips swept. */
function sweep(at: number, from: number, to: number, seconds: number, opts: Chip = {}) {
  const frames = Math.max(2, Math.round(seconds / FRAME))
  const freqs = Array.from({ length: frames }, (_, i) => from * (to / from) ** (i / (frames - 1)))
  chip(at, freqs, { decay: 0.03, ...opts, step: FRAME })
}

/** A note in a tune: a MIDI number for one step, or [note, steps]; 0 is a rest. */
type Note = number | [number, number]

/** A melody on one chip voice, each note slightly detached; returns when it ends (seconds from now). */
function tune(at: number, notes: Note[], { step = 0.07, ...opts }: Chip = {}) {
  let pos = 0
  for (const n of notes) {
    const [m, len] = typeof n === 'number' ? [n, 1] : n
    const d = len * step
    if (m) chip(at + pos * step, [mtof(m)], { vibrato: len >= 4, ...opts, hold: d * 0.78, decay: opts.decay ?? d * 0.22 })
    pos += len
  }
  return at + pos * step
}

const lfsr = new Map<boolean, AudioBuffer>()
/**
 * The noise channel: a 15-bit shift register, one bit per sample. The long mode hisses;
 * the short mode (feedback from bit 6) repeats every 93 steps and rings like metal.
 */
function lfsrBuffer(ac: AudioContext, short: boolean) {
  let buf = lfsr.get(short)
  if (!buf) {
    const len = short ? 93 * 44 : 32767
    buf = ac.createBuffer(1, len, ac.sampleRate)
    const d = buf.getChannelData(0)
    let reg = 1
    for (let i = 0; i < len; i++) {
      const bit = (reg ^ (reg >> (short ? 6 : 1))) & 1
      reg = (reg >> 1) | (bit << 14)
      d[i] = reg & 1 ? 0.7 : -0.7
    }
    lfsr.set(short, buf)
  }
  return buf
}

/** Chip noise: `clock` is the shift rate in Hz (low: a crunch, high: a hiss); `to` drops it in frames. */
function crunch(at: number, { clock = 20000, to, gain = 0.04, decay = 0.05, short = false }: { clock?: number; to?: number; gain?: number; decay?: number; short?: boolean } = {}) {
  const ac = audio()
  const t = ac.currentTime + at
  const src = ac.createBufferSource()
  src.buffer = lfsrBuffer(ac, short)
  src.loop = true
  const rate = (c: number) => c / ac.sampleRate
  src.playbackRate.setValueAtTime(rate(clock), t)
  if (to) for (let s = FRAME, n = Math.round(decay / FRAME), i = 1; i <= n; s += FRAME, i++) src.playbackRate.setValueAtTime(rate(clock * (to / clock) ** (i / n)), t + s)
  const g = ac.createGain()
  g.gain.setValueAtTime(gain, t)
  g.gain.linearRampToValueAtTime(0, t + decay)
  src.connect(g).connect(chipOut(ac))
  src.start(t)
  src.stop(t + decay + 0.02)
}

// ---------------------------------------------------------------- the sets

/** The moments that have a sound. Every set has the first six; the others fall back to a soft version. */
export type SoundKind =
  | 'move'
  | 'capture'
  | 'check'
  | 'castle'
  | 'end'
  | 'wrong'
  | 'promote'
  | 'start'
  | 'win'
  | 'lose'
  | 'draw'
  | 'solved'
  | 'failed'

type Base = 'move' | 'capture' | 'check' | 'castle' | 'end' | 'wrong'
type Recipe = Record<Base, () => unknown> & Partial<Record<Exclude<SoundKind, Base>, () => unknown>>

/** The extra moments for the calm sets: built from the set's own move sounds and soft chimes. */
const SOFT: Record<Exclude<SoundKind, Base>, (r: Recipe) => unknown> = {
  promote: (r) => (r.move(), chime([659.25, 987.77], 0.06, 0.08, 0.08, 0.5)),
  start: () => chime([392, 523.25], 0.06, 0, 0.12, 0.6),
  win: () => chime([523.25, 659.25, 783.99, 1046.5], 0.07, 0.15, 0.1),
  lose: () => chime([392, 349.23, 293.66], 0.06, 0.15, 0.14),
  draw: () => chime([440, 523.25, 440], 0.06, 0.15, 0.12, 0.7),
  solved: () => chime([783.99, 1046.5], 0.07, 0, 0.08, 0.6),
  failed: (r) => r.wrong(),
}

const WOOD: Recipe = {
  move: () => (burst(0), tone(0, { freq: 140, to: 84, gain: 0.3, decay: 0.09 })),
  capture: () => (burst(0, { freq: 1300, gain: 0.7, decay: 0.09 }), tone(0, { freq: 110, to: 66, gain: 0.4, decay: 0.1 }), burst(0.045, { freq: 2100, gain: 0.35, decay: 0.05 })),
  castle: () => (burst(0), burst(0.09, { freq: 1500, gain: 0.4 })),
  check: () => (burst(0, { gain: 0.6 }), tone(0.02, { freq: 880, gain: 0.05, decay: 0.6 })),
  end: () => chime([523.25, 659.25, 783.99]),
  wrong: () => (burst(0, { freq: 600, gain: 0.45, decay: 0.12 }), tone(0, { freq: 90, to: 60, gain: 0.3, decay: 0.15 })),
}

/** Chiptune: a blip for a move, a crunch for a capture, an alarm for check, little tunes for the rest. */
const RETRO: Recipe = {
  // a two-frame blip with a tick of noise as the piece lands
  move: () => (chip(0, [mtof(79), mtof(74)], { step: 0.018, duty: 0.25, gain: 0.055, decay: 0.035 }), crunch(0, { clock: 60000, gain: 0.03, decay: 0.018 })),
  // the noise channel crunches while a pulse falls away
  capture: () => (crunch(0, { clock: 26000, to: 5000, gain: 0.065, decay: 0.11 }), sweep(0, mtof(81), mtof(57), 0.1, { duty: 0.5, gain: 0.04 })),
  // king and rook: two hops up a fifth
  castle: () => (
    chip(0, [mtof(72)], { duty: 0.25, gain: 0.055, hold: 0.035, decay: 0.03 }),
    crunch(0, { clock: 60000, gain: 0.028, decay: 0.018 }),
    chip(0.085, [mtof(79)], { duty: 0.25, gain: 0.055, hold: 0.035, decay: 0.03 }),
    crunch(0.085, { clock: 60000, gain: 0.028, decay: 0.018 })
  ),
  // an alarm: high, higher, high
  check: () => tune(0, [88, 93, 88], { step: 0.05, duty: 0.5, gain: 0.04 }),
  // a power-up run
  promote: () => (chip(0, [72, 76, 79, 84, 88, 91, 96].map(mtof), { step: 0.028, duty: 0.125, gain: 0.045, decay: 0.12 }), chip(0, [mtof(48)], { duty: 0, gain: 0.09, hold: 0.12, decay: 0.1 })),
  // a low double buzz
  wrong: () => tune(0, [57, 52], { step: 0.08, duty: 0.25, gain: 0.05 }),
  // ready, set, go
  start: () => (tune(0, [72, 0, 72, [79, 3]], { step: 0.07, duty: 0.25, gain: 0.035 }), tune(0, [48, 0, 48, [55, 3]], { step: 0.07, duty: 0, gain: 0.09 })),
  // finished: a short cadence that suits any result
  end: () => (tune(0.05, [76, 79, [84, 4]], { step: 0.08, duty: 0.25, gain: 0.035 }), tune(0.05, [[48, 2], [43, 4]], { step: 0.08, duty: 0, gain: 0.09 })),
  // a little fanfare
  win: () => (
    tune(0.05, [72, 76, 79, [84, 2], 79, [84, 5]], { step: 0.075, duty: 0.25, gain: 0.035 }),
    tune(0.05, [64, 67, 72, [76, 2], 72, [76, 5]], { step: 0.075, duty: 0.125, gain: 0.02 }),
    tune(0.05, [[48, 3], [55, 2], [48, 6]], { step: 0.075, duty: 0, gain: 0.1 })
  ),
  // down and out
  lose: () => (tune(0.05, [[79, 2], [78, 2], [77, 2], [76, 6]], { step: 0.09, duty: 0.5, gain: 0.03 }), tune(0.05, [[52, 6], [48, 6]], { step: 0.09, duty: 0, gain: 0.09 })),
  // neither: up and back
  draw: () => (tune(0.05, [79, 74, [79, 4]], { step: 0.09, duty: 0.25, gain: 0.032 }), tune(0.05, [[43, 2], [43, 4]], { step: 0.09, duty: 0, gain: 0.08 })),
  // correct: two bright notes a fifth apart
  solved: () => tune(0, [84, [91, 4]], { step: 0.06, duty: 0.125, gain: 0.05 }),
  // not quite: a fourth down and a little droop
  failed: () => (tune(0, [[60, 2]], { step: 0.07, duty: 0.5, gain: 0.032 }), sweep(0.14, mtof(55), mtof(50), 0.22, { duty: 0.5, gain: 0.032 })),
}

export const SOUND_SETS: { id: string; name: string; recipe: Recipe }[] = [
  {
    id: 'retro',
    name: 'Retro',
    recipe: RETRO,
  },
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
].map((set) => translateFields(set, 'name'))

let current = SOUND_SETS[0]

export function setSoundSet(id: string) {
  current = SOUND_SETS.find((s) => s.id === id) ?? SOUND_SETS[0]
}

/** Plays one moment in the chosen set (or `set`). The caller checks the sound setting. */
export function playSound(kind: SoundKind, set = current) {
  try {
    const own = set.recipe[kind]
    if (own) own()
    else SOFT[kind as Exclude<SoundKind, Base>](set.recipe)
  } catch {
    // no audio available (e.g. blocked autoplay); moves stay silent
  }
}

export function soundFor(san: string): SoundKind {
  if (san.includes('=')) return 'promote'
  if (san.includes('+') || san.includes('#')) return 'check'
  if (san.startsWith('O-O')) return 'castle'
  if (san.includes('x')) return 'capture'
  return 'move'
}

/** The sound for the end of a game, from the player's point of view. */
export const resultSound = (score: number | null): SoundKind => (score === 1 ? 'win' : score === 0 ? 'lose' : score === 0.5 ? 'draw' : 'end')

// ---------------------------------------------------------------- jingles

export type Jingle = 'levelUp' | 'quest' | 'chest' | 'achievement'

/** Each jingle in chiptune and as soft chimes for the other sets; each returns when it ends (seconds from now). */
const JINGLES: Record<Jingle, { chip: (at: number) => number; soft: (at: number) => number }> = {
  quest: {
    // item get
    chip: (at) => (tune(at, [79, 84, 88, [91, 4]], { step: 0.06, duty: 0.25, gain: 0.035 }), tune(at, [[55, 3], [60, 4]], { step: 0.06, duty: 0, gain: 0.09 })),
    soft: (at) => (chime([783.99, 1046.5, 1318.5], 0.06, at, 0.08, 0.6), at + 0.8),
  },
  achievement: {
    chip: (at) => (
      tune(at, [84, 88, 91, 96, 0, 91, [96, 6]], { step: 0.055, duty: 0.125, gain: 0.035 }),
      tune(at, [76, 79, 84, 88, 0, 84, [88, 6]], { step: 0.055, duty: 0.25, gain: 0.018 }),
      tune(at, [[48, 4], [55, 1], 0, [60, 6]], { step: 0.055, duty: 0, gain: 0.09 })
    ),
    soft: (at) => (chime([1046.5, 1318.5, 1567.98], 0.06, at, 0.08, 0.8), at + 1),
  },
  levelUp: {
    chip: (at) => (
      tune(at, [72, 76, 79, 72, 76, 79, 84, 0, 84, [88, 2], [91, 6]], { step: 0.07, duty: 0.25, gain: 0.035 }),
      tune(at, [64, 67, 72, 64, 67, 72, 76, 0, 76, [79, 2], [84, 6]], { step: 0.07, duty: 0.125, gain: 0.018 }),
      tune(at, [[48, 3], [48, 3], [55, 2], [53, 2], [60, 7]], { step: 0.07, duty: 0, gain: 0.1 })
    ),
    soft: (at) => {
      chime([523.25, 659.25, 783.99, 1046.5], 0.06, at, 0.1, 0.7)
      ;[523.25, 659.25, 783.99].forEach((f) => tone(at + 0.45, { freq: f, gain: 0.035, decay: 1.2, attack: 0.03 }))
      return at + 1.6
    },
  },
  chest: {
    // a run up the scale as the lid lifts, a sparkle, then the chord
    chip: (at) => {
      const run = [72, 74, 76, 79, 81, 84, 86, 88, 91, 93, 96]
      chip(at, run.map(mtof), { step: 0.04, duty: 0.125, gain: 0.032, decay: 0.03 })
      const top = at + run.length * 0.04
      chip(top, [96, 100, 103, 108, 96, 100, 103, 108].map(mtof), { step: 0.03, duty: 0.125, gain: 0.022, decay: 0.08 })
      crunch(top, { clock: 180000, gain: 0.012, decay: 0.3 })
      const chord = top + 0.26
      ;[84, 88, 91].forEach((m, i) => chip(chord, [mtof(m)], { duty: i ? 0.125 : 0.25, gain: i ? 0.018 : 0.03, hold: 0.32, decay: 0.3, vibrato: true }))
      chip(chord, [mtof(48)], { duty: 0, gain: 0.1, hold: 0.32, decay: 0.3 })
      return chord + 0.62
    },
    soft: (at) => {
      chime([523.25, 659.25, 783.99, 1046.5, 1318.5, 1567.98], 0.045, at, 0.06, 0.6)
      ;[1046.5, 1318.5, 1567.98].forEach((f) => tone(at + 0.45, { freq: f, gain: 0.03, decay: 1.1, attack: 0.03 }))
      return at + 1.5
    },
  },
}

// jingles queue up behind each other instead of playing on top of each other
let jingleUntil = 0

/** A short tune for a reward, in the style of the chosen sound set; silent when sound is off. */
export function playJingle(kind: Jingle) {
  const { sound, soundSet } = useGame.getState().settings
  if (!sound) return
  try {
    const ac = audio()
    const wait = Math.max(0, jingleUntil - ac.currentTime)
    // a long queue (a sync bringing many rewards at once) would only drag on
    if (wait > 2.5) return
    const j = JINGLES[kind]
    const end = soundSet === 'retro' ? j.chip(wait) : j.soft(wait)
    jingleUntil = ac.currentTime + end + 0.08
  } catch {
    // no audio available
  }
}
