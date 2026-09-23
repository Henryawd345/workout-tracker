import { describe, expect, it } from 'vitest'
import { newId } from './ids.ts'

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

describe('newId', () => {
  it('returns unique v4 UUIDs', () => {
    const ids = new Set(Array.from({ length: 1000 }, newId))
    expect(ids.size).toBe(1000)
    for (const id of ids) expect(id).toMatch(UUID_V4)
  })

  it('still works where randomUUID is missing (phone on plain http)', () => {
    const original = Object.getOwnPropertyDescriptor(crypto, 'randomUUID')
    Object.defineProperty(crypto, 'randomUUID', { value: undefined, configurable: true, writable: true })
    try {
      const ids = new Set(Array.from({ length: 200 }, newId))
      expect(ids.size).toBe(200)
      for (const id of ids) expect(id).toMatch(UUID_V4)
    } finally {
      if (original) Object.defineProperty(crypto, 'randomUUID', original)
      else delete (crypto as { randomUUID?: unknown }).randomUUID
    }
    expect(typeof crypto.randomUUID).toBe('function')
  })
})
