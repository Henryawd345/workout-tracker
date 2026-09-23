import { act, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setUpdateReady } from '../pwaUpdate.ts'
import { startWorkout } from '../data/index.ts'
import { resetDb } from '../test/factories.ts'
import { renderApp } from '../test/renderApp.tsx'

beforeEach(resetDb)

describe('app update banner', () => {
  it('appears when a new version is ready and updates only when tapped', async () => {
    const apply = vi.fn(async () => {})
    renderApp('/today')
    await screen.findByRole('heading', { name: 'Today' })
    expect(screen.queryByText('A new version of the app is ready.')).not.toBeInTheDocument()

    act(() => setUpdateReady(apply))
    expect(screen.getByText('A new version of the app is ready.')).toBeInTheDocument()
    expect(apply).not.toHaveBeenCalled()

    await userEvent.click(screen.getByRole('button', { name: 'Update' }))
    expect(apply).toHaveBeenCalledTimes(1)
  })

  it('never shows during a workout', async () => {
    await startWorkout()
    act(() => setUpdateReady(async () => {}))
    renderApp('/workout')
    await screen.findByRole('button', { name: 'Finish' })
    expect(screen.queryByText('A new version of the app is ready.')).not.toBeInTheDocument()
  })
})
