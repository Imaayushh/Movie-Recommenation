/**
 * Types ported from the original C program.
 *
 * The C source used global ints as genre ids:
 *   int scify = 0; int actionfilm = 1; int thriller = 2; int drama = 3;
 *   int crime = 4; int biography = 5; int horror = 6;   // 7 was skipped
 *   int adventure = 8; int superhero = 9; int comedy = 10;
 *
 * We keep the exact same numeric ids so the port is 1:1, fill the missing
 * 7 with Romance, and add 11 (Animation) for the expanded catalog.
 */

export interface Category {
  id: number;
  key: string;
  label: string;
  emoji: string;
}

export type CategoryId = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11;

export const CATEGORIES: readonly Category[] = [
  { id: 0, key: 'scify', label: 'Sci-Fi', emoji: '🚀' },
  { id: 1, key: 'actionfilm', label: 'Action', emoji: '💥' },
  { id: 2, key: 'thriller', label: 'Thriller', emoji: '🔪' },
  { id: 3, key: 'drama', label: 'Drama', emoji: '🎭' },
  { id: 4, key: 'crime', label: 'Crime', emoji: '🕵️' },
  { id: 5, key: 'biography', label: 'Biography', emoji: '📖' },
  { id: 6, key: 'horror', label: 'Horror', emoji: '👻' },
  { id: 7, key: 'romance', label: 'Romance', emoji: '💖' },
  { id: 8, key: 'adventure', label: 'Adventure', emoji: '🧭' },
  { id: 9, key: 'superhero', label: 'Superhero', emoji: '🦸' },
  { id: 10, key: 'comedy', label: 'Comedy', emoji: '😂' },
  { id: 11, key: 'animation', label: 'Animation', emoji: '🎨' },
];

const FALLBACK_CATEGORY: Category = { id: -1, key: 'unknown', label: 'Unknown', emoji: '🎬' };

const CATEGORY_MAP = new Map<number, Category>(CATEGORIES.map((c) => [c.id, c]));

export function getCategory(id: number): Category {
  return CATEGORY_MAP.get(id) ?? FALLBACK_CATEGORY;
}

/** `struct movie { char moviename[30]; int category; };` */
export interface Movie {
  id: number;
  moviename: string;
  category: CategoryId;
  year?: number;
}

export interface User {
  id: number;
  name: string;
}

/**
 * One row of the C `matrix[3][20]`:
 *   matrix[0][k] = id  |  matrix[1][k] = index  |  matrix[2][k] = ratings
 */
export interface RatingRecord {
  userId: number;
  movieId: number;
  rating: number;
}
