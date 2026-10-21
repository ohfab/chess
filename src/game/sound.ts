// Move sounds synthesised with Web Audio: a short filtered noise burst
// over a low body thump reads as a wooden piece set down on the board.

let ctx: AudioContext | null = null
let noise: AudioBuffer | null = null

function audio() {
  if (!ctx) {
    ctx = new AudioContext()
    noise = ctx.createBuffer(1, ctx.sampleRate * 0.2, ctx.sampleRate)
    const data = noise.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  }
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

function tap(at: number, { freq = 1700, body = 140, gain = 0.5, decay = 0.07 } = {}) {
  const ac = audio()
  const t = ac.currentTime + at

  const src = ac.createBufferSource()
  src.buffer = noise
  const band = ac.createBiquadFilter()
  band.type = 'bandpass'
  band.frequency.value = freq
  band.Q.value = 1.2
  const env = ac.createGain()
  env.gain.setValueAtTime(0.0001, t)
  env.gain.exponentialRampToValueAtTime(gain, t + 0.002)
  env.gain.exponentialRampToValueAtTime(0.0001, t + decay)
  src.connect(band).connect(env).connect(ac.destination)
  src.start(t)
  src.stop(t + decay + 0.02)

  const osc = ac.createOscillator()
  osc.frequency.setValueAtTime(body, t)
  osc.frequency.exponentialRampToValueAtTime(body * 0.6, t + 0.08)
  const thump = ac.createGain()
  thump.gain.setValueAtTime(0.0001, t)
  thump.gain.exponentialRampToValueAtTime(gain * 0.6, t + 0.003)
  thump.gain.exponentialRampToValueAtTime(0.0001, t + 0.09)
  osc.connect(thump).connect(ac.destination)
  osc.start(t)
  osc.stop(t + 0.1)
}

function chime(at: number, freqs: number[], gain = 0.08) {
  const ac = audio()
  const t = ac.currentTime + at
  freqs.forEach((f, i) => {
    const osc = ac.createOscillator()
    osc.type = 'sine'
    osc.frequency.value = f
    const env = ac.createGain()
    const start = t + i * 0.09
    env.gain.setValueAtTime(0.0001, start)
    env.gain.exponentialRampToValueAtTime(gain, start + 0.02)
    env.gain.exponentialRampToValueAtTime(0.0001, start + 0.9)
    osc.connect(env).connect(ac.destination)
    osc.start(start)
    osc.stop(start + 1)
  })
}

export type SoundKind = 'move' | 'capture' | 'check' | 'castle' | 'end' | 'wrong'

export function playSound(kind: SoundKind) {
  try {
    switch (kind) {
      case 'move':
        tap(0)
        break
      case 'capture':
        tap(0, { freq: 1300, body: 110, gain: 0.7, decay: 0.09 })
        tap(0.045, { freq: 2100, gain: 0.35, decay: 0.05 })
        break
      case 'castle':
        tap(0)
        tap(0.09, { freq: 1500, gain: 0.4 })
        break
      case 'check':
        tap(0, { gain: 0.6 })
        chime(0.02, [880], 0.05)
        break
      case 'end':
        chime(0.2, [523.25, 659.25, 783.99])
        break
      case 'wrong':
        tap(0, { freq: 600, body: 90, gain: 0.45, decay: 0.12 })
        break
    }
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
