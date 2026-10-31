import { Link } from 'react-router'
import { ButtonLink } from '../components/Button.tsx'
import { unlockFightSound } from '../components/fight/coach.ts'
import { useFightSession } from '../components/fight/fightContext.ts'
import { planSummary, SPORT_BLURBS, SPORT_LABELS } from '../components/fight/labels.ts'
import { ChevronRightIcon } from '../components/icons.tsx'
import { Screen } from '../components/Screen.tsx'
import { SPORTS } from '../data/index.ts'
import styles from './FightScreen.module.css'

export function FightScreen() {
  const fight = useFightSession()
  const active = fight.status === 'active' ? fight.session : null

  return (
    <Screen title="Fight">
      {active && (
        <ButtonLink to="/fight/session" variant="primary" block onClick={unlockFightSound}>
          Resume {SPORT_LABELS[active.sport]} · {planSummary(active)}
        </ButtonLink>
      )}
      <p className={styles.intro}>Pick a sport. Each round, a voice coach calls combos for you to throw.</p>
      <ul className={styles.sports} aria-label="Sports">
        {SPORTS.map((sport) => (
          <li key={sport}>
            <Link to={`/fight/${sport}`} className={styles.card}>
              <span className={styles.text}>
                <span className={styles.name}>{SPORT_LABELS[sport]}</span>
                <span className={styles.blurb}>{SPORT_BLURBS[sport]}</span>
              </span>
              <ChevronRightIcon className={styles.chevron} />
            </Link>
          </li>
        ))}
      </ul>
    </Screen>
  )
}
