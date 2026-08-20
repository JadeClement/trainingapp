import { CoachAthleteScope } from '../components/CoachAthleteScope.jsx';
import { CalendarPage } from './CalendarPage.jsx';

export function CoachHomePage() {
  return (
    <CoachAthleteScope emptyTitle="Coach dashboard">
      {(athleteId) => <CalendarPage athleteId={athleteId} key={athleteId} />}
    </CoachAthleteScope>
  );
}
