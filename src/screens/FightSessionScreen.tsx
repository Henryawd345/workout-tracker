import { useEffect, useState, type CSSProperties } from 'react'
import { useNavigate } from 'react-router'
import { Button, ButtonLink } from '../components/Button.tsx'
import { ConfirmDialog } from '../components/ConfirmDialog.tsx'
import { unlockFightSound } from '../components/fight/coach.ts'
import { useFightSession, type LiveFight } from '../components/fight/fightContext.ts'
import { planSummary, SPORT_LABELS } from '../components/fight/labels.ts'
import { plural } from '../components/format.ts'
import { IconButton } from '../components/IconButton.tsx'
import { ChevronDownIcon } from '../components/icons.tsx'
import { EmptyState, Screen } from '../components/Screen.tsx'
import { audioReady } from '../components/workout/alerts.ts'
import { formatDuration, getFightSession, type ClockState } from '../data/index.ts'
import { wakeLockSupported } from '../hooks/useWakeLock.ts'
import styles from './FightSessionScreen.module.css'

/** The session in progress, full screen. The session itself runs in FightSessionHost. */
export function FightSessionScreen() {
  const navigate = useNavigate()
  const fight = useFightSession()
  // The session this screen showed, so that when it ends we know which summary to open.
  const [shownId, setShownId] = useState<string | null>(null)
  const activeId = fight.status === 'active' ? fight.session.id : null
  if (activeId && activeId !== shownId) setShownId(activeId)

  // When it ends (last bell or End), go to its summary — or to Fight if it was discarded.
  useEffect(() => {
    if (fight.status !== 'none' || !shownId) return
    void getFightSession(shownId).then((s) =>
      navigate(s?.status === 'completed' ? `/fight/summary/${shownId}` : '/fight', { replace: true }),
    )
  }, [fight.status, shownId, navigate])

  // Ending: show nothing for the moment before the summary opens.
  if (fight.status === 'loading' || (fight.status === 'none' && shownId)) return null
  if (fight.status === 'none') {
    return (
      <Screen title="Fight">
        <EmptyState title="No session in progress">Pick a sport on the Fight tab to start one.</EmptyState>
        <ButtonLink to="/fight" variant="primary" block>
          Go to Fight
        </ButtonLink>
      </Screen>
    )
  }
  return <LiveSession fight={fight} />
}

function phaseLabel(state: ClockState, rounds: number): string {
  switch (state.phase) {
    case 'ready':
      return 'Get ready'
    case 'round':
      return `Round ${state.round} of ${rounds}`
    case 'rest':
      return `Rest · round ${state.round + 1} next`
    case 'done':
      return 'Time'
  }
}

function LiveSession({ fight }: { fight: LiveFight }) {
  const navigate = useNavigate()
  const { session, state, call } = fight
  const [confirmEnd, setConfirmEnd] = useState(false)
  // After a reload iOS keeps sound off until you tap; offer the tap.
  const [soundOn, setSoundOn] = useState(audioReady)

  const progress = state.phaseSec > 0 ? 1 - state.remainingSec / state.phaseSec : 1
  const done = state.completedRounds

  return (
    <div className={styles.screen} data-phase={state.phase}>
      <header className={styles.header}>
        <IconButton label="Minimise session" onClick={() => navigate('/fight')}>
          <ChevronDownIcon />
        </IconButton>
        <div className={styles.headerText}>
          <h1 className={styles.title}>{SPORT_LABELS[session.sport]}</h1>
          <span className={styles.plan}>{planSummary(session)}</span>
        </div>
        <Button onClick={() => setConfirmEnd(true)}>End</Button>
      </header>

      <div className={styles.body}>
        {!soundOn && (
          <Button
            block
            onClick={() => {
              unlockFightSound()
              setSoundOn(true)
            }}
          >
            Tap to turn the coach’s sound on
          </Button>
        )}
        <p className={styles.phase}>{phaseLabel(state, session.rounds)}</p>
        <p className={styles.countdown} role="timer" aria-label="Time left">
          {formatDuration(state.remainingSec)}
        </p>
        <div className={styles.track} aria-hidden="true">
          <div className={styles.fill} style={{ '--progress': progress } as CSSProperties} />
        </div>

        <p className={styles.combo} aria-label="Combo">
          {state.paused
            ? 'Paused'
            : state.phase === 'round'
              ? (call?.text ?? '')
              : state.phase === 'rest'
                ? 'Breathe. Shake it out.'
                : state.phase === 'ready'
                  ? 'Hands up'
                  : ''}
        </p>

        <Button
          variant="primary"
          block
          onClick={() => {
            fight.togglePause()
            setSoundOn(true)
          }}
          disabled={state.phase === 'done'}
        >
          {state.paused ? 'Resume' : 'Pause'}
        </Button>
        {!wakeLockSupported() && (
          <p className={styles.tip}>Keep the screen on: the coach stops talking when the phone locks.</p>
        )}
      </div>

      <ConfirmDialog
        open={confirmEnd}
        title={done > 0 ? 'End session?' : 'Discard session?'}
        message={
          done > 0
            ? `${plural(done, 'full round')} will be saved to History.`
            : 'No full rounds yet, so nothing will be saved.'
        }
        confirmLabel={done > 0 ? 'End and save' : 'Discard'}
        destructive={done === 0}
        onCancel={() => setConfirmEnd(false)}
        onConfirm={() => {
          setConfirmEnd(false)
          void fight.end()
        }}
      />
    </div>
  )
}
