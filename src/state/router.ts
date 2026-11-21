import { useEffect, useState } from 'react';

export type Route = 'home' | 'start' | 'exercise' | 'end' | 'progress' | 'settings';
const ROUTES: Route[] = ['home', 'start', 'exercise', 'end', 'progress', 'settings'];

/** Hash routing — works on GitHub Pages without server rewrites. Never carries personal data. */
export function parseHash(hash: string): Route {
  const r = hash.replace(/^#\/?/, '').split(/[?/]/)[0] as Route;
  return ROUTES.includes(r) ? r : 'home';
}

export function navigate(r: Route): void {
  const h = r === 'home' ? '#/' : `#/${r}`;
  if (window.location.hash !== h) window.location.hash = h;
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash));
  useEffect(() => {
    const on = () => setRoute(parseHash(window.location.hash));
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}
