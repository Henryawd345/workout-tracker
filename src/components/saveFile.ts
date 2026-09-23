/**
 * Hands a file to the user. On iPhone this opens the share sheet ("Save to Files", AirDrop,
 * Mail…); elsewhere it downloads. Returns what happened.
 */
export async function saveFile(name: string, content: string, type: string): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const file = new File([content], name, { type })
  if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: name })
      return 'shared'
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return 'cancelled'
      // Share failed for another reason: fall back to a download.
    }
  }
  const url = URL.createObjectURL(file)
  const link = document.createElement('a')
  link.href = url
  link.download = name
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return 'downloaded'
}
