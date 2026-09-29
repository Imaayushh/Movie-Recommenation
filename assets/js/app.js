/**
 * Filmphile — vanilla JS app shell.
 *
 * Static port of legacy-react/src/App.tsx + components/. No build step,
 * no framework, no dependencies: open index.html or serve the folder.
 */
(function () {
  'use strict';

  var API = window.FilmphileAPI;
  var R = window.FilmphileRecommender;
  var Storage = window.FilmphileStorage;

  var MOVIES = [];
  var SERIES = [];
  var TV = [];
  var ANIME = [];
  var USERS = [];
  var CATEGORIES = [];
  var LANGUAGES = [];
  var CATEGORY_MAP = {};
  var LANGUAGE_MAP = {};
  var TOPLISTS = null;
  var SIMILARITY = { movies: {}, series: {}, tv: {}, anime: {} };

  function getCategory(id) {
    return CATEGORY_MAP[id] || { id: -1, key: 'unknown', label: 'Unknown', emoji: '\uD83C\uDFAC' };
  }

  function getLanguage(id) {
    return LANGUAGE_MAP[id] || { id: id, label: id };
  }

  var TOP = R.TOP_RATING_THRESHOLD;

  var MENU = [
    { id: 1, label: 'Give your review' },
    { id: 2, label: 'Personalised picks' },
    { id: 3, label: 'Top ratings of movies' },
    { id: 4, label: 'Profile' }
  ];

  var state = {
    choice: 1,
    activeUserId: null,
    showLoginModal: false,
    loginCallback: null,
    auth: {
      mode: 'register',
      name: '',
      email: '',
      otp: '',
      step: 'form',
      error: null,
      busy: false,
      devOtp: null,
      resendAt: 0,
      resendTimer: null
    },
    ratings: [],
    users: [],
    dailyPick: null
  };

  // ---------------------------------------------------------------------------
  // Hash-based routing
  // ---------------------------------------------------------------------------

  var ROUTE_MAP = {
    1: { base: '#/reviews', sub: { movie: '#/reviews', series: '#/reviews/series', tv: '#/reviews/tv', anime: '#/reviews/anime' } },
    2: { base: '#/suggestions' },
    3: { base: '#/top-ratings', sub: { movie: '#/top-ratings/movies', series: '#/top-ratings/series', tv: '#/top-ratings/tv', anime: '#/top-ratings/anime' } },
    4: { base: '#/profile' }
  };

  function hashToRoute(hash) {
    var h = (hash || '').replace(/^#\/?/, '/');
    if (h === '/suggestions' || h === '/suggestions/' || h === '/picks' || h === '/picks/') return { choice: 2 };
    if (h === '/top-ratings' || h === '/top-ratings/' || h === '/top-ratings/movies') return { choice: 3, kind: 'movie' };
    if (h === '/top-ratings/series') return { choice: 3, kind: 'series' };
    if (h === '/top-ratings/tv') return { choice: 3, kind: 'tv' };
    if (h === '/top-ratings/anime') return { choice: 3, kind: 'anime' };
    if (h === '/profile' || h === '/profile/') return { choice: 4 };
    if (h === '/reviews/series' || h === '/reviews/series/') return { choice: 1, content: 'series' };
    if (h === '/reviews/tv' || h === '/reviews/tv/') return { choice: 1, content: 'tv' };
    if (h === '/reviews/anime' || h === '/reviews/anime/') return { choice: 1, content: 'anime' };
    return { choice: 1, content: 'movie' };
  }

  function navigateTo(choice, contentOrKind) {
    var route = ROUTE_MAP[choice];
    if (!route) return false;
    var hash = contentOrKind && route.sub ? (route.sub[contentOrKind] || route.base) : route.base;
    if (window.location.hash === hash) return false;
    window.location.hash = hash;
    return true;
  }

  function syncFromHash() {
    var parsed = hashToRoute(window.location.hash);
    state.choice = parsed.choice;
    if (parsed.content) ui.content = parsed.content;
    if (parsed.kind) ui.top.kind = parsed.kind;
  }

  /** Panel-local UI state that does not need to be persisted. */
  var ui = {
    content: 'movie',
    review: {
      search: '',
      genreFilter: null,
      languageFilter: null,
      carouselIndex: 0,
      selectedId: null,
      pendingRating: 0,
      expandedGenres: [],
      flash: null,
      flashTimer: null
    },
    series: {
      search: '',
      genreFilter: null,
      languageFilter: null,
      carouselIndex: 0,
      selectedId: null,
      pendingRating: 0,
      expandedGenres: [],
      flash: null,
      flashTimer: null
    },
    tv: {
      search: '',
      genreFilter: null,
      languageFilter: null,
      carouselIndex: 0,
      selectedId: null,
      pendingRating: 0,
      expandedGenres: [],
      flash: null,
      flashTimer: null
    },
    anime: {
      search: '',
      genreFilter: null,
      languageFilter: null,
      carouselIndex: 0,
      selectedId: null,
      pendingRating: 0,
      expandedGenres: [],
      flash: null,
      flashTimer: null
    },
    suggestions: { genreFilter: null, grouped: true, spotlight: null, pickFilter: 'all' },
    top: { kind: 'movie' },
    profile: { showReviews: true }
  };

  // ---------------------------------------------------------------------------
  // Tiny DOM helpers
  // ---------------------------------------------------------------------------

  function h(tag, attrs) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (key) {
        var value = attrs[key];
        if (value === null || value === undefined || value === false) return;
        if (key === 'class') node.className = value;
        else if (key === 'text') node.textContent = value;
        else if (key.slice(0, 2) === 'on' && typeof value === 'function') {
          node.addEventListener(key.slice(2).toLowerCase(), value);
        } else if (value === true) node.setAttribute(key, '');
        else node.setAttribute(key, value);
      });
    }
    for (var i = 2; i < arguments.length; i++) append(node, arguments[i]);
    return node;
  }

  function append(node, child) {
    if (child === null || child === undefined || child === false || child === true) return;
    if (Array.isArray(child)) {
      child.forEach(function (c) { append(node, c); });
      return;
    }
    node.appendChild(child instanceof Node ? child : document.createTextNode(String(child)));
  }

  function clear(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
    return node;
  }

  function plural(count, word) {
    return count + ' ' + word + (count === 1 ? '' : 's');
  }

  // ---------------------------------------------------------------------------
  // Derived state
  // ---------------------------------------------------------------------------

  function activeUser() {
    if (state.activeUserId === null || state.activeUserId === undefined) return null;
    for (var i = 0; i < state.users.length; i++) {
      if (state.users[i].id === state.activeUserId) return state.users[i];
    }
    return null;
  }

  function currentMatrix() {
    return R.buildMatrix(state.users, MOVIES, state.ratings);
  }

  function currentResult() {
    var user = activeUser();
    if (!user) return { unlocked: false, liked: [], recs: [], surprise: null };
    return R.recommendForUser(currentMatrix(), user.id, 9);
  }

  function myRatings() {
    var user = activeUser();
    var id = user ? user.id : null;
    if (id === null || id === undefined) return [];
    return state.ratings.filter(function (r) { return r.userId === id; });
  }

  /**
   * Content-based picks for the profile page: titles the user rated highly
   * (>= Dtop) seed the list, and SIMILARITY (precomputed TF-IDF cosine) brings
   * back other titles with similar plot / cast / genre. Already-rated titles
   * are excluded; each pick keeps the strongest seeding neighbour.
   */
  function profilePicks(limit) {
    if (limit === undefined) limit = 18;
    var user = activeUser();
    if (!user) return { unlocked: false, liked: [], picks: [] };

    var rated = {};
    var liked = [];
    state.ratings.forEach(function (r) {
      if (r.userId !== user.id) return;
      rated[r.movieId] = true;
      if (r.rating >= 4) liked.push(r);
    });
    liked.sort(function (a, b) { return b.rating - a.rating; });

    var best = {};
    var order = [];
    var seedOf = {};

    liked.forEach(function (rating) {
      var found = findTitleById(rating.movieId);
      if (!found) return;
      var seed = found.item;
      similarityFor(found.kind, rating.movieId).forEach(function (n) {
        if (rated[n.id]) return;
        var target = findTitleById(n.id);
        if (!target) return;
        var key = String(n.id);
        if (!best[key] || n.score > best[key]) {
          if (!best[key]) order.push(key);
          best[key] = n.score;
          seedOf[key] = { seed: seed, seedRating: rating.rating, title: n.title || target.item.moviename };
          best[key + '\u0000title'] = target;
        }
      });
    });

    order.sort(function (a, b) { return best[b] - best[a]; });

    var picks = order.slice(0, limit).map(function (key) {
      var title = best[key + '\u0000title'];
      var s = seedOf[key];
      var match = Math.max(1, Math.min(99, Math.round(best[key] * 100)));
      return {
        movie: title.item,
        kind: title.kind,
        match: match,
        similarity: best[key],
        reasons: ['Similar to ' + s.seed.moviename + ' (' + s.seedRating + '\u2605)']
      };
    });

    return { unlocked: liked.length > 0, liked: liked, picks: picks };
  }

  /** Compute average rating for a movie across all viewers. */
  function movieAverageRating(movieId) {
    var sum = 0, count = 0;
    state.ratings.forEach(function (r) {
      if (r.movieId === movieId && r.rating > 0) { sum += r.rating; count++; }
    });
    return count > 0 ? sum / count : 0;
  }

  function findUserById(id) {
    for (var i = 0; i < state.users.length; i++) {
      if (state.users[i].id === id) return state.users[i];
    }
    return null;
  }

  /** Drawer section — overall community rating only. Individual star rows, bot
   * or human, are not shown; the rating widget sits below the detail block. */
  function otherRatingsBlock(movieId) {
    var count = 0;
    state.ratings.forEach(function (r) {
      if (String(r.movieId) === String(movieId) && r.rating > 0) count++;
    });
    var block = h('div', { class: 'movie-detail-others' },
      h('span', { class: 'movie-detail-others-title', text: 'Overall rating' })
    );
    if (count === 0) {
      block.appendChild(h('span', { class: 'text-supporting', text: 'No reviews yet \u2014 be the first to rate.' }));
      return block;
    }
    var avg = movieAverageRating(movieId);
    block.appendChild(h('span', {
      class: 'text-supporting',
      text: 'Community ' + avg.toFixed(1) + '\u2605 \u00B7 ' + count +
        (count === 1 ? ' review' : ' reviews')
    }));
    return block;
  }

  /** Get trending movies: highest user average first, then TMDB rating as a tiebreak. */
  function trendingMovies() {
    return MOVIES.slice().sort(function (a, b) {
      var aAvg = movieAverageRating(a.id);
      var bAvg = movieAverageRating(b.id);
      if (bAvg !== aAvg) return bAvg - aAvg;
      return (b.tmdbRating || 0) - (a.tmdbRating || 0);
    });
  }

  // ---------------------------------------------------------------------------
  // Content kinds — Movies / Web Series / TV Shows share one panel layout
  // ---------------------------------------------------------------------------

  var CONTENT_KINDS = [
    { key: 'movie', label: 'Movies', heading: 'Browse Movies' },
    { key: 'series', label: 'Web Series', heading: 'Browse Web Series' },
    { key: 'tv', label: 'TV Shows', heading: 'Browse TV Shows' },
    { key: 'anime', label: 'Anime', heading: 'Browse Anime' }
  ];

  function contentKind(key) {
    for (var i = 0; i < CONTENT_KINDS.length; i++) if (CONTENT_KINDS[i].key === key) return CONTENT_KINDS[i];
    return CONTENT_KINDS[0];
  }

  function catalogFor(kind) {
    if (kind === 'series') return SERIES;
    if (kind === 'tv') return TV;
    if (kind === 'anime') return ANIME;
    return MOVIES;
  }

  function browseUi(kind) {
    if (kind === 'series') return ui.series;
    if (kind === 'tv') return ui.tv;
    if (kind === 'anime') return ui.anime;
    return ui.review;
  }

  function catById(kind, id) {
    var list = catalogFor(kind);
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  /**
   * Locate a title across all four catalogs.
   * Returns { kind, item } or null. Similarity dictionaries (SIMILARITY) are
   * keyed by catalog: movies -> SIMILARITY.movies, series -> SIMILARITY.series,
   * tv -> SIMILARITY.tv, anime -> SIMILARITY.anime.
   */
  function findTitleById(id) {
    var kinds = ['movie', 'series', 'tv', 'anime'];
    for (var i = 0; i < kinds.length; i++) {
      var item = catById(kinds[i], id);
      if (item) return { kind: kinds[i], item: item };
    }
    return null;
  }

  function similarityFor(kind, id) {
    if (!SIMILARITY) return [];
    var bucket = kind === 'movie' ? SIMILARITY.movies : SIMILARITY[kind];
    if (!bucket) return [];
    return bucket[String(id)] || [];
  }

  /** Trending for any catalog: highest user average first, tmdbRating tiebreak. */
  function trendingFor(kind) {
    return catalogFor(kind).slice().sort(function (a, b) {
      var aAvg = movieAverageRating(a.id);
      var bAvg = movieAverageRating(b.id);
      if (bAvg !== aAvg) return bAvg - aAvg;
      return (b.tmdbRating || 0) - (a.tmdbRating || 0);
    });
  }

  // ---------------------------------------------------------------------------
  // Mutations
  // ---------------------------------------------------------------------------

  function rate(movieId, value) {
    var user = activeUser();
    if (!user) {
      authOpen('register');
      state.loginCallback = function () { rate(movieId, value); };
      render();
      return;
    }
    var uid = user.id;
    state.ratings = state.ratings.filter(function (r) {
      return !(r.userId === uid && r.movieId === movieId);
    });
    if (value > 0) state.ratings.push({ userId: uid, movieId: movieId, rating: value });
    API.saveRating(uid, movieId, value).catch(function (err) {
      console.error('Failed to save rating:', err);
    });
  }

  // ---------------------------------------------------------------------------
  // Auth — account creation and login both verify the email with a one-time
  // code. Registering collects a username + email; logging in needs the email.
  // ---------------------------------------------------------------------------

  function authOpen(mode) {
    var a = state.auth;
    a.mode = mode || 'register';
    a.step = 'form';
    a.name = '';
    a.email = '';
    a.otp = '';
    a.error = null;
    a.busy = false;
    a.devOtp = null;
    a.resendAt = 0;
    if (a.resendTimer) { window.clearInterval(a.resendTimer); a.resendTimer = null; }
    state.showLoginModal = true;
  }

  function authClose() {
    var a = state.auth;
    a.error = null;
    a.busy = false;
    a.devOtp = null;
    if (a.resendTimer) { window.clearInterval(a.resendTimer); a.resendTimer = null; }
    a.resendTimer = null;
    a.step = 'form';
    state.showLoginModal = false;
    state.loginCallback = null;
  }

  function authSwitch(mode) {
    var a = state.auth;
    a.mode = mode;
    a.step = 'form';
    a.otp = '';
    a.error = null;
    a.devOtp = null;
    render();
  }

  function authSendOtp() {
    var a = state.auth;
    var email = (a.email || '').trim();
    var name = (a.name || '').trim();
    a.error = null;
    if (a.mode === 'register' && name.length < 2) {
      a.error = 'Username must be at least 2 characters long.';
      render();
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      a.error = 'Enter a valid email address.';
      render();
      return;
    }
    a.busy = true;
    render();
    API.sendOtp(email, name, a.mode).then(function (res) {
      a.busy = false;
      a.error = null;
      a.step = 'otp';
      a.devOtp = res.devOtp || null;
      startResendCountdown();
      render();
    }).catch(function (err) {
      a.busy = false;
      a.error = err.message || 'Something went wrong. Please try again.';
      render();
    });
  }

  function authVerifyAndLogin() {
    var a = state.auth;
    var email = (a.email || '').trim();
    var name = (a.name || '').trim();
    var otp = (a.otp || '').replace(/\s+/g, '');
    a.error = null;
    if (!/^\d{6}$/.test(otp)) {
      a.error = 'Enter the 6-digit code.';
      render();
      return;
    }
    a.busy = true;
    render();
    API.verifyOtp(email, otp, name, a.mode).then(function (res) {
      a.busy = false;
      var user = res.user;
      state.users = state.users.filter(function (u) { return u.id !== user.id; });
      state.users.push(user);
      state.activeUserId = user.id;
      Storage.save('filmphile_current_user', { id: user.id, name: user.name, email: user.email || null });
      state.showLoginModal = false;
      a.step = 'form';
      if (a.resendTimer) { window.clearInterval(a.resendTimer); a.resendTimer = null; }
      var cb = state.loginCallback;
      state.loginCallback = null;
      render();
      if (cb) cb();
    }).catch(function (err) {
      a.busy = false;
      a.error = err.message || 'Verification failed. Please try again.';
      render();
    });
  }

  function authGoBack() {
    var a = state.auth;
    a.step = 'form';
    a.otp = '';
    a.error = null;
    a.devOtp = null;
    render();
  }

  function startResendCountdown() {
    var a = state.auth;
    a.resendAt = Date.now() + 30000;
    if (a.resendTimer) window.clearInterval(a.resendTimer);
    tickResend();
    a.resendTimer = window.setInterval(tickResend, 1000);
  }

  function tickResend() {
    var a = state.auth;
    var el = document.getElementById('auth-resend-btn');
    if (!el || !state.showLoginModal) {
      if (a.resendTimer) { window.clearInterval(a.resendTimer); a.resendTimer = null; }
      return;
    }
    var left = Math.ceil((a.resendAt - Date.now()) / 1000);
    if (left <= 0) {
      el.textContent = 'Resend code';
      el.disabled = false;
      if (a.resendTimer) { window.clearInterval(a.resendTimer); a.resendTimer = null; }
    } else {
      el.textContent = 'Resend code in ' + left + 's';
      el.disabled = true;
    }
  }

  function logoutUser() {
    state.activeUserId = null;
    Storage.reset('filmphile_current_user');
    state.choice = 1;
    if (!navigateTo(1)) render();
  }

  // ---------------------------------------------------------------------------
  // Reusable widgets
  // ---------------------------------------------------------------------------

  function banner(status, title) {
    return h('div', { class: 'banner banner-' + status, role: 'status' },
      h('span', { class: 'banner-icon', 'aria-hidden': 'true', text: status === 'success' ? '\u2713' : '!' }),
      h('span', { text: title })
    );
  }

  function badge(label, variant) {
    return h('span', { class: 'badge badge-' + (variant || 'neutral'), text: label });
  }

  function token(label) {
    return h('span', { class: 'token', text: label });
  }

  function progressBar(value, max) {
    var pct = max ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
    return h('span', { class: 'progress', role: 'img', 'aria-label': Math.round(pct) + '%' },
      h('span', { class: 'progress-fill', style: 'width:' + pct + '%' })
    );
  }

  function emptyState(title) {
    return h('div', { class: 'empty', text: title });
  }

  function starRating(value, onChange, size) {
    var wrap = h('span', {
      class: 'stars stars-' + (size || 'md'),
      role: 'group',
      'aria-label': 'Rating'
    });
    for (var i = 1; i <= 5; i++) {
      (function (star) {
        var filled = star <= value;
        wrap.appendChild(h('button', {
          type: 'button',
          class: 'star' + (filled ? ' is-filled' : ''),
          'aria-label': star + (star === 1 ? ' star' : ' stars'),
          'aria-pressed': filled ? 'true' : 'false',
          title: star + (star === 1 ? ' star' : ' stars'),
          disabled: !onChange,
          onclick: function () {
            if (!onChange) return;
            onChange(value === star ? 0 : star);
          },
          text: filled ? '\u2605' : '\u2606'
        }));
      })(i);
    }
    wrap.appendChild(h('span', { class: 'stars-label', text: value > 0 ? value + '/5' : 'Not rated' }));
    return wrap;
  }

  function section(children) {
    var node = h('section', { class: 'section' });
    append(node, children);
    return node;
  }

  function listItem(label, description, endContent) {
    return h('li', { class: 'list-item' },
      h('span', { class: 'stack gap-0' },
        h('span', { class: 'list-item-label', text: label }),
        description ? h('span', { class: 'text-supporting', text: description }) : null
      ),
      endContent ? h('span', { class: 'row gap-2 align-center' }, endContent) : null
    );
  }

  function card(variant, children) {
    var node = h('div', { class: 'card card-' + (variant || 'plain') });
    append(node, children);
    return node;
  }

  // ---------------------------------------------------------------------------
  // Panel 1 — Browse & Review (Hero Carousel + Filters + Grid)
  // ---------------------------------------------------------------------------

  function buildContentSwitcher() {
    var wrap = h('div', { class: 'content-switcher', role: 'tablist', 'aria-label': 'Content type' });
    CONTENT_KINDS.forEach(function (k) {
      var active = ui.content === k.key;
      wrap.appendChild(h('button', {
        type: 'button',
        class: 'content-switch' + (active ? ' is-active' : ''),
        role: 'tab',
        'aria-selected': active ? 'true' : 'false',
        onclick: function () {
          if (ui.content === k.key) return;
          ui.content = k.key;
          navigateTo(1, k.key);
        },
        text: k.label
      }));
    });
    return wrap;
  }

  function reviewPanel(kind) {
    var user = activeUser();
    var st = browseUi(kind);
    var cat = catalogFor(kind);
    var ratings = myRatings();
    var submitted = ratings.filter(function (r) { return r.rating > 0 && catById(kind, r.movieId); });

    var ratingByMovieId = {};
    ratings.forEach(function (r) { if (catById(kind, r.movieId)) ratingByMovieId[r.movieId] = r.rating; });

    var root = h('div', { class: 'stack gap-4' });

    root.appendChild(buildContentSwitcher());

    if (st.flash) root.appendChild(banner('success', st.flash));

    // --- Hero Carousel (Trending) ---
    var trending = trendingFor(kind);
    var heroSection = buildHeroCarousel(trending, ratingByMovieId, user, st, flash);
    root.appendChild(heroSection);

    // --- Search + Filters Bar ---
    function buildFilterBar() {
      var bar = h('div', { class: 'filter-bar' });

      // Search
      var searchWrap = h('div', { class: 'filter-search' },
        h('input', {
          type: 'search',
          id: 'movie-search',
          class: 'filter-search-input',
          value: st.search,
          placeholder: 'Search titles, genres...',
          autocomplete: 'off',
          oninput: function (e) {
            st.search = e.target.value;
            var headerSearch = document.getElementById('header-search');
            if (headerSearch) headerSearch.value = e.target.value;
            refreshGrid();
          }
        })
      );
      bar.appendChild(searchWrap);

      // Genre filter
      var genreWrap = h('div', { class: 'filter-group' },
        h('span', { class: 'filter-label', text: 'Genre' })
      );
      var genreScroll = h('div', { class: 'filter-chips' });
      genreScroll.appendChild(h('button', {
        type: 'button',
        class: 'chip' + (st.genreFilter === null ? ' is-active' : ''),
        onclick: function () { st.genreFilter = null; refreshGrid(); updateFilterChips(); },
        text: 'All'
      }));
      CATEGORIES.forEach(function (c) {
        var active = st.genreFilter === c.id;
        genreScroll.appendChild(h('button', {
          type: 'button',
          class: 'chip' + (active ? ' is-active' : ''),
          'aria-pressed': active ? 'true' : 'false',
          onclick: function () {
            st.genreFilter = active ? null : c.id;
            refreshGrid();
            updateFilterChips();
          },
          text: c.label
        }));
      });
      genreWrap.appendChild(genreScroll);
      bar.appendChild(genreWrap);

      // Language filter
      var langWrap = h('div', { class: 'filter-group' },
        h('span', { class: 'filter-label', text: 'Language' })
      );
      var langScroll = h('div', { class: 'filter-chips' });
      langScroll.appendChild(h('button', {
        type: 'button',
        class: 'chip' + (st.languageFilter === null ? ' is-active' : ''),
        onclick: function () { st.languageFilter = null; refreshGrid(); updateFilterChips(); },
        text: 'All'
      }));
      LANGUAGES.forEach(function (l) {
        var active = st.languageFilter === l.id;
        langScroll.appendChild(h('button', {
          type: 'button',
          class: 'chip' + (active ? ' is-active' : ''),
          'aria-pressed': active ? 'true' : 'false',
          onclick: function () {
            st.languageFilter = active ? null : l.id;
            refreshGrid();
            updateFilterChips();
          },
          text: l.label
        }));
      });
      langWrap.appendChild(langScroll);
      bar.appendChild(langWrap);

      return bar;
    }

    var filterBar = buildFilterBar();
    root.appendChild(filterBar);

    // --- Filter chips update helper (rebuilds just the bar, keeps the grid stable) ---
    function updateFilterChips() {
      var fresh = buildFilterBar();
      filterBar.parentNode.replaceChild(fresh, filterBar);
      filterBar = fresh;
    }

    // --- Movie Grid ---
    var gridSection = h('div', { class: 'stack gap-2' });
    var gridHeader = h('div', { class: 'row gap-2 space-between align-center' },
      h('h3', { class: 'h3', text: contentKind(kind).heading }),
      h('span', { class: 'text-supporting', id: 'movie-count' })
    );
    gridSection.appendChild(gridHeader);

    var grid = h('div', { class: 'grid grid-movies' });
    gridSection.appendChild(grid);

    // --- Rating Drawer (appears when a movie is selected) ---
    var ratingDrawer = h('div', { class: 'rating-drawer', id: 'rating-drawer' });
    gridSection.appendChild(ratingDrawer);

    // --- Paging (Load more) ---
    var PAGE_SIZE = 24;
    var STRIP_SIZE = 12;
    var visibleCount = PAGE_SIZE;
    var loadingMore = false;

    function resetPaging() {
      visibleCount = PAGE_SIZE;
    }

    function refreshGrid() {
      resetPaging();
      updateMovieGrid();
    }

    function loadMore() {
      if (loadingMore) return;
      loadingMore = true;
      window.setTimeout(function () {
        loadingMore = false;
        visibleCount += PAGE_SIZE;
        updateMovieGrid();
      }, 200);
    }

    function buildLoadMoreButton() {
      var wrap = h('div', { class: 'grid-loader' });
      wrap.appendChild(h('button', {
        type: 'button',
        class: 'btn btn-secondary btn-sm',
        onclick: loadMore,
        text: 'Load more titles'
      }));
      return wrap;
    }

    /** One clickable title card. `strip` renders poster-only (for genre rows). */
    function makeMovieCard(movie, strip) {
      var cat = getCategory(movie.category);
      var lang = getLanguage(movie.language);
      var rated = ratingByMovieId[movie.id] || 0;
      var selected = st.selectedId === movie.id;

      var movieCard = h('button', {
        type: 'button',
        class: 'movie-card' + (selected ? ' is-selected' : '') + (strip ? ' is-strip' : ''),
        'aria-pressed': selected ? 'true' : 'false',
        title: movie.moviename,
        onclick: function () {
          if (st.selectedId === movie.id) {
            st.selectedId = null;
            st.pendingRating = 0;
          } else {
            st.selectedId = movie.id;
            st.pendingRating = rated || 0;
          }
          updateMovieGrid();
          updateRatingDrawer();
        }
      });

      var poster = h('div', { class: 'movie-card-poster', style: posterStyle(movie) });
      if (strip) {
        poster.appendChild(h('span', { class: 'movie-card-strip-title', text: movie.moviename }));
        var stripAvg = movieAverageRating(movie.id);
        if (stripAvg > 0) {
          poster.appendChild(h('span', { class: 'movie-card-strip-rating', text: '\u2605 ' + stripAvg.toFixed(1) }));
        }
      }
      movieCard.appendChild(poster);

      if (!strip) {
        var info = h('div', { class: 'movie-card-info' },
          h('span', { class: 'movie-card-title', text: movie.moviename }),
          h('span', { class: 'movie-card-meta', text: cat.label + ' \u00B7 ' + lang.label + (movie.year ? ' \u00B7 ' + movie.year : '') })
        );
        var avg = movieAverageRating(movie.id);
        if (avg > 0) info.appendChild(h('span', { class: 'movie-card-rated', text: 'Community ' + avg.toFixed(1) + '\u2605' }));
        if (rated > 0) info.appendChild(h('span', { class: 'movie-card-rated', text: 'Your rating: ' + rated + '\u2605' }));
        movieCard.appendChild(info);
      }

      return movieCard;
    }

    /** Flat grid of a filtered result set (search / genre / language active). */
    function renderFlatGrid(list) {
      if (list.length === 0) {
        grid.appendChild(emptyState('No titles match your filters'));
        return;
      }
      var shown = list.slice(0, visibleCount);
      shown.forEach(function (movie) { grid.appendChild(makeMovieCard(movie, false)); });
      if (visibleCount < list.length) {
        grid.appendChild(buildLoadMoreButton());
      } else if (list.length > PAGE_SIZE) {
        grid.appendChild(h('div', { class: 'grid-loader', text: 'You have seen all ' + list.length + ' titles' }));
      }
    }

    /** One genre section: header (label + count + View more) + strip or full grid. */
    function renderGenreRow(group) {
      var expanded = st.expandedGenres.indexOf(group.cat.id) !== -1;
      var total = group.movies.length;
      var hasMore = total > STRIP_SIZE;

      var row = h('div', { class: 'genre-row' });

      var header = h('div', { class: 'genre-row-header' },
        h('span', { class: 'genre-row-title' },
          h('span', { class: 'genre-row-dot', style: 'background:' + getGenreColor(group.cat.id) }),
          h('span', { class: 'genre-row-name', text: group.cat.label }),
          h('span', { class: 'genre-row-count', text: total + (total === 1 ? ' title' : ' titles') })
        )
      );
      if (hasMore) {
        header.appendChild(h('button', {
          type: 'button',
          class: 'btn btn-sm ' + (expanded ? 'btn-secondary' : 'btn-primary'),
          onclick: function () {
            toggleGenreExpand(kind, group.cat.id);
            updateMovieGrid();
          },
          text: expanded ? 'Show less' : 'View more (' + (total - STRIP_SIZE) + ')'
        }));
      }
      row.appendChild(header);

      if (expanded) {
        var fullGrid = h('div', { class: 'genre-grid' });
        group.movies.forEach(function (movie) { fullGrid.appendChild(makeMovieCard(movie, false)); });
        row.appendChild(fullGrid);
      } else {
        var strip = h('div', { class: 'genre-strip' });
        group.movies.slice(0, STRIP_SIZE).forEach(function (movie) { strip.appendChild(makeMovieCard(movie, true)); });
        row.appendChild(strip);
      }

      grid.appendChild(row);
    }

    /** Genre-segregated browse: one horizontal row per genre (spec of the title). */
    function renderGenreRows() {
      var groups = genreGroups(kind);
      if (groups.length === 0) {
        grid.appendChild(emptyState('No titles available yet.'));
        return;
      }
      groups.forEach(function (group) { renderGenreRow(group); });
    }

    function updateMovieGrid() {
      clear(grid);
      var list = getFilteredMovies(kind);
      var countEl = gridHeader.querySelector('.text-supporting');

      var filteredMode = !!(
        st.search.trim() || st.genreFilter !== null || st.languageFilter !== null
      );

      if (countEl) {
        countEl.textContent = filteredMode
          ? (list.length > PAGE_SIZE
            ? 'Showing ' + Math.min(visibleCount, list.length) + ' of ' + list.length + ' matches'
            : plural(list.length, 'match'))
          : plural(catalogFor(kind).length, 'title');
      }

      grid.classList.remove('grid-movies');
      grid.classList.remove('genre-rows');
      if (filteredMode) {
        grid.classList.add('grid-movies');
        renderFlatGrid(list);
      } else {
        grid.classList.add('genre-rows');
        renderGenreRows();
      }
    }

    function updateRatingDrawer() {
      clear(ratingDrawer);
      if (st.selectedId === null) {
        ratingDrawer.classList.remove('is-open');
        return;
      }
      ratingDrawer.classList.add('is-open');
      var movie = catById(kind, st.selectedId);
      if (!movie) return;

      var cat = getCategory(movie.category);
      var lang = getLanguage(movie.language);

      ratingDrawer.appendChild(h('div', { class: 'rating-drawer-inner' },
        h('div', { class: 'row gap-3 align-center space-between' },
          h('div', { class: 'stack gap-0' },
            h('h4', { class: 'h4', text: movie.moviename }),
            h('span', { class: 'text-supporting', text: cat.label + ' \u00B7 ' + lang.label + (movie.year ? ' \u00B7 ' + movie.year : '') })
          ),
          h('button', {
            type: 'button',
            class: 'btn-close',
            'aria-label': 'Close',
            onclick: function () { st.selectedId = null; st.pendingRating = 0; updateMovieGrid(); updateRatingDrawer(); },
            text: '\u2715'
          })
        ),
        buildMovieDetail(movie),
        otherRatingsBlock(movie.id),
        h('div', { class: 'rating-drawer-stars' },
          starRating(st.pendingRating, function (next) {
            st.pendingRating = next;
            updateRatingDrawer();
          }, 'lg')
        ),
        h('div', { class: 'row gap-2' },
          h('button', {
            type: 'button',
            class: 'btn btn-primary',
            onclick: function () {
              if (st.pendingRating < 1 || st.pendingRating > 5) {
                flash('Give 1\u20135 stars first.');
                return;
              }
              var chosen = st.pendingRating;
              var mv = catById(kind, st.selectedId);
              rate(st.selectedId, chosen);
              if (!activeUser()) return;
              st.pendingRating = chosen;
              flash(user.name + ' rated ' + (mv ? mv.moviename : 'this title') + ' ' + chosen + '\u2605');
              updateMovieGrid();
              updateRatingDrawer();
            },
            text: 'Submit'
          }),
          h('button', {
            type: 'button',
            class: 'btn btn-secondary',
            onclick: function () { st.selectedId = null; st.pendingRating = 0; updateMovieGrid(); updateRatingDrawer(); },
            text: 'Cancel'
          })
        )
      ));
      try { ratingDrawer.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch (e) {}
    }

    function flash(message) {
      st.flash = message;
      if (st.flashTimer) window.clearTimeout(st.flashTimer);
      st.flashTimer = window.setTimeout(function () {
        st.flash = null;
        st.flashTimer = null;
        renderPanel();
      }, 2600);
      render();
    }

    root.appendChild(gridSection);

    var node = section(root);
    updateMovieGrid();
    updateRatingDrawer();
    return node;
  }

  function getFilteredMovies(kind) {
    var st = browseUi(kind);
    var cat = catalogFor(kind);
    var q = st.search.trim().toLowerCase();
    return cat.filter(function (m) {
      // Search filter
      if (q) {
        var cat = getCategory(m.category);
        var lang = getLanguage(m.language);
        var matchName = m.moviename.toLowerCase().indexOf(q) !== -1;
        var matchGenre = cat.label.toLowerCase().indexOf(q) !== -1;
        var matchLang = lang.label.toLowerCase().indexOf(q) !== -1;
        if (!matchName && !matchGenre && !matchLang) return false;
      }
      // Genre filter
      if (st.genreFilter !== null && m.category !== st.genreFilter) return false;
      // Language filter
      if (st.languageFilter !== null && m.language !== st.languageFilter) return false;
      return true;
    });
  }

  /** Movies of one catalog split into CATEGORIES-order groups (skips empty genres). */
  function genreGroups(kind) {
    var grouped = {};
    catalogFor(kind).forEach(function (m) {
      (grouped[m.category] = grouped[m.category] || []).push(m);
    });
    return CATEGORIES
      .filter(function (c) { return grouped[c.id] && grouped[c.id].length; })
      .map(function (c) {
        var movies = grouped[c.id].slice().sort(function (a, b) {
          var aAvg = movieAverageRating(a.id);
          var bAvg = movieAverageRating(b.id);
          if (bAvg !== aAvg) return bAvg - aAvg;
          return (b.tmdbRating || 0) - (a.tmdbRating || 0);
        });
        return { cat: c, movies: movies };
      });
  }

  /** Toggle a genre row between compact strip and full grid. */
  function toggleGenreExpand(kind, catId) {
    var st = browseUi(kind);
    var idx = st.expandedGenres.indexOf(catId);
    if (idx === -1) st.expandedGenres.push(catId);
    else st.expandedGenres.splice(idx, 1);
  }

  function getGenreColor(categoryId) {
    var colors = [
      'linear-gradient(135deg, #1a1a2e, #16213e)',   // Sci-Fi
      'linear-gradient(135deg, #8B0000, #4a0000)',    // Action
      'linear-gradient(135deg, #2d2d2d, #1a1a1a)',    // Thriller
      'linear-gradient(135deg, #4a3728, #2d1f14)',    // Drama
      'linear-gradient(135deg, #1a1a1a, #0d0d0d)',    // Crime
      'linear-gradient(135deg, #3d2b1f, #1f150d)',    // Biography
      'linear-gradient(135deg, #0d0d0d, #1a0a0a)',    // Horror
      'linear-gradient(135deg, #4a1942, #2d1028)',    // Romance
      'linear-gradient(135deg, #1a3a2a, #0d1f15)',    // Adventure
      'linear-gradient(135deg, #1a1a3e, #0d0d2e)',    // Superhero
      'linear-gradient(135deg, #3e2a1a, #2e1d0d)',    // Comedy
      'linear-gradient(135deg, #2a1a3e, #1d0d2e)'     // Animation
    ];
    return colors[categoryId] || colors[0];
  }

  /** Poster background: real image layered over the genre gradient (gradient shows if image fails). */
  function posterStyle(movie) {
    var gradient = getGenreColor(movie.category);
    return movie.poster_url
      ? 'background:url(\'' + movie.poster_url + '\') center/cover no-repeat,' + gradient
      : 'background:' + gradient;
  }

  function factRow(label, value) {
    return h('p', { class: 'movie-detail-fact', text: label + ': ' + value });
  }

  function buildMovieDetail(movie) {
    var details = window.FilmphileData.getMovieDetails(movie);
    var cat = getCategory(movie.category);
    var lang = getLanguage(movie.language);

    var description = movie.synopsis || details.description;
    var director = movie.director || details.director;
    var leads = (movie.leads && movie.leads.length) ? movie.leads : details.leads;

    var info = h('div', { class: 'stack gap-1' },
      h('span', { class: 'movie-detail-meta', text:
        cat.label + ' \u00B7 ' + lang.label + (movie.year ? ' \u00B7 ' + movie.year : '')
      }),
      h('p', { class: 'movie-detail-desc', text: description })
    );

    if (director) info.appendChild(factRow('Director', director));
    if (leads && leads.length) info.appendChild(factRow('Lead actors', leads.join(', ')));
    if (movie.seasons && movie.seasons.length) info.appendChild(buildSeasonsBlock(movie));

    return h('div', { class: 'movie-detail' },
      h('div', { class: 'movie-detail-poster', style: posterStyle(movie) },
        movie.poster_url ? null : h('span', { class: 'movie-detail-char', text: movie.moviename.charAt(0) })
      ),
      info
    );
  }

  function buildSeasonsBlock(movie) {
    var seasons = movie.seasons;
    var totalEpisodes = movie.totalEpisodes != null
      ? movie.totalEpisodes
      : seasons.reduce(function (sum, s) { return sum + s.episodes; }, 0);
    var header = movie.totalSeasons != null
      ? movie.totalSeasons + ' seasons \u00B7 ' + totalEpisodes + ' episodes'
      : seasons.length + ' seasons \u00B7 ' + totalEpisodes + ' episodes';

    var chips = h('div', { class: 'row gap-1 movie-detail-seasons' });
    seasons.forEach(function (s) {
      chips.appendChild(h('span', { class: 'season-chip', text: 'S' + s.season + ' \u00B7 ' + s.episodes }));
    });

    return h('div', { class: 'stack gap-1' },
      factRow('Seasons', header),
      chips
    );
  }

  // --- Hero Carousel ---

  function buildHeroCarousel(trending, ratingByMovieId, user, st, flashFn) {
    var heroWrap = h('div', { class: 'hero-carousel' });

    var slides = h('div', { class: 'hero-slides', id: 'hero-slides' });
    var topMovies = trending.slice(0, 5);

    function openHeroDetail(movie) {
      st.selectedId = movie.id;
      st.pendingRating = 0;
      var drawer = document.getElementById('rating-drawer');
      if (!drawer) return;
      var slideCat = getCategory(movie.category);
      clear(drawer);
      drawer.classList.add('is-open');
      drawer.appendChild(h('div', { class: 'rating-drawer-inner' },
        h('div', { class: 'row gap-3 align-center space-between' },
          h('div', { class: 'stack gap-0' },
            h('h4', { class: 'h4', text: movie.moviename }),
            h('span', { class: 'text-supporting', text: slideCat.label })
          ),
          h('button', {
            type: 'button', class: 'btn-close', 'aria-label': 'Close',
            onclick: function () { st.selectedId = null; st.pendingRating = 0; renderPanel(); },
            text: '\u2715'
          })
        ),
        buildMovieDetail(movie),
        otherRatingsBlock(movie.id),
        h('div', { class: 'rating-drawer-stars' },
          starRating(0, function (next) {
            st.pendingRating = next;
            renderPanel();
          }, 'lg')
        ),
        h('div', { class: 'row gap-2' },
          h('button', {
            type: 'button', class: 'btn btn-primary',
            onclick: function () {
              if (st.pendingRating < 1) { flashFn('Give 1\u20135 stars first.'); return; }
              rate(movie.id, st.pendingRating);
              if (!activeUser()) return;
              flashFn(user.name + ' rated ' + movie.moviename + ' ' + st.pendingRating + '\u2605');
              st.selectedId = null;
              st.pendingRating = 0;
              renderPanel();
            },
            text: 'Submit'
          }),
          h('button', {
            type: 'button', class: 'btn btn-secondary',
            onclick: function () { st.selectedId = null; st.pendingRating = 0; renderPanel(); },
            text: 'Cancel'
          })
        )
      ));
      try { drawer.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch (e) {}
    }

    topMovies.forEach(function (movie, index) {
      var cat = getCategory(movie.category);
      var lang = getLanguage(movie.language);
      var rated = ratingByMovieId[movie.id] || 0;
      var avg = movieAverageRating(movie.id);

      var slide = h('div', {
        class: 'hero-slide' + (index === 0 ? ' is-active' : ''),
        onclick: function () { openHeroDetail(movie); }
      },
        h('div', { class: 'hero-slide-bg', style: posterStyle(movie) }),
        h('div', { class: 'hero-slide-content' },
          h('div', { class: 'hero-slide-badge', text: 'Trending #' + (index + 1) }),
          h('h2', { class: 'hero-slide-title', text: movie.moviename }),
          h('div', { class: 'hero-slide-meta' },
            h('span', { class: 'hero-slide-tag', text: cat.label }),
            h('span', { class: 'hero-slide-tag', text: lang.label }),
            movie.year ? h('span', { class: 'hero-slide-tag', text: String(movie.year) }) : null,
            avg > 0 ? h('span', { class: 'hero-slide-tag hero-slide-tag-rating', text: '\u2605 ' + avg.toFixed(1) + ' community' }) : null
          ),
          h('div', { class: 'hero-slide-actions' },
            rated > 0
              ? h('span', { class: 'hero-slide-rated', text: 'You rated: ' + rated + '\u2605' })
              : h('button', {
                  type: 'button',
                  class: 'btn btn-primary',
                  onclick: function (e) {
                    if (e && e.stopPropagation) e.stopPropagation();
                    openHeroDetail(movie);
                  },
                  text: 'Rate this title'
                })
          )
        )
      );
      slides.appendChild(slide);
    });

    heroWrap.appendChild(slides);

    // Navigation dots
    var dots = h('div', { class: 'hero-dots' });
    topMovies.forEach(function (_, i) {
      dots.appendChild(h('button', {
        type: 'button',
        class: 'hero-dot' + (i === 0 ? ' is-active' : ''),
        'aria-label': 'Go to slide ' + (i + 1),
        onclick: function () { goToSlide(i); }
      }));
    });
    heroWrap.appendChild(dots);

    // Nav arrows
    heroWrap.appendChild(h('button', {
      type: 'button',
      class: 'hero-arrow hero-arrow-left',
      'aria-label': 'Previous',
      onclick: function () {
        var total = topMovies.length;
        goToSlide((st.carouselIndex - 1 + total) % total);
      },
      text: '\u2039'
    }));
    heroWrap.appendChild(h('button', {
      type: 'button',
      class: 'hero-arrow hero-arrow-right',
      'aria-label': 'Next',
      onclick: function () {
        var total = topMovies.length;
        goToSlide((st.carouselIndex + 1) % total);
      },
      text: '\u203A'
    }));

    // Auto-advance
    var autoTimer = null;
    function startAuto() {
      stopAuto();
      autoTimer = window.setInterval(function () {
        var total = topMovies.length;
        goToSlide((st.carouselIndex + 1) % total);
      }, 5000);
    }
    function stopAuto() {
      if (autoTimer) { window.clearInterval(autoTimer); autoTimer = null; }
    }

    function goToSlide(index) {
      st.carouselIndex = index;
      var allSlides = slides.querySelectorAll('.hero-slide');
      allSlides.forEach(function (s, i) {
        s.classList.toggle('is-active', i === index);
      });
      var allDots = dots.querySelectorAll('.hero-dot');
      allDots.forEach(function (d, i) {
        d.classList.toggle('is-active', i === index);
      });
      startAuto();
    }

    startAuto();

    // Pause on hover
    heroWrap.addEventListener('mouseenter', stopAuto);
    heroWrap.addEventListener('mouseleave', startAuto);

    return heroWrap;
  }

  // ---------------------------------------------------------------------------
  // Panel 2 — Personalised picks (rebuilt)
  // ---------------------------------------------------------------------------

  function suggestionsPanel() {
    var user = activeUser();
    var result = currentResult();
    var root = h('div', { class: 'stack gap-4' });

    root.appendChild(h('div', { class: 'stack gap-1' },
      h('h2', { class: 'h2', text: user ? 'Personalised picks for ' + user.name : 'Personalised picks' }),
      h('p', {
        class: 'text-secondary',
        text: user
          ? (result.unlocked
            ? 'Genre engine is active \u2014 here are titles matched to your taste profile.'
            : 'Rate any movie ' + TOP + '\u2605 or higher to unlock same-genre recommendations.')
          : 'Log in to unlock personalised recommendations based on your ratings.'
      })
    ));

    root.appendChild(buildDailyPickCard());

    if (!user) {
      root.appendChild(card('muted', h('div', { class: 'stack gap-3' },
        h('p', { class: 'text-secondary', text: 'Your suggestions appear here once you are logged in and have rated a few titles.' }),
        h('div', { class: 'row gap-2' },
          h('button', {
            type: 'button',
            class: 'btn btn-primary',
            onclick: function () { state.showLoginModal = true; render(); },
            text: 'Login'
          }),
          h('button', {
            type: 'button',
            class: 'btn btn-secondary',
            onclick: function () { state.choice = 1; navigateTo(1); },
            text: 'Browse movies'
          })
        )
      )));
      return section(root);
    }

    if (result.liked.length > 0) {
      var topPick = result.liked[0];
      var topCat = getCategory(topPick.movie.category);
      root.appendChild(card('blue', h('div', { class: 'stack gap-2' },
        h('span', { class: 'label', text: 'Your top rated' }),
        h('h3', { class: 'h3', text: topPick.movie.moviename }),
        h('span', { class: 'text-secondary', text: topCat.label + (topPick.movie.year ? ' \u00B7 ' + topPick.movie.year : '') + ' \u00B7 ' + topPick.rating + '\u2605' }),
        result.liked.length > 1
          ? h('span', { class: 'text-secondary', text: 'Also loved: ' + result.liked.slice(1, 3).map(function (l) { return l.movie.moviename; }).join(', ') })
          : null
      )));

      root.appendChild(personalPicksSection());
    }

    if (!result.unlocked) {
      root.appendChild(h('div', { class: 'stack gap-2' },
        h('h3', { class: 'h3', text: 'Trending now' }),
        h('p', { class: 'text-secondary', text: 'Rate a few movies to get personalised picks.' }),
        h('div', { class: 'grid grid-recs' }, trendingMovies().slice(0, 6).map(function (movie) {
          var cat = getCategory(movie.category);
          return h('div', { class: 'card card-plain' },
            h('div', { class: 'stack gap-1' },
              h('h4', { class: 'h4', text: movie.moviename }),
              h('span', { class: 'text-supporting', text: cat.label + (movie.year ? ' \u00B7 ' + movie.year : '') }),
              starRating(0, function (rating) { rate(movie.id, rating); render(); }, 'sm')
            )
          );
        }))
      ));
      return section(root);
    }

    return section(root);
  }

  /**
   * "Today's pick" — a single featured title picked by tools/daily-pick.py
   * (Python, seeded by the calendar date) and served from /api/daily-pick.
   * Rotates once a day; shown at the top of the Personalised picks page.
   */
  function buildDailyPickCard() {
    var pick = state.dailyPick;
    if (!pick || pick.catalogId === null || pick.catalogId === undefined) return null;
    var found = findTitleById(pick.catalogId);
    if (!found) return null;
    var movie = found.item;
    var cat = getCategory(movie.category);
    var lang = getLanguage(movie.language);
    var kindObj = contentKind(found.kind);

    var rated = 0;
    var mine = myRatings();
    for (var i = 0; i < mine.length; i++) {
      if (mine[i].movieId === movie.id) { rated = mine[i].rating; break; }
    }
    var avg = movieAverageRating(movie.id);

    var posterEl = h('div', { class: 'today-pick-poster', style: posterStyle(movie) });
    if (!movie.poster_url) {
      posterEl.appendChild(h('span', { class: 'movie-detail-char', text: movie.moviename ? movie.moviename.charAt(0) : '?' }));
    }

    return card('blue', h('div', { class: 'today-pick' },
      posterEl,
      h('div', { class: 'stack gap-2 today-pick-body' },
        h('div', { class: 'row gap-2 align-center wrap' },
          h('span', { class: 'label today-pick-label', text: 'Today\u2019s pick' }),
          h('span', { class: 'text-supporting', text: 'A curated title \u2014 changes every day' })
        ),
        h('div', { class: 'row gap-1 align-center wrap' },
          badge(kindObj.label, 'accent'),
          badge(cat.label, 'neutral'),
          movie.year ? token(String(movie.year)) : null,
          lang && lang.label && lang.label !== 'English' ? token(lang.label) : null
        ),
        h('h3', { class: 'h3', text: movie.moviename }),
        h('div', { class: 'row gap-2 align-center wrap' },
          h('span', { class: 'text-strong', text: avg > 0 ? 'Community ' + avg.toFixed(1) + '\u2605' : 'Community rating loading' }),
          (pick.ratingCount > 0) ? h('span', { class: 'text-supporting', text: plural(pick.ratingCount, 'review') }) : null,
          pick.imdbScore ? h('span', { class: 'text-supporting', text: 'IMDb ' + pick.imdbScore.toFixed(1) }) : null
        ),
        pick.reason ? h('p', { class: 'text-secondary today-pick-reason', text: pick.reason }) : null,
        h('div', { class: 'row gap-2 align-center' },
          h('span', { class: 'text-supporting', text: rated > 0 ? 'Your rating: ' + rated + '\u2605' : 'Rate this pick:' }),
          starRating(rated, function (next) { rate(movie.id, next); render(); }, 'sm')
        )
      )
    ));
  }

  /**
   * Content-based picks (scikit-learn TF-IDF via SIMILARITY) — the former
   * profile "More like what you liked" section, now living on the Personalised
   * picks page. Titles rated 4★+ seed the list; similar titles come back.
   */
  function personalPicksSection() {
    var picks = profilePicks();
    var container = h('div', { class: 'stack gap-3' });

    container.appendChild(h('div', { class: 'stack gap-1' },
      h('h3', { class: 'h3', text: 'More of what you rate highly' }),
      h('span', {
        class: 'text-secondary',
        text: picks.unlocked && picks.picks.length > 0
          ? 'Content-aware picks from the scikit-learn similarity graph, built on the ' + picks.liked.length + ' ' + (picks.liked.length === 1 ? 'title' : 'titles') + ' you rated 4\u2605 or higher.'
          : 'Rate movies, web series, TV shows, or anime 4\u2605 or higher while browsing to unlock content-aware picks.'
      })
    ));

    if (picks.unlocked && picks.picks.length > 0) {
      var kindCounts = { all: picks.picks.length, movie: 0, series: 0, tv: 0, anime: 0 };
      picks.picks.forEach(function (p) {
        if (kindCounts[p.kind] !== undefined) kindCounts[p.kind]++;
      });

      var kindsAvailable = ['all'];
      if (kindCounts.movie > 0) kindsAvailable.push('movie');
      if (kindCounts.series > 0) kindsAvailable.push('series');
      if (kindCounts.tv > 0) kindsAvailable.push('tv');
      if (kindCounts.anime > 0) kindsAvailable.push('anime');

      if (kindsAvailable.length > 2) {
        var switcher = h('div', { class: 'content-switcher', role: 'tablist', 'aria-label': 'Pick filter' });
        kindsAvailable.forEach(function (k) {
          var label = k === 'all' ? 'All (' + kindCounts.all + ')' :
                      k === 'movie' ? 'Movies (' + kindCounts.movie + ')' :
                      k === 'series' ? 'Web Series (' + kindCounts.series + ')' :
                      k === 'tv' ? 'TV Shows (' + kindCounts.tv + ')' :
                      'Anime (' + kindCounts.anime + ')';
          var active = (ui.suggestions.pickFilter || 'all') === k;
          switcher.appendChild(h('button', {
            type: 'button',
            class: 'content-switch' + (active ? ' is-active' : ''),
            onclick: function () {
              ui.suggestions.pickFilter = k;
              renderPanel();
            },
            text: label
          }));
        });
        container.appendChild(switcher);
      }

      var filteredPicks = picks.picks.filter(function (p) {
        if (ui.suggestions.pickFilter && ui.suggestions.pickFilter !== 'all') {
          return p.kind === ui.suggestions.pickFilter;
        }
        return true;
      });

      var grid = h('div', { class: 'grid grid-recs' });
      filteredPicks.forEach(function (pick) {
        grid.appendChild(profileRecCard(pick));
      });
      container.appendChild(grid);
    } else {
      container.appendChild(emptyState('No picks yet \u2014 try rating a few more titles 4\u2605 or higher.'));
    }

    return container;
  }

  // ---------------------------------------------------------------------------
  // Panel 3 — Top ratings of movies
  // ---------------------------------------------------------------------------

  function topRatedPanel() {
    var root = h('div', { class: 'stack gap-4' });
    var top = TOPLISTS;

    root.appendChild(h('div', { class: 'stack gap-1' },
      h('h2', { class: 'h2', text: 'Top ratings of movies' }),
      h('p', {
        class: 'text-secondary',
        text: 'Movies, web series, TV shows and anime ranked by IMDb score.'
      })
    ));

    if (top && (top.movies.length > 0 || top.series.length > 0 || top.tv.length > 0 || top.anime.length > 0)) {
      root.appendChild(buildTopSwitcher());
      if (ui.top.kind === 'series') {
        root.appendChild(topRankList(
          'Best Web Series',
          'Streaming originals from the curated IMDb snapshot, sorted by score.',
          top.series,
          'No web series in the chart yet.'
        ));
      } else if (ui.top.kind === 'tv') {
        root.appendChild(topRankList(
          'Best TV Shows',
          'Broadcast, cable and anime from the curated IMDb snapshot, sorted by score.',
          top.tv,
          'No TV shows in the chart yet.'
        ));
      } else if (ui.top.kind === 'anime') {
        root.appendChild(topRankList(
          'Best Anime',
          'Top-rated anime series and films from the curated IMDb snapshot, sorted by score.',
          top.anime,
          'No anime in the chart yet.'
        ));
      } else {
        root.appendChild(topRankList(
          'Top movies',
          'IMDb Top 250 \u2014 matched to the catalog and sorted by score.',
          top.movies,
          top.movies.length === 0
            ? 'No titles matched the catalog yet \u2014 the chart may still be loading, refresh in a moment.'
            : null
        ));
      }
    } else {
      root.appendChild(h('p', { class: 'text-secondary', text: 'Top lists are still loading \u2014 refresh in a moment if this persists.' }));
    }

    return section(root);
  }

  /** Category switcher for the top-rated panel (Movies / Web Series / TV Shows / Anime). */
  function buildTopSwitcher() {
    var wrap = h('div', { class: 'content-switcher', role: 'tablist', 'aria-label': 'Top list category' });
    [
      { key: 'movie', label: 'Movies' },
      { key: 'series', label: 'Web Series' },
      { key: 'tv', label: 'TV Shows' },
      { key: 'anime', label: 'Anime' }
    ].forEach(function (k) {
      var active = ui.top.kind === k.key;
      wrap.appendChild(h('button', {
        type: 'button',
        class: 'content-switch' + (active ? ' is-active' : ''),
        role: 'tab',
        'aria-selected': active ? 'true' : 'false',
        onclick: function () {
          if (ui.top.kind === k.key) return;
          ui.top.kind = k.key;
          navigateTo(3, k.key);
        },
        text: k.label
      }));
    });
    return wrap;
  }

  /** A single merged scored list — rows carry poster, genre and API info. */
  function topRankList(title, subtitle, entries, emptyNote) {
    var body;
    if (!entries || entries.length === 0) {
      body = h('p', { class: 'text-secondary', text: emptyNote || 'Nothing to show yet.' });
    } else {
      var list = h('ol', { class: 'list list-numbered' });
      entries.forEach(function (entry) { list.appendChild(topRankItem(entry)); });
      body = list;
    }
    return h('div', { class: 'stack gap-3' },
      h('div', { class: 'stack gap-1' },
        h('h3', { class: 'h3', text: title }),
        h('span', { class: 'text-supporting', text: subtitle })
      ),
      body
    );
  }

  function clip(text, max) {
    var t = String(text || '').replace(/\s+/g, ' ').trim();
    if (t.length <= max) return t;
    var cut = t.slice(0, max);
    var sp = cut.lastIndexOf(' ');
    return (sp > 40 ? cut.slice(0, sp) : cut) + '\u2026';
  }

  function topRankItem(entry) {
    var meta = [];
    if (entry.year) meta.push(String(entry.year));
    var cat = (entry.category !== null && entry.category !== undefined) ? getCategory(entry.category) : null;
    if (cat && cat.label !== 'Unknown' && cat.id !== -1) meta.push(cat.label);
    if (entry.language) {
      var lang = getLanguage(entry.language);
      if (lang && lang.label) meta.push(lang.label);
    }
    if (entry.platform) meta.push(entry.platform);
    if (entry.network) meta.push(entry.network);
    if (entry.director) meta.push(entry.director);

    var poster = h('span', {
      class: 'top-item-poster',
      style: posterStyle({ poster_url: entry.poster || null, category: entry.category, moviename: entry.title })
    }, entry.poster
      ? null
      : h('span', { class: 'top-item-poster-char', text: entry.title.charAt(0).toUpperCase() })
    );

    var info = null;
    if (entry.synopsis) {
      info = h('span', { class: 'top-item-synopsis', text: clip(entry.synopsis, 210) });
    } else if (entry.seasons && entry.seasons.length) {
      var totalEps = entry.totalEpisodes != null
        ? entry.totalEpisodes
        : entry.seasons.reduce(function (sum, s) { return sum + s.episodes; }, 0);
      info = h('span', { class: 'text-supporting',
        text: (entry.totalSeasons != null ? entry.totalSeasons : entry.seasons.length) +
          ' seasons \u00B7 ' + totalEps + ' episodes' });
    }

    var badges = h('span', { class: 'row gap-1 top-item-scores' });
    if (entry.imdbScore != null && entry.imdbScore > 0) {
      badges.appendChild(h('span', { class: 'score-badge score-imdb', text: entry.imdbScore.toFixed(1) }));
    }

    return h('li', { class: 'list-item top-item' },
      poster,
      h('span', { class: 'stack gap-0 top-item-body' },
        h('span', { class: 'list-item-label', text: entry.title }),
        h('span', { class: 'text-supporting', text: meta.join(' \u00B7 ') || '\u00B7' }),
        info
      ),
      badges
    );
  }

  // ---------------------------------------------------------------------------
  // Panel 4 — Profile / login (replaces "Add a viewer")
  // ---------------------------------------------------------------------------

  function profileRecCard(pick) {
    var movie = pick.movie;
    var kind = pick.kind || 'movie';
    var cat = getCategory(movie.category);
    var lang = getLanguage(movie.language);
    var kindObj = contentKind(kind);

    var DataRef = window.FilmphileData;
    var details = DataRef ? DataRef.getMovieDetails(movie) : { description: '', director: null, leads: [] };
    var description = movie.synopsis || details.description || '';
    var director = movie.director || details.director;
    var leads = (movie.leads && movie.leads.length) ? movie.leads : details.leads;

    var rated = 0;
    var my = myRatings();
    for (var i = 0; i < my.length; i++) {
      if (my[i].movieId === movie.id) { rated = my[i].rating; break; }
    }

    var cardEl = h('div', { class: 'card profile-rec-card' });

    var posterEl = h('div', { class: 'profile-rec-poster', style: posterStyle(movie) });
    if (!movie.poster_url) {
      posterEl.appendChild(h('span', { class: 'movie-detail-char', text: movie.moviename ? movie.moviename.charAt(0) : '?' }));
    }

    var badges = h('div', { class: 'row gap-1 align-center wrap' },
      badge(kindObj.label, 'accent'),
      badge(cat.label, 'neutral'),
      movie.year ? token(String(movie.year)) : null,
      lang && lang.label && lang.label !== 'English' ? token(lang.label) : null
    );

    var topRow = h('div', { class: 'profile-rec-header' },
      posterEl,
      h('div', { class: 'stack gap-1 profile-rec-headinfo' },
        badges,
        h('h4', { class: 'h4 profile-rec-title', text: movie.moviename }),
        h('div', { class: 'row gap-2 align-center' },
          h('span', { class: 'profile-rec-match', text: pick.match + '% Match' }),
          progressBar(pick.match, 100)
        )
      )
    );
    cardEl.appendChild(topRow);

    var body = h('div', { class: 'stack gap-1 profile-rec-body' });
    if (description) {
      body.appendChild(h('p', { class: 'profile-rec-desc', text: description }));
    }

    if (director) {
      body.appendChild(factRow('Director', director));
    }
    if (leads && leads.length) {
      body.appendChild(factRow('Leads', Array.isArray(leads) ? leads.join(', ') : String(leads)));
    }

    if (movie.seasons && movie.seasons.length) {
      var totalEps = movie.totalEpisodes != null
        ? movie.totalEpisodes
        : movie.seasons.reduce(function (sum, s) { return sum + s.episodes; }, 0);
      var seasonsText = (movie.totalSeasons != null ? movie.totalSeasons : movie.seasons.length) +
        ' seasons \u00B7 ' + totalEps + ' episodes';
      body.appendChild(factRow('Format', seasonsText));
    } else if ((kind === 'series' || kind === 'tv') && (movie.totalSeasons || movie.totalEpisodes)) {
      var fmt = (movie.totalSeasons ? movie.totalSeasons + ' seasons' : '') +
        (movie.totalSeasons && movie.totalEpisodes ? ' \u00B7 ' : '') +
        (movie.totalEpisodes ? movie.totalEpisodes + ' episodes' : '');
      if (fmt) body.appendChild(factRow('Format', fmt));
    }

    cardEl.appendChild(body);

    var footer = h('div', { class: 'row gap-2 align-center space-between profile-rec-footer' },
      h('span', { class: 'text-supporting', text: rated > 0 ? 'Your rating: ' + rated + '\u2605' : 'Rate this title:' }),
      starRating(rated, function (next) {
        rate(movie.id, next);
        render();
      }, 'sm')
    );
    cardEl.appendChild(footer);

    return cardEl;
  }

  function profilePanel() {
    var user = activeUser();
    var root = h('div', { class: 'stack gap-4' });

    root.appendChild(h('div', { class: 'stack gap-1' },
      h('h2', { class: 'h2', text: 'Profile' }),
      h('p', {
        class: 'text-secondary',
        text: 'Manage your ratings and reviews; personalised picks live on the Personalised picks page.'
      })
    ));

    if (!user) {
      root.appendChild(card('plain', h('div', { class: 'stack gap-3' },
        h('div', { class: 'stack gap-1' },
          h('span', { class: 'label', text: 'Not logged in' }),
          h('span', { class: 'text-supporting', text: 'Browse freely, but log in when you want to submit a rating.' })
        ),
        h('button', {
          type: 'button',
          class: 'btn btn-primary',
          onclick: function () { authOpen('login'); render(); },
          text: 'Login'
        })
      )));
      return section(root);
    }

    var userRatings = state.ratings.filter(function (r) {
      return r.userId === user.id && r.rating > 0;
    });

    // -------------------------------------------------------------------------
    // Section 1: Profile Overview (User name section with basic theme container)
    // -------------------------------------------------------------------------
    var profileCardActions = h('div', { class: 'row gap-2 wrap align-center' },
      h('button', {
        type: 'button',
        class: 'btn ' + (ui.profile.showReviews ? 'btn-primary' : 'btn-secondary'),
        onclick: function () {
          ui.profile.showReviews = !ui.profile.showReviews;
          renderPanel();
        },
        text: ui.profile.showReviews ? 'Hide your reviews' : 'View your reviews (' + userRatings.length + ')'
      }),
      h('button', {
        type: 'button',
        class: 'btn btn-secondary',
        onclick: logoutUser,
        text: 'Logout'
      })
    );

    root.appendChild(card('plain', h('div', { class: 'stack gap-3' },
      h('div', { class: 'stack gap-1' },
        h('span', { class: 'label', text: 'Logged in as' }),
        h('span', { class: 'h3', text: user.name }),
        user.email ? h('span', { class: 'text-supporting', text: user.email }) : null,
        h('span', { class: 'text-supporting', text: plural(userRatings.length, 'rating') + ' submitted' })
      ),
      profileCardActions
    )));

    // -------------------------------------------------------------------------
    // Section 2: Your Reviews
    // -------------------------------------------------------------------------
    if (ui.profile.showReviews) {
      var reviewsInner = h('div', { class: 'stack gap-3' },
        h('div', { class: 'row gap-2 align-center space-between' },
          h('h3', { class: 'h3', text: 'Your reviews (' + userRatings.length + ')' }),
          userRatings.length > 0 ? h('span', { class: 'text-supporting', text: 'Ratings can be edited or removed' }) : null
        )
      );

      if (userRatings.length === 0) {
        reviewsInner.appendChild(
          h('p', { class: 'text-secondary', text: 'You have not rated anything yet. Rate movies, web series, TV shows, or anime while browsing to see them here.' })
        );
      } else {
        var ul = h('ul', { class: 'list' });
        userRatings.forEach(function (r) {
          var found = findTitleById(r.movieId);
          var titleName = found ? found.item.moviename : 'Title #' + r.movieId;
          var kindLabel = found ? contentKind(found.kind).label : 'Title';
          var catLabel = found ? getCategory(found.item.category).label : '';
          var yearStr = found && found.item.year ? ' \u00B7 ' + found.item.year : '';
          var subtitle = kindLabel + (catLabel ? ' \u00B7 ' + catLabel : '') + yearStr;

          ul.appendChild(listItem(
            titleName,
            subtitle,
            [
              starRating(r.rating, function (next) { rate(r.movieId, next); render(); }, 'sm'),
              h('button', {
                type: 'button',
                class: 'btn btn-ghost btn-sm',
                onclick: function () { rate(r.movieId, 0); render(); },
                text: 'Remove'
              })
            ]
          ));
        });
        reviewsInner.appendChild(ul);
      }

      root.appendChild(reviewsInner);
    }

    return section(root);
  }

  // ---------------------------------------------------------------------------
  // Auth modal — register (username + email) or log in (email), then prove
  // ownership with a 6-digit code sent to that email. A verified email can
  // only ever claim one account.
  // ---------------------------------------------------------------------------

  function buildLoginModal() {
    if (!state.showLoginModal) return null;
    var a = state.auth;
    var isRegister = a.mode === 'register';

    var overlay = h('div', {
      class: 'login-modal-overlay',
      onclick: function (e) {
        if (e.target === overlay) {
          authClose();
          render();
        }
      }
    });

    var stack = h('div', { class: 'stack gap-3' });

    stack.appendChild(h('div', { class: 'auth-tabs' },
      h('button', {
        type: 'button',
        class: 'auth-tab' + (isRegister ? ' is-active' : ''),
        role: 'tab',
        'aria-selected': isRegister ? 'true' : 'false',
        onclick: function () { authSwitch('register'); },
        text: 'Create account'
      }),
      h('button', {
        type: 'button',
        class: 'auth-tab' + (isRegister ? '' : ' is-active'),
        role: 'tab',
        'aria-selected': isRegister ? 'false' : 'true',
        onclick: function () { authSwitch('login'); },
        text: 'Log in'
      })
    ));

    if (a.error) {
      stack.appendChild(h('div', { class: 'auth-error', role: 'alert', text: a.error }));
    }
    if (a.devOtp) {
      stack.appendChild(h('div', { class: 'auth-hint', text: 'Development mode — your code: ' + a.devOtp }));
    }

    if (a.step === 'form') {
      if (isRegister) {
        stack.appendChild(h('span', { class: 'field' },
          h('label', { class: 'label', for: 'auth-name', text: 'Username' }),
          h('input', {
            type: 'text',
            id: 'auth-name',
            class: 'input',
            value: a.name,
            placeholder: 'e.g. Alex',
            autocomplete: 'name',
            maxlength: '40',
            oninput: function (e) { a.name = e.target.value; },
            onkeydown: function (e) { if (e.key === 'Enter') authSendOtp(); }
          })
        ));
      }
      stack.appendChild(h('span', { class: 'field' },
        h('label', { class: 'label', for: 'auth-email', text: 'Email address' }),
        h('input', {
          type: 'email',
          id: 'auth-email',
          class: 'input',
          value: a.email,
          placeholder: 'you@example.com',
          autocomplete: 'email',
          oninput: function (e) { a.email = e.target.value; },
          onkeydown: function (e) { if (e.key === 'Enter') authSendOtp(); }
        })
      ));
      stack.appendChild(h('div', { class: 'row gap-2' },
        h('button', {
          type: 'button',
          class: 'btn btn-primary',
          disabled: a.busy ? '' : null,
          onclick: authSendOtp,
          text: a.busy ? 'Sending\u2026' : 'Send verification code'
        }),
        h('button', {
          type: 'button',
          class: 'btn btn-secondary',
          onclick: function () { authClose(); render(); },
          text: 'Cancel'
        })
      ));
    } else {
      stack.appendChild(h('div', { class: 'stack gap-1' },
        h('h3', { class: 'h3', text: 'Enter your code' }),
        h('span', { class: 'text-supporting', text: 'A 6-digit code was sent to ' + a.email + '.' })
      ));
      stack.appendChild(h('span', { class: 'field' },
        h('label', { class: 'label', for: 'auth-otp', text: 'Verification code' }),
        h('input', {
          type: 'text',
          id: 'auth-otp',
          class: 'input otp-input',
          value: a.otp,
          inputmode: 'numeric',
          pattern: '[0-9]{6}',
          maxlength: '6',
          placeholder: '000000',
          autocomplete: 'one-time-code',
          oninput: function (e) {
            a.otp = e.target.value;
            if (e.target.value.length === 6) authVerifyAndLogin();
          },
          onkeydown: function (e) { if (e.key === 'Enter') authVerifyAndLogin(); }
        })
      ));
      stack.appendChild(h('button', {
        type: 'button',
        class: 'btn btn-primary',
        disabled: a.busy ? '' : null,
        onclick: authVerifyAndLogin,
        text: a.busy ? 'Verifying\u2026' : (isRegister ? 'Verify & create account' : 'Verify & log in')
      }));
      stack.appendChild(h('div', { class: 'row gap-2 align-center' },
        h('button', {
          id: 'auth-resend-btn',
          type: 'button',
          class: 'btn btn-ghost btn-sm',
          onclick: authSendOtp,
          text: 'Resend code'
        }),
        h('button', {
          type: 'button',
          class: 'btn btn-ghost btn-sm',
          onclick: authGoBack,
          text: 'Use a different email'
        })
      ));
    }

    var modal = h('div', { class: 'card login-modal', role: 'dialog', 'aria-modal': 'true' }, stack);
    overlay.appendChild(modal);
    return overlay;
  }

  // ---------------------------------------------------------------------------
  // Shell rendering
  // ---------------------------------------------------------------------------

  function renderHeader() {
    // Header search bar — keep value in sync
    var headerSearch = document.getElementById('header-search');
    if (headerSearch && headerSearch.value !== ui.review.search) {
      headerSearch.value = ui.review.search;
    }

    // Engine status (optional / backwards-compatible)
    var status = document.getElementById('engine-status');
    if (status) {
      var result = currentResult();
      clear(status);
      status.className = 'status ' + (result.unlocked ? 'is-success' : 'is-warning');
      status.appendChild(h('span', { class: 'status-dot', 'aria-hidden': 'true' }));
      status.appendChild(h('span', {
        text: result.unlocked ? 'Genre engine on' : 'Genre engine locked'
      }));
    }
  }

  function renderTabs() {
    var nav = document.getElementById('tabs');
    clear(nav);
    MENU.forEach(function (item) {
      var active = state.choice === item.id;
      nav.appendChild(h('button', {
        type: 'button',
        class: 'tab' + (active ? ' is-active' : ''),
        role: 'tab',
        'aria-selected': active ? 'true' : 'false',
        onclick: function () {
          state.choice = item.id;
          if (item.id === 1) navigateTo(1, ui.content);
          else if (item.id === 3) navigateTo(3, ui.top.kind);
          else navigateTo(item.id);
        },
        text: item.label
      }));
    });
  }

  function renderPanel() {
    var panel = document.getElementById('panel');
    clear(panel);
    if (state.choice === 1) panel.appendChild(reviewPanel(ui.content));
    else if (state.choice === 2) panel.appendChild(suggestionsPanel());
    else if (state.choice === 3) panel.appendChild(topRatedPanel());
    else if (state.choice === 4) panel.appendChild(profilePanel());
    else panel.appendChild(reviewPanel(ui.content));
  }

  function renderFooter() {
    var user = activeUser();
    var who = user ? user.name : '';
    document.getElementById('footer').textContent = who;
  }

  function render() {
    renderHeader();
    renderTabs();
    renderPanel();
    renderFooter();
    var existingModal = document.querySelector('.login-modal-overlay');
    if (existingModal && existingModal.parentNode) existingModal.parentNode.removeChild(existingModal);
    var modal = buildLoginModal();
    if (modal) document.body.appendChild(modal);
  }

  // ---------------------------------------------------------------------------
  // Boot
  // ---------------------------------------------------------------------------

  function init() {
    Promise.all([
      API.getCategories(),
      API.getLanguages(),
      API.getMovies(),
      API.getSeries(),
      API.getTV(),
      API.getAnime(),
      API.getUsers(),
      API.getRatings(),
      API.getTop().catch(function () {
        return { movies: [], series: [], tv: [], anime: [] };
      }),
      API.getSimilarity().catch(function () {
        return { movies: {}, series: {}, tv: {}, anime: {} };
      }),
      API.getDailyPick().catch(function () {
        return null;
      })
    ]).then(function (results) {
      CATEGORIES = results[0];
      LANGUAGES = results[1];
      MOVIES = results[2];
      SERIES = results[3];
      TV = results[4];
      ANIME = results[5];
      USERS = results[6];
      state.ratings = results[7];
      TOPLISTS = results[8];
      SIMILARITY = results[9];
      state.dailyPick = results[10];
      state.users = USERS.slice();
      var stored = Storage.load('filmphile_current_user', null);
      if (stored && stored.id) {
        var match = USERS.filter(function (u) { return u.id === stored.id; })[0];
        if (match) state.activeUserId = match.id;
      }
      syncFromHash();
      if (!window.location.hash) window.location.hash = ROUTE_MAP[state.choice].base;

      CATEGORIES.forEach(function (c) { CATEGORY_MAP[c.id] = c; });
      LANGUAGES.forEach(function (l) { LANGUAGE_MAP[l.id] = l; });

      setupEventListeners();
      render();
    }).catch(function (err) {
      console.error('Failed to load data from API:', err);
      document.getElementById('panel').textContent = 'Failed to connect to server. Make sure the backend is running.';
    });
  }

  function setupEventListeners() {
    window.addEventListener('hashchange', function () {
      syncFromHash();
      render();
    });

    // Header search: if user types while on another panel, jump to Review panel
    var headerSearch = document.getElementById('header-search');
    if (headerSearch) {
      headerSearch.addEventListener('input', function (e) {
        ui.review.search = e.target.value;
        ui.content = 'movie';
        state.choice = 1;
        if (!navigateTo(1)) render();
      });
      headerSearch.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
          headerSearch.value = '';
          ui.review.search = '';
          headerSearch.blur();
          if (state.choice === 1) renderPanel();
        }
      });
    }

    var brand = document.getElementById('header-brand');
    if (brand) {
      brand.addEventListener('click', function () {
        state.choice = 1;
        if (!navigateTo(1)) render();
      });
      brand.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          state.choice = 1;
          if (!navigateTo(1)) render();
        }
      });
    }

    document.getElementById('year').textContent = String(new Date().getFullYear());
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
