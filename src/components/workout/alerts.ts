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
