import { useState, useEffect } from 'react';

export type AppRoute = '/login' | '/home' | '/adminportal';

/**
 * Normalizes browser pathname or hash into one of the supported AppRoutes:
 * - /login
 * - /home
 * - /adminportal (alias /admin)
 */
export function normalizePath(pathOrHash?: string): AppRoute {
  let raw = pathOrHash;

  if (!raw && typeof window !== 'undefined') {
    // Check hash first (for Capacitor / static server fallback)
    if (window.location.hash) {
      const hash = window.location.hash.replace(/^#\/?/, '/');
      if (
        hash.startsWith('/login') ||
        hash.startsWith('/home') ||
        hash.startsWith('/adminportal') ||
        hash.startsWith('/admin')
      ) {
        raw = hash;
      }
    }
    if (!raw) {
      raw = window.location.pathname || '/';
    }
  }

  if (!raw) return '/home';

  // Strip trailing slashes, hashes and query strings
  const clean = raw.split('?')[0].split('#')[0].replace(/\/+$/, '').toLowerCase();

  if (clean === '/login') return '/login';
  if (clean === '/adminportal' || clean === '/admin') return '/adminportal';
  if (clean === '/home') return '/home';

  // Default root /
  return '/home';
}

type RouteListener = (route: AppRoute) => void;
let listeners: RouteListener[] = [];

export const router = {
  getCurrentRoute(): AppRoute {
    return normalizePath();
  },

  navigate(to: AppRoute, replace = false): void {
    if (typeof window === 'undefined') return;
    const current = normalizePath();
    if (current === to && !replace) return;

    try {
      if (replace) {
        window.history.replaceState({ route: to }, '', to);
      } else {
        window.history.pushState({ route: to }, '', to);
      }
    } catch {
      // In restricted file:// environments fallback to hash
      window.location.hash = `#${to}`;
    }

    listeners.forEach((listener) => {
      try {
        listener(to);
      } catch (err) {
        console.warn('[Router] Listener error:', err);
      }
    });

    try {
      window.dispatchEvent(new CustomEvent('limochat_route_change', { detail: { route: to } }));
    } catch {}
  },

  subscribe(callback: RouteListener): () => void {
    listeners.push(callback);
    return () => {
      listeners = listeners.filter((l) => l !== callback);
    };
  },
};

/**
 * React hook to listen to route changes and navigate between pages
 */
export function useRouter() {
  const [currentRoute, setCurrentRoute] = useState<AppRoute>(() => router.getCurrentRoute());

  useEffect(() => {
    const handleLocationChange = () => {
      setCurrentRoute(router.getCurrentRoute());
    };

    window.addEventListener('popstate', handleLocationChange);
    window.addEventListener('hashchange', handleLocationChange);
    const unsubscribe = router.subscribe((route) => {
      setCurrentRoute(route);
    });

    return () => {
      window.removeEventListener('popstate', handleLocationChange);
      window.removeEventListener('hashchange', handleLocationChange);
      unsubscribe();
    };
  }, []);

  return {
    currentRoute,
    navigate: (to: AppRoute, replace = false) => router.navigate(to, replace),
  };
}
