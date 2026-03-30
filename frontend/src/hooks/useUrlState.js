/**
 * Utilities for reading and writing URL search params without a router library.
 *
 * Usage:
 *   const [value, setValue] = useUrlParam('year', '2010');
 *
 * - Reads the param from the current URL on mount.
 * - setValue calls history.replaceState so the URL updates without a history entry.
 * - A 'popstate' listener keeps the value in sync when the user presses back/forward.
 */

import { useState, useEffect, useCallback } from 'react';

// ── Low-level helpers ─────────────────────────────────────────────────────────

export function getParam(key, fallback = '') {
  return new URLSearchParams(window.location.search).get(key) ?? fallback;
}

export function setParam(key, value) {
  const sp = new URLSearchParams(window.location.search);
  if (value === null || value === undefined || value === '') {
    sp.delete(key);
  } else {
    sp.set(key, String(value));
  }
  const qs = sp.toString();
  history.replaceState(null, '', `${window.location.pathname}${qs ? '?' + qs : ''}`);
}

export function setParams(obj) {
  const sp = new URLSearchParams(window.location.search);
  for (const [key, value] of Object.entries(obj)) {
    if (value === null || value === undefined || value === '') {
      sp.delete(key);
    } else {
      sp.set(key, String(value));
    }
  }
  const qs = sp.toString();
  history.replaceState(null, '', `${window.location.pathname}${qs ? '?' + qs : ''}`);
}

export function clearParams(keys) {
  const sp = new URLSearchParams(window.location.search);
  for (const key of keys) sp.delete(key);
  const qs = sp.toString();
  history.replaceState(null, '', `${window.location.pathname}${qs ? '?' + qs : ''}`);
}

// ── React hook ────────────────────────────────────────────────────────────────

/**
 * useUrlParam(key, defaultValue)
 * Returns [value, setValue] backed by a URL search param.
 * setValue uses replaceState (no history entry).
 */
export function useUrlParam(key, defaultValue = '') {
  const [value, setValue] = useState(() => getParam(key, defaultValue));

  // Sync from URL when popstate fires (back/forward)
  useEffect(() => {
    const handler = () => setValue(getParam(key, defaultValue));
    window.addEventListener('popstate', handler);
    return () => window.removeEventListener('popstate', handler);
  }, [key, defaultValue]);

  const set = useCallback((next) => {
    const v = typeof next === 'function' ? next(getParam(key, defaultValue)) : next;
    setParam(key, v === defaultValue ? '' : v);
    setValue(v);
  }, [key, defaultValue]);

  return [value, set];
}

// ── Page navigation (pushState) ───────────────────────────────────────────────

const PATH_TO_PAGE = {
  '/':            'dashboard',
  '/dashboard':   'dashboard',
  '/vendors':     'vendors',
  '/graph':       'graph',
  '/analytics':   'analytics',
  '/agent':       'agent',
  '/system-design': 'system-design',
};

const PAGE_TO_PATH = {
  'dashboard':     '/dashboard',
  'vendors':       '/vendors',
  'graph':         '/graph',
  'analytics':     '/analytics',
  'agent':         '/agent',
  'system-design': '/system-design',
};

export function pageFromPath(pathname) {
  return PATH_TO_PAGE[pathname] ?? 'dashboard';
}

export function pathFromPage(page) {
  return PAGE_TO_PATH[page] ?? '/dashboard';
}

export function navigateTo(page) {
  const path = pathFromPage(page);
  history.pushState(null, '', path);
  // pushState does not fire popstate — dispatch manually so App.jsx
  // and any page hooks that listen to popstate pick up the new path.
  window.dispatchEvent(new PopStateEvent('popstate', { state: null }));
}
