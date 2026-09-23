/** Stable input ids for a set's fields, so the screen can move focus to a missing value. */
export const setFieldId = (setId: string, field: 'weight' | 'reps' | 'durationSec') => `set-${setId}-${field}`
