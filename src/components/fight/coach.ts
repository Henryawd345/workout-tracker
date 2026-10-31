import { unlockAudio } from '../workout/alerts.ts'

// The fight coach's voice: the phone's built-in text-to-speech, so it works offline.
// iOS only starts speech from a tap, so unlockSpeech() is called from the Start tap.
// Every call is wrapped so a speech problem can never break the session.

function synth(): SpeechSynthesis | null {
  return typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null
}

export function speechSupported(): boolean {
  return synth() !== null && typeof SpeechSynthesisUtterance !== 'undefined'
}

export interface SpeakOptions {
  voiceURI?: string | null
  rate?: number
  /** Called when speaking ends, fails, or isn't possible. */
  onEnd?: () => void
}

export function speak(text: string, { voiceURI = null, rate = 1, onEnd }: SpeakOptions = {}): void {
  const s = synth()
  if (!s || !speechSupported()) {
    onEnd?.()
    return
  }
  try {
    // A new call replaces one still being said, so the coach never falls behind.
    if (s.speaking || s.pending) s.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate = rate
    utterance.lang = 'en-US'
    const voice = voiceURI ? s.getVoices().find((v) => v.voiceURI === voiceURI) : undefined
    if (voice) {
      utterance.voice = voice
      utterance.lang = voice.lang
    }
    let ended = false
    const end = () => {
      if (ended) return
      ended = true
      onEnd?.()
    }
    utterance.onend = end
    utterance.onerror = end
    s.speak(utterance)
  } catch {
    onEnd?.()
  }
}

/** Call from a tap, before the session needs to speak. */
export function unlockSpeech(): void {
  const s = synth()
  if (!s || !speechSupported()) return
  try {
    const utterance = new SpeechSynthesisUtterance(' ')
    utterance.volume = 0
    s.speak(utterance)
  } catch {
    // ignore
  }
}

/** Call from a tap that opens a fight session, so iOS lets the coach and the bell make sound. */
export function unlockFightSound(): void {
  unlockAudio()
  unlockSpeech()
}

export function stopSpeaking(): void {
  try {
    synth()?.cancel()
  } catch {
    // ignore
  }
}

/** English voices on this phone, by name. (May be empty until the phone has loaded them.) */
export function englishVoices(): SpeechSynthesisVoice[] {
  try {
    return (synth()?.getVoices() ?? []).filter((v) => v.lang.toLowerCase().startsWith('en')).sort((a, b) => a.name.localeCompare(b.name))
  } catch {
    return []
  }
}

/** Calls `listener` when the list of voices changes. Returns an unsubscribe function. */
export function onVoicesChanged(listener: () => void): () => void {
  const s = synth()
  if (!s?.addEventListener) return () => {}
  s.addEventListener('voiceschanged', listener)
  return () => s.removeEventListener('voiceschanged', listener)
}

/** Rough time to say `text`, for when the phone never reports that speech ended. */
export function estimatedSpeechSec(text: string, rate = 1): number {
  const words = text.split(/[\s,]+/).filter(Boolean).length
  return (0.5 + 0.38 * words) / rate
}
