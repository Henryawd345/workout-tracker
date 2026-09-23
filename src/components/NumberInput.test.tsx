import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { DurationInput, NumberInput } from './NumberInput.tsx'

function Harness({ decimals, onValue }: { decimals?: boolean; onValue: (v: number | null) => void }) {
  const [value, setValue] = useState<number | null>(null)
  return (
    <NumberInput
      label="n"
      decimals={decimals}
      value={value}
      onChange={(v) => {
        setValue(v)
        onValue(v)
      }}
    />
  )
}

describe('NumberInput', () => {
  it('reports whole numbers and ignores other characters', async () => {
    const onValue = vi.fn()
    render(<Harness onValue={onValue} />)
    await userEvent.type(screen.getByRole('textbox'), '1x2.')
    expect(screen.getByRole('textbox')).toHaveValue('12')
    expect(onValue).toHaveBeenLastCalledWith(12)
  })

  it('accepts decimals (comma too) while typing', async () => {
    const onValue = vi.fn()
    render(<Harness decimals onValue={onValue} />)
    await userEvent.type(screen.getByRole('textbox'), '62,5')
    expect(onValue).toHaveBeenLastCalledWith(62.5)
    await userEvent.tab()
    expect(screen.getByRole('textbox')).toHaveValue('62.5')
  })

  it('clearing gives null so a suggestion can show', async () => {
    const onValue = vi.fn()
    render(<Harness onValue={onValue} />)
    await userEvent.type(screen.getByRole('textbox'), '8')
    await userEvent.clear(screen.getByRole('textbox'))
    expect(onValue).toHaveBeenLastCalledWith(null)
  })

  it('uses the number keypad', () => {
    render(<NumberInput label="w" decimals value={null} onChange={() => {}} />)
    expect(screen.getByRole('textbox')).toHaveAttribute('inputmode', 'decimal')
  })
})

describe('DurationInput', () => {
  it('reads m:ss when leaving the field and shows it formatted', async () => {
    const onChange = vi.fn()
    const { rerender } = render(<DurationInput label="t" value={null} onChange={onChange} />)
    await userEvent.type(screen.getByRole('textbox'), '90')
    await userEvent.tab()
    expect(onChange).toHaveBeenLastCalledWith(90)
    rerender(<DurationInput label="t" value={90} onChange={onChange} />)
    expect(screen.getByRole('textbox')).toHaveValue('1:30')
  })

  it('keeps the old value on nonsense and clears on empty', async () => {
    const onChange = vi.fn()
    render(<DurationInput label="t" value={60} onChange={onChange} />)
    const input = screen.getByRole('textbox')
    await userEvent.clear(input)
    await userEvent.type(input, '1:99')
    await userEvent.tab()
    expect(onChange).not.toHaveBeenCalled()
    await userEvent.clear(input)
    await userEvent.tab()
    expect(onChange).toHaveBeenLastCalledWith(null)
  })
})
