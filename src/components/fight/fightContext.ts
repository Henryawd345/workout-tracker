import { createContext, useContext } from 'react'
import type { Call, ClockState, FightSession } from '../../data/index.ts'

export interface LiveFight {
  session: FightSession
  state: ClockState
  call: Call | null
  togglePause: () => void
  /** Saves the full rounds, or discards the session if there are none. */
  end: () => Promise<void>
}

export type FightContextValue = { status: 'loading' } | { status: 'none' } | ({ status: 'active' } & LiveFight)

export const FightContext = createContext<FightContextValue>({ status: 'loading' })

/** The fight session in progress, wherever you are in the app. */
export function useFightSession(): FightContextValue {
  return useContext(FightContext)
}
