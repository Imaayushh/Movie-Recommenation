import type { Movie, RatingRecord, User } from '../types';
import { getCategory } from '../types';

/**
 * Recommendation engine.
 *
 * Core rule requested by the user (ported from "Give Your suggestions"):
 *   -> Only when a user gives a TOP rating (4 or 5) to a movie do we unlock
 *      recommendations from that movie's genre. Below that threshold the
 *      genre engine stays LOCKED and the user only gets trending /
 *      collaborative suggestions.
 */

export const TOP_RATING_THRESHOLD = 4;
export const LOW_RATING_THRESHOLD = 2;

/** Weights of the final blended score. */
const W_GENRE = 0.6;
const W_COLLAB = 0.3;
const W_POPULARITY = 0.1;

/**
 * How much of the genre lift comes from "this is my favourite genre" (relative)
 * vs "I rated it a lot and highly" (absolute evidence).
 *
 * Relative alone is not enough: a user with a single 5 star and a user with a
 * single 4 star would both normalise to 1.0 and rank identically. Mixing in a
 * saturating evidence term keeps 5 star > 4 star while still letting a clearly
 * dominant genre win.
 */
const RELATIVE_WEIGHT = 0.6;
const EVIDENCE_SATURATION = 2;

function normaliseLift(lift: number, maxLift: number): number {
  if (lift <= 0) return 0;
  const relative = lift / maxLift;
  const evidence = lift / (lift + EVIDENCE_SATURATION);
  return RELATIVE_WEIGHT * relative + (1 - RELATIVE_WEIGHT) * evidence;
}

export interface Matrix {
  users: User[];
  movies: Movie[];
  /** values[userIndex][movieIndex] -> 0 = Not Rated, 1..5 = Rating */
  values: number[][];
}

export function buildMatrix(users: User[], movies: Movie[], records: RatingRecord[]): Matrix {
  const userIndex = new Map(users.map((u, i) => [u.id, i]));
  const movieIndex = new Map(movies.map((m, i) => [m.id, i]));
  const values: number[][] = users.map(() => movies.map(() => 0));

  for (const record of records) {
    const ui = userIndex.get(record.userId);
    const mi = movieIndex.get(record.movieId);
    if (ui === undefined || mi === undefined) continue;
    values[ui][mi] = record.rating; // latest rating wins, same as matrix[2][k] = ratings
  }
  return { users, movies, values };
}

export interface MovieStat {
  movie: Movie;
  average: number;
  count: number;
}

export function movieStats(matrix: Matrix): MovieStat[] {
  return matrix.movies.map((movie, mi) => {
    let sum = 0;
    let count = 0;
    for (let ui = 0; ui < matrix.users.length; ui++) {
      const value = matrix.values[ui][mi];
      if (value > 0) {
        sum += value;
        count++;
      }
    }
    return { movie, average: count ? sum / count : 0, count };
  });
}

export function topRated(matrix: Matrix, minRatings = 1): MovieStat[] {
  return movieStats(matrix)
    .filter((stat) => stat.count >= minRatings)
    .sort((a, b) => b.average - a.average || b.count - a.count);
}

/** Cosine similarity over movies both users have rated. */
function similarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    if (a[i] > 0 && b[i] > 0) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export interface RatedMovie {
  movie: Movie;
  rating: number;
}

export interface Neighbour {
  user: User;
  index: number;
  similarity: number;
}

export interface Recommendation {
  movie: Movie;
  score: number;
  /** 0-100 match percentage shown in the UI */
  match: number;
  genreScore: number;
  collabScore: number;
  popularityScore: number;
  reasons: string[];
  /** true when the pick came from trending/collab only (genre engine locked) */
  coldStart: boolean;
}

export interface RecommendResult {
  /** false until the user rates at least one movie 4+ stars */
  unlocked: boolean;
  liked: RatedMovie[];
  disliked: RatedMovie[];
  neighbours: Neighbour[];
  recommendations: Recommendation[];
  /** how many ratings the user still needs before genre kicks in */
  ratingsToUnlock: number;
}

export function recommendForUser(matrix: Matrix, userId: number, limit = 8): RecommendResult {
  const ui = matrix.users.findIndex((u) => u.id === userId);
  if (ui === -1) {
    return { unlocked: false, liked: [], disliked: [], neighbours: [], recommendations: [], ratingsToUnlock: 1 };
  }

  const row = matrix.values[ui];
  const liked: RatedMovie[] = [];
  const disliked: RatedMovie[] = [];

  matrix.movies.forEach((movie, mi) => {
    const rating = row[mi];
    if (rating >= TOP_RATING_THRESHOLD) liked.push({ movie, rating });
    else if (rating > 0 && rating <= LOW_RATING_THRESHOLD) disliked.push({ movie, rating });
  });
  liked.sort((a, b) => b.rating - a.rating);

  const unlocked = liked.length > 0;

  // Genre lift: 4 stars = +1, 5 stars = +2. Genre drag: 2 stars = +1, 1 star = +2.
  const lift = new Map<number, number>();
  liked.forEach(({ movie, rating }) => {
    lift.set(movie.category, (lift.get(movie.category) ?? 0) + (rating - 3));
  });
  const drag = new Map<number, number>();
  disliked.forEach(({ movie, rating }) => {
    drag.set(movie.category, (drag.get(movie.category) ?? 0) + (3 - rating));
  });
  const maxLift = Math.max(1, ...lift.values());
  const maxDrag = Math.max(1, ...drag.values());

  // Nearest neighbours (collaborative filtering).
  const neighbours: Neighbour[] = matrix.users
    .map((user, index) => ({ user, index, similarity: index === ui ? 0 : similarity(row, matrix.values[index]) }))
    .filter((n) => n.index !== ui && n.similarity > 0)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 4);

  const stats = movieStats(matrix);
  const recommendations: Recommendation[] = [];

  matrix.movies.forEach((movie, mi) => {
    if (row[mi] > 0) return; // already rated by this user

    const reasons: string[] = [];
    const category = getCategory(movie.category);

    // ---- 1. Genre signal (gated on top ratings) ----
    let genreScore = 0;
    if (unlocked) {
      const rawLift = normaliseLift(lift.get(movie.category) ?? 0, maxLift);
      const rawDrag = (drag.get(movie.category) ?? 0) / maxDrag;
      genreScore = Math.max(0, rawLift - 0.5 * rawDrag);

      if (rawLift > 0) {
        const proof = liked.filter((l) => l.movie.category === movie.category).slice(0, 2);
        proof.forEach((p) =>
          reasons.push(`You rated ${p.movie.moviename} ${p.rating}★ — more ${category.label} picked for you`),
        );
      } else if (rawDrag > 0) {
        reasons.push(`You usually rate ${category.label} low, so this is de-prioritised`);
      }
    }

    // ---- 2. Collaborative signal ----
    let weighted = 0;
    let weightSum = 0;
    let bestFan: { name: string; percent: number; rating: number } | null = null;

    for (const neighbour of neighbours) {
      const rating = matrix.values[neighbour.index][mi];
      if (rating <= 0) continue;
      weighted += neighbour.similarity * rating;
      weightSum += neighbour.similarity;
      if (rating >= 4 && (!bestFan || neighbour.similarity > bestFan.percent / 100)) {
        bestFan = { name: neighbour.user.name, percent: Math.round(neighbour.similarity * 100), rating };
      }
    }
    const collabScore = weightSum > 0 ? weighted / weightSum / 5 : 0;
    if (bestFan && collabScore >= 0.6) {
      reasons.push(`${bestFan.name} (${bestFan.percent}% similar taste) rated it ${bestFan.rating}★`);
    }

    // ---- 3. Popularity prior (cold start fallback) ----
    const popularity = stats[mi].average / 5;
    if (!unlocked && popularity > 0 && stats[mi].count >= 2) {
      reasons.push(`Trending right now — ${stats[mi].average.toFixed(1)}★ from ${stats[mi].count} viewers`);
    }

    const score = W_GENRE * genreScore + W_COLLAB * collabScore + W_POPULARITY * popularity;
    if (score <= 0) return;

    recommendations.push({
      movie,
      score,
      match: Math.max(1, Math.min(99, Math.round(score * 100))),
      genreScore,
      collabScore,
      popularityScore: popularity,
      reasons: reasons.slice(0, 3),
      coldStart: !unlocked,
    });
  });

  recommendations.sort((a, b) => b.score - a.score || a.movie.moviename.localeCompare(b.movie.moviename));

  return {
    unlocked,
    liked,
    disliked,
    neighbours,
    recommendations: recommendations.slice(0, limit),
    ratingsToUnlock: unlocked ? 0 : 1,
  };
}

/**
 * "Surprise me": prefers a movie from a genre the user has NOT built lift in,
 * so the pick explores instead of echoing back what they already love.
 * Falls back to the normal ranking when every suggestion is genre-driven.
 */
export function pickSurprise(result: RecommendResult, random: () => number = Math.random): Recommendation | null {
  const pool = result.recommendations;
  if (pool.length === 0) return null;
  const unexplored = pool.filter((r) => r.genreScore === 0);
  const candidates = unexplored.length > 0 ? unexplored : pool;
  return candidates[Math.floor(random() * candidates.length)] ?? null;
}
