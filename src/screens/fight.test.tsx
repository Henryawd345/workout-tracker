import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { addCombo, getActiveFightSession, listCompletedFightSessions, READY_SEC, startFightSession, updateSettings } from '../data/index.ts'
import { resetDb } from '../test/factories.ts'
import { renderApp } from '../test/renderApp.tsx'

const alerts = vi.hoisted(() => ({
  restOverAlert: vi.fn(),
  unlockAudio: vi.fn(),
  roundBell: vi.fn(),
  warningKnock: vi.fn(),
  audioReady: vi.fn(() => true),
}))
vi.mock('../components/workout/alerts.ts', () => alerts)

/** Fake phone voice: records what is said and "finishes" straight away. */
const spoken: string[] = []
class FakeUtterance {
  text: string
  rate = 1
  lang = ''
  volume = 1
  voice: unknown = null
  onend: (() => void) | null = null
  onerror: (() => void) | null = null
  constructor(text: string) {
    this.text = text
  }
}
const synth = {
  speaking: false,
  pending: false,
  speak: vi.fn((u: FakeUtterance) => {
    if (u.text.trim()) spoken.push(u.text)
    setTimeout(() => u.onend?.(), 0)
  }),
  cancel: vi.fn(),
  getVoices: () => [{ voiceURI: 'v-daniel', name: 'Daniel', lang: 'en-GB' }],
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
}

const T = Date.parse('2026-10-31T10:00:00.000Z')
const plan = { sport: 'boxing' as const, intensity: 'medium' as const, roundSec: 60, restSec: 30, rounds: 2 }

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(T)
  vi.stubGlobal('SpeechSynthesisUtterance', FakeUtterance)
  Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true })
  spoken.length = 0
  Object.values(alerts).forEach((f) => f.mockClear())
  synth.speak.mockClear()
  await resetDb()
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

const at = (sec: number) => vi.setSystemTime(T + sec * 1000)
/** Moves the clock and lets a few real ticks (250 ms) run, as on a phone that stays awake. */
async function tickAt(sec: number) {
  at(sec)
  await new Promise((resolve) => setTimeout(resolve, 300))
}
const roundLength = () => within(screen.getByRole('group', { name: 'Round length' }))
const phase = (text: string | RegExp) => screen.findByText(text, {}, { timeout: 3000 })

describe('fight tab and setup', () => {
  it('lists the sports and starts a session with your choices', async () => {
    renderApp('/today')
    await userEvent.click(await screen.findByRole('link', { name: 'Fight' }))
    const sports = await screen.findByRole('list', { name: 'Sports' })
    expect(within(sports).getAllByRole('link').map((l) => l.textContent)).toEqual([
      expect.stringContaining('Boxing'),
      expect.stringContaining('Muay Thai'),
      expect.stringContaining('Kickboxing'),
      expect.stringContaining('Wrestling'),
    ])

    await userEvent.click(within(sports).getByRole('link', { name: /Boxing/ }))
    expect(await screen.findByRole('radio', { name: '3 min' })).toBeChecked()
    expect(roundLength().getByRole('radio', { name: '1 min' })).not.toBeChecked()
    await userEvent.click(roundLength().getByRole('radio', { name: '2 min' }))
    await userEvent.click(screen.getByRole('button', { name: 'More rounds' }))
    await userEvent.click(screen.getByRole('radio', { name: 'Hard' }))
    expect(screen.getByText(/Total 11:10/)).toBeInTheDocument() // 10 s + 4 × 2:00 + 3 × 1:00

    await userEvent.click(screen.getByRole('button', { name: 'Start' }))
    expect(await phase('Get ready')).toBeInTheDocument()
    expect(alerts.unlockAudio).toHaveBeenCalled()
    expect(await getActiveFightSession()).toMatchObject({ sport: 'boxing', rounds: 4, roundSec: 120, intensity: 'hard' })
    expect(screen.queryByRole('navigation', { name: 'Main' })).not.toBeInTheDocument()
  })

  it('remembers your last choices for a sport', async () => {
    const s = await startFightSession({ ...plan, sport: 'wrestling', rounds: 5 }, T)
    const { finishFightSession } = await import('../data/index.ts')
    await finishFightSession(s.id, T + (READY_SEC + 60) * 1000)
    renderApp('/fight/wrestling')
    await screen.findByRole('group', { name: 'Round length' })
    expect(roundLength().getByRole('radio', { name: '1 min' })).toBeChecked()
    expect(screen.getByText('5')).toBeInTheDocument()
  })
})

describe('live session', () => {
  it('rings the bell, calls the round, then calls combos and shows them', async () => {
    await startFightSession(plan, T)
    renderApp('/fight/session')
    expect(await phase('Get ready')).toBeInTheDocument()
    expect(alerts.roundBell).not.toHaveBeenCalled()

    await tickAt(READY_SEC - 1)
    await tickAt(READY_SEC + 0.5)
    expect(await phase('Round 1 of 2')).toBeInTheDocument()
    expect(alerts.roundBell).toHaveBeenCalledWith(1)
    expect(spoken).toEqual(['Round 1'])

    at(READY_SEC + 4)
    await waitFor(() => expect(spoken.length).toBe(2))
    const combo = spoken[1]
    expect(combo).toMatch(/^[1-6]( (\d|slip|roll|duck|pull))+$/) // medium boxing: 2–4 moves
    await waitFor(() => expect(screen.getByLabelText('Combo')).toHaveTextContent(combo))

    at(READY_SEC + 51)
    await waitFor(() => expect(alerts.warningKnock).toHaveBeenCalledTimes(1))

    await tickAt(READY_SEC + 59)
    await tickAt(READY_SEC + 60.5)
    expect(await phase(/Rest/)).toBeInTheDocument()
    expect(alerts.roundBell).toHaveBeenLastCalledWith(3)
    expect(spoken.at(-1)).toBe('Rest')
  })

  it('mixes in your own combos', async () => {
    await addCombo('boxing', 'double jab, step back')
    const rng = vi.spyOn(Math, 'random').mockReturnValue(0) // always picks your combo first
    await startFightSession(plan, T)
    renderApp('/fight/session')
    await phase('Get ready')
    await tickAt(READY_SEC - 1)
    await tickAt(READY_SEC + 0.5)
    await phase('Round 1 of 2')
    at(READY_SEC + 4)
    await waitFor(() => expect(spoken).toContain('double jab, step back'))
    rng.mockRestore()
  })

  it('pauses (and saves the pause) and resumes', async () => {
    await startFightSession(plan, T)
    renderApp('/fight/session')
    at(READY_SEC + 20)
    await phase('Round 1 of 2')
    await userEvent.click(screen.getByRole('button', { name: 'Pause' }))
    await waitFor(() => expect(screen.getByLabelText('Combo')).toHaveTextContent('Paused'))
    await waitFor(async () => expect((await getActiveFightSession())?.clock.runningSince).toBeNull())

    at(READY_SEC + 500)
    await waitFor(() => expect(screen.getByRole('timer')).toHaveTextContent('0:40'))
    await userEvent.click(screen.getByRole('button', { name: 'Resume' }))
    at(READY_SEC + 510)
    await waitFor(() => expect(screen.getByRole('timer')).toHaveTextContent('0:30'))
  })

  it('opens part-way through without replaying bells or calls', async () => {
    await startFightSession(plan, T)
    at(READY_SEC + 60 + 10) // 10 s into the rest
    renderApp('/fight/session')
    expect(await phase(/Rest/)).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('timer')).toHaveTextContent('0:20'))
    expect(alerts.roundBell).not.toHaveBeenCalled()
    expect(spoken).toEqual([])
  })

  it('saves to history at the last bell and shows a summary', async () => {
    await startFightSession(plan, T)
    renderApp('/fight/session')
    await phase('Get ready')
    at(READY_SEC + 60 + 30 + 60 + 1)
    expect(await screen.findByRole('heading', { name: 'Session complete' }, { timeout: 3000 })).toBeInTheDocument()
    const [saved] = await listCompletedFightSessions()
    expect(saved).toMatchObject({ completedRounds: 2, rounds: 2 })
    await userEvent.type(screen.getByRole('textbox', { name: 'How did it feel?' }), 'sharp')
    await userEvent.click(screen.getByRole('button', { name: 'Done' }))
    expect(await screen.findByRole('list', { name: 'Sports' })).toBeInTheDocument()
    expect((await listCompletedFightSessions())[0].note).toBe('sharp')
  })

  it('ending early saves full rounds, or discards when there are none', async () => {
    await startFightSession(plan, T)
    renderApp('/fight/session')
    at(READY_SEC + 30)
    await phase('Round 1 of 2')
    await userEvent.click(screen.getByRole('button', { name: 'End' }))
    const dialog = await screen.findByRole('alertdialog')
    expect(dialog).toHaveTextContent('No full rounds yet')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Discard' }))
    expect(await screen.findByRole('list', { name: 'Sports' })).toBeInTheDocument()
    expect(await getActiveFightSession()).toBeUndefined()
  })

  it('keeps coaching when minimised, and comes back after the phone was locked without replaying', async () => {
    await startFightSession(plan, T)
    renderApp('/fight/session')
    await phase('Get ready')
    await tickAt(READY_SEC - 1)
    await tickAt(READY_SEC + 0.5)
    await phase('Round 1 of 2')
    await userEvent.click(screen.getByRole('button', { name: 'Minimise session' }))
    await screen.findByRole('list', { name: 'Sports' })
    const before = spoken.length
    at(READY_SEC + 4)
    await waitFor(() => expect(spoken.length).toBeGreaterThan(before)) // still calling combos

    // Locked through the end of round 1: no late "Rest" or bell when it wakes up in the rest.
    const bells = alerts.roundBell.mock.calls.length
    await tickAt(READY_SEC + 60 + 10)
    await screen.findByRole('link', { name: /Boxing · Rest/ }, { timeout: 3000 })
    expect(alerts.roundBell.mock.calls.length).toBe(bells)
    expect(spoken.at(-1)).not.toBe('Rest')
  })

  it('shows an in-progress bar on the other tabs', async () => {
    await startFightSession(plan, T)
    at(READY_SEC + 5)
    renderApp('/today')
    const bar = await screen.findByRole('link', { name: /Boxing · Round 1 of 2/ }, { timeout: 3000 })
    await userEvent.click(bar)
    expect(await phase('Round 1 of 2')).toBeInTheDocument()
  })
})

describe('coach settings', () => {
  it('picks a voice and speed, and tests it', async () => {
    renderApp('/settings')
    await userEvent.selectOptions(await screen.findByRole('combobox', { name: 'Voice' }), 'Daniel (en-GB)')
    await userEvent.click(screen.getByRole('radio', { name: 'Fast' }))
    await userEvent.click(screen.getByRole('button', { name: 'Test voice' }))
    expect(spoken.at(-1)).toMatch(/slip/)
    const { getSettings } = await import('../data/index.ts')
    await waitFor(async () => expect(await getSettings()).toMatchObject({ coachVoice: 'v-daniel', coachRate: 1.2 }))
    await updateSettings({ coachVoice: null })
  })
})
