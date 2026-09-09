import { useMemo, useState } from 'react';
import { Badge } from '@astryxdesign/core/Badge';
import { Banner } from '@astryxdesign/core/Banner';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { Grid } from '@astryxdesign/core/Grid';
import { Heading } from '@astryxdesign/core/Heading';
import { List, ListItem } from '@astryxdesign/core/List';
import { ProgressBar } from '@astryxdesign/core/ProgressBar';
import { Section } from '@astryxdesign/core/Section';
import { Stack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { Token } from '@astryxdesign/core/Token';

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
  const [showBreakdown, setShowBreakdown] = useState(false);
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
    <Section padding={4}>
      <Stack gap={4}>
        <Stack gap={1}>
          <Heading level={2}>Give your suggestions</Heading>
          <Text color="secondary">
            Personalised picks for {userName}. The genre engine only switches on once you hand out a{' '}
            {TOP_RATING_THRESHOLD}★ or 5★ — until then you get trending / taste-twin picks.
          </Text>
        </Stack>

        {result.unlocked ? (
          <Banner
            status="success"
            title={`Genre engine unlocked — you rated ${result.liked.length} movie${
              result.liked.length > 1 ? 's' : ''
            } at ${TOP_RATING_THRESHOLD}★+, so we are pulling more titles from those genres.`}
          />
        ) : (
          <Banner
            status="warning"
            title={`Genre engine locked — rate any movie ${TOP_RATING_THRESHOLD}★ or 5★ to unlock same-genre recommendations.`}
          />
        )}

        <Grid columns={{ minWidth: 260 }} gap={2}>
          <Card variant="muted" padding={3}>
            <Stack gap={2}>
              <Text type="label">Top rated by you</Text>
              {result.liked.length === 0 ? (
                <Text color="secondary">Nothing at {TOP_RATING_THRESHOLD}★+ yet.</Text>
              ) : (
                <List density="compact">
                  {result.liked.map((l) => (
                    <ListItem
                      key={l.movie.id}
                      label={l.movie.moviename}
                      endContent={<Badge label={`${l.rating}★`} variant="success" />}
                    />
                  ))}
                </List>
              )}
            </Stack>
          </Card>

          <Card variant="muted" padding={3}>
            <Stack gap={2}>
              <Text type="label">Rated low by you</Text>
              {result.disliked.length === 0 ? (
                <Text color="secondary">No low ratings recorded.</Text>
              ) : (
                <List density="compact">
                  {result.disliked.map((l) => (
                    <ListItem
                      key={l.movie.id}
                      label={l.movie.moviename}
                      endContent={<Badge label={`${l.rating}★`} variant="error" />}
                    />
                  ))}
                </List>
              )}
            </Stack>
          </Card>

          <Card variant="muted" padding={3}>
            <Stack gap={2}>
              <Text type="label">Your taste twins</Text>
              {result.neighbours.length === 0 ? (
                <Text color="secondary">Not enough overlap with other viewers yet.</Text>
              ) : (
                <List density="compact">
                  {result.neighbours.slice(0, 3).map((n) => (
                    <ListItem
                      key={n.user.id}
                      label={n.user.name}
                      endContent={<Badge label={`${Math.round(n.similarity * 100)}%`} />}
                    />
                  ))}
                </List>
              )}
            </Stack>
          </Card>
        </Grid>

        <Stack gap={2}>
          <Text type="label">Filter by genre</Text>
          <Grid columns={{ minWidth: 130 }} gap={1}>
            <Button
              label="All genres"
              size="sm"
              variant={genreFilter === null ? 'primary' : 'secondary'}
              onClick={() => setGenreFilter(null)}
            />
            {CATEGORIES.map((c) => (
              <Button
                key={c.id}
                label={`${c.emoji} ${c.label}`}
                size="sm"
                variant={genreFilter === c.id ? 'primary' : 'secondary'}
                onClick={() => setGenreFilter(genreFilter === c.id ? null : c.id)}
              />
            ))}
          </Grid>
        </Stack>

        <Stack direction="horizontal" gap={2}>
          <Button label="Surprise me" onClick={() => setSpotlight(pickSurprise(result))} />
          {result.unlocked && (
            <Button
              label={grouped ? 'Grouped by genre' : 'Group by genre'}
              variant={grouped ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setGrouped((v) => !v)}
            />
          )}
          <Button label={showBreakdown ? 'Hide scores' : 'Show scores'} size="sm" onClick={() => setShowBreakdown((v) => !v)} />
          <Text type="supporting">{visible.length} suggestion(s)</Text>
        </Stack>

        {spotlight && (
          <Card variant="blue" padding={3}>
            <Stack gap={2}>
              <Text type="label">Tonight's pick</Text>
              <Heading level={3}>{spotlight.movie.moviename}</Heading>
              <Text color="secondary">
                {getCategory(spotlight.movie.category).emoji} {getCategory(spotlight.movie.category).label}
                {spotlight.movie.year ? ` · ${spotlight.movie.year}` : ''} · {spotlight.match}% match
              </Text>
              <Text color="secondary">
                {spotlight.genreScore === 0
                  ? 'Deliberately picked outside your usual genres — something new to try.'
                  : 'A safe bet from a genre you already rate highly.'}
              </Text>
              <Stack direction="horizontal" gap={2}>
                <StarRating value={0} onChange={(rating) => onRate(spotlight.movie.id, rating)} />
                <Button label="Dismiss" size="sm" onClick={() => setSpotlight(null)} />
              </Stack>
            </Stack>
          </Card>
        )}

        {visible.length === 0 ? (
          <Text color="secondary">No suggestions in this genre right now — try another filter.</Text>
        ) : groups ? (
          groups.map(([categoryId, recs]) => {
            const category = getCategory(categoryId);
            const proof = proofFor(categoryId);
            return (
              <Stack gap={2} key={categoryId}>
                <Stack gap={0.5}>
                  <Heading level={3}>
                    {category.emoji} More {category.label}
                  </Heading>
                  <Text type="supporting">
                    {proof.length > 0
                      ? `because you rated ${proof.map((p) => `${p.movie.moviename} ${p.rating}★`).join(' and ')}`
                      : 'from your overall taste profile'}
                  </Text>
                </Stack>
                <Grid columns={{ minWidth: 300 }} gap={2}>
                  {recs.map((rec) => (
                    <RecommendationCard
                      key={rec.movie.id}
                      rec={rec}
                      onRate={onRate}
                      showBreakdown={showBreakdown}
                    />
                  ))}
                </Grid>
              </Stack>
            );
          })
        ) : (
          <Grid columns={{ minWidth: 300 }} gap={2}>
            {visible.map((rec) => (
              <RecommendationCard key={rec.movie.id} rec={rec} onRate={onRate} showBreakdown={showBreakdown} />
            ))}
          </Grid>
        )}
      </Stack>
    </Section>
  );
}

function RecommendationCard({
  rec,
  onRate,
  showBreakdown,
}: {
  rec: Recommendation;
  onRate: (movieId: number, rating: number) => void;
  showBreakdown: boolean;
}) {
  const category = getCategory(rec.movie.category);

  const parts = [
    { label: 'Genre match', value: rec.genreScore, weight: 0.6 },
    { label: 'Taste twins', value: rec.collabScore, weight: 0.3 },
    { label: 'Popularity', value: rec.popularityScore, weight: 0.1 },
  ];

  return (
    <Card padding={3}>
      <Stack gap={2}>
        <Stack direction="horizontal" gap={2}>
          <Stack gap={1}>
            <Heading level={4}>{rec.movie.moviename}</Heading>
            <Token
              label={`${category.emoji} ${category.label}${rec.movie.year ? ` · ${rec.movie.year}` : ''}`}
            />
          </Stack>
          <Text weight="bold">{rec.match}%</Text>
        </Stack>

        <ProgressBar
          label={`${rec.movie.moviename} match`}
          value={rec.match}
          max={100}
          isLabelHidden
          hasValueLabel
        />

        <Stack gap={0.5}>
          {rec.reasons.length === 0 && <Text type="supporting">Recommended by the blended ranking model.</Text>}
          {rec.reasons.map((reason) => (
            <Text key={reason} type="supporting">
              → {reason}
            </Text>
          ))}
        </Stack>

        {showBreakdown && (
          <Stack gap={1}>
            {parts.map((p) => (
              <Stack direction="horizontal" gap={1} key={p.label}>
                <Text type="supporting">{p.label}</Text>
                <ProgressBar
                  label={p.label}
                  value={Math.round(p.value * 100)}
                  max={100}
                  isLabelHidden
                  hasValueLabel
                />
                <Text type="supporting">+{Math.round(p.value * p.weight * 100)}</Text>
              </Stack>
            ))}
            <Text type="supporting">
              contribution points out of 100 — genre stays at 0 until you rate something {TOP_RATING_THRESHOLD}★+
            </Text>
          </Stack>
        )}

        <StarRating value={0} size="sm" onChange={(rating) => onRate(rec.movie.id, rating)} />
      </Stack>
    </Card>
  );
}
