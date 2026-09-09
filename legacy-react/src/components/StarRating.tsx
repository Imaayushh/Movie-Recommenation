import { Button } from '@astryxdesign/core/Button';
import { Stack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';

interface StarRatingProps {
  value: number;
  onChange?: (rating: number) => void;
  size?: 'sm' | 'md' | 'lg';
  readOnly?: boolean;
}

const BUTTON_SIZE = { sm: 'sm', md: 'md', lg: 'lg' } as const;

export function StarRating({ value, onChange, size = 'md', readOnly = false }: StarRatingProps) {
  const interactive = !readOnly && Boolean(onChange);

  return (
    <Stack direction="horizontal" gap={0.5}>
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = star <= value;
        return (
          <Button
            key={star}
            size={BUTTON_SIZE[size]}
            variant={filled ? 'primary' : 'ghost'}
            label={filled ? '★' : '☆'}
            aria-label={`${star} star${star > 1 ? 's' : ''}`}
            aria-pressed={filled}
            isDisabled={!interactive}
            onClick={() => {
              if (!interactive) return;
              // clicking the current value clears it (0 = Not Rated)
              onChange?.(value === star ? 0 : star);
            }}
          />
        );
      })}
      <Text type="supporting">{value > 0 ? `${value}/5` : 'Not rated'}</Text>
    </Stack>
  );
}
