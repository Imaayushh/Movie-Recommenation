import { useMemo, useState } from 'react';
import type { Movie, RatingRecord, User } from '../types';
import { getCategory } from '../types';
import { StarRating } from './StarRating';

interface ReviewPanelProps {
  user: User;
  movies: Movie[];
  myRatings: RatingRecord[];
  onRate: (movieId: number, rating: number) => void;
}

export function ReviewPanel({ user, movies, myRatings, onRate }: ReviewPanelProps) {
  const [search, setSearch] = useState('');
  const [pendingRating, setPendingRating] = useState(0);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const ratingByMovieId = useMemo(() => {
    const map = new Map<number, number>();
    myRatings.forEach((r) => map.set(r.movieId, r.rating));
    return map;
  }, [myRatings]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return movies;
    return movies.filter(
      (m) => m.moviename.toLowerCase().includes(query) || getCategory(m.category).label.toLowerCase().includes(query),
    );
  }, [movies, search]);

  function submit() {
    if (selectedId === null) {
      setFlash('Pick a movie first.');
      return;
    }
    if (pendingRating < 1 || pendingRating > 5) {
      setFlash('Ratings must be between 1 and 5.');
      return;
    }
    const movie = movies.find((m) => m.id === selectedId);
    onRate(selectedId, pendingRating);
    setFlash(`${user.name} rated ${movie?.moviename ?? 'the movie'} ${pendingRating}★`);
    setSelectedId(null);
    setPendingRating(0);
    window.setTimeout(() => setFlash(null), 2600);
  }

  return (
    <div className="panel">
      <div className="panel__head">
        <h2>Give your review</h2>
        <p>
          Signed in as <strong>{user.name}</strong> (id {user.id}). Pick a movie, give 1–5 stars, submit. Rating a movie
          <strong> 4★ or 5★ </strong>
          is what unlocks genre-based suggestions for you.
        </p>
      </div>

      <div className="review-form">
        <input
          className="input"
          placeholder="Search movies or genres…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <div className="movie-picker">
          {filtered.map((movie) => {
            const category = getCategory(movie.category);
            const rated = ratingByMovieId.get(movie.id) ?? 0;
            const selected = selectedId === movie.id;
            return (
              <button
                key={movie.id}
                type="button"
                className={`movie-chip ${selected ? 'movie-chip--active' : ''}`}
                onClick={() => {
                  setSelectedId(movie.id);
                  setPendingRating(rated || 0);
                }}
              >
                <span className="movie-chip__name">{movie.moviename}</span>
                <span className="movie-chip__meta">
                  {category.emoji} {category.label}
                  {rated > 0 ? ` · you: ${rated}★` : ''}
                </span>
              </button>
            );
          })}
          {filtered.length === 0 && <p className="muted">No movie matches “{search}”.</p>}
        </div>

        <div className="review-actions">
          <StarRating value={pendingRating} onChange={setPendingRating} size="lg" />
          <button className="btn btn--primary" onClick={submit}>
            Submit review
          </button>
        </div>
        {flash && <p className="flash">{flash}</p>}
      </div>

      <section className="section">
        <h3>
          Your reviews <span className="badge">{myRatings.filter((r) => r.rating > 0).length}</span>
        </h3>
        {myRatings.filter((r) => r.rating > 0).length === 0 ? (
          <p className="muted">You have not rated anything yet.</p>
        ) : (
          <ul className="review-list">
            {myRatings
              .filter((r) => r.rating > 0)
              .map((r) => {
                const movie = movies.find((m) => m.id === r.movieId);
                if (!movie) return null;
                return (
                  <li key={r.movieId}>
                    <span className="review-list__name">{movie.moviename}</span>
                    <span className="tag">{getCategory(movie.category).label}</span>
                    <StarRating value={r.rating} onChange={(next) => onRate(movie.id, next)} size="sm" />
                    <button className="btn btn--ghost btn--small" onClick={() => onRate(movie.id, 0)}>
                      Remove
                    </button>
                  </li>
                );
              })}
          </ul>
        )}
      </section>
    </div>
  );
}
