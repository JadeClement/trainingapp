import { CoachAthleteScope } from '../components/CoachAthleteScope.jsx';
import { CalendarPage } from './CalendarPage.jsx';

export function CoachPlanPage() {
  return (
    <CoachAthleteScope emptyTitle="Plan">
      {(athleteId) => <CalendarPage athleteId={athleteId} key={athleteId} />}
    </CoachAthleteScope>
  );
}
