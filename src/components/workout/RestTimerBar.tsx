import { useEffect, useRef } from 'react'
import {
  adjustRest,
  formatDuration,
  isRestOver,
  isRestPaused,
  pauseRest,
  restProgress,
  restRemainingSec,
  resumeRest,
  type RestTimer,
} from '../../data/index.ts'
import { useNow } from '../../hooks/useNow.ts'
import { PauseIcon, PlayIcon } from '../icons.tsx'
import { unlockAudio } from './alerts.ts'
import styles from './RestTimerBar.module.css'

interface RestTimerBarProps {
  timer: RestTimer
  onChange: (timer: RestTimer | null) => void
  /** Called once when the rest runs out. */
  onOver: () => void
}

/** Pinned to the bottom of the workout screen while resting. */
export function RestTimerBar({ timer, onChange, onOver }: RestTimerBarProps) {
  // One clock reading for both the display and the buttons, so +15 shows exactly +15.
  const now = useNow(250).getTime()
  const remaining = restRemainingSec(timer, now)
  const over = isRestOver(timer, now)
  const paused = isRestPaused(timer)

  // Alert once per rest (a new rest has a new end time). No alert if it was already over
  // when the screen opened — e.g. coming back to the app long after.
  const alerted = useRef<string | null>(over ? timer.endsAt : null)
  const onOverRef = useRef(onOver)
  useEffect(() => {
    onOverRef.current = onOver
  })
  useEffect(() => {
    if (over && alerted.current !== timer.endsAt) {
      alerted.current = timer.endsAt
      onOverRef.current()
    }
  }, [over, timer.endsAt])

  /** Every tap on the bar re-enables sound (iOS may have suspended it while locked). */
  function change(next: RestTimer | null) {
    unlockAudio()
    // Ending the rest yourself with −15 is not a "rest over" moment: no beep.
    if (next && restRemainingSec(next, now) === 0) alerted.current = next.endsAt
    onChange(next)
  }

  if (over) {
    return (
      <div className={`${styles.bar} ${styles.over}`} role="status">
        <span className={styles.overText}>Rest over — next set!</span>
        <button type="button" className={styles.primary} onClick={() => change(null)}>
          Done
        </button>
      </div>
    )
  }

  return (
    <div className={styles.bar} role="group" aria-label="Rest timer">
      <div className={styles.progress} style={{ transform: `scaleX(${restProgress(timer, now)})` }} aria-hidden="true" />
      <button type="button" className={styles.small} onClick={() => change(adjustRest(timer, -15, now))} aria-label="15 seconds less">
        −15
      </button>
      <div className={styles.time}>
        <span className={styles.label}>{paused ? 'Paused' : 'Rest'}</span>
        <span role="timer" aria-live="off" className={styles.clock}>
          {formatDuration(remaining)}
        </span>
      </div>
      <button type="button" className={styles.small} onClick={() => change(adjustRest(timer, 15, now))} aria-label="15 seconds more">
        +15
      </button>
      <button
        type="button"
        className={styles.icon}
        aria-label={paused ? 'Resume rest' : 'Pause rest'}
        onClick={() => change(paused ? resumeRest(timer, now) : pauseRest(timer, now))}
      >
        {paused ? <PlayIcon /> : <PauseIcon />}
      </button>
      <button type="button" className={styles.primary} onClick={() => change(null)}>
        Skip
      </button>
    </div>
  )
}
