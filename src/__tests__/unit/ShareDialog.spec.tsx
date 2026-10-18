// ABOUTME: Unit tests for the share post text and the share dialog's options.
// ABOUTME: The post is published in the player's name, so its voice is part of the contract.

import { act, fireEvent, render, screen } from '@testing-library/react';

import { ShareDialog, sharePost } from '@/components/ShareDialog';

jest.mock('lucide-react', () => ({
  Check: () => <span data-testid="icon-check" />,
  Copy: () => <span data-testid="icon-copy" />,
  Link2: () => <span data-testid="icon-link" />,
  Share2: () => <span data-testid="icon-share" />,
  // DialogContent's close button uses this one.
  X: () => <span data-testid="icon-close" />,
}));

jest.mock('@/components/ui/use-toast', () => ({
  useToast: () => ({ toast: jest.fn() }),
}));

const URL_UNDER_TEST = 'https://replayrhythms.example/replays/abc';

// A real match row, as extractMetrics stores it.
const METRICS = {
  title: 'ff',
  playlist: 'Ranked Doubles',
  map_name: 'Farmstead (Pitched)',
  teams: {
    blue: { name: 'Blue', goals: 2, players: [{ id: 'blue-1' }] },
    orange: { name: 'Orange', goals: 5, players: [{ id: 'orange-1' }] },
  },
};

// Songs are recommended for one player; playerId says which.
const SONG = {
  title: 'Blinding Lights',
  artist: 'The Weeknd',
  playerId: 'blue-1',
};

describe('sharePost', () => {
  // Replay titles are whatever the player typed when saving — "ff", "lol", a
  // date — so they never lead the post.
  it('never leads with the replay title', () => {
    expect(sharePost(METRICS)).not.toMatch(/\bff\b/);
    expect(sharePost(METRICS, SONG, true)).not.toMatch(/\bff\b/);
  });

  it('describes the match by its facts before any songs exist', () => {
    expect(sharePost(METRICS)).toBe(
      '2-5 in ranked doubles on farmstead, and this is what it sounded like'
    );
  });

  // The pairing of this match with that song is the whole product.
  it('names the song once one has been recommended', () => {
    expect(sharePost(METRICS, SONG, true)).toBe(
      'my 2-5 in ranked doubles sounded like Blinding Lights by The Weeknd'
    );
  });

  // The share button shows to anyone viewing a public match, and the songs
  // may be for any player in it, so only the owner gets to say "my".
  it('only speaks in the first person for the replay owner', () => {
    expect(sharePost(METRICS, SONG, false)).toBe(
      'this 2-5 in ranked doubles sounded like Blinding Lights by The Weeknd'
    );
  });

  // Read from the player's side, a 5-2 win must not post as a 2-5 loss.
  it('puts the score from the side of the player the songs are for', () => {
    expect(sharePost(METRICS, { ...SONG, playerId: 'orange-1' }, true)).toBe(
      'my 5-2 in ranked doubles sounded like Blinding Lights by The Weeknd'
    );
  });

  it('drops whichever facts the match does not have', () => {
    expect(sharePost({ map_name: 'Farmstead (Pitched)' })).toBe(
      'a game on farmstead, and this is what it sounded like'
    );
    expect(sharePost({ teams: METRICS.teams }, SONG, true)).toBe(
      'my 2-5 sounded like Blinding Lights by The Weeknd'
    );
  });

  it('still reads when nothing about the match is known', () => {
    expect(sharePost(undefined)).toBe('this is what the match sounded like');
    expect(sharePost(undefined, SONG, true)).toBe(
      'my match sounded like Blinding Lights by The Weeknd'
    );
    expect(sharePost(undefined, SONG, false)).toBe(
      'this match sounded like Blinding Lights by The Weeknd'
    );
  });

  // A thumb-typed result uses a hyphen. The typographically correct dash is
  // the polish that marks a line as machine-written.
  it('types the score with a hyphen rather than an en dash', () => {
    expect(sharePost(METRICS)).toContain('2-5');
    expect(sharePost(METRICS)).not.toContain('–');
  });

  it('avoids the tells that make a post read as an advert', () => {
    for (const post of [sharePost(METRICS), sharePost(METRICS, SONG, true)]) {
      const lower = post.toLowerCase();
      for (const tell of [
        'check out',
        'introducing',
        'discover',
        'unleash',
        'elevate',
        'seamless',
        'soundtrack of your',
        'replayrhythms',
        '#',
        '!',
        '—',
      ]) {
        expect(lower).not.toContain(tell);
      }
      // One sentence, no closing full stop, and short enough to leave room
      // for the appended link and whatever the poster adds in front of it.
      expect(post.endsWith('.')).toBe(false);
      expect(post.length).toBeLessThan(140);
    }
  });
});

describe('ShareDialog', () => {
  it('offers the link, X and Discord once opened', () => {
    render(<ShareDialog url={URL_UNDER_TEST} metrics={METRICS} />);

    fireEvent.click(screen.getByRole('button', { name: /share/i }));

    expect(
      screen.getByRole('button', { name: 'Copy link' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Post on X' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Copy for Discord' })
    ).toBeInTheDocument();
  });

  // The dialog is opened by a generic share icon, so reusing that icon on the X
  // option made it read as a second "share" button rather than X.
  it('marks the X option with the X logo, not the generic share icon', () => {
    render(<ShareDialog url={URL_UNDER_TEST} metrics={METRICS} />);

    fireEvent.click(screen.getByRole('button', { name: /share/i }));

    const xButton = screen.getByRole('button', { name: 'Post on X' });
    expect(xButton.querySelector('[data-testid="icon-share"]')).toBeNull();
    expect(xButton.querySelector('svg')).not.toBeNull();
  });

  it('shows the post before it is sent anywhere', () => {
    render(<ShareDialog url={URL_UNDER_TEST} metrics={METRICS} />);

    fireEvent.click(screen.getByRole('button', { name: /share/i }));

    expect(screen.getByText(sharePost(METRICS))).toBeInTheDocument();
  });

  // The button's label swap is visual; a screen reader needs a live region.
  it('announces a successful copy to screen readers', async () => {
    Object.assign(navigator, {
      clipboard: { writeText: jest.fn().mockResolvedValue(undefined) },
    });
    render(<ShareDialog url={URL_UNDER_TEST} metrics={METRICS} />);
    fireEvent.click(screen.getByRole('button', { name: /share/i }));

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copy link' }));
    });

    expect(screen.getByRole('status')).toHaveTextContent('Link copied');
  });
});
