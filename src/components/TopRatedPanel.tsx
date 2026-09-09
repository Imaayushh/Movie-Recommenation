import { useState } from 'react';
import type { Matrix, MovieStat } from '../lib/recommender';
import { topRated } from '../lib/recommender';
import { getCategory } from '../types';

interface TopRatedPanelProps {
  matrix: Matrix;
  highlightMovieIds: number[];
}

export function TopRatedPanel({ matrix, highlightMovieIds }: TopRatedPanelProps) {
  const [showMatrix, setShowMatrix] = useState(false);
  const [minRatings, setMinRatings] = useState(1);
  const ranked = topRated(matrix, minRatings);

  return (
    <div className="panel">
      <div className="panel__head">
        <h2>Top rating of movies</h2>
        <p>
          Average score across all viewers. Highlighted rows are movies you personally rated{' '}
          {highlightMovieIds.length ? '' : '— none yet'}.
        </p>
      </div>

      <div className="filter-bar">
        <span className="muted">Minimum number of ratings:</span>
        {[1, 2, 3, 4].map((n) => (
          <button key={n} className={`chip ${minRatings === n ? 'chip--active' : ''}`} onClick={() => setMinRatings(n)}>
            {n}+
          </button>
        ))}
        <button className="btn btn--ghost btn--small" onClick={() => setShowMatrix((v) => !v)}>
          {showMatrix ? 'Hide' : 'Show'} raw matrix
        </button>
      </div>

      <ol className="rank-list">
        {ranked.map((stat, index) => (
          <RankRow key={stat.movie.id} stat={stat} rank={index + 1} highlight={highlightMovieIds.includes(stat.movie.id)} />
        ))}
        {ranked.length === 0 && <p className="muted">No movie clears that bar yet.</p>}
      </ol>

      {showMatrix && <MatrixTable matrix={matrix} />}
    </div>
  );
}

function RankRow({ stat, rank, highlight }: { stat: MovieStat; rank: number; highlight: boolean }) {
  const category = getCategory(stat.movie.category);
  return (
    <li className={`rank-row ${highlight ? 'rank-row--mine' : ''}`}>
      <span className="rank-row__rank">{rank}</span>
      <div className="rank-row__body">
        <div className="rank-row__title">
          {stat.movie.moviename}
          <span className="tag">
            {category.emoji} {category.label}
          </span>
          {highlight && <span className="tag tag--good">you rated</span>}
        </div>
        <div className="meter">
          <div className="meter__fill" style={{ width: `${(stat.average / 5) * 100}%` }} />
        </div>
      </div>
      <span className="rank-row__score">
        {stat.average.toFixed(1)}★
        <small>{stat.count} rating{stat.count > 1 ? 's' : ''}</small>
      </span>
    </li>
  );
}

/** The modern equivalent of C `case 3`: dump matrix[i][j] as a grid. */
function MatrixTable({ matrix }: { matrix: Matrix }) {
  return (
    <div className="matrix-wrap">
      <h3>Raw ratings matrix</h3>
      <p className="muted">0 = Not Rated, 1–5 = Rating. Rows are users, columns are movies.</p>
      <table className="matrix">
        <thead>
          <tr>
            <th>User</th>
            {matrix.movies.map((m) => (
              <th key={m.id} title={m.moviename}>
                {m.id}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {matrix.users.map((user, ui) => (
            <tr key={user.id}>
              <th>
                {user.name} <small>({user.id})</small>
              </th>
              {matrix.movies.map((movie, mi) => {
                const value = matrix.values[ui][mi];
                return (
                  <td key={movie.id} className={value === 0 ? 'cell--empty' : value >= 4 ? 'cell--high' : value <= 2 ? 'cell--low' : ''}>
                    {value === 0 ? '·' : value}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
