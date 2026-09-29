/**
 * Filmphile — Filmphile API client.
 *
 * Fetches data from the Node.js backend, which proxies the TMDB API
 * server-side so the TMDB key never appears in the browser.
 */
(function (global) {
  'use strict';

  var API_BASE = 'http://localhost:3000/api';

  async function fetchJSON(url, options) {
    var response = await fetch(API_BASE + url, options);
    var data = null;
    try { data = await response.json(); } catch (e) { /* non-JSON body */ }
    if (!response.ok) {
      var message = data && data.error ? data.error : 'API error: ' + response.status;
      var err = new Error(message);
      err.status = response.status;
      throw err;
    }
    return data;
  }

  async function getCategories() {
    return fetchJSON('/categories');
  }

  async function getLanguages() {
    return fetchJSON('/languages');
  }

  async function getMovies() {
    return fetchJSON('/movies');
  }

  async function getSeries() {
    return fetchJSON('/series');
  }

  async function getTV() {
    return fetchJSON('/tv');
  }

  async function getAnime() {
    return fetchJSON('/anime');
  }

  async function getTop() {
    return fetchJSON('/top');
  }

  async function getSimilarity() {
    return fetchJSON('/similarity');
  }

  async function getDailyPick() {
    return fetchJSON('/daily-pick');
  }

  async function getMovie(id) {
    return fetchJSON('/movies/' + id);
  }

  async function getUsers() {
    return fetchJSON('/users');
  }

  async function addUser(name) {
    return fetchJSON('/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name })
    });
  }

  async function sendOtp(email, name, mode) {
    return fetchJSON('/auth/send-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email, name: name, mode: mode })
    });
  }

  async function verifyOtp(email, otp, name, mode) {
    return fetchJSON('/auth/verify-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email, otp: otp, name: name, mode: mode })
    });
  }

  async function getRatings() {
    return fetchJSON('/ratings');
  }

  async function getUserRatings(userId) {
    return fetchJSON('/ratings/user/' + userId);
  }

  async function saveRating(userId, movieId, rating) {
    if (rating <= 0) {
      var all = await getRatings();
      var existing = all.find(function (r) { return r.userId === userId && r.movieId === movieId; });
      if (existing) {
        await fetchJSON('/ratings/' + existing.id, { method: 'DELETE' });
      }
      return null;
    }
    return fetchJSON('/ratings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: userId, movieId: movieId, rating: rating })
    });
  }

  async function deleteRating(id) {
    return fetchJSON('/ratings/' + id, { method: 'DELETE' });
  }

  async function getStats() {
    return fetchJSON('/stats');
  }

  global.FilmphileAPI = {
    getCategories: getCategories,
    getLanguages: getLanguages,
    getMovies: getMovies,
    getSeries: getSeries,
    getTV: getTV,
    getAnime: getAnime,
    getTop: getTop,
    getSimilarity: getSimilarity,
    getDailyPick: getDailyPick,
    getMovie: getMovie,
    getUsers: getUsers,
    addUser: addUser,
    sendOtp: sendOtp,
    verifyOtp: verifyOtp,
    getRatings: getRatings,
    getUserRatings: getUserRatings,
    saveRating: saveRating,
    deleteRating: deleteRating,
    getStats: getStats
  };
})(window);
