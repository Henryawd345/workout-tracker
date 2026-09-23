import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useDebouncedSave } from './useDebouncedSave.ts'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('useDebouncedSave', () => {
  it('saves only the last value, after the pause', () => {
    const save = vi.fn(async () => {})
    const { result } = renderHook(() => useDebouncedSave(save, 500))
    act(() => {
      result.current.schedule('a')
      result.current.schedule('ab')
      result.current.schedule('abc')
    })
    vi.advanceTimersByTime(499)
    expect(save).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(save).toHaveBeenCalledExactlyOnceWith('abc')
  })

  it('flush saves right away, and only once', () => {
    const save = vi.fn(async () => {})
    const { result } = renderHook(() => useDebouncedSave(save, 500))
    act(() => result.current.schedule('x'))
    act(() => {
      void result.current.flush()
    })
    vi.advanceTimersByTime(1000)
    act(() => {
      void result.current.flush()
    })
    expect(save).toHaveBeenCalledExactlyOnceWith('x')
  })

  it('saves what is pending when the component goes away', () => {
    const save = vi.fn(async () => {})
    const { result, unmount } = renderHook(() => useDebouncedSave(save, 500))
    act(() => result.current.schedule('last words'))
    unmount()
    expect(save).toHaveBeenCalledExactlyOnceWith('last words')
  })

  it('saves right away when the app is hidden or closed', () => {
    const save = vi.fn(async () => {})
    const { result } = renderHook(() => useDebouncedSave(save, 500))

    act(() => result.current.schedule('hidden'))
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))
    expect(save).toHaveBeenLastCalledWith('hidden')

    act(() => result.current.schedule('closed'))
    window.dispatchEvent(new Event('pagehide'))
    expect(save).toHaveBeenLastCalledWith('closed')
    expect(save).toHaveBeenCalledTimes(2)
    delete (document as { visibilityState?: unknown }).visibilityState
  })

  it('cancel drops the pending save, even on unmount', () => {
    const save = vi.fn(async () => {})
    const { result, unmount } = renderHook(() => useDebouncedSave(save, 500))
    act(() => result.current.schedule('doomed'))
    act(() => result.current.cancel())
    vi.advanceTimersByTime(1000)
    unmount()
    expect(save).not.toHaveBeenCalled()
  })

  it('flush waits for every save already running', async () => {
    vi.useRealTimers()
    const order: string[] = []
    let release!: () => void
    const save = vi.fn(async (v: string) => {
      order.push(`start ${v}`)
      if (v === 'a') await new Promise<void>((r) => (release = r))
      order.push(`end ${v}`)
    })
    const { result } = renderHook(() => useDebouncedSave(save, 500))
    act(() => result.current.schedule('a'))
    let first!: Promise<void>
    act(() => {
      first = result.current.flush() // 'a' starts and blocks
    })
    let second!: Promise<void>
    act(() => {
      second = result.current.flush() // nothing pending, but must still wait for 'a'
    })
    let secondDone = false
    void second.then(() => (secondDone = true))
    await Promise.resolve()
    expect(secondDone).toBe(false)

    act(() => result.current.schedule('b'))
    act(() => {
      void result.current.flush()
    })
    release()
    await first
    await second
    await result.current.flush()
    // 'b' starts at once (IndexedDB keeps the order); flush still waited for 'a'
    expect(order).toEqual(['start a', 'start b', 'end b', 'end a'])
  })

  it('uses the latest save function', () => {
    const first = vi.fn(async () => {})
    const second = vi.fn(async () => {})
    const { result, rerender } = renderHook(({ fn }) => useDebouncedSave(fn, 500), { initialProps: { fn: first } })
    rerender({ fn: second })
    act(() => result.current.schedule('v'))
    vi.advanceTimersByTime(500)
    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledWith('v')
  })
})
