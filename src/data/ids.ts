import type { ID } from './types.ts'

/**
 * Random unique ID.
 * crypto.randomUUID only exists on HTTPS/localhost, so when the phone opens the dev
 * server over plain http://192.168.x.x we build a v4 UUID from getRandomValues instead.
 */
export function newId(): ID {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  const b = crypto.getRandomValues(new Uint8Array(16))
  b[6] = (b[6] & 0x0f) | 0x40
  b[8] = (b[8] & 0x3f) | 0x80
  const hex = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

/** Current time as an ISO string. The one place "now" comes from, so tests can pass their own. */
export function nowIso(): string {
  return new Date().toISOString()
}
