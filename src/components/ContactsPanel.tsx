import { useState, useEffect, useCallback } from 'react';
import {
  UserPlus, Search, MessageSquare, UserRound, X, Check, AlertCircle,
  MoreVertical, Trash2, Send,
} from 'lucide-react';
import type { SpotVaultAccount } from '@/types';
import { DEMO_ACCOUNTS } from '@/types';
import {
  getMyContacts, getPendingContactRequests, requestContact,
  acceptContact, declineContact, removeContact, openConversation,
  type Contact,
} from '@/lib/contactsEngine';

const GOLD = '#d4a52c';
const GOLD_SOFT = '#f5e6b0';
const BORDER = 'rgba(212, 165, 44, 0.18)';

function initials(name: string): string {
  return name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
}

export function ContactsPanel({ account }: { account: SpotVaultAccount | null }) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [pendingRequests, setPendingRequests] = useState<Array<{ relationship_id: string; requester_id: string; created_at: string }>>([]);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SpotVaultAccount[]>([]);
  const [sending, setSending] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [openMenuFor, setOpenMenuFor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [c, p] = await Promise.all([getMyContacts(), getPendingContactRequests()]);
    setContacts(c);
    setPendingRequests(p);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Search demo accounts — name/username substring, email exact match only (no enumeration)
  useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults([]); return; }
    const q = searchQuery.trim().toLowerCase();
    setSearchResults(
      DEMO_ACCOUNTS.filter((a) => {
        if (account && a.id === account.id) return false;
        const nameMatch = a.name.toLowerCase().includes(q);
        const usernameMatch = a.username.toLowerCase().includes(q);
        const emailMatch = a.email && a.email.toLowerCase() === q;
        return nameMatch || usernameMatch || emailMatch;
      }).slice(0, 6)
    );
  }, [searchQuery, account]);

  const handleSendRequest = async (targetId: string) => {
    setSending(targetId);
    setError(null);
    const result = await requestContact(targetId);
    setSending(null);
    if (!result) {
      setError('Failed to send contact request.');
    } else {
      setShowSearch(false);
      setSearchQuery('');
      load();
    }
  };

  const handleAccept = async (relId: string) => {
    setActionLoading(relId);
    setError(null);
    const ok = await acceptContact(relId);
    setActionLoading(null);
    if (!ok) setError('Failed to accept contact request.');
    load();
  };

  const handleDecline = async (relId: string) => {
    setActionLoading(relId);
    setError(null);
    const ok = await declineContact(relId);
    setActionLoading(null);
    if (!ok) setError('Failed to decline contact request.');
    load();
  };

  const handleRemove = async (relId: string) => {
    setActionLoading(relId);
    setError(null);
    const ok = await removeContact(relId);
    setActionLoading(null);
    setOpenMenuFor(null);
    if (!ok) setError('Failed to remove contact.');
    load();
  };

  const handleMessage = (contact: Contact) => {
    const acct = DEMO_ACCOUNTS.find((a) => a.id === contact.user_id);
    if (acct) {
      openConversation(contact.user_id, acct.name);
    }
  };

  const activeContacts = contacts.filter((c) => c.status === 'active');
  const pendingOutgoing = contacts.filter((c) => c.status === 'pending');

  const accountForId = (userId: string): SpotVaultAccount | null => {
    return DEMO_ACCOUNTS.find((a) => a.id === userId) ?? null;
  };

  return (
    <div className="flex flex-col">
      {/* Section header */}
      <div className="flex items-center justify-between px-3 py-2">
        <span className="text-[9px] font-bold tracking-[0.2em] text-white/40 uppercase">Contacts</span>
        <button
          onClick={() => setShowSearch(!showSearch)}
          className="flex items-center gap-1 rounded-md border border-white/[0.08] bg-white/[0.03] px-2 py-1 text-[9px] font-semibold text-white/50 uppercase transition hover:bg-white/10 hover:text-white/80"
        >
          <UserPlus className="h-3 w-3" /> Add
        </button>
      </div>

      {/* Search modal */}
      {showSearch && (
        <div className="mx-2 mb-2 rounded-lg border border-white/[0.08] bg-black/40 p-2.5">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-white/30" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
              placeholder="Search people..."
              className="w-full rounded-md border border-white/10 bg-white/[0.03] py-2 pl-8 pr-3 text-[11px] text-white outline-none placeholder:text-white/25 focus:border-[#d4a52c]/40"
            />
          </div>
          <div className="mt-2 space-y-1.5">
            {searchResults.length === 0 && searchQuery.trim() && (
              <p className="py-2 text-center text-[10px] text-white/30">No SpotVault accounts found.</p>
            )}
            {searchResults.map((result) => {
              const isAlreadyContact = contacts.some((c) => c.user_id === result.id);
              return (
                <div key={result.id} className="flex items-center justify-between rounded-md border border-white/[0.04] bg-white/[0.02] p-2">
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full border border-[#c0911e]/30 bg-gradient-to-b from-[#2a2010] to-[#1a1408] text-[9px] font-bold text-[#d4a52c]">
                      {initials(result.name)}
                    </div>
                    <div>
                      <div className="text-[11px] font-semibold text-white">{result.name}</div>
                      <div className="text-[9px] text-white/35">@{result.username}</div>
                    </div>
                  </div>
                  {isAlreadyContact ? (
                    <span className="text-[9px] text-emerald-400/60">Added</span>
                  ) : (
                    <button
                      disabled={sending === result.id}
                      onClick={() => handleSendRequest(result.id)}
                      className="rounded-md border border-[#d4a52c]/40 bg-[#c0911e]/15 px-2.5 py-1 text-[9px] font-bold text-[#f5e6b0] uppercase transition hover:bg-[#c0911e]/25 disabled:opacity-50"
                    >
                      {sending === result.id ? '...' : 'Add'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          <button
            onClick={() => { setShowSearch(false); setSearchQuery(''); }}
            className="mt-2 w-full rounded-md border border-white/[0.06] py-1.5 text-[9px] font-semibold text-white/40 uppercase hover:bg-white/5"
          >
            Close
          </button>
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="mx-2 mb-1 rounded-md border border-red-300/20 bg-red-300/5 px-2.5 py-1.5">
          <span className="text-[10px] text-red-300/80">{error}</span>
        </div>
      )}

      {/* Pending incoming requests */}
      {pendingRequests.length > 0 && (
        <div className="mx-2 mb-1 space-y-1.5">
          {pendingRequests.map((req) => {
            const requester = accountForId(req.requester_id);
            const name = requester?.name ?? 'Unknown';
            return (
              <div key={req.relationship_id} className="rounded-lg border border-amber-300/20 bg-amber-300/5 p-2.5">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-3.5 w-3.5 text-amber-300" />
                  <span className="text-[10px] font-semibold text-amber-200">{name} wants to connect</span>
                </div>
                <div className="mt-2 flex gap-1.5">
                  <button
                    disabled={actionLoading === req.relationship_id}
                    onClick={() => handleAccept(req.relationship_id)}
                    className="flex items-center gap-1 rounded-md border border-emerald-300/30 bg-emerald-300/10 px-3 py-1.5 text-[9px] font-bold text-emerald-300 uppercase hover:bg-emerald-300/20 disabled:opacity-50"
                  >
                    <Check className="h-3 w-3" /> Accept
                  </button>
                  <button
                    disabled={actionLoading === req.relationship_id}
                    onClick={() => handleDecline(req.relationship_id)}
                    className="flex items-center gap-1 rounded-md border border-red-300/20 bg-red-300/5 px-3 py-1.5 text-[9px] font-bold text-red-300 uppercase hover:bg-red-300/10 disabled:opacity-50"
                  >
                    <X className="h-3 w-3" /> Decline
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pending outgoing requests */}
      {pendingOutgoing.length > 0 && (
        <div className="mx-2 mb-1">
          {pendingOutgoing.map((contact) => {
            const acct = accountForId(contact.user_id);
            const name = acct?.name ?? 'Unknown';
            return (
              <div key={contact.relationship_id} className="flex items-center gap-2 rounded-md border border-white/[0.04] bg-white/[0.02] px-2.5 py-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-[9px] font-bold text-white/50">
                  {initials(name)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[11px] font-medium text-white/70">{name}</div>
                  <div className="text-[8px] text-amber-300/60">Pending</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Active contacts list */}
      {activeContacts.length === 0 && pendingRequests.length === 0 && pendingOutgoing.length === 0 ? (
        <div className="mx-2 mb-2 rounded-lg border border-dashed border-white/[0.08] p-4 text-center">
          <p className="text-[10px] text-white/30">No contacts yet.</p>
          <p className="mt-0.5 text-[9px] text-white/20">Add people to build your SpotVault network.</p>
        </div>
      ) : (
        <div className="space-y-0.5">
          {activeContacts.map((contact) => {
            const acct = accountForId(contact.user_id);
            const name = acct?.name ?? 'Unknown';
            const username = acct?.username ?? '';
            const menuOpen = openMenuFor === contact.relationship_id;
            return (
              <div key={contact.relationship_id} className="group relative flex items-center gap-2 rounded-md px-2.5 py-2 transition-colors hover:bg-white/[0.03]">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[#c0911e]/30 bg-gradient-to-b from-[#2a2010] to-[#1a1408] text-[9px] font-bold text-[#d4a52c]">
                  {initials(name)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[11px] font-semibold text-white/80">{name}</div>
                  <div className="truncate text-[9px] text-white/30">@{username}</div>
                </div>
                <div className="flex items-center gap-0.5">
                  <button
                    onClick={() => handleMessage(contact)}
                    className="rounded-md p-1.5 text-white/30 transition-colors hover:bg-white/10 hover:text-[#d4a52c]"
                    title="Message"
                  >
                    <MessageSquare className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => setOpenMenuFor(menuOpen ? null : contact.relationship_id)}
                    className="rounded-md p-1.5 text-white/30 transition-colors hover:bg-white/10 hover:text-white/60"
                  >
                    <MoreVertical className="h-3.5 w-3.5" />
                  </button>
                </div>
                {menuOpen && (
                  <div className="absolute right-2 top-10 z-30 w-36 rounded-lg border border-white/[0.08] bg-black/90 py-1 backdrop-blur-xl" style={{ boxShadow: '0 8px 32px -8px rgba(0,0,0,0.8)' }}>
                    <button
                      onClick={() => handleMessage(contact)}
                      className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[10px] text-white/60 transition-colors hover:bg-white/5 hover:text-white"
                    >
                      <Send className="h-3 w-3" /> Message
                    </button>
                    <button
                      onClick={() => handleRemove(contact.relationship_id)}
                      disabled={actionLoading === contact.relationship_id}
                      className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[10px] text-red-400/70 transition-colors hover:bg-red-400/10 hover:text-red-400 disabled:opacity-50"
                    >
                      <Trash2 className="h-3 w-3" /> Remove Contact
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
