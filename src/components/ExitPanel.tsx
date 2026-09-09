import { Button } from '@astryxdesign/core/Button';
import { Heading } from '@astryxdesign/core/Heading';
import { Section } from '@astryxdesign/core/Section';
import { Stack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import type { User } from '../types';

interface ExitPanelProps {
  user: User;
  ratingCount: number;
  onExit: () => void;
  onResume: () => void;
  exited: boolean;
}

export function ExitPanel({ user, ratingCount, onExit, onResume, exited }: ExitPanelProps) {
  return (
    <Section padding={4}>
      <Stack gap={3}>
        <Heading level={2}>{exited ? `Goodbye, ${user.name}` : 'Exit'}</Heading>

        {exited ? (
          <Text color="secondary">
            Session ended. Your local data has been reset to the seeded C dataset.
          </Text>
        ) : (
          <Text color="secondary">
            You have {ratingCount} rating{ratingCount === 1 ? '' : 's'} saved on this device. Exiting clears
            everything added during this session and restores the original dataset.
          </Text>
        )}

        <Stack direction="horizontal" gap={2}>
          {exited ? (
            <Button label="Start a new session" variant="primary" onClick={onResume} />
          ) : (
            <>
              <Button label="Exit & reset data" variant="destructive" onClick={onExit} />
              <Button label="Keep browsing" onClick={onResume} />
            </>
          )}
        </Stack>
      </Stack>
    </Section>
  );
}
