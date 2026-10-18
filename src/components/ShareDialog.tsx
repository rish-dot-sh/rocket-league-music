// ABOUTME: Share sheet for a public match page: the link, X, and Discord.
// ABOUTME: Discord has no web share intent, so that option copies a message to paste instead.

'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, Copy, Link2, Share2 } from 'lucide-react';

import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';

interface SharedSong {
  title: string;
  artist: string;
  /** The player the song was recommended for, which decides the score's order. */
  playerId?: string;
}

interface ShareDialogProps {
  /** The page being shared. */
  url: string;
  /** The replay's stored metrics; the post is built from its facts. */
  metrics: any;
  /** The top recommended song, once the player has generated songs. */
  topSong?: SharedSong | null;
  /** Whether the viewer uploaded this replay, and so may say "my". */
  isOwner?: boolean;
}

/**
 * The facts a stranger can read: the score, the playlist and the map. Team
 * names are left out because they are only ever "Blue" and "Orange", and the
 * map's variant in brackets is dropped the way a player would say it. The score
 * reads from the given player's side when they are on orange, so a 5-2 win is
 * never posted as a 2-5; with no player it stays blue-first.
 */
function matchFacts(metrics: any, playerId?: string) {
  const blue = metrics?.teams?.blue?.goals;
  const orange = metrics?.teams?.orange?.goals;
  const onOrange = (metrics?.teams?.orange?.players ?? []).some(
    (player: { id?: string }) => player.id === playerId
  );

  return {
    score:
      typeof blue === 'number' && typeof orange === 'number'
        ? onOrange
          ? `${orange}-${blue}`
          : `${blue}-${orange}`
        : null,
    playlist:
      typeof metrics?.playlist === 'string'
        ? metrics.playlist.toLowerCase()
        : null,
    map:
      typeof metrics?.map_name === 'string'
        ? metrics.map_name.replace(/\s*\(.*\)\s*$/, '').toLowerCase()
        : null,
  };
}

/**
 * What gets posted, in the player's name rather than the app's.
 *
 * It never uses the replay's title, which is whatever the player typed when
 * saving — "ff", "lol", a date. Once a song has been recommended the post pairs
 * the match with it, because that pairing is the whole product; before then it
 * states the match and lets the link carry the music. It is lowercase, ends
 * without a full stop and types the score with a hyphen, since that is how a
 * result gets typed on a phone and correct typography is what marks a line as
 * written by software. Nothing here names or explains the app.
 *
 * Only the replay's owner says "my". Anyone can share a public match, and the
 * songs can be for any player in it, so everyone else says "this".
 */
export function sharePost(
  metrics: any,
  topSong?: SharedSong | null,
  isOwner = false
): string {
  const { score, playlist, map } = matchFacts(metrics, topSong?.playerId);

  if (topSong?.title && topSong.artist) {
    const whose = isOwner ? 'my' : 'this';
    const match = score
      ? `${whose} ${score}${playlist ? ` in ${playlist}` : ''}`
      : `${whose} match`;
    return `${match} sounded like ${topSong.title} by ${topSong.artist}`;
  }

  if (!score && !playlist && !map) return 'this is what the match sounded like';

  const match = [
    score ?? 'a game',
    playlist && `in ${playlist}`,
    map && `on ${map}`,
  ]
    .filter(Boolean)
    .join(' ');
  return `${match}, and this is what it sounded like`;
}

export function ShareDialog({
  url,
  metrics,
  topSong,
  isOwner = false,
}: ShareDialogProps) {
  const [copied, setCopied] = useState<'link' | 'discord' | null>(null);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined
  );
  const { toast } = useToast();

  const post = sharePost(metrics, topSong, isOwner);

  // One timer at a time, so a second copy gets its full two seconds.
  useEffect(() => () => clearTimeout(resetTimer.current), []);

  const copy = async (text: string, which: 'link' | 'discord') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(which);
      clearTimeout(resetTimer.current);
      resetTimer.current = setTimeout(() => setCopied(null), 2000);
    } catch {
      // Clipboard is unavailable on insecure origins and when permission is
      // denied, and the browser gives no way to ask first.
      toast({
        title: 'Could not copy',
        description: 'Your browser blocked clipboard access.',
        variant: 'destructive',
      });
    }
  };

  const openX = () => {
    const intent = new URL('https://twitter.com/intent/tweet');
    intent.searchParams.set('text', post);
    intent.searchParams.set('url', url);
    window.open(intent.toString(), '_blank', 'noopener,noreferrer');
  };

  return (
    <Dialog
      onOpenChange={(open) => {
        // A reopened dialog should not still say a link was copied.
        if (!open) {
          clearTimeout(resetTimer.current);
          setCopied(null);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="flex items-center gap-2">
          <Share2 className="h-4 w-4" />
          Share
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share this match</DialogTitle>
          <DialogDescription>{post}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          <Button
            variant="outline"
            onClick={() => copy(url, 'link')}
            className="justify-start gap-2"
          >
            {copied === 'link' ? (
              <Check className="h-4 w-4" />
            ) : (
              <Link2 className="h-4 w-4" />
            )}
            {copied === 'link' ? 'Link copied' : 'Copy link'}
          </Button>

          <Button
            variant="outline"
            onClick={openX}
            className="justify-start gap-2"
          >
            <Icons.x className="h-4 w-4" />
            Post on X
          </Button>

          <Button
            variant="outline"
            onClick={() => copy(`${post}\n${url}`, 'discord')}
            className="justify-start gap-2"
          >
            {copied === 'discord' ? (
              <Check className="h-4 w-4" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
            {copied === 'discord' ? 'Copied for Discord' : 'Copy for Discord'}
          </Button>
        </div>

        {/* The label swap above is visual; this is what a screen reader hears. */}
        <span role="status" aria-live="polite" className="sr-only">
          {copied === 'link'
            ? 'Link copied'
            : copied === 'discord'
              ? 'Copied for Discord'
              : ''}
        </span>
      </DialogContent>
    </Dialog>
  );
}
