import { useMemo, useState } from 'react';
import { MOVIES, SEED_RATINGS, USERS } from './data/catalog';
import type { RatingRecord, User } from './types';
import { buildMatrix, recommendForUser } from './lib/recommender';
import { useLocalStorage } from './hooks/useLocalStorage';
import { ReviewPanel } from './components/ReviewPanel';
import { SuggestionsPanel } from './components/SuggestionsPanel';
import { TopRatedPanel } from './components/TopRatedPanel';
import { ExitPanel } from './components/ExitPanel';

type MenuChoice = 1 | 2 | 3 | 4 | 5;

const MENU: { id: MenuChoice; label: string; hint: string }[] = [
  { id: 1, label: 'Give your review', hint: 'Rate a movie 1–5' },
  { id: 2, label: 'Give your suggestions', hint: 'Genre-aware picks' },
  { id: 3, label: 'Top ratings of movies', hint: 'Leaderboard' },
  { id: 4, label: 'Exit', hint: 'End session' },
  { id: 5, label: 'Add a viewer', hint: 'New profile' },
];

export default function App() {
  const [choice, setChoice] = useState<MenuChoice>(1);
  const [exited, setExited] = useState(false);

  const ratingsStore = useLocalStorage<RatingRecord[]>('cinematch.ratings', SEED_RATINGS);
  const usersStore = useLocalStorage<User[]>('cinematch.users', USERS);
  const [activeUserId, setActiveUserId] = useState<number>(USERS[0].id);
  const [newUserName, setNewUserName] = useState('');

  const users = usersStore.value;
  const ratings = ratingsStore.value;

  const activeUser = users.find((u) => u.id === activeUserId) ?? users[0];

  const matrix = useMemo(() => buildMatrix(users, MOVIES, ratings), [users, ratings]);
  const result = useMemo(() => recommendForUser(matrix, activeUser.id, 9), [matrix, activeUser.id]);
  const myRatings = useMemo(() => ratings.filter((r) => r.userId === activeUser.id), [ratings, activeUser.id]);

  /** Upsert: mirrors `matrix[0][k]=id; matrix[1][k]=index; matrix[2][k]=ratings;` */
  function rate(movieId: number, ratingValue: number) {
    ratingsStore.setValue((prev) => {
      const rest = prev.filter((r) => !(r.userId === activeUser.id && r.movieId === movieId));
      if (ratingValue <= 0) return rest; // 0 = Not Rated -> drop the record
      return [...rest, { userId: activeUser.id, movieId, rating: ratingValue }];
    });
  }

  function addUser() {
    const name = newUserName.trim();
    if (!name) return;
    const nextId = users.reduce((max, u) => Math.max(max, u.id), 0) + 1;
    usersStore.setValue((prev) => [...prev, { id: nextId, name }]);
    setActiveUserId(nextId);
    setNewUserName('');
    setChoice(1);
  }

  function handleExit() {
    ratingsStore.reset();
    usersStore.reset();
    setActiveUserId(USERS[0].id);
    setExited(true);
  }

  function handleResume() {
    setExited(false);
    setChoice(1);
  }

  const ratedMovieIds = myRatings.filter((r) => r.rating > 0).map((r) => r.movieId);

  return (
    <div className="app">
      <header className="app__header">
        <div className="brand">
          <span className="brand__mark">🎬</span>
          <div>
            <h1>CineMatch</h1>
            <p>Movie recommendation system — C logic, rebuilt in React + TypeScript</p>
          </div>
        </div>

        <div className="user-bar">
          <label className="user-bar__label" htmlFor="user-select">
            Viewer
          </label>
          <select
            id="user-select"
            className="input input--compact"
            value={activeUser.id}
            onChange={(e) => setActiveUserId(Number(e.target.value))}
          >
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} (id {u.id})
              </option>
            ))}
          </select>
          <span className={`pill ${result.unlocked ? 'pill--good' : 'pill--warn'}`}>
            {result.unlocked ? 'Genre engine on' : 'Genre engine locked'}
          </span>
        </div>
      </header>

      <nav className="menu">
        {MENU.map((item) => (
          <button
            key={item.id}
            className={`menu__item ${choice === item.id ? 'menu__item--active' : ''}`}
            onClick={() => {
              setExited(false);
              setChoice(item.id);
            }}
          >
            <span className="menu__num">{item.id}.</span>
            <span className="menu__label">
              {item.label}
              <small>{item.hint}</small>
            </span>
          </button>
        ))}
      </nav>

      <main className="app__main">
        {choice === 1 && !exited && (
          <ReviewPanel user={activeUser} movies={MOVIES} myRatings={myRatings} onRate={rate} />
        )}

        {choice === 2 && !exited && (
          <SuggestionsPanel userName={activeUser.name} result={result} onRate={rate} />
        )}

        {choice === 3 && !exited && <TopRatedPanel matrix={matrix} highlightMovieIds={ratedMovieIds} />}

        {choice === 4 && (
          <ExitPanel
            user={activeUser}
            ratingCount={ratedMovieIds.length}
            onExit={handleExit}
            onResume={handleResume}
            exited={exited}
          />
        )}

        {choice === 5 && !exited && (
          <div className="panel">
            <div className="panel__head">
              <h2>Add a viewer</h2>
              <p>New profiles start cold: no ratings, so the genre engine stays locked until they rate 4★+.</p>
            </div>
            <div className="review-actions">
              <input
                className="input"
                placeholder="Viewer name"
                value={newUserName}
                onChange={(e) => setNewUserName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addUser()}
              />
              <button className="btn btn--primary" onClick={addUser}>
                Create &amp; switch
              </button>
            </div>
          </div>
        )}
      </main>

      <footer className="app__footer">
        {users.length} viewers · {MOVIES.length} movies · {ratings.length} ratings stored locally
      </footer>
    </div>
  );
}
