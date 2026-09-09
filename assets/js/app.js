/**
 * CineMatch — vanilla JS app shell.
 *
 * Static port of legacy-react/src/App.tsx + components/. No build step,
 * no framework, no dependencies: open index.html or serve the folder.
 */
(function () {
  'use strict';

  var D = window.CineMatchData;
  var R = window.CineMatchRecommender;
  var S = window.CineMatchStorage;

  var MOVIES = D.MOVIES;
  var USERS = D.USERS;
  var CATEGORIES = D.CATEGORIES;
  var getCategory = D.getCategory;
  var TOP = R.TOP_RATING_THRESHOLD;

  var KEY_RATINGS = 'cinematch.ratings';
  var KEY_USERS = 'cinematch.users';

  /** The four options of the original C menu, plus one extra. */
  var MENU = [
    { id: 1, label: 'Give your review' },
    { id: 2, label: 'Give your suggestions' },
    { id: 3, label: 'Top ratings of movies' },
    { id: 4, label: 'Exit' },
    { id: 5, label: 'Add a viewer' }
  ];

  var state = {
    choice: 1,
    exited: false,
    activeUserId: USERS[0].id,
    newUserName: '',
    ratings: S.load(KEY_RATINGS, D.SEED_RATINGS).slice(),
    users: S.load(KEY_USERS, USERS).slice()
  };

  /** Panel-local UI state that does not need to be persisted. */
  var ui = {
    review: { search: '', selectedId: null, pendingRating: 0, flash: null, flashTimer: null },
    suggestions: { genreFilter: null, grouped: true, showBreakdown: false, spotlight: null },
    top: { showMatrix: false, minRatings: 1 }
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

  function movieById(id) {
    for (var i = 0; i < MOVIES.length; i++) if (MOVIES[i].id === id) return MOVIES[i];
    return null;
  }

  function plural(count, word) {
    return count + ' ' + word + (count === 1 ? '' : 's');
  }

  // ---------------------------------------------------------------------------
  // Derived state
  // ---------------------------------------------------------------------------

  function activeUser() {
    for (var i = 0; i < state.users.length; i++) {
      if (state.users[i].id === state.activeUserId) return state.users[i];
    }
    return state.users[0];
  }

  function currentMatrix() {
    return R.buildMatrix(state.users, MOVIES, state.ratings);
  }

  function currentResult() {
    return R.recommendForUser(currentMatrix(), activeUser().id, 9);
  }

  function myRatings() {
    var id = activeUser().id;
    return state.ratings.filter(function (r) { return r.userId === id; });
  }

  // ---------------------------------------------------------------------------
  // Mutations
  // ---------------------------------------------------------------------------

  /** Upsert: mirrors `matrix[0][k]=id; matrix[1][k]=index; matrix[2][k]=ratings;` */
  function rate(movieId, value) {
    var uid = activeUser().id;
    state.ratings = state.ratings.filter(function (r) {
      return !(r.userId === uid && r.movieId === movieId);
    });
    if (value > 0) state.ratings.push({ userId: uid, movieId: movieId, rating: value });
    S.save(KEY_RATINGS, state.ratings);
  }

  function addUser() {
    var name = state.newUserName.trim();
    if (!name) return;
    var nextId = 1;
    state.users.forEach(function (u) { if (u.id >= nextId) nextId = u.id + 1; });
    state.users.push({ id: nextId, name: name });
    S.save(KEY_USERS, state.users);
    state.activeUserId = nextId;
    state.newUserName = '';
    state.choice = 1;
    resetPanelUi();
    render();
  }

  function handleExit() {
    S.reset(KEY_RATINGS);
    S.reset(KEY_USERS);
    state.ratings = D.SEED_RATINGS.slice();
    state.users = USERS.slice();
    state.activeUserId = USERS[0].id;
    state.exited = true;
    resetPanelUi();
    render();
  }

  function handleResume() {
    state.exited = false;
    state.choice = 1;
    render();
  }

  function resetPanelUi() {
    ui.review = { search: '', selectedId: null, pendingRating: 0, flash: null, flashTimer: null };
    ui.suggestions = { genreFilter: null, grouped: true, showBreakdown: false, spotlight: null };
    ui.top = { showMatrix: false, minRatings: 1 };
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
            onChange(value === star ? 0 : star); // clicking the current value clears it
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
  // Panel 1 — Give your review
  // ---------------------------------------------------------------------------

  function reviewPanel() {
    var user = activeUser();
    var ratings = myRatings();
    var submitted = ratings.filter(function (r) { return r.rating > 0; });

    var ratingByMovieId = {};
    ratings.forEach(function (r) { ratingByMovieId[r.movieId] = r.rating; });

    var root = h('div', { class: 'stack gap-4' });

    root.appendChild(h('div', { class: 'stack gap-1' },
      h('h2', { class: 'h2', text: 'Give your review' }),
      h('p', {
        class: 'text-secondary',
        text: 'Signed in as ' + user.name + ' (id ' + user.id + '). Pick a movie, give 1\u20135 stars, submit. ' +
          'Rating a movie ' + TOP + '\u2605 or 5\u2605 is what unlocks genre-based suggestions for you.'
      })
    ));

    if (ui.review.flash) root.appendChild(banner('success', ui.review.flash));

    function filteredMovies() {
      var q = ui.review.search.trim().toLowerCase();
      if (!q) return MOVIES;
      return MOVIES.filter(function (m) {
        return m.moviename.toLowerCase().indexOf(q) !== -1 ||
          getCategory(m.category).label.toLowerCase().indexOf(q) !== -1;
      });
    }

    var grid = h('div', { class: 'grid grid-movies' });

    function updateGrid() {
      clear(grid);
      var list = filteredMovies();
      if (list.length === 0) {
        grid.appendChild(emptyState('No movie matches \u201C' + ui.review.search + '\u201D'));
        return;
      }
      list.forEach(function (movie) {
        var cat = getCategory(movie.category);
        var rated = ratingByMovieId[movie.id] || 0;
        var selected = ui.review.selectedId === movie.id;
        grid.appendChild(h('button', {
          type: 'button',
          class: 'btn btn-secondary btn-movie' + (selected ? ' is-primary' : ''),
          'aria-pressed': selected ? 'true' : 'false',
          onclick: function () {
            ui.review.selectedId = movie.id;
            ui.review.pendingRating = rated || 0;
            updateGrid();
            updateStars();
          },
          text: movie.moviename + ' \u2014 ' + cat.label + (rated > 0 ? ' \u00B7 you: ' + rated + '\u2605' : '')
        }));
      });
    }

    var starsSlot = h('div', { class: 'row gap-3 align-center wrap' });

    function updateStars() {
      clear(starsSlot);
      starsSlot.appendChild(starRating(ui.review.pendingRating, function (next) {
        ui.review.pendingRating = next;
        updateStars();
      }, 'lg'));
      starsSlot.appendChild(h('button', {
        type: 'button', class: 'btn btn-primary', onclick: submit
      }, 'Submit review'));
    }

    function submit() {
      if (ui.review.selectedId === null) {
        flash('Pick a movie first.');
        return;
      }
      if (ui.review.pendingRating < 1 || ui.review.pendingRating > 5) {
        flash('Ratings must be between 1 and 5.');
        return;
      }
      var movie = movieById(ui.review.selectedId);
      var value = ui.review.pendingRating;
      rate(ui.review.selectedId, value);
      ui.review.selectedId = null;
      ui.review.pendingRating = 0;
      flash(user.name + ' rated ' + (movie ? movie.moviename : 'the movie') + ' ' + value + '\u2605');
    }

    function flash(message) {
      ui.review.flash = message;
      if (ui.review.flashTimer) window.clearTimeout(ui.review.flashTimer);
      ui.review.flashTimer = window.setTimeout(function () {
        ui.review.flash = null;
        ui.review.flashTimer = null;
        renderPanel();
      }, 2600);
      render();
    }

    var searchField = h('div', { class: 'field' },
      h('label', { class: 'label', for: 'movie-search', text: 'Search movies or genres' }),
      h('input', {
        type: 'search',
        id: 'movie-search',
        class: 'input',
        value: ui.review.search,
        placeholder: 'e.g. Inception, Sci-Fi',
        autocomplete: 'off',
        oninput: function (e) {
          ui.review.search = e.target.value;
          updateGrid();
        }
      })
    );

    root.appendChild(h('div', { class: 'stack gap-3' },
      searchField,
      grid,
      starsSlot
    ));

    var reviews = h('div', { class: 'stack gap-2' },
      h('h3', { class: 'h3', text: 'Your reviews (' + submitted.length + ')' })
    );

    if (submitted.length === 0) {
      reviews.appendChild(h('p', { class: 'text-secondary', text: 'You have not rated anything yet.' }));
    } else {
      var ul = h('ul', { class: 'list' });
      submitted.forEach(function (r) {
        var movie = movieById(r.movieId);
        if (!movie) return;
        ul.appendChild(listItem(
          movie.moviename,
          getCategory(movie.category).label,
          [
            starRating(r.rating, function (next) { rate(movie.id, next); render(); }, 'sm'),
            h('button', {
              type: 'button',
              class: 'btn btn-ghost btn-sm',
              onclick: function () { rate(movie.id, 0); render(); },
              text: 'Remove'
            })
          ]
        ));
      });
      reviews.appendChild(ul);
    }

    root.appendChild(reviews);

    var node = section(root);
    updateGrid();
    updateStars();
    return node;
  }

  // ---------------------------------------------------------------------------
  // Panel 2 — Give your suggestions
  // ---------------------------------------------------------------------------

  function suggestionsPanel() {
    var user = activeUser();
    var result = currentResult();
    var root = h('div', { class: 'stack gap-4' });

    root.appendChild(h('div', { class: 'stack gap-1' },
      h('h2', { class: 'h2', text: 'Give your suggestions' }),
      h('p', {
        class: 'text-secondary',
        text: 'Personalised picks for ' + user.name + '. The genre engine only switches on once you hand out a ' +
          TOP + '\u2605 or 5\u2605 \u2014 until then you get trending / taste-twin picks.'
      })
    ));

    root.appendChild(result.unlocked
      ? banner('success', 'Genre engine unlocked \u2014 you rated ' + plural(result.liked.length, 'movie') +
          ' at ' + TOP + '\u2605+, so we are pulling more titles from those genres.')
      : banner('warning', 'Genre engine locked \u2014 rate any movie ' + TOP +
          '\u2605 or 5\u2605 to unlock same-genre recommendations.'));

    // --- Taste profile cards ---
    var cards = h('div', { class: 'grid grid-cards' });

    cards.appendChild(card('muted', h('div', { class: 'stack gap-2' },
      h('span', { class: 'label', text: 'Top rated by you' }),
      result.liked.length === 0
        ? h('span', { class: 'text-secondary', text: 'Nothing at ' + TOP + '\u2605+ yet.' })
        : h('ul', { class: 'list list-compact' }, result.liked.map(function (l) {
            return listItem(l.movie.moviename, null, badge(l.rating + '\u2605', 'success'));
          }))
    )));

    cards.appendChild(card('muted', h('div', { class: 'stack gap-2' },
      h('span', { class: 'label', text: 'Rated low by you' }),
      result.disliked.length === 0
        ? h('span', { class: 'text-secondary', text: 'No low ratings recorded.' })
        : h('ul', { class: 'list list-compact' }, result.disliked.map(function (l) {
            return listItem(l.movie.moviename, null, badge(l.rating + '\u2605', 'error'));
          }))
    )));

    cards.appendChild(card('muted', h('div', { class: 'stack gap-2' },
      h('span', { class: 'label', text: 'Your taste twins' }),
      result.neighbours.length === 0
        ? h('span', { class: 'text-secondary', text: 'Not enough overlap with other viewers yet.' })
        : h('ul', { class: 'list list-compact' }, result.neighbours.slice(0, 3).map(function (n) {
            return listItem(n.user.name, null, badge(Math.round(n.similarity * 100) + '%'));
          }))
    )));

    root.appendChild(cards);

    // --- Genre filter ---
    var genreGrid = h('div', { class: 'grid grid-chips' });
    genreGrid.appendChild(h('button', {
      type: 'button',
      class: 'btn btn-sm ' + (ui.suggestions.genreFilter === null ? 'btn-primary' : 'btn-secondary'),
      onclick: function () { ui.suggestions.genreFilter = null; renderPanel(); },
      text: 'All genres'
    }));
    CATEGORIES.forEach(function (c) {
      var active = ui.suggestions.genreFilter === c.id;
      genreGrid.appendChild(h('button', {
        type: 'button',
        class: 'btn btn-sm ' + (active ? 'btn-primary' : 'btn-secondary'),
        'aria-pressed': active ? 'true' : 'false',
        onclick: function () {
          ui.suggestions.genreFilter = active ? null : c.id;
          renderPanel();
        },
        text: c.emoji + ' ' + c.label
      }));
    });
    root.appendChild(h('div', { class: 'stack gap-2' },
      h('span', { class: 'label', text: 'Filter by genre' }),
      genreGrid
    ));

    // --- Toolbar ---
    var visible = ui.suggestions.genreFilter === null
      ? result.recommendations
      : result.recommendations.filter(function (r) { return r.movie.category === ui.suggestions.genreFilter; });

    var toolbar = h('div', { class: 'row gap-2 align-center wrap' },
      h('button', {
        type: 'button',
        class: 'btn btn-secondary',
        onclick: function () { ui.suggestions.spotlight = R.pickSurprise(result); renderPanel(); },
        text: 'Surprise me'
      })
    );

    if (result.unlocked) {
      toolbar.appendChild(h('button', {
        type: 'button',
        class: 'btn btn-sm ' + (ui.suggestions.grouped ? 'btn-primary' : 'btn-secondary'),
        'aria-pressed': ui.suggestions.grouped ? 'true' : 'false',
        onclick: function () { ui.suggestions.grouped = !ui.suggestions.grouped; renderPanel(); },
        text: ui.suggestions.grouped ? 'Grouped by genre' : 'Group by genre'
      }));
    }

    toolbar.appendChild(h('button', {
      type: 'button',
      class: 'btn btn-sm btn-secondary',
      onclick: function () { ui.suggestions.showBreakdown = !ui.suggestions.showBreakdown; renderPanel(); },
      text: ui.suggestions.showBreakdown ? 'Hide scores' : 'Show scores'
    }));

    toolbar.appendChild(h('span', { class: 'text-supporting', text: plural(visible.length, 'suggestion') }));
    root.appendChild(toolbar);

    // --- Spotlight ---
    var spotlight = ui.suggestions.spotlight;
    if (spotlight) {
      var cat = getCategory(spotlight.movie.category);
      root.appendChild(card('blue', h('div', { class: 'stack gap-2' },
        h('span', { class: 'label', text: 'Tonight\u2019s pick' }),
        h('h3', { class: 'h3', text: spotlight.movie.moviename }),
        h('span', {
          class: 'text-secondary',
          text: cat.emoji + ' ' + cat.label + (spotlight.movie.year ? ' \u00B7 ' + spotlight.movie.year : '') +
            ' \u00B7 ' + spotlight.match + '% match'
        }),
        h('span', {
          class: 'text-secondary',
          text: spotlight.genreScore === 0
            ? 'Deliberately picked outside your usual genres \u2014 something new to try.'
            : 'A safe bet from a genre you already rate highly.'
        }),
        h('span', { class: 'row gap-2 align-center' },
          starRating(0, function (rating) {
            rate(spotlight.movie.id, rating);
            ui.suggestions.spotlight = null;
            render();
          }),
          h('button', {
            type: 'button', class: 'btn btn-sm btn-secondary',
            onclick: function () { ui.suggestions.spotlight = null; renderPanel(); },
            text: 'Dismiss'
          })
        )
      )));
    }

    // --- Results ---
    if (visible.length === 0) {
      root.appendChild(h('p', {
        class: 'text-secondary',
        text: 'No suggestions in this genre right now \u2014 try another filter.'
      }));
    } else if (result.unlocked && ui.suggestions.grouped) {
      var buckets = {};
      var order = [];
      visible.forEach(function (rec) {
        if (!buckets[rec.movie.category]) {
          buckets[rec.movie.category] = [];
          order.push(rec.movie.category);
        }
        buckets[rec.movie.category].push(rec);
      });
      order.sort(function (a, b) { return buckets[b][0].score - buckets[a][0].score; });

      order.forEach(function (categoryId) {
        var category = getCategory(categoryId);
        var proof = result.liked.filter(function (l) { return l.movie.category === categoryId; });
        var group = h('div', { class: 'stack gap-2' },
          h('div', { class: 'stack gap-0' },
            h('h3', { class: 'h3', text: category.emoji + ' More ' + category.label }),
            h('span', {
              class: 'text-supporting',
              text: proof.length > 0
                ? 'because you rated ' + proof.map(function (p) {
                    return p.movie.moviename + ' ' + p.rating + '\u2605';
                  }).join(' and ')
                : 'from your overall taste profile'
            })
          ),
          h('div', { class: 'grid grid-recs' }, buckets[categoryId].map(function (rec) {
            return recommendationCard(rec);
          }))
        );
        root.appendChild(group);
      });
    } else {
      root.appendChild(h('div', { class: 'grid grid-recs' }, visible.map(function (rec) {
        return recommendationCard(rec);
      })));
    }

    return section(root);
  }

  function recommendationCard(rec) {
    var category = getCategory(rec.movie.category);

    var parts = [
      { label: 'Genre match', value: rec.genreScore, weight: 0.6 },
      { label: 'Taste twins', value: rec.collabScore, weight: 0.3 },
      { label: 'Popularity', value: rec.popularityScore, weight: 0.1 }
    ];

    var root = h('div', { class: 'stack gap-2' },
      h('div', { class: 'row gap-2 space-between align-start' },
        h('span', { class: 'stack gap-1' },
          h('h4', { class: 'h4', text: rec.movie.moviename }),
          token(category.emoji + ' ' + category.label + (rec.movie.year ? ' \u00B7 ' + rec.movie.year : ''))
        ),
        h('span', { class: 'text-strong', text: rec.match + '%' })
      ),
      progressBar(rec.match, 100)
    );

    var reasons = h('div', { class: 'stack gap-0' });
    if (rec.reasons.length === 0) {
      reasons.appendChild(h('span', { class: 'text-supporting', text: 'Recommended by the blended ranking model.' }));
    }
    rec.reasons.forEach(function (reason) {
      reasons.appendChild(h('span', { class: 'text-supporting', text: '\u2192 ' + reason }));
    });
    root.appendChild(reasons);

    if (ui.suggestions.showBreakdown) {
      var breakdown = h('div', { class: 'stack gap-1' });
      parts.forEach(function (p) {
        breakdown.appendChild(h('div', { class: 'row gap-2 align-center' },
          h('span', { class: 'text-supporting breakdown-label', text: p.label }),
          progressBar(Math.round(p.value * 100), 100),
          h('span', { class: 'text-supporting', text: '+' + Math.round(p.value * p.weight * 100) })
        ));
      });
      breakdown.appendChild(h('span', {
        class: 'text-supporting',
        text: 'contribution points out of 100 \u2014 genre stays at 0 until you rate something ' + TOP + '\u2605+'
      }));
      root.appendChild(breakdown);
    }

    root.appendChild(starRating(0, function (rating) {
      rate(rec.movie.id, rating);
      render();
    }, 'sm'));

    return card('plain', root);
  }

  // ---------------------------------------------------------------------------
  // Panel 3 — Top ratings of movies
  // ---------------------------------------------------------------------------

  function topRatedPanel() {
    var matrix = currentMatrix();
    var ranked = R.topRated(matrix, ui.top.minRatings);
    var userId = activeUser().id;
    var highlight = {};
    state.ratings.forEach(function (r) {
      if (r.userId === userId && r.rating > 0) highlight[r.movieId] = true;
    });

    var root = h('div', { class: 'stack gap-4' });

    root.appendChild(h('div', { class: 'stack gap-1' },
      h('h2', { class: 'h2', text: 'Top rating of movies' }),
      h('p', {
        class: 'text-secondary',
        text: 'Average score across all viewers' +
          (Object.keys(highlight).length > 0 ? ' \u2014 highlighted rows are movies you rated.' : '.')
      })
    ));

    var controls = h('div', { class: 'row gap-1 align-center wrap' },
      h('span', { class: 'text-supporting', text: 'Minimum ratings:' })
    );
    [1, 2, 3, 4].forEach(function (n) {
      controls.appendChild(h('button', {
        type: 'button',
        class: 'btn btn-sm ' + (ui.top.minRatings === n ? 'btn-primary' : 'btn-secondary'),
        'aria-pressed': ui.top.minRatings === n ? 'true' : 'false',
        onclick: function () { ui.top.minRatings = n; renderPanel(); },
        text: n + '+'
      }));
    });
    controls.appendChild(h('button', {
      type: 'button',
      class: 'btn btn-sm btn-secondary',
      onclick: function () { ui.top.showMatrix = !ui.top.showMatrix; renderPanel(); },
      text: ui.top.showMatrix ? 'Hide raw matrix' : 'Show raw matrix'
    }));
    root.appendChild(controls);

    if (ranked.length === 0) {
      root.appendChild(h('p', { class: 'text-secondary', text: 'No movie clears that bar yet.' }));
    } else {
      var list = h('ol', { class: 'list list-numbered' });
      ranked.forEach(function (stat) {
        var category = getCategory(stat.movie.category);
        var isMine = !!highlight[stat.movie.id];
        list.appendChild(h('li', { class: 'list-item' + (isMine ? ' is-highlighted' : '') },
          h('span', { class: 'stack gap-0' },
            h('span', { class: 'list-item-label', text: stat.movie.moviename }),
            h('span', {
              class: 'text-supporting',
              text: category.emoji + ' ' + category.label + (isMine ? ' \u00B7 you rated' : '')
            })
          ),
          h('span', { class: 'row gap-2 align-center' },
            h('span', { class: 'text-strong', text: stat.average.toFixed(1) + '\u2605' }),
            h('span', { class: 'text-supporting', text: plural(stat.count, 'rating') }),
            progressBar(Math.round((stat.average / 5) * 100), 100)
          )
        ));
      });
      root.appendChild(list);
    }

    if (ui.top.showMatrix) root.appendChild(matrixTable(matrix));

    return section(root);
  }

  /** The modern equivalent of C `case 3`: dump matrix[i][j] as a grid. */
  function matrixTable(matrix) {
    var headRow = h('tr', null, h('th', { scope: 'col', text: 'User' }));
    matrix.movies.forEach(function (m) {
      headRow.appendChild(h('th', { scope: 'col', text: String(m.id) }));
    });

    var body = h('tbody');
    matrix.users.forEach(function (user, ui_) {
      var tr = h('tr', null, h('th', { scope: 'row', text: user.name + ' (' + user.id + ')' }));
      matrix.movies.forEach(function (movie, mi) {
        var value = matrix.values[ui_][mi];
        tr.appendChild(h('td', { class: value === 0 ? 'is-empty' : '', text: value === 0 ? '\u00B7' : String(value) }));
      });
      body.appendChild(tr);
    });

    return h('div', { class: 'stack gap-2' },
      h('div', { class: 'stack gap-0' },
        h('h3', { class: 'h3', text: 'Raw ratings matrix' }),
        h('span', {
          class: 'text-supporting',
          text: '0 = Not Rated, 1\u20135 = Rating. Rows are users, columns are movies.'
        })
      ),
      h('div', { class: 'table-scroll' },
        h('table', { class: 'table' },
          h('thead', null, headRow),
          body
        )
      ),
      token('matrix[user][movie]')
    );
  }

  // ---------------------------------------------------------------------------
  // Panel 4 — Exit
  // ---------------------------------------------------------------------------

  function exitPanel() {
    var user = activeUser();
    var ratingCount = myRatings().filter(function (r) { return r.rating > 0; }).length;

    var root = h('div', { class: 'stack gap-3' },
      h('h2', { class: 'h2', text: state.exited ? 'Goodbye, ' + user.name : 'Exit' })
    );

    root.appendChild(h('p', {
      class: 'text-secondary',
      text: state.exited
        ? 'Session ended. Your local data has been reset to the seeded C dataset.'
        : 'You have ' + plural(ratingCount, 'rating') + ' saved on this device. Exiting clears everything ' +
          'added during this session and restores the original dataset.'
    }));

    var actions = h('div', { class: 'row gap-2 wrap' });
    if (state.exited) {
      actions.appendChild(h('button', {
        type: 'button', class: 'btn btn-primary', onclick: handleResume, text: 'Start a new session'
      }));
    } else {
      actions.appendChild(h('button', {
        type: 'button', class: 'btn btn-destructive', onclick: handleExit, text: 'Exit & reset data'
      }));
      actions.appendChild(h('button', {
        type: 'button', class: 'btn btn-secondary', onclick: handleResume, text: 'Keep browsing'
      }));
    }
    root.appendChild(actions);

    return section(root);
  }

  // ---------------------------------------------------------------------------
  // Panel 5 — Add a viewer
  // ---------------------------------------------------------------------------

  function addViewerPanel() {
    var input = h('input', {
      type: 'text',
      id: 'viewer-name',
      class: 'input',
      value: state.newUserName,
      placeholder: 'e.g. Aayush',
      autocomplete: 'off',
      oninput: function (e) { state.newUserName = e.target.value; },
      onkeydown: function (e) { if (e.key === 'Enter') addUser(); }
    });

    return section(h('div', { class: 'stack gap-3' },
      h('div', { class: 'stack gap-1' },
        h('h2', { class: 'h2', text: 'Add a viewer' }),
        h('p', {
          class: 'text-secondary',
          text: 'New profiles start cold: no ratings, so the genre engine stays locked until they rate 4\u2605+.'
        })
      ),
      h('div', { class: 'row gap-2 align-end wrap' },
        h('span', { class: 'field' },
          h('label', { class: 'label', for: 'viewer-name', text: 'Viewer name' }),
          input
        ),
        h('button', {
          type: 'button', class: 'btn btn-primary', onclick: addUser, text: 'Create & switch'
        })
      )
    ));
  }

  // ---------------------------------------------------------------------------
  // Shell rendering
  // ---------------------------------------------------------------------------

  function renderHeader() {
    var select = document.getElementById('viewer-select');
    clear(select);
    state.users.forEach(function (u) {
      select.appendChild(h('option', { value: String(u.id), text: u.name + ' (id ' + u.id + ')' }));
    });
    select.value = String(activeUser().id);

    var result = currentResult();
    var status = document.getElementById('engine-status');
    clear(status);
    status.className = 'status ' + (result.unlocked ? 'is-success' : 'is-warning');
    status.appendChild(h('span', { class: 'status-dot', 'aria-hidden': 'true' }));
    status.appendChild(h('span', {
      text: result.unlocked ? 'Genre engine on' : 'Genre engine locked'
    }));
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
          state.exited = false;
          state.choice = item.id;
          render();
        },
        text: item.label
      }));
    });
  }

  function renderPanel() {
    var panel = document.getElementById('panel');
    clear(panel);
    if (state.choice === 1 && !state.exited) panel.appendChild(reviewPanel());
    else if (state.choice === 2 && !state.exited) panel.appendChild(suggestionsPanel());
    else if (state.choice === 3 && !state.exited) panel.appendChild(topRatedPanel());
    else if (state.choice === 4) panel.appendChild(exitPanel());
    else if (state.choice === 5 && !state.exited) panel.appendChild(addViewerPanel());
    else panel.appendChild(reviewPanel());
  }

  function renderFooter() {
    document.getElementById('footer').textContent =
      state.users.length + ' viewers \u00B7 ' + MOVIES.length + ' movies \u00B7 ' +
      state.ratings.length + ' ratings stored locally';
  }

  function render() {
    renderHeader();
    renderTabs();
    renderPanel();
    renderFooter();
  }

  // ---------------------------------------------------------------------------
  // Boot
  // ---------------------------------------------------------------------------

  function init() {
    document.getElementById('viewer-select').addEventListener('change', function (e) {
      state.activeUserId = Number(e.target.value);
      resetPanelUi();
      render();
    });

    document.getElementById('year').textContent = String(new Date().getFullYear());
    render();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
