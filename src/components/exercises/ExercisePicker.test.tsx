import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { addCompletedWorkout, done, makeExercise, resetDb } from '../../test/factories.ts'
import { ExercisePicker } from './ExercisePicker.tsx'

beforeEach(resetDb)

function setup(mode: 'single' | 'multi') {
  const onDone = vi.fn()
  const onCancel = vi.fn()
  render(<ExercisePicker mode={mode} onDone={onDone} onCancel={onCancel} />)
  return { onDone, onCancel }
}

const row = (name: string) => screen.findByRole('button', { name: new RegExp(`^${name}`) })

describe('ExercisePicker', () => {
  it('multi: ticks several and returns them in the order picked', async () => {
    const { onDone } = setup('multi')
    const add = screen.getByRole('button', { name: 'Add' })
    expect(add).toBeDisabled()

    await userEvent.click(await row('Back Squat'))
    await userEvent.click(await row('Leg Press'))
    await userEvent.click(await row('Deadlift'))
    await userEvent.click(await row('Leg Press')) // untick
    expect(await row('Back Squat')).toHaveAttribute('aria-pressed', 'true')

    await userEvent.click(screen.getByRole('button', { name: 'Add (2)' }))
    expect(onDone).toHaveBeenCalledTimes(1)
    expect(onDone.mock.calls[0][0].map((e: { name: string }) => e.name)).toEqual(['Back Squat', 'Deadlift'])
  })

  it('keeps ticks while searching', async () => {
    setup('multi')
    await userEvent.click(await row('Plank'))
    await userEvent.type(screen.getByRole('searchbox'), 'squat')
    await userEvent.click(await row('Front Squat'))
    expect(screen.getByRole('button', { name: 'Add (2)' })).toBeEnabled()
  })

  it('single: the first tap chooses', async () => {
    const { onDone } = setup('single')
    expect(screen.getByRole('dialog', { name: 'Choose exercise' })).toBeInTheDocument()
    await userEvent.click(await row('Hip Thrust'))
    expect(onDone.mock.calls[0][0][0].name).toBe('Hip Thrust')
  })

  it('cancels with the button or Escape', async () => {
    const { onCancel } = setup('multi')
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    await userEvent.keyboard('{Escape}')
    expect(onCancel).toHaveBeenCalledTimes(2)
  })

  it('creates a custom exercise without leaving, and ticks it', async () => {
    setup('multi')
    await userEvent.type(screen.getByRole('searchbox'), 'Sled Push')
    await userEvent.click(await screen.findByRole('button', { name: 'Create “Sled Push”' }))
    expect(screen.getByRole('dialog', { name: 'New exercise' })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('Sled Push')

    await userEvent.click(screen.getByRole('button', { name: 'Quads' }))
    await userEvent.click(screen.getByRole('button', { name: 'Create exercise' }))

    expect(await screen.findByRole('button', { name: 'Add (1)' })).toBeEnabled()
    expect(await row('Sled Push')).toHaveAttribute('aria-pressed', 'true')
  })

  it('acts as a real modal: focus moves in, the page behind is inert, both undone on close', async () => {
    const onCancel = vi.fn()
    const { rerender } = render(
      <>
        <button type="button">Behind</button>
        <ExercisePicker mode="multi" onDone={vi.fn()} onCancel={onCancel} />
      </>,
    )
    const behind = screen.getByRole('button', { name: 'Behind' })
    const dialog = screen.getByRole('dialog', { name: 'Add exercises' })
    expect(dialog).toHaveFocus()
    // The test renderer's container holds "Behind"; it must be inert while the picker is open.
    expect(behind.closest('[inert]')).not.toBeNull()

    rerender(<button type="button">Behind</button>)
    expect(screen.getByRole('button', { name: 'Behind' }).closest('[inert]')).toBeNull()
  })

  it('shows recent exercises at the top', async () => {
    await addCompletedWorkout('2026-09-20T10:00:00Z', [makeExercise('ex-lat-pulldown', [done(60, 10)])])
    setup('multi')
    const recent = await screen.findByRole('region', { name: 'Recent' })
    expect(within(recent).getByRole('button', { name: /^Lat Pulldown/ })).toBeInTheDocument()
  })
})
