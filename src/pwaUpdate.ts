// Tiny store for "a new version of the app is ready". Kept separate from the service-worker
// registration (registerPwa.ts) so screens and tests can use it without a service worker.

type Listener = (ready: boolean) => void

let ready = false
let apply: (() => Promise<void>) | null = null
const listeners = new Set<Listener>()

export function setUpdateReady(applyUpdate: () => Promise<void>) {
  ready = true
  apply = applyUpdate
  listeners.forEach((l) => l(true))
}

export function isUpdateReady() {
  return ready
}

export function subscribeUpdate(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Reloads into the new version. Only ever called when the user taps "Update". */
export async function applyUpdate() {
  await apply?.()
}
