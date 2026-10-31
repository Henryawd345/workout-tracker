import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  addCombo,
  finishFightSession,
  getFightSession,
  listCombos,
  READY_SEC,
  startFightSession,
} from '../data/index.ts'
import { addCompletedWorkout, done, makeExercise, resetDb } from '../test/factories.ts'
import { renderApp } from '../test/renderApp.tsx'

const spoken: string[] = []
beforeEach(async () => {
  // Mid-month, mid-week, midday: no day, week or month boundary near "now".
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 9, 14, 12, 0))
  spoken.length = 0
  vi.stubGlobal(
    'SpeechSynthesisUtterance',
    class {
      text: string
      constructor(text: string) {
        this.text = text
      }
    },
  )
  Object.defineProperty(window, 'speechSynthesis', {
    configurable: true,
    value: { speaking: false, pending: false, speak: (u: { text: string }) => spoken.push(u.text), cancel() {}, getVoices: () => [] },
  })
  await resetDb()
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

/** A finished boxing session (2 of 3 rounds) that started `daysAgo` days ago. */
async function finishedSession(daysAgo = 0) {
  const start = Date.now() - daysAgo * 86_400_000 - 60_000
  const s = await startFightSession({ sport: 'boxing', intensity: 'hard', roundSec: 180, restSec: 60, rounds: 3 }, start)
  return finishFightSession(s.id, start + (READY_SEC + 180 + 60 + 180 + 30) * 1000)
}

describe('my combos', () => {
  it('adds, refuses duplicates, plays and deletes with undo', async () => {
    renderApp('/fight/boxing')
    await userEvent.click(await screen.findByRole('link', { name: 'Combos' }))
    expect(await screen.findByText('No combos yet')).toBeInTheDocument()

    const field = screen.getByRole('textbox', { name: 'New combo' })
    await userEvent.type(field, '1 2 slip 2 3{Enter}')
    const list = await screen.findByRole('list', { name: 'Your combos' })
    expect(within(list).getByText('1 2 slip 2 3')).toBeInTheDocument()
    expect(field).toHaveValue('')

    await userEvent.type(field, '1 2  slip 2 3')
    await userEvent.click(screen.getByRole('button', { name: 'Add combo' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('already in your combos')

    await userEvent.click(within(list).getByRole('button', { name: 'Hear “1 2 slip 2 3”' }))
    expect(spoken.at(-1)).toBe('1 2 slip 2 3')

    await userEvent.click(within(list).getByRole('button', { name: 'Delete “1 2 slip 2 3”' }))
    expect(await screen.findByText('No combos yet')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Undo' }))
    expect(await screen.findByRole('list', { name: 'Your combos' })).toBeInTheDocument()
    expect(await listCombos('boxing')).toHaveLength(1)
  })

  it('shows the count on the setup screen', async () => {
    await addCombo('muay_thai', '1 2 rear kick')
    renderApp('/fight/muay_thai')
    expect(await screen.findByRole('link', { name: 'Combos (1)' })).toBeInTheDocument()
  })
})

describe('fight sessions in history', () => {
  it('lists them with workouts, newest first, and opens the detail', async () => {
    await addCompletedWorkout(new Date(Date.now() - 2 * 86_400_000).toISOString(), [makeExercise('ex-deadlift', [done(140, 5)])], {
      name: 'Pull day',
    })
    const s = await finishedSession(0)
    renderApp('/history')
    const rows = await screen.findAllByRole('link', { name: /Boxing|Pull day/ })
    expect(rows.map((r) => r.textContent)).toEqual([expect.stringContaining('Boxing'), expect.stringContaining('Pull day')])
    expect(rows[0]).toHaveTextContent('2 of 3 × 3 min · Hard')
    expect(screen.getByText(/· 1 workout, 1 fight session$/)).toBeInTheDocument()

    await userEvent.click(rows[0])
    expect(await screen.findByRole('heading', { name: 'Boxing' })).toBeInTheDocument()
    expect(screen.getByText('Hard · 1 min rest between rounds')).toBeInTheDocument()
    await userEvent.type(screen.getByRole('textbox', { name: 'Note' }), 'good head movement')
    await userEvent.tab()
    await waitFor(async () => expect((await getFightSession(s.id))?.note).toBe('good head movement'))

    await userEvent.click(screen.getByRole('button', { name: 'Delete session' }))
    await userEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Delete' }))
    expect(await screen.findByRole('heading', { name: 'History' })).toBeInTheDocument()
    expect(await getFightSession(s.id)).toBeUndefined()
  })

  it('shows them on the calendar', async () => {
    await finishedSession(0)
    renderApp('/history?view=calendar')
    const days = await screen.findByRole('group', { name: /^Days in/ })
    expect(within(days).getByRole('button', { name: /, 1 fight session$/ })).toBeInTheDocument()
    expect(screen.getByText('1 fight session')).toBeInTheDocument()
  })

  it('counts them in “this week” on Today', async () => {
    await finishedSession(0)
    await addCompletedWorkout(new Date(Date.now() - 60_000).toISOString(), [makeExercise('ex-deadlift', [done(140, 5)])])
    renderApp('/today')
    expect(await screen.findByText('2 workouts this week.')).toBeInTheDocument()
  })
})
