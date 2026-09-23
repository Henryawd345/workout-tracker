import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../data/db.ts'
import { getActiveWorkout, saveWorkout, startWorkout } from '../data/index.ts'
import { makeExercise, makeSet, resetDb } from '../test/factories.ts'
import { renderApp } from '../test/renderApp.tsx'

const alerts = vi.hoisted(() => ({ restOverAlert: vi.fn(), unlockAudio: vi.fn() }))
vi.mock('../components/workout/alerts.ts', () => alerts)

beforeEach(async () => {
  await resetDb()
  alerts.restOverAlert.mockClear()
})

/** A workout with one squat set typed in, ready to tick. Rest time 90 s. */
async function workoutWithOneSet() {
  const w = await startWorkout()
  await saveWorkout({ ...w, exercises: [{ ...makeExercise('ex-back-squat', [makeSet({ weight: 100, reps: 5 }), makeSet()]), restSec: 90 }] })
}

const timer = () => screen.findByRole('group', { name: 'Rest timer' })

describe('rest timer', () => {
  it('starts after ticking a set, with the exercise’s rest time, and is saved', async () => {
    await workoutWithOneSet()
    renderApp('/workout')
    await userEvent.click(await screen.findByRole('button', { name: 'Complete set 1' }))
    const bar = within(await timer())
    expect(bar.getByRole('timer')).toHaveTextContent(/^1:(30|29)$/)
    expect(alerts.unlockAudio).toHaveBeenCalled()
    await waitFor(async () => expect((await getActiveWorkout())?.restTimer?.durationSec).toBe(90))
  })

  it('adds and removes 15 seconds, pauses, resumes and skips', async () => {
    await workoutWithOneSet()
    renderApp('/workout')
    await userEvent.click(await screen.findByRole('button', { name: 'Complete set 1' }))
    const bar = within(await timer())

    await userEvent.click(bar.getByRole('button', { name: '15 seconds more' }))
    expect(bar.getByRole('timer')).toHaveTextContent(/^1:(45|44)$/)
    await userEvent.click(bar.getByRole('button', { name: '15 seconds less' }))
    await userEvent.click(bar.getByRole('button', { name: '15 seconds less' }))
    expect(bar.getByRole('timer')).toHaveTextContent(/^1:(15|14)$/)

    await userEvent.click(bar.getByRole('button', { name: 'Pause rest' }))
    expect(bar.getByText('Paused')).toBeInTheDocument()
    await waitFor(async () => expect((await getActiveWorkout())?.restTimer?.pausedRemainingSec).not.toBeNull())
    await userEvent.click(bar.getByRole('button', { name: 'Resume rest' }))
    expect(bar.getByText('Rest')).toBeInTheDocument()

    await userEvent.click(bar.getByRole('button', { name: 'Skip' }))
    expect(screen.queryByRole('group', { name: 'Rest timer' })).not.toBeInTheDocument()
    await waitFor(async () => expect((await getActiveWorkout())?.restTimer).toBeNull())
  })

  it('does not start when auto-start is off, or for "No rest"', async () => {
    await db.settings.put({ id: 'settings', displayUnit: 'kg', defaultRestSec: 90, autoStartRest: false })
    await workoutWithOneSet()
    renderApp('/workout')
    await userEvent.click(await screen.findByRole('button', { name: 'Complete set 1' }))
    await screen.findByRole('button', { name: 'Set 1 done — tap to undo' })
    expect(screen.queryByRole('group', { name: 'Rest timer' })).not.toBeInTheDocument()
  })

  it('keeps counting after the app is closed and reopened', async () => {
    const w = await startWorkout()
    const endsAt = new Date(Date.now() + 42_000).toISOString()
    await saveWorkout({ ...w, restTimer: { durationSec: 90, endsAt, pausedRemainingSec: null } })
    renderApp('/workout')
    expect(within(await timer()).getByRole('timer')).toHaveTextContent(/^0:(42|41)$/)
  })

  it('alerts once when the rest is over', async () => {
    const w = await startWorkout()
    const endsAt = new Date(Date.now() + 1200).toISOString()
    await saveWorkout({ ...w, restTimer: { durationSec: 60, endsAt, pausedRemainingSec: null } })
    renderApp('/workout')
    expect(await screen.findByText('Rest over — next set!', {}, { timeout: 3000 })).toBeInTheDocument()
    expect(alerts.restOverAlert).toHaveBeenCalledTimes(1)
    await userEvent.click(screen.getByRole('button', { name: 'Done' }))
    expect(screen.queryByText('Rest over — next set!')).not.toBeInTheDocument()
  })

  it('does not beep when you shorten the rest to zero yourself', async () => {
    const w = await startWorkout()
    await saveWorkout({ ...w, restTimer: { durationSec: 60, endsAt: new Date(Date.now() + 10_000).toISOString(), pausedRemainingSec: null } })
    renderApp('/workout')
    await userEvent.click(within(await timer()).getByRole('button', { name: '15 seconds less' }))
    expect(await screen.findByText('Rest over — next set!')).toBeInTheDocument()
    expect(alerts.restOverAlert).not.toHaveBeenCalled()
  })

  it('does not alert for a rest that ended while the app was closed', async () => {
    const w = await startWorkout()
    await saveWorkout({ ...w, restTimer: { durationSec: 60, endsAt: new Date(Date.now() - 5000).toISOString(), pausedRemainingSec: null } })
    renderApp('/workout')
    expect(await screen.findByText('Rest over — next set!')).toBeInTheDocument()
    expect(alerts.restOverAlert).not.toHaveBeenCalled()
  })
})
