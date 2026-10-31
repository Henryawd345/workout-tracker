import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { BackButton } from '../components/BackButton.tsx'
import { Button } from '../components/Button.tsx'
import { ConfirmDialog } from '../components/ConfirmDialog.tsx'
import { INTENSITY_LABELS, secLabel, SPORT_LABELS } from '../components/fight/labels.ts'
import { TextAreaField } from '../components/Fields.tsx'
import { formatDate, formatTime } from '../components/format.ts'
import { EmptyState, Screen } from '../components/Screen.tsx'
import {
  deleteFightSession,
  fightSessionDurationSec,
  formatDuration,
  getFightSession,
  saveFightSession,
  StaleFightSaveError,
  type FightSession,
} from '../data/index.ts'
import { useDebouncedSave } from '../hooks/useDebouncedSave.ts'
import styles from './WorkoutDetailScreen.module.css'

const back = <BackButton fallback="/history" label="Back to history" />

export function FightDetailScreen() {
  const { id = '' } = useParams()
  const session = useLiveQuery(async () => (await getFightSession(id)) ?? null, [id])
  if (session === undefined) return <Screen title="" leading={back}>{null}</Screen>
  if (session === null || session.status !== 'completed') {
    return (
      <Screen title="Session" leading={back}>
        <EmptyState title="Session not found">It may have been deleted.</EmptyState>
      </Screen>
    )
  }
  return <Detail key={session.id} session={session} />
}

function Detail({ session }: { session: FightSession }) {
  const navigate = useNavigate()
  const [note, setNote] = useState(session.note)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [saveFailed, setSaveFailed] = useState(false)
  const { schedule, flush, cancel } = useDebouncedSave((text: string) =>
    saveFightSession({ ...session, note: text }).then(
      () => setSaveFailed(false),
      (err: unknown) => setSaveFailed(!(err instanceof StaleFightSaveError)),
    ),
  )

  return (
    <Screen title={SPORT_LABELS[session.sport]} leading={back}>
      <p className={styles.when}>
        {formatDate(session.startedAt)} · {formatTime(session.startedAt)}
        {session.endedAt ? `–${formatTime(session.endedAt)}` : ''}
      </p>

      <dl className={styles.stats}>
        <div>
          <dt>Rounds</dt>
          <dd>
            {session.completedRounds}
            <small>/{session.rounds}</small>
          </dd>
        </div>
        <div>
          <dt>Round</dt>
          <dd>{secLabel(session.roundSec)}</dd>
        </div>
        <div>
          <dt>Time</dt>
          <dd>{formatDuration(fightSessionDurationSec(session))}</dd>
        </div>
      </dl>
      <p>
        {INTENSITY_LABELS[session.intensity]} · {secLabel(session.restSec)} rest between rounds
      </p>

      <TextAreaField
        label="Note"
        value={note}
        placeholder="What worked, what to sharpen next time…"
        onChange={(e) => {
          setNote(e.target.value)
          schedule(e.target.value)
        }}
        onBlur={() => void flush()}
      />
      {saveFailed && (
        <p className={styles.error} role="alert">
          Couldn’t save your note. It’s still here — keep typing to try again.
        </p>
      )}

      <Button variant="danger" block onClick={() => setConfirmDelete(true)}>
        Delete session
      </Button>
      <ConfirmDialog
        open={confirmDelete}
        title={`Delete this ${SPORT_LABELS[session.sport]} session?`}
        message="It will be removed from your history."
        confirmLabel="Delete"
        destructive
        onCancel={() => setConfirmDelete(false)}
        onConfirm={async () => {
          setConfirmDelete(false)
          cancel()
          await deleteFightSession(session.id)
          navigate('/history', { replace: true })
        }}
      />
    </Screen>
  )
}
