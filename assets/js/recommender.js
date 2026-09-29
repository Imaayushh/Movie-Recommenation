/**
 * Filmphile — recommendation engine.
 *
 * Ported 1:1 from legacy-react/src/lib/recommender.ts.
 *
 * Core rule (ported from the C menu "Give Your suggestions"):
 *   -> Only when a user gives a TOP rating (4 or 5) to a movie do we unlock
 *      recommendations from that movie's genre. Below that threshold the
 *      genre engine stays LOCKED and the user only gets trending /
 *      collaborative suggestions.
 */
(function (global) {
  'use strict';

  var getCategory = global.FilmphileData.getCategory;

  var TOP_RATING_THRESHOLD = 4;
  var LOW_RATING_THRESHOLD = 2;

  /** Weights of the final blended score. */
  var W_GENRE = 0.6;
  var W_COLLAB = 0.3;
  var W_POPULARITY = 0.1;

  /**
   * How much of the genre lift comes from "this is my favourite genre" (relative)
   * vs "I rated it a lot and highly" (absolute evidence).
   */
  var RELATIVE_WEIGHT = 0.6;
  var EVIDENCE_SATURATION = 2;

  function normaliseLift(lift, maxLift) {
    if (lift <= 0) return 0;
    var relative = lift / maxLift;
    var evidence = lift / (lift + EVIDENCE_SATURATION);
    return RELATIVE_WEIGHT * relative + (1 - RELATIVE_WEIGHT) * evidence;
  }

  function buildMatrix(users, movies, records) {
    var userIndex = {};
    var movieIndex = {};
    users.forEach(function (u, i) { userIndex[u.id] = i; });
    movies.forEach(function (m, i) { movieIndex[m.id] = i; });

    var values = users.map(function () {
      return movies.map(function () { return 0; });
    });

    records.forEach(function (record) {
      var ui = userIndex[record.userId];
      var mi = movieIndex[record.movieId];
      if (ui === undefined || mi === undefined) return;
      values[ui][mi] = record.rating; // latest rating wins, same as matrix[2][k] = ratings
    });

    return { users: users, movies: movies, values: values };
  }

  function movieStats(matrix) {
    return matrix.movies.map(function (movie, mi) {
      var sum = 0;
      var count = 0;
      for (var ui = 0; ui < matrix.users.length; ui++) {
        var value = matrix.values[ui][mi];
        if (value > 0) {
          sum += value;
          count++;
        }
      }
      return { movie: movie, average: count ? sum / count : 0, count: count };
    });
  }

  function topRated(matrix, minRatings) {
    if (minRatings === undefined) minRatings = 1;
    return movieStats(matrix)
      .filter(function (stat) { return stat.count >= minRatings; })
      .sort(function (a, b) {
        return b.average - a.average || b.count - a.count;
      });
  }

  /** Cosine similarity over movies both users have rated. */
  function similarity(a, b) {
    var dot = 0, normA = 0, normB = 0;
    for (var i = 0; i < a.length; i++) {
      if (a[i] > 0 && b[i] > 0) {
        dot += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
      }
    }
    if (normA === 0 || normB === 0) return 0;
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  function recommendForUser(matrix, userId, limit) {
    if (limit === undefined) limit = 8;

    var ui = -1;
    for (var i = 0; i < matrix.users.length; i++) {
      if (matrix.users[i].id === userId) { ui = i; break; }
    }
    if (ui === -1) {
      return { unlocked: false, liked: [], disliked: [], neighbours: [], recommendations: [], ratingsToUnlock: 1 };
    }

    var row = matrix.values[ui];
    var liked = [];
    var disliked = [];

    matrix.movies.forEach(function (movie, mi) {
      var rating = row[mi];
      if (rating >= TOP_RATING_THRESHOLD) liked.push({ movie: movie, rating: rating });
      else if (rating > 0 && rating <= LOW_RATING_THRESHOLD) disliked.push({ movie: movie, rating: rating });
    });
    liked.sort(function (a, b) { return b.rating - a.rating; });

    var unlocked = liked.length > 0;

    // Genre lift: 4 stars = +1, 5 stars = +2. Genre drag: 2 stars = +1, 1 star = +2.
    var lift = {};
    liked.forEach(function (entry) {
      var key = entry.movie.category;
      lift[key] = (lift[key] || 0) + (entry.rating - 3);
    });
    var drag = {};
    disliked.forEach(function (entry) {
      var key = entry.movie.category;
      drag[key] = (drag[key] || 0) + (3 - entry.rating);
    });

    var maxLift = 1;
    Object.keys(lift).forEach(function (k) { if (lift[k] > maxLift) maxLift = lift[k]; });
    var maxDrag = 1;
    Object.keys(drag).forEach(function (k) { if (drag[k] > maxDrag) maxDrag = drag[k]; });

    // Nearest neighbours (collaborative filtering).
    var neighbours = matrix.users
      .map(function (user, index) {
        return { user: user, index: index, similarity: index === ui ? 0 : similarity(row, matrix.values[index]) };
      })
      .filter(function (n) { return n.index !== ui && n.similarity > 0; })
      .sort(function (a, b) { return b.similarity - a.similarity; })
      .slice(0, 4);

    var stats = movieStats(matrix);
    var recommendations = [];

    matrix.movies.forEach(function (movie, mi) {
      if (row[mi] > 0) return; // already rated by this user

      var reasons = [];
      var category = getCategory(movie.category);

      // ---- 1. Genre signal (gated on top ratings) ----
      var genreScore = 0;
      if (unlocked) {
        var rawLift = normaliseLift(lift[movie.category] || 0, maxLift);
        var rawDrag = (drag[movie.category] || 0) / maxDrag;
        genreScore = Math.max(0, rawLift - 0.5 * rawDrag);

        if (rawLift > 0) {
          var proof = liked.filter(function (l) { return l.movie.category === movie.category; }).slice(0, 2);
          proof.forEach(function (p) {
            reasons.push('You rated ' + p.movie.moviename + ' ' + p.rating +
              '\u2605 \u2014 more ' + category.label + ' picked for you');
          });
        } else if (rawDrag > 0) {
          reasons.push('You usually rate ' + category.label + ' low, so this is de-prioritised');
        }
      }

      // ---- 2. Collaborative signal ----
      var weighted = 0;
      var weightSum = 0;
      var bestFan = null;

      neighbours.forEach(function (neighbour) {
        var rating = matrix.values[neighbour.index][mi];
        if (rating <= 0) return;
        weighted += neighbour.similarity * rating;
        weightSum += neighbour.similarity;
        if (rating >= 4 && (!bestFan || neighbour.similarity > bestFan.percent / 100)) {
          bestFan = {
            name: neighbour.user.name,
            percent: Math.round(neighbour.similarity * 100),
            rating: rating
          };
        }
      });

      var collabScore = weightSum > 0 ? weighted / weightSum / 5 : 0;
      if (bestFan && collabScore >= 0.6) {
        reasons.push(bestFan.name + ' (' + bestFan.percent + '% similar taste) rated it ' + bestFan.rating + '\u2605');
      }

      // ---- 3. Popularity prior (cold start fallback) ----
      var popularity = stats[mi].average / 5;
      if (!unlocked && popularity > 0 && stats[mi].count >= 2) {
        reasons.push('Trending right now \u2014 ' + stats[mi].average.toFixed(1) +
          '\u2605 from ' + stats[mi].count + ' viewers');
      }

      var score = W_GENRE * genreScore + W_COLLAB * collabScore + W_POPULARITY * popularity;
      if (score <= 0) return;

      recommendations.push({
        movie: movie,
        score: score,
        match: Math.max(1, Math.min(99, Math.round(score * 100))),
        genreScore: genreScore,
        collabScore: collabScore,
        popularityScore: popularity,
        reasons: reasons.slice(0, 3),
        coldStart: !unlocked
      });
    });

    recommendations.sort(function (a, b) {
      return b.score - a.score || a.movie.moviename.localeCompare(b.movie.moviename);
    });

    return {
      unlocked: unlocked,
      liked: liked,
      disliked: disliked,
      neighbours: neighbours,
      recommendations: recommendations.slice(0, limit),
      ratingsToUnlock: unlocked ? 0 : 1
    };
  }

  /**
   * "Surprise me": prefers a movie from a genre the user has NOT built lift in,
   * so the pick explores instead of echoing back what they already love.
   */
  function pickSurprise(result, random) {
    if (typeof random !== 'function') random = Math.random;
    var pool = result.recommendations;
    if (pool.length === 0) return null;
    var unexplored = pool.filter(function (r) { return r.genreScore === 0; });
    var candidates = unexplored.length > 0 ? unexplored : pool;
    return candidates[Math.floor(random() * candidates.length)] || null;
  }

  global.FilmphileRecommender = {
    TOP_RATING_THRESHOLD: TOP_RATING_THRESHOLD,
    LOW_RATING_THRESHOLD: LOW_RATING_THRESHOLD,
    buildMatrix: buildMatrix,
    movieStats: movieStats,
    topRated: topRated,
    recommendForUser: recommendForUser,
    pickSurprise: pickSurprise
  };
})(window);
