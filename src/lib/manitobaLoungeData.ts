import {
  LIVE_TOURNAMENTS,
  LIVE_CASH_GAMES,
  TONIGHT_TOURNAMENTS,
  MANITOBA_POSTS,
  MANITOBA_GROUP_CHAT,
  MANITOBA_DIRECT_CONTACTS,
  MANITOBA_GROUP_PRESENCE,
  type ManitobaTournament,
  type ManitobaCashGame,
  type ManitobaPost,
  type ManitobaChatMessage,
  type ManitobaDirectContact,
} from '@/data/manitobaDemoData';
import type {
  TournamentEvent,
  CashGameSession,
  LoungePost,
} from '@/lib/loungeFramework';
import type { GroupMsg } from '@/components/lounge/GroupChatModule';

function mapTournament(t: ManitobaTournament): TournamentEvent {
  return {
    id: t.id,
    venue: t.venue,
    operator: t.operator,
    name: t.name,
    startTime: t.startTime,
    buyIn: t.buyIn,
    prizePoolContribution: t.prizePoolContribution,
    fee: t.fee,
    feePercent: t.feePercent,
    startingStack: t.startingStack,
    blindLevelMinutes: t.blindLevelMinutes,
    lateRegistration: t.lateRegistration,
    reEntry: t.reEntry,
    reEntryLimit: t.reEntryLimit,
    rebuy: t.rebuy,
    addOn: t.addOn,
    guarantee: t.guarantee,
    live: t.live
      ? {
          level: t.live.level,
          smallBlind: t.live.smallBlind,
          bigBlind: t.live.bigBlind,
          ante: t.live.ante,
          entries: t.live.entries,
          remaining: t.live.remaining,
          reentries: t.live.reentries,
          rebuys: t.live.rebuys,
          totalChips: t.live.totalChips,
          avgStack: t.live.avgStack,
          lateRegRemaining: t.live.lateRegRemaining,
          nextBreakIn: t.live.nextBreakIn,
          elapsed: t.live.elapsed,
          lastUpdated: t.live.lastUpdated,
          prizePool: t.live.prizePool,
          chipCounts: t.live.chipCounts,
        }
      : undefined,
  };
}

function mapCashGame(g: ManitobaCashGame): CashGameSession {
  return {
    id: g.id,
    venue: g.venue,
    game: g.game,
    tables: g.tables,
    players: g.players,
    waiting: g.waiting,
    openSeats: g.openSeats,
    status: g.status,
    startsAt: g.startsAt,
    lastUpdated: g.lastUpdated,
  };
}

import { resolveDemoProfile } from '@/data/demoCommunityProfiles';

function mapPost(p: ManitobaPost): LoungePost {
  const profile = p.authorUserId ? resolveDemoProfile(p.authorUserId) : null;
  return {
    id: p.id,
    author_id: p.authorUserId ?? p.id,
    author_name: p.authorName,
    author_avatar: p.authorAvatar ?? null,
    author_role: profile?.role ?? p.authorRole ?? null,
    body: p.text,
    attachment_type: p.image ? 'image' : null,
    attachment_url: p.image ?? null,
    attachment_label: null,
    reply_to: null,
    created_at: p.timestamp,
  };
}

function mapChatMsg(m: ManitobaChatMessage): GroupMsg {
  return {
    id: m.id,
    author: m.authorName,
    authorName: m.authorName,
    body: m.text,
    ts: m.timestamp,
  };
}

function mapDirectContacts(contacts: ManitobaDirectContact[]) {
  return contacts.map((c) => ({
    id: c.id,
    name: c.name,
    avatar: c.avatar,
    role: c.role,
    online: c.online,
    lastSeen: c.lastSeen,
    previewMessage: c.previewMessage,
    previewTimestamp: c.previewTimestamp,
    messages: c.messages.map(mapChatMsg),
  }));
}

export function getManitobaLoungeData() {
  return {
    liveTournaments: LIVE_TOURNAMENTS.filter((t) => t.live).map(mapTournament),
    cashGames: LIVE_CASH_GAMES.map(mapCashGame),
    upcomingEvents: TONIGHT_TOURNAMENTS.map(mapTournament),
    seedPosts: MANITOBA_POSTS.map(mapPost),
    seedGroupMessages: MANITOBA_GROUP_CHAT.map(mapChatMsg),
    seedDirectMessages: MANITOBA_DIRECT_CONTACTS[0]?.messages.map(mapChatMsg) ?? [],
    seedDirectContacts: mapDirectContacts(MANITOBA_DIRECT_CONTACTS),
    seedGroupPresence: MANITOBA_GROUP_PRESENCE,
    region: 'Manitoba',
  };
}
