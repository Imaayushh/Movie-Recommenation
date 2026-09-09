/**
 * CineMatch — localStorage wrapper.
 *
 * Mirrors legacy-react/src/hooks/useLocalStorage.ts. Storage is best-effort:
 * if it is unavailable (private mode, file:// in some browsers) the app keeps
 * working from memory instead of throwing.
 */
(function (global) {
  'use strict';

  function load(key, fallback) {
    try {
      var raw = global.localStorage.getItem(key);
      if (!raw) return fallback;
      var parsed = JSON.parse(raw);
      return parsed === null || parsed === undefined ? fallback : parsed;
    } catch (err) {
      return fallback;
    }
  }

  function save(key, value) {
    try {
      global.localStorage.setItem(key, JSON.stringify(value));
    } catch (err) {
      /* storage unavailable — keep working in memory */
    }
  }

  function reset(key) {
    try {
      global.localStorage.removeItem(key);
    } catch (err) {
      /* ignore */
    }
  }

  global.CineMatchStorage = { load: load, save: save, reset: reset };
})(window);
