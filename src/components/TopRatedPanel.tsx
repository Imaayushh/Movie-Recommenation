import { useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { Heading } from '@astryxdesign/core/Heading';
import { List, ListItem } from '@astryxdesign/core/List';
import { ProgressBar } from '@astryxdesign/core/ProgressBar';
import { Section } from '@astryxdesign/core/Section';
import { Stack } from '@astryxdesign/core/Stack';
import { Table, TableBody, TableCell, TableHeader, TableHeaderCell, TableRow } from '@astryxdesign/core/Table';
import { Text } from '@astryxdesign/core/Text';
import { Token } from '@astryxdesign/core/Token';

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
    <Section padding={4}>
      <Stack gap={4}>
        <Stack gap={1}>
          <Heading level={2}>Top rating of movies</Heading>
          <Text color="secondary">
            Average score across all viewers
            {highlightMovieIds.length > 0 ? ' — highlighted rows are movies you rated.' : '.'}
          </Text>
        </Stack>

        <Stack direction="horizontal" gap={1}>
          <Text type="supporting">Minimum ratings:</Text>
          {[1, 2, 3, 4].map((n) => (
            <Button
              key={n}
              label={`${n}+`}
              size="sm"
              variant={minRatings === n ? 'primary' : 'secondary'}
              onClick={() => setMinRatings(n)}
            />
          ))}
          <Button
            label={showMatrix ? 'Hide raw matrix' : 'Show raw matrix'}
            size="sm"
            onClick={() => setShowMatrix((v) => !v)}
          />
        </Stack>

        {ranked.length === 0 ? (
          <Text color="secondary">No movie clears that bar yet.</Text>
        ) : (
          <List listStyle="decimal" hasDividers>
            {ranked.map((stat) => (
              <RankRow
                key={stat.movie.id}
                stat={stat}
                highlight={highlightMovieIds.includes(stat.movie.id)}
              />
            ))}
          </List>
        )}

        {showMatrix && <MatrixTable matrix={matrix} />}
      </Stack>
    </Section>
  );
}

function RankRow({ stat, highlight }: { stat: MovieStat; highlight: boolean }) {
  const category = getCategory(stat.movie.category);
  return (
    <ListItem
      label={stat.movie.moviename}
      description={`${category.emoji} ${category.label}${highlight ? ' · you rated' : ''}`}
      endContent={
        <Stack direction="horizontal" gap={2}>
          <Text weight="bold">{stat.average.toFixed(1)}★</Text>
          <Text type="supporting">
            {stat.count} rating{stat.count > 1 ? 's' : ''}
          </Text>
          <ProgressBar
            label={`${stat.movie.moviename} average`}
            value={Math.round((stat.average / 5) * 100)}
            max={100}
            isLabelHidden
          />
        </Stack>
      }
    />
  );
}

/** The modern equivalent of C `case 3`: dump matrix[i][j] as a grid. */
function MatrixTable({ matrix }: { matrix: Matrix }) {
  return (
    <Stack gap={2}>
      <Stack gap={0.5}>
        <Heading level={3}>Raw ratings matrix</Heading>
        <Text type="supporting">0 = Not Rated, 1–5 = Rating. Rows are users, columns are movies.</Text>
      </Stack>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHeaderCell>User</TableHeaderCell>
            {matrix.movies.map((m) => (
              <TableHeaderCell key={m.id}>{m.id}</TableHeaderCell>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {matrix.users.map((user, ui) => (
            <TableRow key={user.id}>
              <TableCell>
                {user.name} ({user.id})
              </TableCell>
              {matrix.movies.map((movie, mi) => {
                const value = matrix.values[ui][mi];
                return <TableCell key={movie.id}>{value === 0 ? '·' : value}</TableCell>;
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <Token label="matrix[user][movie]" />
    </Stack>
  );
}
