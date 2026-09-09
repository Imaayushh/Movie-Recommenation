interface StarRatingProps {
  value: number;
  onChange?: (rating: number) => void;
  size?: 'sm' | 'md' | 'lg';
  readOnly?: boolean;
}

export function StarRating({ value, onChange, size = 'md', readOnly = false }: StarRatingProps) {
  const interactive = !readOnly && Boolean(onChange);

  return (
    <div className={`stars stars--${size} ${interactive ? 'stars--interactive' : ''}`} role="group" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = star <= value;
        return (
          <button
            key={star}
            type="button"
            disabled={!interactive}
            aria-label={`${star} star${star > 1 ? 's' : ''}`}
            aria-pressed={filled}
            className={`star ${filled ? 'star--on' : ''}`}
            onClick={() => {
              if (!interactive) return;
              // click the current value again to clear it (0 = Not Rated)
              onChange?.(value === star ? 0 : star);
            }}
          >
            {filled ? '★' : '☆'}
          </button>
        );
      })}
      <span className="stars__value">{value > 0 ? `${value}/5` : 'Not rated'}</span>
    </div>
  );
}
