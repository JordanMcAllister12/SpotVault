import { useSyncExternalStore } from 'react';

export interface PrivateMessage {
  id: string;
  authorId: string;
  authorName: string;
  body: string;
  timestamp: string;
}

export interface PrivateConversation {
  memberId: string;
  messages: PrivateMessage[];
  unread: number;
}

export interface ChatContact {
  id: string;
  name: string;
  role: string;
  online: boolean;
}

interface PrivateChatState {
  conversations: Record<string, PrivateConversation>;
  contacts: ChatContact[];
  currentUserId: string;
  currentUserName: string;
  currentUserRole: string;
}

let state: PrivateChatState = {
  conversations: {},
  contacts: [],
  currentUserId: '',
  currentUserName: '',
  currentUserRole: '',
};

const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

function getSnapshot() {
  return state;
}

function setState(updater: (prev: PrivateChatState) => PrivateChatState) {
  state = updater(state);
  notify();
}

export function initPrivateChat(
  contacts: ChatContact[],
  currentUserId: string,
  currentUserName: string,
  currentUserRole: string,
) {
  setState((prev) => {
    if (
      prev.currentUserId === currentUserId &&
      prev.currentUserName === currentUserName &&
      prev.currentUserRole === currentUserRole &&
      prev.contacts.length === contacts.length &&
      prev.contacts.every((c, i) => c.id === contacts[i].id && c.name === contacts[i].name)
    ) {
      return prev;
    }
    return {
      ...prev,
      contacts,
      currentUserId,
      currentUserName,
      currentUserRole,
      conversations: prev.conversations,
    };
  });
}

export function openConversation(memberId: string) {
  setState((prev) => {
    if (!prev.conversations[memberId]) {
      return {
        ...prev,
        conversations: {
          ...prev.conversations,
          [memberId]: { memberId, messages: [], unread: 0 },
        },
      };
    }
    return {
      ...prev,
      conversations: {
        ...prev.conversations,
        [memberId]: { ...prev.conversations[memberId], unread: 0 },
      },
    };
  });
}

export function sendPrivateMessage(memberId: string, body: string) {
  const msg: PrivateMessage = {
    id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `pm-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    authorId: state.currentUserId,
    authorName: state.currentUserName,
    body,
    timestamp: nowTime(),
  };
  setState((prev) => ({
    ...prev,
    conversations: {
      ...prev.conversations,
      [memberId]: {
        ...(prev.conversations[memberId] ?? { memberId, messages: [], unread: 0 }),
        messages: [...(prev.conversations[memberId]?.messages ?? []), msg],
      },
    },
  }));
}

export function receivePrivateMessage(memberId: string, authorName: string, body: string) {
  const msg: PrivateMessage = {
    id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `pm-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    authorId: memberId,
    authorName,
    body,
    timestamp: nowTime(),
  };
  setState((prev) => {
    const existing = prev.conversations[memberId];
    if (existing && existing.messages.some((m) => m.id === msg.id)) return prev;
    return {
      ...prev,
      conversations: {
        ...prev.conversations,
        [memberId]: {
          ...(existing ?? { memberId, messages: [], unread: 0 }),
          messages: [...(existing?.messages ?? []), msg],
          unread: (existing?.unread ?? 0) + 1,
        },
      },
    };
  });
}

export function getTotalUnread(): number {
  return Object.values(state.conversations).reduce((sum, c) => sum + c.unread, 0);
}

export function usePrivateChat(): PrivateChatState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

function nowTime(): string {
  const d = new Date();
  let h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m} ${ampm}`;
}
