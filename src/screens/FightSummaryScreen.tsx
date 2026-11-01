import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { Button } from '../components/Button.tsx'
import { secLabel, SPORT_LABELS, styleLabel } from '../components/fight/labels.ts'
import { TextAreaField } from '../components/Fields.tsx'
import { EmptyState, Screen } from '../components/Screen.tsx'
import {
  fightSessionDurationSec,
  formatDuration,
  getFightSession,
  saveFightSession,
  type FightSession,
} from '../data/index.ts'
import { useDebouncedSave } from '../hooks/useDebouncedSave.ts'
import styles from './WorkoutSummaryScreen.module.css'

export function FightSummaryScreen() {
  const { id = '' } = useParams()
  const loaded = useLiveQuery(async () => (await getFightSession(id)) ?? null, [id])
  if (loaded === undefined) return null
  if (loaded === null || loaded.status !== 'completed') {
    return (
      <Screen title="Session">
        <EmptyState title="Session not found" />
      </Screen>
    )
  }
  return <Summary key={loaded.id} session={loaded} />
}

function Summary({ session }: { session: FightSession }) {
  const navigate = useNavigate()
  const [note, setNote] = useState(session.note)
  const { schedule, flush } = useDebouncedSave((text: string) =>
    saveFightSession({ ...session, note: text }).catch(() => undefined),
  )

  return (
    <Screen title="Session complete">
      <p className={styles.name}>
        {SPORT_LABELS[session.sport]} · {styleLabel(session)}
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

      <TextAreaField
        label="How did it feel?"
        value={note}
        placeholder="What worked, what to sharpen next time…"
        onChange={(e) => {
          setNote(e.target.value)
          schedule(e.target.value)
        }}
        onBlur={() => void flush()}
      />

      <Button
        variant="primary"
        block
        onClick={async () => {
          await flush()
          navigate('/fight', { replace: true })
        }}
      >
        Done
      </Button>
    </Screen>
  )
}
