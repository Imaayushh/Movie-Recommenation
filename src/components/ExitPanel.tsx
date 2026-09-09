import type { User } from '../types';

interface ExitPanelProps {
  user: User;
  ratingCount: number;
  onExit: () => void;
  onResume: () => void;
  exited: boolean;
}

export function ExitPanel({ user, ratingCount, onExit, onResume, exited }: ExitPanelProps) {
  if (exited) {
    return (
      <div className="panel panel--centered">
        <h2>Goodbye, {user.name} 👋</h2>
        <p className="muted">Session ended. Your local data has been reset to the seeded C dataset.</p>
        <button className="btn btn--primary" onClick={onResume}>
          Start a new session
        </button>
      </div>
    );
  }

  return (
    <div className="panel panel--centered">
      <h2>Exit</h2>
      <p className="muted">
        You have {ratingCount} rating{ratingCount === 1 ? '' : 's'} saved on this device. Exiting clears everything
        added during this session and restores the original dataset.
      </p>
      <div className="exit-actions">
        <button className="btn btn--danger" onClick={onExit}>
          Exit &amp; reset data
        </button>
        <button className="btn btn--ghost" onClick={onResume}>
          Keep browsing
        </button>
      </div>
    </div>
  );
}
