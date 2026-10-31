// End-of-rest alert: a short beep, plus vibration where the phone allows it (not iPhone).
// iOS only lets a page play sound after a tap, so unlockAudio() is called from the ✓ tap.

type AudioContextClass = typeof AudioContext

let ctx: AudioContext | null = null

export function unlockAudio(): void {
  try {
    const Ctor: AudioContextClass | undefined =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioContextClass }).webkitAudioContext
    if (!Ctor) return
    ctx ??= new Ctor()
    if (ctx.state === 'suspended') void ctx.resume()
  } catch {
    // Sound is a nice-to-have; never let it break logging.
  }
}

/** True once a tap has turned sound on (iOS needs one after every reload). */
export function audioReady(): boolean {
  return ctx?.state === 'running'
}

export function restOverAlert(): void {
  try {
    navigator.vibrate?.([200, 100, 200])
  } catch {
    // ignore
  }
  if (!ctx) return
  // iOS suspends audio while the phone is locked; wake it before beeping.
  if (ctx.state !== 'running') {
    void ctx.resume().then(beep, () => undefined)
    return
  }
  beep()
}

function beep(): void {
  if (!ctx || ctx.state !== 'running') return
  try {
    const start = ctx.currentTime
    for (const offset of [0, 0.25, 0.5]) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.frequency.value = 880
      gain.gain.setValueAtTime(0.0001, start + offset)
      gain.gain.exponentialRampToValueAtTime(0.3, start + offset + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, start + offset + 0.18)
      osc.connect(gain).connect(ctx.destination)
      osc.start(start + offset)
      osc.stop(start + offset + 0.2)
    }
  } catch {
    // ignore
  }
}

// —— Fight session sounds ——

interface Tone {
  freq: number
  at: number
  dur: number
  peak: number
  type?: OscillatorType
}

function play(tones: Tone[]): void {
  if (!ctx) return
  const run = () => {
    if (!ctx || ctx.state !== 'running') return
    try {
      const start = ctx.currentTime
      for (const t of tones) {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = t.type ?? 'sine'
        osc.frequency.value = t.freq
        gain.gain.setValueAtTime(0.0001, start + t.at)
        gain.gain.exponentialRampToValueAtTime(t.peak, start + t.at + 0.005)
        gain.gain.exponentialRampToValueAtTime(0.0001, start + t.at + t.dur)
        osc.connect(gain).connect(ctx.destination)
        osc.start(start + t.at)
        osc.stop(start + t.at + t.dur + 0.05)
      }
    } catch {
      // ignore
    }
  }
  if (ctx.state !== 'running') void ctx.resume().then(run, () => undefined)
  else run()
}

/** A boxing bell: rung once to start a round, three times to end it. */
export function roundBell(times: 1 | 3): void {
  const tones: Tone[] = []
  for (let i = 0; i < times; i++) {
    const at = i * 0.45
    // A few slightly out-of-tune partials with a long decay sound like a struck bell.
    tones.push({ freq: 620, at, dur: 1.6, peak: 0.28 })
    tones.push({ freq: 1252, at, dur: 1.1, peak: 0.14 })
    tones.push({ freq: 1975, at, dur: 0.7, peak: 0.08 })
  }
  play(tones)
}

/** Two quick knocks: 10 seconds left in the round. */
export function warningKnock(): void {
  play([
    { freq: 950, at: 0, dur: 0.06, peak: 0.35, type: 'triangle' },
    { freq: 950, at: 0.16, dur: 0.06, peak: 0.35, type: 'triangle' },
  ])
}
