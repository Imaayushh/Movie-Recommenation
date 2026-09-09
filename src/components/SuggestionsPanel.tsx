import { useMemo, useState } from 'react';
import { CATEGORIES, getCategory } from '../types';
import type { RecommendResult, Recommendation } from '../lib/recommender';
import { TOP_RATING_THRESHOLD, pickSurprise } from '../lib/recommender';
import { StarRating } from './StarRating';

interface SuggestionsPanelProps {
  userName: string;
  result: RecommendResult;
  onRate: (movieId: number, rating: number) => void;
}

export function SuggestionsPanel({ userName, result, onRate }: SuggestionsPanelProps) {
  const [genreFilter, setGenreFilter] = useState<number | null>(null);
  const [grouped, setGrouped] = useState(true);
  const [spotlight, setSpotlight] = useState<Recommendation | null>(null);

  const visible = useMemo(
    () =>
      genreFilter === null
        ? result.recommendations
        : result.recommendations.filter((r) => r.movie.category === genreFilter),
    [result.recommendations, genreFilter],
  );

  /** When the genre engine is on, cluster picks under the genre that earned them. */
  const groups = useMemo(() => {
    if (!result.unlocked || !grouped) return null;
    const map = new Map<number, Recommendation[]>();
    visible.forEach((rec) => {
      const bucket = map.get(rec.movie.category) ?? [];
      bucket.push(rec);
      map.set(rec.movie.category, bucket);
    });
    return [...map.entries()].sort((a, b) => b[1][0].score - a[1][0].score);
  }, [visible, result.unlocked, grouped]);

  function proofFor(category: number) {
    return result.liked.filter((l) => l.movie.category === category);
  }

  return (
    <div className="panel">
      <div className="panel__head">
        <h2>Give your suggestions</h2>
        <p>
          Personalised picks for <strong>{userName}</strong>. The genre engine only switches on once you hand out a{' '}
          {TOP_RATING_THRESHOLD}★ or 5★ — until then you get trending / taste-twin picks.
        </p>
      </div>

      {result.unlocked ? (
        <div className="notice notice--good">
          <strong>Genre engine unlocked.</strong> You rated {result.liked.length} movie
          {result.liked.length > 1 ? 's' : ''} at {TOP_RATING_THRESHOLD}★+, so we are pulling more titles from those
          genres.
        </div>
      ) : (
        <div className="notice notice--warn">
          <strong>Genre engine locked.</strong> Rate any movie {TOP_RATING_THRESHOLD}★ or 5★ to unlock
          same-genre recommendations. Below are trending picks in the meantime.
        </div>
      )}

      <div className="profile-grid">
        <div className="profile-card">
          <h4>Top rated by you</h4>
          {result.liked.length === 0 ? (
            <p className="muted">Nothing at {TOP_RATING_THRESHOLD}★+ yet.</p>
          ) : (
            <ul className="plain">
              {result.liked.map((l) => (
                <li key={l.movie.id}>
                  <span>{l.movie.moviename}</span>
                  <span className="tag tag--good">{l.rating}★</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="profile-card">
          <h4>Rated low by you</h4>
          {result.disliked.length === 0 ? (
            <p className="muted">No low ratings recorded.</p>
          ) : (
            <ul className="plain">
              {result.disliked.map((l) => (
                <li key={l.movie.id}>
                  <span>{l.movie.moviename}</span>
                  <span className="tag tag--bad">{l.rating}★</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="profile-card">
          <h4>Your taste twins</h4>
          {result.neighbours.length === 0 ? (
            <p className="muted">Not enough overlap with other viewers yet.</p>
          ) : (
            <ul className="plain">
              {result.neighbours.slice(0, 3).map((n) => (
                <li key={n.user.id}>
                  <span>{n.user.name}</span>
                  <span className="tag">{Math.round(n.similarity * 100)}% match</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="filter-bar">
        <button className={`chip ${genreFilter === null ? 'chip--active' : ''}`} onClick={() => setGenreFilter(null)}>
          All genres
        </button>
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            className={`chip ${genreFilter === c.id ? 'chip--active' : ''}`}
            onClick={() => setGenreFilter(genreFilter === c.id ? null : c.id)}
          >
            {c.emoji} {c.label}
          </button>
        ))}
      </div>

      <div className="filter-bar filter-bar--split">
        <div className="filter-bar__left">
          <button className="btn btn--ghost btn--small" onClick={() => setSpotlight(pickSurprise(result))}>
            🎲 Surprise me
          </button>
          {result.unlocked && (
            <label className="switch">
              <input type="checkbox" checked={grouped} onChange={(e) => setGrouped(e.target.checked)} />
              Group by genre
            </label>
          )}
        </div>
        <span className="muted">{visible.length} suggestion(s)</span>
      </div>

      {spotlight && (
        <div className="spotlight">
          <div>
            <span className="spotlight__label">Tonight's pick</span>
            <h3>{spotlight.movie.moviename}</h3>
            <p className="muted">
              {getCategory(spotlight.movie.category).emoji} {getCategory(spotlight.movie.category).label}
              {spotlight.movie.year ? ` · ${spotlight.movie.year}` : ''} · {spotlight.match}% match
            </p>
            <p className="muted">
              {spotlight.genreScore === 0
                ? 'Deliberately picked outside your usual genres — something new to try.'
                : 'A safe bet from a genre you already rate highly.'}
            </p>
          </div>
          <div className="spotlight__actions">
            <StarRating value={0} onChange={(rating) => onRate(spotlight.movie.id, rating)} />
            <button className="btn btn--ghost btn--small" onClick={() => setSpotlight(null)}>
              Dismiss
            </button>
          </div>
        </div>
      )}

      {visible.length === 0 ? (
        <p className="muted">No suggestions in this genre right now — try another filter.</p>
      ) : groups ? (
        groups.map(([categoryId, recs]) => {
          const category = getCategory(categoryId);
          const proof = proofFor(categoryId);
          return (
            <section className="genre-group" key={categoryId}>
              <header className="genre-group__head">
                <h3>
                  {category.emoji} More {category.label}
                </h3>
                <span className="muted">
                  {proof.length > 0
                    ? `because you rated ${proof.map((p) => `${p.movie.moviename} ${p.rating}★`).join(' and ')}`
                    : 'from your overall taste profile'}
                </span>
              </header>
              <div className="rec-grid">
                {recs.map((rec) => (
                  <RecommendationCard key={rec.movie.id} rec={rec} onRate={onRate} />
                ))}
              </div>
            </section>
          );
        })
      ) : (
        <div className="rec-grid">
          {visible.map((rec) => (
            <RecommendationCard key={rec.movie.id} rec={rec} onRate={onRate} />
          ))}
        </div>
      )}
    </div>
  );
}

function RecommendationCard({
  rec,
  onRate,
}: {
  rec: Recommendation;
  onRate: (movieId: number, rating: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const category = getCategory(rec.movie.category);

  const parts = [
    { label: 'Genre match', value: rec.genreScore, weight: 0.6 },
    { label: 'Taste twins', value: rec.collabScore, weight: 0.3 },
    { label: 'Popularity', value: rec.popularityScore, weight: 0.1 },
  ];

  return (
    <article className={`rec-card ${rec.coldStart ? 'rec-card--cold' : ''}`}>
      <header>
        <div>
          <h4>{rec.movie.moviename}</h4>
          <span className="tag">
            {category.emoji} {category.label}
            {rec.movie.year ? ` · ${rec.movie.year}` : ''}
          </span>
        </div>
        <div className="match" title="genre 60% + taste twins 30% + popularity 10%">
          <span className="match__value">{rec.match}%</span>
          <span className="match__label">match</span>
        </div>
      </header>

      <div className="meter" aria-hidden="true">
        <div className="meter__fill" style={{ width: `${rec.match}%` }} />
      </div>

      <ul className="reasons">
        {rec.reasons.length === 0 && <li className="muted">Recommended by the blended ranking model.</li>}
        {rec.reasons.map((reason) => (
          <li key={reason}>{reason}</li>
        ))}
      </ul>

      {open && (
        <div className="breakdown">
          {parts.map((p) => (
            <div className="breakdown__row" key={p.label}>
              <span className="breakdown__label">{p.label}</span>
              <div className="meter meter--thin">
                <div className="meter__fill" style={{ width: `${Math.round(p.value * 100)}%` }} />
              </div>
              <span className="breakdown__contribution">
                +{Math.round(p.value * p.weight * 100)}
              </span>
            </div>
          ))}
          <small className="muted">
            contribution points out of 100 — genre stays at 0 until you rate something {TOP_RATING_THRESHOLD}★+
          </small>
        </div>
      )}

      <footer>
        <StarRating value={0} size="sm" onChange={(rating) => onRate(rec.movie.id, rating)} />
        <button className="btn btn--ghost btn--small" onClick={() => setOpen((v) => !v)}>
          {open ? 'Hide' : 'Why this?'}
        </button>
      </footer>
    </article>
  );
}
