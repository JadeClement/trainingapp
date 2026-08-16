import { Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import { useAuth } from './context/AuthContext.jsx';
import { ProtectedRoute } from './components/ProtectedRoute.jsx';
import { NavBar } from './components/NavBar.jsx';
import { LoginPage } from './pages/LoginPage.jsx';
import { SignupPage } from './pages/SignupPage.jsx';
import { CalendarPage } from './pages/CalendarPage.jsx';
import { WorkoutFormPage } from './pages/WorkoutFormPage.jsx';
import { WorkoutDetailPage } from './pages/WorkoutDetailPage.jsx';
import { SettingsPage } from './pages/SettingsPage.jsx';
import { FitnessPage } from './pages/FitnessPage.jsx';
import { FriendsPage } from './pages/FriendsPage.jsx';
import { CoachHomePage } from './pages/CoachHomePage.jsx';
import { AthleteFinderPage } from './pages/AthleteFinderPage.jsx';
import { CoachesPage } from './pages/CoachesPage.jsx';

function HomeRoute() {
  const { user } = useAuth();
  return user?.activeMode === 'coach' ? <CoachHomePage /> : <CalendarPage />;
}

export default function App() {
  return (
    <AuthProvider>
      <NavBar />
      <main className="app-main">
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <HomeRoute />
              </ProtectedRoute>
            }
          />
          <Route
            path="/workouts/new"
            element={
              <ProtectedRoute>
                <WorkoutFormPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/workouts/:id"
            element={
              <ProtectedRoute>
                <WorkoutFormPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/workouts/:id/detail"
            element={
              <ProtectedRoute>
                <WorkoutDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/fitness"
            element={
              <ProtectedRoute>
                <FitnessPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <SettingsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/friends"
            element={
              <ProtectedRoute>
                <FriendsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/coaches"
            element={
              <ProtectedRoute>
                <CoachesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/coach/athletes"
            element={
              <ProtectedRoute>
                <AthleteFinderPage />
              </ProtectedRoute>
            }
          />
        </Routes>
      </main>
    </AuthProvider>
  );
}
