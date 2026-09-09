import { useMemo, useState } from 'react';
import { Banner } from '@astryxdesign/core/Banner';
import { Button } from '@astryxdesign/core/Button';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { Grid } from '@astryxdesign/core/Grid';
import { Heading } from '@astryxdesign/core/Heading';
import { List, ListItem } from '@astryxdesign/core/List';
import { Section } from '@astryxdesign/core/Section';
import { Stack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { TextInput } from '@astryxdesign/core/TextInput';

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

  const submitted = myRatings.filter((r) => r.rating > 0);

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
    <Section padding={4}>
      <Stack gap={4}>
        <Stack gap={1}>
          <Heading level={2}>Give your review</Heading>
          <Text color="secondary">
            Signed in as {user.name} (id {user.id}). Pick a movie, give 1–5 stars, submit. Rating a movie 4★ or 5★
            is what unlocks genre-based suggestions for you.
          </Text>
        </Stack>

        {flash && <Banner status="success" title={flash} />}

        <Stack gap={3}>
          <TextInput
            label="Search movies or genres"
            value={search}
            onChange={(value: string) => setSearch(value)}
          />

          {filtered.length === 0 ? (
            <EmptyState title={`No movie matches "${search}"`} />
          ) : (
            <Grid columns={{ minWidth: 210 }} gap={1}>
              {filtered.map((movie) => {
                const category = getCategory(movie.category);
                const rated = ratingByMovieId.get(movie.id) ?? 0;
                const selected = selectedId === movie.id;
                return (
                  <Button
                    key={movie.id}
                    label={`${movie.moviename} — ${category.label}${rated > 0 ? ` · you: ${rated}★` : ''}`}
                    variant={selected ? 'primary' : 'secondary'}
                    onClick={() => {
                      setSelectedId(movie.id);
                      setPendingRating(rated || 0);
                    }}
                  />
                );
              })}
            </Grid>
          )}

          <Stack direction="horizontal" gap={3}>
            <StarRating value={pendingRating} onChange={setPendingRating} size="lg" />
            <Button label="Submit review" variant="primary" onClick={submit} />
          </Stack>
        </Stack>

        <Stack gap={2}>
          <Heading level={3}>Your reviews ({submitted.length})</Heading>
          {submitted.length === 0 ? (
            <Text color="secondary">You have not rated anything yet.</Text>
          ) : (
            <List hasDividers>
              {submitted.map((r) => {
                const movie = movies.find((m) => m.id === r.movieId);
                if (!movie) return null;
                return (
                  <ListItem
                    key={r.movieId}
                    label={movie.moviename}
                    description={getCategory(movie.category).label}
                    endContent={
                      <Stack direction="horizontal" gap={1}>
                        <StarRating value={r.rating} onChange={(next) => onRate(movie.id, next)} size="sm" />
                        <Button label="Remove" size="sm" onClick={() => onRate(movie.id, 0)} />
                      </Stack>
                    }
                  />
                );
              })}
            </List>
          )}
        </Stack>
      </Stack>
    </Section>
  );
}
