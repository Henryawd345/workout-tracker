import { useEffect, useRef, useState } from 'react'
import { nextCall, type Call, type ClockState, type FightSession } from '../../data/index.ts'
import { roundBell, warningKnock } from '../workout/alerts.ts'
import { estimatedSpeechSec, speak, stopSpeaking } from './coach.ts'

/** A gap between ticks longer than this means the app was hidden or the phone locked. */
const JUMP_MS = 2000

interface CoachOptions {
  session: Pick<FightSession, 'sport' | 'intensity'>
  state: ClockState
  /** Epoch ms of this tick. */
  now: number
  /** The user's own combos for this sport. */
  custom: string[]
  voiceURI: string | null
  rate: number
}

/** Seconds after "Round 2" before the first combo. */
const FIRST_CALL_DELAY_SEC = 2.5
/** No new combo this close to the bell. */
const QUIET_END_SEC = 2

/**
 * Drives the coach from the clock, once per tick: bell and "Round 2" / "Rest" / "Time" when
 * the phase changes, a knock 10 seconds before the end of a round, and combos during rounds
 * — each after the last one was said plus time to throw it. Returns the combo to show.
 *
 * Opening part-way through (after a reload), or coming back after the phone was locked, plays
 * nothing for the phase you land in, so missed calls are never replayed late.
 */
export function useFightCoach({ session, state, now, custom, voiceURI, rate }: CoachOptions): Call | null {
  const [current, setCurrent] = useState<Call | null>(null)
  const phaseKey = useRef<string | null>(null)
  const wasPaused = useRef(state.paused)
  const nextAt = useRef(0)
  const lastText = useRef<string | null>(null)
  const warnedRound = useRef(0)
  const callId = useRef(0)
  const lastTick = useRef(now)

  // Read inside the tick effect without restarting it.
  const latest = useRef({ session, custom, voiceURI, rate })
  useEffect(() => {
    latest.current = { session, custom, voiceURI, rate }
  })

  const { phase, round, remainingSec, paused } = state

  useEffect(() => {
    const { session, custom, voiceURI, rate } = latest.current
    const say = (text: string, onEnd?: () => void) => speak(text, { voiceURI, rate, onEnd })
    const key = `${phase}:${round}`
    const jumped = now - lastTick.current > JUMP_MS
    lastTick.current = now

    if (phaseKey.current === null || (jumped && key !== phaseKey.current)) {
      // First tick on this screen: land quietly in whatever phase it is.
      phaseKey.current = key
      nextAt.current = now + FIRST_CALL_DELAY_SEC * 1000
      if (phase === 'round' && remainingSec <= 10) warnedRound.current = round
      return
    }

    if (key !== phaseKey.current) {
      phaseKey.current = key
      callId.current++
      setCurrent(null)
      if (phase === 'round') {
        roundBell(1)
        say(`Round ${round}`)
        nextAt.current = now + FIRST_CALL_DELAY_SEC * 1000
      } else if (phase === 'rest' || phase === 'done') {
        roundBell(3)
        say(phase === 'rest' ? 'Rest' : 'Time')
      }
      return
    }

    if (paused !== wasPaused.current) {
      wasPaused.current = paused
      if (paused) {
        callId.current++
        stopSpeaking()
      } else {
        nextAt.current = now + 1500
      }
    }
    if (phase !== 'round' || paused) return

    if (remainingSec <= 10 && remainingSec > 8 && warnedRound.current !== round) {
      warnedRound.current = round
      warningKnock()
    }
    if (remainingSec <= QUIET_END_SEC || now < nextAt.current) return

    const call = nextCall(session.sport, session.intensity, { custom, previous: lastText.current })
    const id = ++callId.current
    lastText.current = call.text
    setCurrent(call)
    // If the phone never says it finished, carry on after a rough estimate.
    nextAt.current = now + (estimatedSpeechSec(call.text, rate) + call.gapSec) * 1000
    say(call.text, () => {
      if (callId.current === id) nextAt.current = Date.now() + call.gapSec * 1000
    })
  }, [phase, round, remainingSec, paused, now])

  return phase === 'round' ? current : null
}
