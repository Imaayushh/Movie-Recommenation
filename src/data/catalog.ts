import type { Movie, RatingRecord, User } from '../types';

/**
 * The 10 movies from the original C `struct movie movies[]`, in the exact
 * same order so ids 0-9 match the C array indexes.
 * Everything from id 10 on is extra catalog added so that "recommend other
 * movies from the same genre" actually has something to recommend.
 */
export const MOVIES: Movie[] = [
  { id: 0, moviename: 'Avengers', category: 9, year: 2012 },
  { id: 1, moviename: 'Inception', category: 0, year: 2010 },
  { id: 2, moviename: 'Oppenheimer', category: 5, year: 2023 },
  { id: 3, moviename: 'Interstellar', category: 0, year: 2014 },
  { id: 4, moviename: 'KGF', category: 1, year: 2018 },
  { id: 5, moviename: 'Batman', category: 9, year: 2008 },
  { id: 6, moviename: 'Avengers: Endgame', category: 9, year: 2019 },
  { id: 7, moviename: 'The Dark Knight', category: 2, year: 2008 },
  { id: 8, moviename: 'Shawshank Redemption', category: 3, year: 1994 },
  { id: 9, moviename: 'The Godfather', category: 4, year: 1972 },

  // --- Sci-Fi (0) ---
  { id: 10, moviename: 'The Matrix', category: 0, year: 1999 },
  { id: 11, moviename: 'Arrival', category: 0, year: 2016 },
  { id: 12, moviename: 'Blade Runner 2049', category: 0, year: 2017 },
  { id: 13, moviename: 'Dune', category: 0, year: 2021 },

  // --- Action (1) ---
  { id: 14, moviename: 'Mad Max: Fury Road', category: 1, year: 2015 },
  { id: 15, moviename: 'John Wick', category: 1, year: 2014 },
  { id: 16, moviename: 'Die Hard', category: 1, year: 1988 },
  { id: 17, moviename: 'Gladiator', category: 1, year: 2000 },

  // --- Thriller (2) ---
  { id: 18, moviename: 'Se7en', category: 2, year: 1995 },
  { id: 19, moviename: 'Zodiac', category: 2, year: 2007 },
  { id: 20, moviename: 'Gone Girl', category: 2, year: 2014 },
  { id: 21, moviename: 'Shutter Island', category: 2, year: 2010 },

  // --- Drama (3) ---
  { id: 22, moviename: 'Forrest Gump', category: 3, year: 1994 },
  { id: 23, moviename: 'Parasite', category: 3, year: 2019 },
  { id: 24, moviename: 'Whiplash', category: 3, year: 2014 },
  { id: 25, moviename: 'The Green Mile', category: 3, year: 1999 },

  // --- Crime (4) ---
  { id: 26, moviename: 'Goodfellas', category: 4, year: 1990 },
  { id: 27, moviename: 'Pulp Fiction', category: 4, year: 1994 },
  { id: 28, moviename: 'Heat', category: 4, year: 1995 },
  { id: 29, moviename: 'Scarface', category: 4, year: 1983 },

  // --- Biography (5) ---
  { id: 30, moviename: 'The Wolf of Wall Street', category: 5, year: 2013 },
  { id: 31, moviename: 'Catch Me If You Can', category: 5, year: 2002 },
  { id: 32, moviename: 'The Social Network', category: 5, year: 2010 },
  { id: 33, moviename: 'A Beautiful Mind', category: 5, year: 2001 },

  // --- Horror (6) ---
  { id: 34, moviename: 'Hereditary', category: 6, year: 2018 },
  { id: 35, moviename: 'The Conjuring', category: 6, year: 2013 },
  { id: 36, moviename: 'Get Out', category: 6, year: 2017 },
  { id: 37, moviename: 'The Shining', category: 6, year: 1980 },

  // --- Romance (7) ---
  { id: 38, moviename: 'La La Land', category: 7, year: 2016 },
  { id: 39, moviename: 'The Notebook', category: 7, year: 2004 },
  { id: 40, moviename: 'Before Sunrise', category: 7, year: 1995 },

  // --- Adventure (8) ---
  { id: 41, moviename: 'Raiders of the Lost Ark', category: 8, year: 1981 },
  { id: 42, moviename: 'Jurassic Park', category: 8, year: 1993 },
  { id: 43, moviename: 'The Lord of the Rings: The Fellowship of the Ring', category: 8, year: 2001 },
  { id: 44, moviename: 'Life of Pi', category: 8, year: 2012 },

  // --- Superhero (9) ---
  { id: 45, moviename: 'Iron Man', category: 9, year: 2008 },
  { id: 46, moviename: 'Logan', category: 9, year: 2017 },
  { id: 47, moviename: 'Spider-Man: Into the Spider-Verse', category: 9, year: 2018 },
  { id: 48, moviename: 'The Dark Knight Rises', category: 9, year: 2012 },

  // --- Comedy (10) ---
  { id: 49, moviename: 'The Hangover', category: 10, year: 2009 },
  { id: 50, moviename: 'Superbad', category: 10, year: 2007 },
  { id: 51, moviename: 'Groundhog Day', category: 10, year: 1993 },
  { id: 52, moviename: 'The Grand Budapest Hotel', category: 10, year: 2014 },

  // --- Animation (11) ---
  { id: 53, moviename: 'Coco', category: 11, year: 2017 },
  { id: 54, moviename: 'WALL·E', category: 11, year: 2008 },
  { id: 55, moviename: 'Spirited Away', category: 11, year: 2001 },
];

/** `char *users[5]` */
export const USERS: User[] = [
  { id: 1, name: 'Aayush' },
  { id: 2, name: 'Aniket' },
  { id: 3, name: 'Mayuresh' },
  { id: 4, name: 'Prathamesh' },
  { id: 5, name: 'Yuvraj' },
];

/**
 * The C program had `int ratings[10][5]` (10 rows x 5 cols) but only 5 users
 * and 10 movies, so the two halves never lined up. Here the exact same 50
 * numbers are laid out as 5 users x 10 movies:
 *   - rows 0-4 of the C matrix  -> movies 0-4 for users 1-5
 *   - rows 5-9 of the C matrix  -> movies 5-9 for users 1-5
 * No value was invented or changed. 0 still means "Not Rated".
 */
const SEED_MATRIX: number[][] = [
  [5, 2, 4, 0, 3, 5, 1, 4, 3, 2],
  [2, 4, 5, 3, 0, 3, 4, 2, 0, 5],
  [1, 5, 4, 2, 3, 1, 2, 5, 4, 3],
  [4, 2, 3, 5, 1, 4, 5, 3, 2, 1],
  [0, 3, 1, 4, 5, 5, 3, 4, 0, 5],
];

export const SEED_RATINGS: RatingRecord[] = SEED_MATRIX.flatMap((row, userIndex) =>
  row
    .map((rating, movieIndex): RatingRecord | null =>
      rating > 0
        ? { userId: USERS[userIndex].id, movieId: MOVIES[movieIndex].id, rating }
        : null,
    )
    .filter((r): r is RatingRecord => r !== null),
);
