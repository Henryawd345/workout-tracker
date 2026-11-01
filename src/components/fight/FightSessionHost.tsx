import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  clockState,
  DEFAULT_SETTINGS,
  discardFightSession,
  finishFightSession,
  getActiveFightSession,
  getSettings,
  listCombos,
  pauseClock,
  resumeClock,
  saveFightSession,
  StaleFightSaveError,
  type FightClock,
  type FightSession,
} from '../../data/index.ts'
import { useNow } from '../../hooks/useNow.ts'
import { useWakeLock } from '../../hooks/useWakeLock.ts'
import { stopSpeaking, unlockFightSound } from './coach.ts'
import { FightContext, type FightContextValue, type LiveFight } from './fightContext.ts'
import { useFightCoach } from './useFightCoach.ts'

/**
 * Runs the session in progress — clock, coach, bell, wake lock, saving at the last bell — for
 * the whole app, so minimising the session screen doesn't silence the coach.
 */
export function FightSessionHost({ children }: { children: ReactNode }) {
  const active = useLiveQuery(async () => (await getActiveFightSession()) ?? null, [])
  const [live, setLive] = useState<LiveFight | null>(null)

  const value: FightContextValue =
    active === undefined
      ? { status: 'loading' }
      : active === null
        ? { status: 'none' }
        : live && live.session.id === active.id
          ? { status: 'active', ...live }
          : { status: 'loading' }

  return (
    <FightContext.Provider value={value}>
      {/* A sibling, not a wrapper: starting or ending a session never remounts the screens. */}
      {active && <FightRunner key={active.id} stored={active} onChange={setLive} />}
      {children}
    </FightContext.Provider>
  )
}

function sameClock(a: FightClock, b: FightClock): boolean {
  return a.runningSince === b.runningSince && a.elapsedBeforeSec === b.elapsedBeforeSec
}

function FightRunner({ stored, onChange }: { stored: FightSession; onChange: (live: LiveFight | null) => void }) {
  const settings = useLiveQuery(() => getSettings(), [], DEFAULT_SETTINGS)
  const combos = useLiveQuery(() => listCombos(stored.sport), [stored.sport], [])
  // Pause/resume shows straight away, before the database confirms it.
  const [pending, setPending] = useState<FightClock | null>(null)
  const clock = pending && !sameClock(pending, stored.clock) ? pending : stored.clock
  const session: FightSession = { ...stored, clock }
  const now = useNow(250).getTime()
  const state = clockState(session, clock, now)

  const call = useFightCoach({
    session,
    stance: settings.stance,
    state,
    now,
    custom: combos.map((c) => c.text),
    voiceURI: settings.coachVoice,
    rate: settings.coachRate,
  })
  useWakeLock(!state.paused && state.phase !== 'done')

  const finished = useRef(false)
  useEffect(() => {
    if (state.phase !== 'done' || finished.current) return
    finished.current = true
    // The last bell: save to history. The "Time" call keeps playing; nothing stops it.
    finishFightSession(stored.id).catch(async () => {
      // Already saved (End, or another tab) is fine; anything else is tried again next tick.
      if ((await getActiveFightSession())?.id === stored.id) finished.current = false
    })
  }, [state.phase, stored.id])

  function togglePause() {
    unlockFightSound()
    const t = Date.now()
    const next = state.paused ? resumeClock(clock, t) : pauseClock(clock, t)
    setPending(next)
    saveFightSession({ ...session, clock: next }).catch((err: unknown) => {
      // Finished elsewhere: nothing to pause. Anything else: show what is really saved.
      if (!(err instanceof StaleFightSaveError)) setPending(null)
    })
  }

  async function end() {
    if (finished.current) return // the last bell already saved it
    finished.current = true
    stopSpeaking()
    try {
      if (clockState(session, clock, Date.now()).completedRounds > 0) await finishFightSession(stored.id)
      else await discardFightSession(stored.id)
    } catch {
      // Still in progress here? Then let End or the last bell try again.
      if ((await getActiveFightSession())?.id === stored.id) finished.current = false
    }
  }

  const latest = useRef({ togglePause, end })
  useEffect(() => {
    latest.current = { togglePause, end }
  })

  const snapshot = useRef<LiveFight | null>(null)
  useEffect(() => {
    snapshot.current = {
      session,
      state,
      call,
      togglePause: () => latest.current.togglePause(),
      end: () => latest.current.end(),
    }
  })
  // Tell the app only when something on screen changes, not on every tick.
  const key = [state.phase, state.round, state.remainingSec, state.paused, call?.text, stored.updatedAt, clock.runningSince].join('|')
  useEffect(() => {
    if (snapshot.current) onChange(snapshot.current)
  }, [key, onChange])

  useEffect(() => () => onChange(null), [onChange])
  return null
}
