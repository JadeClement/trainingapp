import { CoachAthleteScope } from '../components/CoachAthleteScope.jsx';
import { HomePage } from './HomePage.jsx';

export function CoachHomePage() {
  return (
    <CoachAthleteScope emptyTitle="Home">
      {(athleteId) => <HomePage athleteId={athleteId} key={athleteId} />}
    </CoachAthleteScope>
  );
}
