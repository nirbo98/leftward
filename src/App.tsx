import { useEffect } from 'react';
import { ErrorBoundary } from './components/ui';
import { AppProvider, useApp } from './state/AppState';
import { useRoute } from './state/router';
import { EndScreen } from './screens/EndScreen';
import { ExerciseScreen } from './screens/ExerciseScreen';
import { HomeScreen } from './screens/HomeScreen';
import { ProgressScreen } from './screens/ProgressScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { StartFlow } from './screens/StartFlow';

function Routes() {
  const route = useRoute();
  const { ready } = useApp();
  useEffect(() => {
    // Move focus to the page heading on navigation (screen-reader friendly).
    const h = document.querySelector<HTMLElement>('main h1');
    h?.focus({ preventScroll: false });
    window.scrollTo(0, 0);
  }, [route, ready]);
  if (!ready) return <main className="page" aria-busy="true"><p>טוען…</p></main>;
  switch (route) {
    case 'start':
      return <StartFlow />;
    case 'exercise':
      return <ExerciseScreen />;
    case 'end':
      return <EndScreen />;
    case 'progress':
      return <ProgressScreen />;
    case 'settings':
      return <SettingsScreen />;
    default:
      return <HomeScreen />;
  }
}

export function App() {
  return (
    <ErrorBoundary>
      <AppProvider>
        <Routes />
      </AppProvider>
    </ErrorBoundary>
  );
}
