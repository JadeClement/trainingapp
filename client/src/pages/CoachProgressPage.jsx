import { CoachAthleteScope } from '../components/CoachAthleteScope.jsx';
import { ProgressPage } from './ProgressPage.jsx';

export function CoachProgressPage() {
  return (
    <CoachAthleteScope emptyTitle="Progress">
      {(athleteId) => <ProgressPage athleteId={athleteId} key={athleteId} />}
    </CoachAthleteScope>
  );
}
