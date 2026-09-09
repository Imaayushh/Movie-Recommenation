import { useMemo, useState } from 'react';
import { AppShell } from '@astryxdesign/core/AppShell';
import { Layout, LayoutContent } from '@astryxdesign/core/Layout';
import { Stack } from '@astryxdesign/core/Stack';
import { Heading } from '@astryxdesign/core/Heading';
import { Text } from '@astryxdesign/core/Text';
import { TabList, Tab } from '@astryxdesign/core/TabList';
import { Selector } from '@astryxdesign/core/Selector';
import { StatusDot } from '@astryxdesign/core/StatusDot';
import { Button } from '@astryxdesign/core/Button';
import { TextInput } from '@astryxdesign/core/TextInput';
import { Section } from '@astryxdesign/core/Section';
import { Divider } from '@astryxdesign/core/Divider';

import { MOVIES, SEED_RATINGS, USERS } from './data/catalog';
import type { RatingRecord, User } from './types';
import { buildMatrix, recommendForUser } from './lib/recommender';
import { useLocalStorage } from './hooks/useLocalStorage';
import { ReviewPanel } from './components/ReviewPanel';
import { SuggestionsPanel } from './components/SuggestionsPanel';
import { TopRatedPanel } from './components/TopRatedPanel';
import { ExitPanel } from './components/ExitPanel';

type MenuChoice = 1 | 2 | 3 | 4 | 5;

/** The four options of the original C menu, plus one extra. */
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
    <AppShell contentPadding={4}>
      <Layout contentWidth={1120}>
        <LayoutContent>
          <Stack gap={5}>
            <Stack direction="horizontal" gap={4}>
              <Stack gap={0.5}>
                <Heading level={1}>CineMatch</Heading>
                <Text color="secondary">
                  Movie recommendation system — C logic, rebuilt in React + TypeScript
                </Text>
              </Stack>
              <Stack direction="horizontal" gap={2}>
                <Selector
                  label="Viewer"
                  options={users.map((u) => ({ value: String(u.id), label: `${u.name} (id ${u.id})` }))}
                  value={String(activeUser.id)}
                  onChange={(value: string) => setActiveUserId(Number(value))}
                />
                <StatusDot
                  variant={result.unlocked ? 'success' : 'warning'}
                  label={result.unlocked ? 'Genre engine on' : 'Genre engine locked'}
                />
              </Stack>
            </Stack>

            <TabList
              value={String(choice)}
              onChange={(value: string) => {
                setExited(false);
                setChoice(Number(value) as MenuChoice);
              }}
              hasDivider
            >
              {MENU.map((item) => (
                <Tab key={item.id} value={String(item.id)} label={item.label} />
              ))}
            </TabList>

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
              <Section padding={4}>
                <Stack gap={3}>
                  <Stack gap={1}>
                    <Heading level={2}>Add a viewer</Heading>
                    <Text color="secondary">
                      New profiles start cold: no ratings, so the genre engine stays locked until they rate 4★+.
                    </Text>
                  </Stack>
                  <Stack direction="horizontal" gap={2}>
                    <TextInput
                      label="Viewer name"
                      value={newUserName}
                      onChange={(value: string) => setNewUserName(value)}
                    />
                    <Button label="Create & switch" variant="primary" onClick={addUser} />
                  </Stack>
                </Stack>
              </Section>
            )}

            <Divider />
            <Text type="supporting">
              {users.length} viewers · {MOVIES.length} movies · {ratings.length} ratings stored locally
            </Text>
          </Stack>
        </LayoutContent>
      </Layout>
    </AppShell>
  );
}
