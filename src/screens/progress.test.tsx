import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { LineChart } from '../components/charts/LineChart.tsx'
import { addCompletedWorkout, done, doneTimed, makeExercise, resetDb } from '../test/factories.ts'
import { renderApp } from '../test/renderApp.tsx'

beforeEach(resetDb)

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString()

async function seed() {
  await addCompletedWorkout(daysAgo(20), [makeExercise('ex-back-squat', [done(100, 5), done(100, 5)])], { id: 'w1' })
  await addCompletedWorkout(daysAgo(10), [makeExercise('ex-back-squat', [done(105, 5)]), makeExercise('ex-plank', [doneTimed(60)])], {
    id: 'w2',
  })
  await addCompletedWorkout(daysAgo(3), [makeExercise('ex-back-squat', [done(110, 3), done(90, 10)])], { id: 'w3' })
}

describe('progress', () => {
  it('explains when there is nothing yet', async () => {
    renderApp('/progress')
    expect(await screen.findByText('Nothing to chart yet')).toBeInTheDocument()
  })

  it('opens on the most-logged exercise with its heaviest-weight trend', async () => {
    await seed()
    renderApp('/progress')
    const card = within(await screen.findByRole('region', { name: 'Back Squat progress' }))
    expect(await card.findByRole('img', { name: /Heaviest, Back Squat\. 3 sessions, latest 110 kg/ })).toBeInTheDocument()
    expect(card.getByText('+10 kg')).toBeInTheDocument() // 100 → 110
    expect(within(screen.getByRole('group', { name: 'Exercise' })).getByRole('button', { name: 'Back Squat' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('switches measure and shows the numbers as a table', async () => {
    await seed()
    renderApp('/progress')
    await userEvent.click(await screen.findByRole('radio', { name: 'Best reps' }))
    expect(screen.getByRole('img', { name: /latest 10 reps/ })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Show as table' }))
    const rows = within(screen.getByRole('table')).getAllByRole('row').slice(1)
    expect(rows.map((r) => r.lastChild?.textContent)).toEqual(['10 reps', '5 reps', '5 reps'])
  })

  it('narrows the time range', async () => {
    await seed()
    renderApp('/progress?range=all')
    await screen.findByRole('img', { name: /3 sessions/ })
    await userEvent.click(screen.getByRole('radio', { name: '1M' }))
    expect(screen.getByRole('img', { name: /3 sessions/ })).toBeInTheDocument()
    // Nothing older than a month here, so switching to 1Y changes nothing — but the choice is kept
    await userEvent.click(screen.getByRole('radio', { name: '1Y' }))
    expect(screen.getByRole('radio', { name: '1Y' })).toBeChecked()
  })

  it('shows timed exercises with time measures', async () => {
    await seed()
    renderApp('/progress?exercise=ex-plank')
    const card = within(await screen.findByRole('region', { name: 'Plank progress' }))
    expect(card.getByRole('radio', { name: 'Longest' })).toBeChecked()
    expect(card.getByRole('img', { name: /latest 1:00/ })).toBeInTheDocument()
  })

  it('lists personal records that link to their workout', async () => {
    await seed()
    renderApp('/progress')
    const records = within(await screen.findByRole('group', { name: 'Personal records' }))
    expect(records.getByRole('link', { name: /^Heaviest: 110 kg × 3/ })).toHaveAttribute('href', '/history/w3')
    expect(records.getByRole('link', { name: /^Most reps: 10,/ })).toHaveAttribute('href', '/history/w3')
    expect(records.getByRole('link', { name: /^Best volume: 1230 kg/ })).toBeInTheDocument()
  })

  it('shows workouts per week for the last 8 weeks', async () => {
    await seed()
    renderApp('/progress')
    const weeks = within(await screen.findByRole('group', { name: 'Workouts per week' }))
    expect(weeks.getAllByRole('button')).toHaveLength(8)
    await userEvent.click(weeks.getAllByRole('button').at(-1)!)
    expect(screen.getByText(/^Week of .*: \d workouts?$/)).toBeInTheDocument()
  })

  it('picks another exercise from the picker', async () => {
    await seed()
    renderApp('/progress')
    await userEvent.click(await screen.findByRole('button', { name: 'Other exercise…' }))
    const picker = screen.getByRole('dialog', { name: 'Show progress for' })
    await userEvent.type(within(picker).getByRole('searchbox'), 'deadlift')
    await userEvent.click(await within(picker).findByRole('button', { name: /^Deadlift/ }))
    expect(await screen.findByRole('region', { name: 'Deadlift progress' })).toHaveTextContent('No sessions yet')
  })
})

describe('LineChart', () => {
  const points = [
    { date: '2026-09-01T10:00:00Z', value: 100, workoutId: 'a' },
    { date: '2026-09-08T10:00:00Z', value: 105, workoutId: 'b' },
  ]

  it('shows a value for the focused point with the arrow keys', async () => {
    render(<LineChart points={points} format={(v) => `${v} kg`} formatTick={String} label="Test" />)
    const chart = screen.getByRole('img', { name: /Test\. 2 sessions, latest 105 kg/ })
    chart.focus()
    await userEvent.keyboard('{ArrowLeft}')
    expect(screen.getByRole('status')).toHaveTextContent('105 kg')
    await userEvent.keyboard('{ArrowLeft}')
    expect(screen.getByRole('status')).toHaveTextContent('100 kg')
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('draws one dot per session and copes with a single session', () => {
    const { container, rerender } = render(<LineChart points={points} format={String} formatTick={String} label="T" />)
    expect(container.querySelectorAll('circle')).toHaveLength(2)
    expect(container.querySelector('path')).not.toBeNull()
    rerender(<LineChart points={points.slice(0, 1)} format={String} formatTick={String} label="T" />)
    expect(container.querySelectorAll('circle')).toHaveLength(1)
    expect(container.querySelector('path')).toBeNull()
  })
})
