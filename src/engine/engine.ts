import engineJs from 'stockfish/bin/stockfish-19-lite-single.js?url'
import engineWasm from 'stockfish/bin/stockfish-19-lite-single.wasm?url'
import engineAsm from 'stockfish/bin/stockfish-19-asm.js?url'
import { t } from '../i18n/i18n'

/** Score from the side to move, as Stockfish reports it. */
export type Score = { cp: number } | { mate: number }

export interface Line {
  multipv: number
  depth: number
  score: Score
  pv: string[]
}

export interface Info {
  depth: number
  nps?: number
  lines: Line[]
}

export interface SearchRequest {
  fen: string
  /** everything after "go", e.g. "depth 18" or "movetime 500" */
  go: string
  options?: Record<string, string | number | boolean>
  onInfo?: (info: Info) => void
}

interface Job {
  request: SearchRequest
  lines: Line[]
  resolve: (bestmove: string | null) => void
}

/**
 * One Stockfish instance in a Web Worker, spoken to over UCI.
 * Only one search runs at a time: a new search stops the previous one,
 * and requests that are overtaken while waiting are dropped (resolve null).
 */
// The WebAssembly build first (it reads its .wasm location from the hash of its own url).
// Some hosts refuse to compile WebAssembly; the asm.js build is slower but runs anywhere.
const wasmBuild = () => new Worker(`${engineJs}#${encodeURIComponent(new URL(engineWasm, location.href).href)}`)
const asmBuild = () => new Worker(engineAsm)

/**
 * Whether this page may compile WebAssembly in a worker, asked once per page load.
 * A blocked engine worker never reports an error, so without the probe every engine
 * would wait for the handshake timeout before falling back to asm.js.
 */
let wasmAllowed: Promise<boolean> | null = null
function canUseWasm() {
  wasmAllowed ??= new Promise<boolean>((resolve) => {
    if (typeof WebAssembly !== 'object') return resolve(false)
    let probe: Worker
    try {
      probe = new Worker(new URL('./wasm-probe.ts', import.meta.url), { type: 'module' })
    } catch {
      return resolve(true)
    }
    const done = (ok: boolean) => {
      clearTimeout(timer)
      probe.terminate()
      resolve(ok)
    }
    // a probe that cannot even start says nothing about WebAssembly: try the fast build
    const timer = setTimeout(() => done(true), 3000)
    probe.onmessage = (e) => done(e.data === true)
    probe.onerror = () => done(true)
  })
  return wasmAllowed
}

/** Starts a build and waits for its UCI greeting; false if it fails to load. */
function handshake(worker: Worker, timeout: number): Promise<boolean> {
  return new Promise((resolve) => {
    const done = (ok: boolean) => {
      clearTimeout(timer)
      worker.onerror = null
      worker.onmessage = null
      resolve(ok)
    }
    const timer = setTimeout(() => done(false), timeout)
    worker.onerror = () => done(false)
    worker.onmessage = (e) => typeof e.data === 'string' && e.data.includes('uciok') && done(true)
    worker.postMessage('uci')
  })
}

export class Engine {
  private worker: Worker | null = null
  private ready: Promise<void>
  private job: Job | null = null
  private idleWaiters: (() => void)[] = []
  private ticket = 0
  private applied = new Map<string, string>()
  private replies: { token: string; resolve: () => void }[] = []

  constructor() {
    this.ready = this.boot()
  }

  private async boot() {
    const builds = (await canUseWasm()) ? [wasmBuild, asmBuild] : [asmBuild]
    for (const build of builds) {
      let worker: Worker
      try {
        worker = build()
      } catch {
        continue
      }
      // slow phones need a few seconds to compile the engine; a hang means it never will
      if (!(await handshake(worker, 15000))) {
        worker.terminate()
        continue
      }
      worker.onmessage = (e) => {
        if (typeof e.data !== 'string') return
        for (const line of e.data.split('\n')) this.receive(line.trim())
      }
      this.worker = worker
      await this.command('isready', 'readyok')
      return
    }
    throw new Error(t('Stockfish konnte nicht gestartet werden'))
  }

  private send(cmd: string) {
    this.worker?.postMessage(cmd)
  }

  private command(cmd: string, token: string) {
    return new Promise<void>((resolve) => {
      this.replies.push({ token, resolve })
      this.send(cmd)
    })
  }

  private receive(line: string) {
    if (!line) return
    // the engine answers uci/isready in order
    const reply = this.replies[0]
    if (reply && line.startsWith(reply.token)) {
      this.replies.shift()
      reply.resolve()
      return
    }
    const job = this.job
    if (!job) return
    if (line.startsWith('info ') && line.includes(' pv ')) {
      const parsed = parseInfo(line)
      if (!parsed) return
      const { line: pvLine, nps } = parsed
      job.lines = [...job.lines.filter((l) => l.multipv !== pvLine.multipv), pvLine].sort((a, b) => a.multipv - b.multipv)
      job.request.onInfo?.({ depth: job.lines[0]?.depth ?? pvLine.depth, nps, lines: job.lines })
    } else if (line.startsWith('bestmove')) {
      const move = line.split(' ')[1]
      this.job = null
      job.resolve(move && move !== '(none)' ? move : null)
      const waiters = this.idleWaiters
      this.idleWaiters = []
      for (const w of waiters) w()
    }
  }

  private idle() {
    if (!this.job) return Promise.resolve()
    return new Promise<void>((resolve) => this.idleWaiters.push(resolve))
  }

  /** Resolves with the best move in UCI notation, or null if overtaken or there is no legal move. */
  async search(request: SearchRequest): Promise<string | null> {
    const ticket = ++this.ticket
    this.stop()
    await this.ready
    await this.idle()
    if (ticket !== this.ticket) return null

    const changed = Object.entries(request.options ?? {}).filter(([k, v]) => this.applied.get(k) !== String(v))
    for (const [name, value] of changed) {
      this.send(`setoption name ${name} value ${value}`)
      this.applied.set(name, String(value))
    }
    if (changed.length) await this.command('isready', 'readyok')
    if (ticket !== this.ticket) return null

    return new Promise((resolve) => {
      this.job = { request, lines: [], resolve: (m) => resolve(ticket === this.ticket ? m : null) }
      this.send(`position fen ${request.fen}`)
      this.send(`go ${request.go}`)
    })
  }

  stop() {
    if (this.job) this.send('stop')
  }

  /** Drops any pending request and stops the running search. */
  cancel() {
    this.ticket++
    this.stop()
  }

  newGame() {
    this.cancel()
    this.send('ucinewgame')
  }

  destroy() {
    this.worker?.terminate()
  }
}

function parseInfo(text: string): { line: Line; nps?: number } | null {
  const t = text.split(' ')
  let depth = 0
  let multipv = 1
  let score: Score | null = null
  let nps: number | undefined
  for (let i = 1; i < t.length; i++) {
    switch (t[i]) {
      case 'depth':
        depth = Number(t[++i])
        break
      case 'multipv':
        multipv = Number(t[++i])
        break
      case 'nps':
        nps = Number(t[++i])
        break
      case 'score': {
        const kind = t[++i]
        const value = Number(t[++i])
        // fail-high/low lines are provisional; wait for the exact score
        if (t[i + 1] === 'lowerbound' || t[i + 1] === 'upperbound') return null
        score = kind === 'mate' ? { mate: value } : { cp: value }
        break
      }
      case 'pv':
        if (!score) return null
        return { line: { multipv, depth, score, pv: t.slice(i + 1) }, nps }
    }
  }
  return null
}
