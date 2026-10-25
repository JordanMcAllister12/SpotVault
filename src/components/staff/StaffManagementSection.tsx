import { useState, useEffect, useCallback } from 'react';
import {
  Search, Shield, Crown, ChevronRight, AlertCircle,
  Check, Trash2, UserCog, BadgeCheck, RefreshCw, Plus, X,
  Mail, Building2, Tag as TagIcon, Copy,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
  searchUsersForStaff, fetchStaffDirectory, setStaffMetadata,
  promoteStaff, demoteStaff, promoteSuperUser, demoteSuperUser,
  type StaffDirectoryEntry,
} from '@/lib/staffMetadataStore';
import {
  fetchStaffTags, createStaffTag, updateStaffTag, deleteStaffTag,
  assignStaffTag, removeStaffTag, fetchUserStaffTags,
  setStaffOrganization, fetchEnhancedStaffDirectory,
  createStaffInvitation, listStaffInvitations, resendStaffInvitation, revokeStaffInvitation,
  suspendStaff, reactivateStaff,
  type StaffTag, type EnhancedStaffEntry, type StaffInvitation, type StaffPermissions,
} from '@/lib/staffAccountStore';
import { ConfigurableStaffBadge } from '@/components/community/ConfigurableStaffBadge';
import { StaffTagBadge } from '@/components/community/StaffTagBadge';

const STAFF_TITLE_PRESETS = [
  'Moderator', 'Community Manager', 'Poker Operations',
  'Player Support', 'Content Team', 'Developer', 'Advisor',
];

const BADGE_ICONS = [
  { name: 'ShieldCheck', label: 'Shield' }, { name: 'Scale', label: 'Scale' },
  { name: 'Crown', label: 'Crown' }, { name: 'Star', label: 'Star' },
  { name: 'Wrench', label: 'Wrench' }, { name: 'Headphones', label: 'Support' },
  { name: 'Code', label: 'Code' }, { name: 'Lightbulb', label: 'Idea' },
];

const COLOR_PRESETS = [
  '#d4a52c', '#22c55e', '#3b82f6', '#ef4444', '#f59e0b',
  '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#0a0908',
];

const GOLD = '#d4a52c';
const BORDER = 'rgba(212,165,44,0.15)';

type OrgFilter = 'all' | 'spotvault' | 'stakekings';
type CreateView = 'idle' | 'create' | 'tags' | 'invitations';

export function StaffManagementSection() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<StaffDirectoryEntry[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [selectedUser, setSelectedUser] = useState<StaffDirectoryEntry | null>(null);
  const [directory, setDirectory] = useState<EnhancedStaffEntry[]>([]);
  const [directoryLoading, setDirectoryLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [orgFilter, setOrgFilter] = useState<OrgFilter>('all');
  const [createView, setCreateView] = useState<CreateView>('idle');
  const [tags, setTags] = useState<StaffTag[]>([]);
  const [invitations, setInvitations] = useState<StaffInvitation[]>([]);

  const loadDirectory = useCallback(async () => {
    setDirectoryLoading(true);
    const data = await fetchEnhancedStaffDirectory();
    setDirectory(data);
    setDirectoryLoading(false);
  }, []);

  const loadTags = useCallback(async () => {
    const data = await fetchStaffTags();
    setTags(data);
  }, []);

  const loadInvitations = useCallback(async () => {
    const data = await listStaffInvitations();
    setInvitations(data);
  }, []);

  useEffect(() => { loadDirectory(); loadTags(); loadInvitations(); }, [loadDirectory, loadTags, loadInvitations]);

  const handleSearch = async () => {
    const q = searchQuery.trim();
    if (!q) return;
    setSearching(true); setSearched(true);
    setActionError(null); setActionMsg(null);
    const results = await searchUsersForStaff(q);
    setSearchResults(results);
    setSearching(false);
  };

  const showMsg = (msg: string) => { setActionMsg(msg); setTimeout(() => setActionMsg(null), 4000); };
  const showError = (err: string) => { setActionError(err); setTimeout(() => setActionError(null), 6000); };

  const handlePromoteStaff = async (userId: string, staffTitle: string) => {
    setActionLoading(true); setActionError(null);
    const { error } = await promoteStaff(userId, staffTitle);
    setActionLoading(false);
    if (error) { showError(error); return; }
    showMsg('User promoted to STAFF successfully.');
    await loadDirectory(); setSelectedUser(null);
  };

  const handleDemoteStaff = async (userId: string) => {
    setActionLoading(true); setActionError(null);
    const { error } = await demoteStaff(userId);
    setActionLoading(false);
    if (error) { showError(error); return; }
    showMsg('Staff access removed. User is now a standard USER.');
    await loadDirectory(); setSelectedUser(null);
  };

  const handlePromoteSuper = async (userId: string) => {
    setActionLoading(true); setActionError(null);
    const { error } = await promoteSuperUser(userId);
    setActionLoading(false);
    if (error) { showError(error); return; }
    showMsg('User promoted to SUPERUSER.');
    await loadDirectory(); setSelectedUser(null);
  };

  const handleDemoteSuper = async (userId: string) => {
    setActionLoading(true); setActionError(null);
    const { error } = await demoteSuperUser(userId);
    setActionLoading(false);
    if (error) { showError(error); return; }
    showMsg('Superuser access removed.');
    await loadDirectory(); setSelectedUser(null);
  };

  const handleSetOrg = async (userId: string, org: 'spotvault' | 'stakekings') => {
    setActionLoading(true); setActionError(null);
    const { error } = await setStaffOrganization(userId, org);
    setActionLoading(false);
    if (error) { showError(error); return; }
    showMsg(`Organization set to ${org === 'stakekings' ? 'StakeKings' : 'SpotVault'}.`);
    await loadDirectory();
  };

  const handleAssignTag = async (userId: string, tagId: string) => {
    const { error } = await assignStaffTag(userId, tagId);
    if (error) { showError(error); return; }
    showMsg('Tag assigned.');
  };

  const handleRemoveTag = async (userId: string, tagId: string) => {
    const { error } = await removeStaffTag(userId, tagId);
    if (error) { showError(error); return; }
    showMsg('Tag removed.');
  };

  const handleSuspend = async (userId: string) => {
    setActionLoading(true); setActionError(null);
    const { error } = await suspendStaff(userId);
    setActionLoading(false);
    if (error) { showError(error); return; }
    showMsg('Staff account suspended.');
    await loadDirectory(); setSelectedUser(null);
  };

  const handleReactivate = async (userId: string) => {
    setActionLoading(true); setActionError(null);
    const { error } = await reactivateStaff(userId);
    setActionLoading(false);
    if (error) { showError(error); return; }
    showMsg('Staff account reactivated.');
    await loadDirectory(); setSelectedUser(null);
  };

  const filteredDirectory = directory.filter((e) => {
    if (orgFilter === 'all') return true;
    return e.organization === orgFilter;
  });

  return (
    <div className="h-full overflow-y-auto p-3 sm:p-4">
      {/* Header */}
      <div className="mb-4 flex items-center gap-2">
        <UserCog className="h-5 w-5" style={{ color: GOLD }} strokeWidth={1.5} />
        <h2 className="text-[12px] font-bold tracking-widest text-white/70 uppercase">Staff Management</h2>
      </div>

      {actionMsg && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-emerald-300/25 bg-emerald-300/10 px-3 py-2.5 text-[11px] text-emerald-300">
          <Check className="h-4 w-4" /> {actionMsg}
        </div>
      )}
      {actionError && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-300/25 bg-red-300/10 px-3 py-2.5 text-[11px] text-red-300">
          <AlertCircle className="h-4 w-4" /> {actionError}
        </div>
      )}

      {/* Action buttons */}
      <div className="mb-4 flex flex-wrap gap-2">
        <button
          onClick={() => setCreateView(createView === 'create' ? 'idle' : 'create')}
          className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-[10px] font-bold uppercase tracking-wider transition-all"
          style={{ borderColor: BORDER, background: 'rgba(212,165,44,0.1)', color: '#f5e6b0' }}
        >
          <Plus className="h-3.5 w-3.5" /> Create Staff Account
        </button>
        <button
          onClick={() => { setCreateView(createView === 'tags' ? 'idle' : 'tags'); loadTags(); }}
          className="flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-black/30 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-white/60 hover:text-white/90"
        >
          <TagIcon className="h-3.5 w-3.5" /> Display Tags
        </button>
        <button
          onClick={() => { setCreateView(createView === 'invitations' ? 'idle' : 'invitations'); loadInvitations(); }}
          className="flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-black/30 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-white/60 hover:text-white/90"
        >
          <Mail className="h-3.5 w-3.5" /> Invitations
        </button>
      </div>

      {/* Create Staff Account panel */}
      {createView === 'create' && (
        <CreateStaffPanel
          tags={tags}
          onCreated={(token) => {
            showMsg('Staff invitation created. The invitee will receive an email with activation instructions.');
            loadInvitations();
            setCreateView('idle');
          }}
          onError={showError}
          onSearchExisting={async (email) => {
            const { data } = await supabase.rpc('sv_staff_get_accounts', {
              p_search: email, p_sort: 'alpha_az', p_limit: 5, p_offset: 0,
            });
            return data as StaffDirectoryEntry[] | null;
          }}
          onPromoteExisting={handlePromoteStaff}
        />
      )}

      {/* Tag Manager panel */}
      {createView === 'tags' && (
        <TagManagerPanel tags={tags} onRefresh={loadTags} onError={showError} onMsg={showMsg} />
      )}

      {/* Invitations panel */}
      {createView === 'invitations' && (
        <InvitationsPanel
          invitations={invitations}
          onRefresh={loadInvitations}
          onError={showError}
          onMsg={showMsg}
        />
      )}

      {/* Search */}
      <div className="mb-4 rounded-xl border border-white/[0.08] bg-black/50 p-4">
        <div className="mb-2 text-[10px] font-bold tracking-widest text-white/40 uppercase">Search Staff / User</div>
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/30" strokeWidth={1.5} />
            <input
              type="text" value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
              placeholder="Search by username or email..."
              className="w-full rounded-lg border border-white/[0.08] bg-black/30 py-2.5 pl-9 pr-3 text-[12px] text-white/80 placeholder:text-white/25 outline-none focus:border-[#c0911e]/35"
            />
          </div>
          <button onClick={handleSearch} disabled={searching || !searchQuery.trim()}
            className="flex items-center gap-1.5 rounded-lg border px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider transition-all disabled:opacity-30"
            style={{ borderColor: BORDER, background: 'rgba(212,165,44,0.1)', color: '#f5e6b0' }}>
            {searching ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />} Search
          </button>
        </div>
        {searched && !searching && (
          <div className="mt-3 space-y-2">
            {searchResults.length === 0 ? (
              <p className="py-4 text-center text-[11px] text-white/30">No users found.</p>
            ) : searchResults.map((user) => (
              <button key={user.user_id} onClick={() => handleSelectUser(user)}
                className={`block w-full rounded-lg border p-3 text-left transition ${selectedUser?.user_id === user.user_id ? 'border-[#d4a52c]/40 bg-[#d4a52c]/10' : 'border-white/[0.06] bg-black/30 hover:bg-white/[0.03]'}`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <span className="text-[12px] font-semibold text-white">{user.display_name}</span>
                    {user.username && <span className="ml-2 text-[10px] text-white/40">@{user.username}</span>}
                    <span className="block text-[10px] text-white/50">{user.email}</span>
                    {user.sv_user_id && <span className="block text-[9px] font-mono font-bold text-[#d4a52c]/80">{user.sv_user_id}</span>}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="text-[9px] font-bold tracking-widest text-[#d4a52c] uppercase">{user.role}</span>
                    {user.staff_title && <span className="text-[9px] text-white/40">{user.staff_title}</span>}
                    <ConfigurableStaffBadge userId={user.user_id} size="xs" />
                    <StaffTagBadge userId={user.user_id} size="xs" />
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* User editor panel */}
      {selectedUser && (
        <StaffEditorPanel
          user={selectedUser}
          tags={tags}
          actionLoading={actionLoading}
          onPromoteStaff={handlePromoteStaff}
          onDemoteStaff={handleDemoteStaff}
          onPromoteSuper={handlePromoteSuper}
          onDemoteSuper={handleDemoteSuper}
          onSetOrg={handleSetOrg}
          onAssignTag={handleAssignTag}
          onRemoveTag={handleRemoveTag}
          onSuspend={handleSuspend}
          onReactivate={handleReactivate}
          onSetMetadata={async (title, badgeText, badgeColor, badgeTextColor, badgeIcon) => {
            setActionLoading(true); setActionError(null);
            const { error } = await setStaffMetadata(selectedUser.user_id, title, badgeText, badgeColor, badgeTextColor, badgeIcon);
            setActionLoading(false);
            if (error) { showError(error); return; }
            showMsg('Staff badge and title updated.');
            await loadDirectory();
          }}
          onClose={() => setSelectedUser(null)}
        />
      )}

      {/* Staff directory with org filter */}
      <div className="mt-4 rounded-xl border border-white/[0.08] bg-black/50">
        <div className="flex items-center justify-between border-b border-white/[0.06] p-3">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4" style={{ color: GOLD }} strokeWidth={1.5} />
            <span className="text-[10px] font-bold tracking-widest text-white/50 uppercase">Staff Directory</span>
          </div>
          <div className="flex items-center gap-2">
            {/* Org filter */}
            <div className="flex rounded-md border border-white/10 bg-black/30 p-0.5">
              {(['all', 'spotvault', 'stakekings'] as const).map((f) => (
                <button key={f} onClick={() => setOrgFilter(f)}
                  className="rounded px-2 py-1 text-[8px] font-bold uppercase tracking-wider"
                  style={{ background: orgFilter === f ? 'rgba(212,165,44,0.16)' : 'transparent', color: orgFilter === f ? '#f5e6b0' : 'rgba(255,255,255,0.4)' }}>
                  {f === 'all' ? 'All' : f === 'spotvault' ? 'SpotVault' : 'StakeKings'}
                </button>
              ))}
            </div>
            <button onClick={loadDirectory} className="flex items-center gap-1 text-[9px] font-bold text-white/30 hover:text-white/60">
              <RefreshCw className="h-3 w-3" /> Refresh
            </button>
          </div>
        </div>
        {directoryLoading ? (
          <div className="flex items-center justify-center py-8"><RefreshCw className="h-5 w-5 animate-spin text-white/30" /></div>
        ) : filteredDirectory.length === 0 ? (
          <p className="py-8 text-center text-[11px] text-white/30">No staff accounts found.</p>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {filteredDirectory.map((entry) => (
              <div key={entry.user_id} className="flex items-center justify-between gap-2 p-3 hover:bg-white/[0.02]">
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <span className="text-[12px] font-semibold text-white">{entry.display_name}</span>
                    {entry.username && <span className="ml-1.5 text-[10px] text-white/40">@{entry.username}</span>}
                    {entry.sv_user_id && <span className="block text-[9px] font-mono font-bold text-[#d4a52c]/70">{entry.sv_user_id}</span>}
                    <div className="mt-1 flex items-center gap-2">
                      <span className="text-[8px] font-bold tracking-widest uppercase" style={{ color: entry.organization === 'stakekings' ? '#22c55e' : '#d4a52c' }}>
                        {entry.organization === 'stakekings' ? 'StakeKings' : 'SpotVault'}
                      </span>
                      {entry.status === 'suspended' && <span className="text-[8px] font-bold text-red-400">SUSPENDED</span>}
                    </div>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className={`rounded-full border px-2 py-0.5 text-[8px] font-bold tracking-widest uppercase ${entry.role === 'superuser' ? 'border-[#d4a52c]/30 bg-[#d4a52c]/10 text-[#d4a52c]' : 'border-blue-400/30 bg-blue-400/10 text-blue-400'}`}>
                    {entry.role === 'superuser' ? <Crown className="mr-0.5 inline h-2.5 w-2.5" /> : <Shield className="mr-0.5 inline h-2.5 w-2.5" />}
                    {entry.role}
                  </span>
                  {entry.staff_title && <span className="text-[9px] text-white/40">{entry.staff_title}</span>}
                  <ConfigurableStaffBadge userId={entry.user_id} size="sm" />
                  <StaffTagBadge userId={entry.user_id} size="sm" />
                  <button onClick={() => { handleSelectUser({ ...entry } as StaffDirectoryEntry); }}
                    className="flex items-center gap-1 rounded-md border border-[#c0911e]/25 bg-[#c0911e]/5 px-2 py-1 text-[9px] font-bold text-[#d4a52c] hover:bg-[#c0911e]/15">
                    Edit <ChevronRight className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function handleSelectUserWrapper(user: StaffDirectoryEntry, setter: (u: StaffDirectoryEntry) => void) {
  setter(user);
}

// ── Create Staff Account Panel ──

function CreateStaffPanel({ tags, onCreated, onError, onSearchExisting, onPromoteExisting }: {
  tags: StaffTag[];
  onCreated: (token: string) => void;
  onError: (err: string) => void;
  onSearchExisting: (email: string) => Promise<StaffDirectoryEntry[] | null>;
  onPromoteExisting: (userId: string, staffTitle: string) => Promise<void>;
}) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [organization, setOrganization] = useState<'spotvault' | 'stakekings'>('spotvault');
  const [selectedTagId, setSelectedTagId] = useState<string>('');
  const [perms, setPerms] = useState<StaffPermissions>({ solver: false, analytics: false, chat: false, main_board: false });
  const [creating, setCreating] = useState(false);
  const [existingMatches, setExistingMatches] = useState<StaffDirectoryEntry[]>([]);
  const [searchedExisting, setSearchedExisting] = useState(false);

  const filteredTags = tags.filter((t) => t.is_active && (t.scope === organization || t.scope === 'shared'));

  const handleEmailBlur = async () => {
    if (!email.trim()) return;
    const results = await onSearchExisting(email.trim());
    setSearchedExisting(true);
    setExistingMatches(results ?? []);
  };

  const handleCreate = async () => {
    if (!fullName.trim() || !email.trim()) { onError('Full name and email are required.'); return; }
    setCreating(true);
    const tagId = selectedTagId || null;
    const { token, error } = await createStaffInvitation(email.trim(), fullName.trim(), username.trim(), organization, tagId, perms);
    setCreating(false);
    if (error) { onError(error); return; }
    if (token) onCreated(token);
  };

  return (
    <div className="mb-4 rounded-xl border border-[#c0911e]/20 bg-black/60 p-4">
      <div className="mb-3 flex items-center gap-2">
        <Plus className="h-4 w-4" style={{ color: GOLD }} />
        <span className="text-[11px] font-bold tracking-widest text-white/70 uppercase">Create Staff Account</span>
      </div>

      {/* Existing email match warning */}
      {searchedExisting && existingMatches.length > 0 && (
        <div className="mb-3 rounded-lg border border-amber-300/30 bg-amber-300/10 p-3">
          <div className="text-[10px] font-bold text-amber-200">Existing Account Found</div>
          <p className="mt-1 text-[10px] text-amber-200/70">An account with this email already exists. Promote the existing account instead of creating a duplicate.</p>
          {existingMatches.map((u) => (
            <button key={u.user_id}
              onClick={() => { onPromoteExisting(u.user_id, 'Staff'); }}
              className="mt-2 w-full rounded-md border border-amber-300/30 bg-amber-300/10 px-3 py-2 text-left text-[10px] text-amber-100 hover:bg-amber-300/20">
              <span className="font-bold">{u.display_name}</span> <span className="text-amber-200/60">@{u.username}</span>
              <span className="block text-[9px] text-amber-200/50">{u.email} — Click to promote to Staff</span>
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-[9px] font-bold tracking-wider text-white/40 uppercase">Full Name *</label>
          <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)}
            placeholder="Jane Smith"
            className="w-full rounded-md border border-white/[0.08] bg-black/30 px-3 py-2 text-[12px] text-white/80 placeholder:text-white/25 outline-none focus:border-[#c0911e]/35" />
        </div>
        <div>
          <label className="mb-1 block text-[9px] font-bold tracking-wider text-white/40 uppercase">Email Address *</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} onBlur={handleEmailBlur}
            placeholder="jane@spotvault.com"
            className="w-full rounded-md border border-white/[0.08] bg-black/30 px-3 py-2 text-[12px] text-white/80 placeholder:text-white/25 outline-none focus:border-[#c0911e]/35" />
        </div>
        <div>
          <label className="mb-1 block text-[9px] font-bold tracking-wider text-white/40 uppercase">Username</label>
          <input type="text" value={username} onChange={(e) => setUsername(e.target.value)}
            placeholder="janesmith"
            className="w-full rounded-md border border-white/[0.08] bg-black/30 px-3 py-2 text-[12px] text-white/80 placeholder:text-white/25 outline-none focus:border-[#c0911e]/35" />
        </div>
        <div>
          <label className="mb-1 block text-[9px] font-bold tracking-wider text-white/40 uppercase">Staff Organization</label>
          <div className="flex rounded-md border border-white/10 bg-black/30 p-0.5">
            <button onClick={() => setOrganization('spotvault')}
              className="flex-1 rounded px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider"
              style={{ background: organization === 'spotvault' ? 'rgba(212,165,44,0.16)' : 'transparent', color: organization === 'spotvault' ? '#f5e6b0' : 'rgba(255,255,255,0.4)' }}>
              SpotVault
            </button>
            <button onClick={() => setOrganization('stakekings')}
              className="flex-1 rounded px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider"
              style={{ background: organization === 'stakekings' ? 'rgba(34,197,94,0.16)' : 'transparent', color: organization === 'stakekings' ? '#bbf7d0' : 'rgba(255,255,255,0.4)' }}>
              StakeKings
            </button>
          </div>
        </div>
      </div>

      {/* Display tag selector */}
      <div className="mt-3">
        <label className="mb-1 block text-[9px] font-bold tracking-wider text-white/40 uppercase">Display Tag</label>
        <div className="flex flex-wrap gap-1.5">
          <button onClick={() => setSelectedTagId('')}
            className={`rounded border px-2 py-1 text-[9px] font-medium ${selectedTagId === '' ? 'border-[#d4a52c]/40 bg-[#d4a52c]/15 text-[#f5e6b0]' : 'border-white/10 text-white/40 hover:text-white/70'}`}>
            None
          </button>
          {filteredTags.map((tag) => (
            <button key={tag.id} onClick={() => setSelectedTagId(tag.id)}
              className={`rounded border px-2 py-1 text-[8px] font-bold uppercase tracking-wider ${selectedTagId === tag.id ? 'ring-1 ring-[#d4a52c]/40' : ''}`}
              style={{ color: tag.text_color, background: tag.bg_color, borderColor: tag.border_color || `${tag.bg_color}40` }}>
              {tag.title}
            </button>
          ))}
        </div>
      </div>

      {/* Permissions */}
      <div className="mt-3">
        <label className="mb-1 block text-[9px] font-bold tracking-wider text-white/40 uppercase">Permissions</label>
        <div className="grid grid-cols-2 gap-2">
          {([['solver', 'Solver'], ['analytics', 'Analytics'], ['chat', 'Chat'], ['main_board', 'Main Board']] as const).map(([key, label]) => (
            <label key={key} className={`flex items-center justify-between rounded-lg border px-3 py-2 ${perms[key] ? 'border-emerald-300/20 bg-emerald-300/5' : 'border-white/[0.06] bg-white/[0.02]'}`}>
              <span className="text-[10px] text-white/75">{label}</span>
              <input type="checkbox" checked={perms[key]} onChange={(e) => setPerms((p) => ({ ...p, [key]: e.target.checked }))} className="accent-[#d4a52c]" />
            </label>
          ))}
        </div>
      </div>

      <button onClick={handleCreate} disabled={creating}
        className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-md border border-[#c0911e]/30 bg-[#c0911e]/10 px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider text-[#f5e6b0] hover:bg-[#c0911e]/20 disabled:opacity-30">
        {creating ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />}
        Create Staff Account & Send Invitation
      </button>
    </div>
  );
}

// ── Tag Manager Panel ──

function TagManagerPanel({ tags, onRefresh, onError, onMsg }: {
  tags: StaffTag[];
  onRefresh: () => void;
  onError: (err: string) => void;
  onMsg: (msg: string) => void;
}) {
  const [editingTag, setEditingTag] = useState<StaffTag | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  return (
    <div className="mb-4 rounded-xl border border-white/[0.08] bg-black/50 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TagIcon className="h-4 w-4" style={{ color: GOLD }} />
          <span className="text-[11px] font-bold tracking-widest text-white/70 uppercase">Display Tag Manager</span>
        </div>
        <button onClick={() => { setIsCreating(true); setEditingTag(null); }}
          className="flex items-center gap-1 rounded-md border border-[#c0911e]/25 bg-[#c0911e]/5 px-2 py-1 text-[9px] font-bold text-[#d4a52c] hover:bg-[#c0911e]/15">
          <Plus className="h-3 w-3" /> New Tag
        </button>
      </div>

      {(isCreating || editingTag) && (
        <TagEditor
          tag={editingTag}
          onCancel={() => { setIsCreating(false); setEditingTag(null); }}
          onSave={async (tagData) => {
            if (editingTag) {
              const { error } = await updateStaffTag(editingTag.id, tagData.title, tagData.bgColor, tagData.textColor, tagData.borderColor, tagData.icon, tagData.scope, tagData.isActive);
              if (error) { onError(error); return; }
              onMsg('Tag updated.');
            } else {
              const { error } = await createStaffTag(tagData.title, tagData.bgColor, tagData.textColor, tagData.borderColor, tagData.icon, tagData.scope);
              if (error) { onError(error); return; }
              onMsg('Tag created.');
            }
            await onRefresh();
            setIsCreating(false); setEditingTag(null);
          }}
        />
      )}

      {/* Tag list */}
      <div className="space-y-1.5">
        {tags.length === 0 ? (
          <p className="py-4 text-center text-[11px] text-white/30">No tags found.</p>
        ) : tags.map((tag) => (
          <div key={tag.id} className="flex items-center justify-between rounded-lg border border-white/[0.06] bg-white/[0.02] p-2.5">
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center rounded border px-1.5 py-0.5 text-[8px] font-bold tracking-widest uppercase"
                style={{ color: tag.text_color, background: tag.bg_color, borderColor: tag.border_color || `${tag.bg_color}40` }}>
                {tag.title}
              </span>
              <div className="flex items-center gap-2">
                <span className="text-[8px] font-bold tracking-wider uppercase" style={{ color: tag.scope === 'stakekings' ? '#22c55e' : '#d4a52c' }}>{tag.scope}</span>
                {tag.is_system && <span className="text-[8px] font-bold text-white/30">SYSTEM</span>}
                {!tag.is_active && <span className="text-[8px] font-bold text-amber-400">HIDDEN</span>}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => { setEditingTag(tag); setIsCreating(false); }}
                className="rounded-md border border-white/10 px-2 py-1 text-[9px] font-bold text-white/60 hover:text-white/90">Edit</button>
              {!tag.is_system && (
                <button onClick={() => setConfirmDelete(confirmDelete === tag.id ? null : tag.id)}
                  className="rounded-md border border-red-400/20 px-2 py-1 text-[9px] font-bold text-red-400 hover:bg-red-400/10">Delete</button>
              )}
              {confirmDelete === tag.id && (
                <button onClick={async () => {
                  const { error } = await deleteStaffTag(tag.id);
                  if (error) { onError(error); setConfirmDelete(null); return; }
                  onMsg('Tag deleted.'); setConfirmDelete(null);
                  await onRefresh();
                }} className="rounded-md border border-red-500/40 bg-red-500/20 px-2 py-1 text-[9px] font-bold text-red-300">Confirm</button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TagEditor({ tag, onSave, onCancel }: {
  tag: StaffTag | null;
  onSave: (data: { title: string; bgColor: string; textColor: string; borderColor: string | null; icon: string | null; scope: StaffTag['scope']; isActive: boolean }) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(tag?.title ?? '');
  const [bgColor, setBgColor] = useState(tag?.bg_color ?? '#d4a52c');
  const [textColor, setTextColor] = useState(tag?.text_color ?? '#0a0908');
  const [borderColor, setBorderColor] = useState(tag?.border_color ?? null);
  const [icon, setIcon] = useState(tag?.icon ?? null);
  const [scope, setScope] = useState<StaffTag['scope']>(tag?.scope ?? 'spotvault');
  const [isActive, setIsActive] = useState(tag?.is_active ?? true);

  return (
    <div className="mb-4 rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-[12px] font-semibold text-white">{tag ? 'Edit Tag' : 'New Tag'}</span>
      </div>

      {/* Live preview */}
      <div className="mb-3 flex items-center gap-2 rounded-md border border-white/[0.06] bg-black/30 px-3 py-2.5">
        <span className="text-[12px] font-semibold text-white">Staff Member</span>
        {title && (
          <span className="inline-flex items-center rounded border px-1.5 py-0.5 text-[7px] font-bold tracking-widest uppercase"
            style={{ color: textColor, background: bgColor, borderColor: borderColor || `${bgColor}40` }}>
            {title}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-[9px] font-bold tracking-wider text-white/40 uppercase">Title</label>
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="STAKEKINGS STAFF"
            className="w-full rounded-md border border-white/[0.08] bg-black/30 px-2 py-1.5 text-[11px] text-white/80 placeholder:text-white/25 outline-none focus:border-[#c0911e]/35" />
        </div>
        <div>
          <label className="mb-1 block text-[9px] font-bold tracking-wider text-white/40 uppercase">Scope</label>
          <select value={scope} onChange={(e) => setScope(e.target.value as StaffTag['scope'])}
            className="w-full rounded-md border border-white/[0.08] bg-black/30 px-2 py-1.5 text-[11px] text-white/80 outline-none focus:border-[#c0911e]/35">
            <option value="spotvault">SpotVault</option>
            <option value="stakekings">StakeKings</option>
            <option value="shared">Shared</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-[9px] font-bold tracking-wider text-white/40 uppercase">Background Color</label>
          <div className="flex items-center gap-2">
            <input type="color" value={bgColor.startsWith('rgba') ? '#d4a52c' : bgColor} onChange={(e) => setBgColor(e.target.value)} className="h-8 w-8 rounded border border-white/10 bg-transparent" />
            <input type="text" value={bgColor} onChange={(e) => setBgColor(e.target.value)} className="flex-1 rounded-md border border-white/[0.08] bg-black/30 px-2 py-1.5 text-[10px] font-mono text-white/80" />
          </div>
          <div className="mt-1 flex flex-wrap gap-1">
            {COLOR_PRESETS.map((c) => <button key={c} onClick={() => setBgColor(c)} className="h-4 w-4 rounded border border-white/10" style={{ background: c }} />)}
          </div>
        </div>
        <div>
          <label className="mb-1 block text-[9px] font-bold tracking-wider text-white/40 uppercase">Text Color</label>
          <div className="flex items-center gap-2">
            <input type="color" value={textColor} onChange={(e) => setTextColor(e.target.value)} className="h-8 w-8 rounded border border-white/10 bg-transparent" />
            <input type="text" value={textColor} onChange={(e) => setTextColor(e.target.value)} className="flex-1 rounded-md border border-white/[0.08] bg-black/30 px-2 py-1.5 text-[10px] font-mono text-white/80" />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-[9px] font-bold tracking-wider text-white/40 uppercase">Border Color</label>
          <input type="text" value={borderColor ?? ''} onChange={(e) => setBorderColor(e.target.value || null)} placeholder="Optional"
            className="w-full rounded-md border border-white/[0.08] bg-black/30 px-2 py-1.5 text-[10px] font-mono text-white/80 placeholder:text-white/25" />
        </div>
        <div>
          <label className="mb-1 block text-[9px] font-bold tracking-wider text-white/40 uppercase">Icon</label>
          <select value={icon ?? ''} onChange={(e) => setIcon(e.target.value || null)}
            className="w-full rounded-md border border-white/[0.08] bg-black/30 px-2 py-1.5 text-[11px] text-white/80 outline-none">
            <option value="">None</option>
            {BADGE_ICONS.map((i) => <option key={i.name} value={i.name}>{i.label}</option>)}
          </select>
        </div>
      </div>

      {tag?.is_system && (
        <div className="mt-2 flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-[10px] text-white/60">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="accent-[#d4a52c]" /> Active
          </label>
        </div>
      )}

      <div className="mt-3 flex gap-2">
        <button onClick={() => onSave({ title, bgColor, textColor, borderColor, icon, scope, isActive })}
          className="flex-1 rounded-md border border-[#c0911e]/30 bg-[#c0911e]/10 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-[#f5e6b0] hover:bg-[#c0911e]/20">
          <Check className="mr-1 inline h-3.5 w-3.5" /> Save Tag
        </button>
        <button onClick={onCancel} className="rounded-md border border-white/15 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-white/55 hover:border-white/30">Cancel</button>
      </div>
    </div>
  );
}

// ── Invitations Panel ──

function InvitationsPanel({ invitations, onRefresh, onError, onMsg }: {
  invitations: StaffInvitation[];
  onRefresh: () => void;
  onError: (err: string) => void;
  onMsg: (msg: string) => void;
}) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopyLink = (token: string | null, invId: string) => {
    if (!token) return;
    const link = `${window.location.origin}/?invite=${token}`;
    navigator.clipboard.writeText(link).then(() => {
      setCopiedId(invId);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  return (
    <div className="mb-4 rounded-xl border border-white/[0.08] bg-black/50 p-4">
      <div className="mb-3 flex items-center gap-2">
        <Mail className="h-4 w-4" style={{ color: GOLD }} />
        <span className="text-[11px] font-bold tracking-widest text-white/70 uppercase">Staff Invitations</span>
      </div>

      {invitations.length === 0 ? (
        <p className="py-4 text-center text-[11px] text-white/30">No invitations sent yet.</p>
      ) : (
        <div className="space-y-2">
          {invitations.map((inv) => (
            <div key={inv.id} className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <span className="text-[12px] font-semibold text-white">{inv.full_name}</span>
                  <span className="ml-2 text-[10px] text-white/40">{inv.email}</span>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-[8px] font-bold uppercase tracking-wider" style={{ color: inv.organization === 'stakekings' ? '#22c55e' : '#d4a52c' }}>
                      {inv.organization === 'stakekings' ? 'StakeKings' : 'SpotVault'}
                    </span>
                    <span className={`rounded-full border px-2 py-0.5 text-[7px] font-bold tracking-widest uppercase ${
                      inv.status === 'pending' ? 'border-amber-300/25 bg-amber-300/10 text-amber-200' :
                      inv.status === 'consumed' ? 'border-emerald-300/25 bg-emerald-300/10 text-emerald-300' :
                      'border-red-300/25 bg-red-300/10 text-red-300'
                    }`}>{inv.status}</span>
                    <span className="text-[8px] text-white/30">Created {new Date(inv.created_at).toLocaleDateString()}</span>
                    <span className="text-[8px] text-white/30">Expires {new Date(inv.expires_at).toLocaleDateString()}</span>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  {inv.status === 'pending' && (
                    <>
                      <button onClick={async () => {
                        const { token, error } = await resendStaffInvitation(inv.id);
                        if (error) { onError(error); return; }
                        if (token) handleCopyLink(token, inv.id);
                        onMsg('Invitation resent and link copied to clipboard.');
                        await onRefresh();
                      }} className="rounded-md border border-white/10 px-2 py-1 text-[9px] font-bold text-white/60 hover:text-white/90">Resend</button>
                      <button onClick={async () => {
                        const { error } = await revokeStaffInvitation(inv.id);
                        if (error) { onError(error); return; }
                        onMsg('Invitation revoked.');
                        await onRefresh();
                      }} className="rounded-md border border-red-400/20 px-2 py-1 text-[9px] font-bold text-red-400 hover:bg-red-400/10">Revoke</button>
                    </>
                  )}
                  {copiedId === inv.id && <span className="text-[9px] text-emerald-300"><Check className="inline h-3 w-3" /> Copied</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Staff Editor Panel ──

function StaffEditorPanel({
  user, tags, actionLoading,
  onPromoteStaff, onDemoteStaff, onPromoteSuper, onDemoteSuper,
  onSetOrg, onAssignTag, onRemoveTag, onSuspend, onReactivate, onSetMetadata, onClose,
}: {
  user: StaffDirectoryEntry;
  tags: StaffTag[];
  actionLoading: boolean;
  onPromoteStaff: (userId: string, staffTitle: string) => void;
  onDemoteStaff: (userId: string) => void;
  onPromoteSuper: (userId: string) => void;
  onDemoteSuper: (userId: string) => void;
  onSetOrg: (userId: string, org: 'spotvault' | 'stakekings') => void;
  onAssignTag: (userId: string, tagId: string) => void;
  onRemoveTag: (userId: string, tagId: string) => void;
  onSuspend: (userId: string) => void;
  onReactivate: (userId: string) => void;
  onSetMetadata: (title: string, badgeText: string, badgeColor: string, badgeTextColor: string, badgeIcon: string | null) => void;
  onClose: () => void;
}) {
  const [staffTitle, setStaffTitle] = useState(user.staff_title || '');
  const [badgeText, setBadgeText] = useState(user.badge_text || '');
  const [badgeColor, setBadgeColor] = useState(user.badge_color || '#3b82f6');
  const [badgeTextColor, setBadgeTextColor] = useState(user.badge_text_color || '#ffffff');
  const [badgeIcon, setBadgeIcon] = useState<string | null>(user.badge_icon);
  const [confirmAction, setConfirmAction] = useState<string | null>(null);
  const [userTags, setUserTags] = useState<StaffTag[]>([]);
  const [tagSelectorOpen, setTagSelectorOpen] = useState(false);

  const isStaff = user.role === 'staff' || user.role === 'developer_admin';
  const isSuperUser = user.role === 'superuser';
  const hasMetadata = isStaff || isSuperUser;

  useEffect(() => {
    if (user.user_id) { fetchUserStaffTags(user.user_id).then(setUserTags); }
  }, [user.user_id]);

  const currentOrg = (user as EnhancedStaffEntry).organization ?? 'spotvault';
  const userStatus = (user as EnhancedStaffEntry).status ?? 'active';

  const availableTags = tags.filter((t) => t.is_active && !userTags.some((ut) => ut.id === t.id));

  return (
    <div className="mb-4 rounded-xl border border-[#c0911e]/20 bg-black/60 p-4">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <div className="text-[13px] font-bold text-white">{user.display_name}</div>
          {user.username && <div className="mt-0.5 text-[10px] text-white/45">@{user.username}</div>}
          <div className="mt-0.5 text-[10px] text-white/55">{user.email}</div>
          {user.sv_user_id && <div className="mt-1 text-[10px] font-mono font-bold text-[#d4a52c]">{user.sv_user_id}</div>}
          <div className="mt-2 flex items-center gap-2">
            <span className="text-[9px] font-bold tracking-widest text-[#d4a52c] uppercase">Role: {user.role}</span>
            <ConfigurableStaffBadge userId={user.user_id} size="sm" />
            <StaffTagBadge userId={user.user_id} size="sm" />
          </div>
        </div>
        <button onClick={onClose} className="rounded-lg border border-white/10 px-2 py-1 text-[9px] font-bold text-white/40 hover:text-white/70">Close</button>
      </div>

      {/* Organization Affiliation */}
      {hasMetadata && (
        <div className="mb-4 rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
          <div className="mb-2 flex items-center gap-2">
            <Building2 className="h-3.5 w-3.5 text-white/40" />
            <span className="text-[9px] font-bold tracking-widest text-white/40 uppercase">Organization Affiliation</span>
          </div>
          <div className="flex rounded-md border border-white/10 bg-black/30 p-0.5">
            <button onClick={() => onSetOrg(user.user_id, 'spotvault')} disabled={actionLoading}
              className="flex-1 rounded px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider"
              style={{ background: currentOrg === 'spotvault' ? 'rgba(212,165,44,0.16)' : 'transparent', color: currentOrg === 'spotvault' ? '#f5e6b0' : 'rgba(255,255,255,0.4)' }}>
              SpotVault
            </button>
            <button onClick={() => onSetOrg(user.user_id, 'stakekings')} disabled={actionLoading}
              className="flex-1 rounded px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider"
              style={{ background: currentOrg === 'stakekings' ? 'rgba(34,197,94,0.16)' : 'transparent', color: currentOrg === 'stakekings' ? '#bbf7d0' : 'rgba(255,255,255,0.4)' }}>
              StakeKings
            </button>
          </div>
          {currentOrg === 'stakekings' && (
            <p className="mt-2 text-[9px] text-emerald-300/60">This staff member will be routed to the StakeKings portal after sign-in.</p>
          )}
        </div>
      )}

      {/* Account Role Control */}
      <div className="mb-4 rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
        <div className="mb-2 text-[9px] font-bold tracking-widest text-white/40 uppercase">Account Role</div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold text-white">{user.role.toUpperCase()}</span>
          {!isStaff && !isSuperUser && (
            <button onClick={() => { if (confirmAction === 'promote_staff') { onPromoteStaff(user.user_id, staffTitle || 'Staff'); setConfirmAction(null); } else setConfirmAction('promote_staff'); }}
              disabled={actionLoading}
              className="ml-auto rounded-md border border-blue-400/30 bg-blue-400/10 px-3 py-1.5 text-[9px] font-bold text-blue-400 hover:bg-blue-400/20 disabled:opacity-30">
              {confirmAction === 'promote_staff' ? 'Confirm: Promote to STAFF' : 'Promote to STAFF'}
            </button>
          )}
          {isStaff && (
            <>
              <button onClick={() => { if (confirmAction === 'demote_staff') { onDemoteStaff(user.user_id); setConfirmAction(null); } else setConfirmAction('demote_staff'); }}
                disabled={actionLoading}
                className="ml-auto rounded-md border border-red-400/30 bg-red-400/10 px-3 py-1.5 text-[9px] font-bold text-red-400 hover:bg-red-400/20 disabled:opacity-30">
                {confirmAction === 'demote_staff' ? 'Confirm: Remove Staff' : 'Demote to USER'}
              </button>
              {userStatus === 'active' ? (
                <button onClick={() => { if (confirmAction === 'suspend') { onSuspend(user.user_id); setConfirmAction(null); } else setConfirmAction('suspend'); }}
                  disabled={actionLoading}
                  className="rounded-md border border-amber-400/30 bg-amber-400/10 px-3 py-1.5 text-[9px] font-bold text-amber-400 hover:bg-amber-400/20 disabled:opacity-30">
                  {confirmAction === 'suspend' ? 'Confirm: Suspend' : 'Suspend'}
                </button>
              ) : (
                <button onClick={() => onReactivate(user.user_id)} disabled={actionLoading}
                  className="rounded-md border border-emerald-400/30 bg-emerald-400/10 px-3 py-1.5 text-[9px] font-bold text-emerald-400 hover:bg-emerald-400/20 disabled:opacity-30">
                  Reactivate
                </button>
              )}
            </>
          )}
          {!isSuperUser && (
            <button onClick={() => { if (confirmAction === 'promote_super') { onPromoteSuper(user.user_id); setConfirmAction(null); } else setConfirmAction('promote_super'); }}
              disabled={actionLoading}
              className="rounded-md border border-[#d4a52c]/30 bg-[#d4a52c]/10 px-3 py-1.5 text-[9px] font-bold text-[#d4a52c] hover:bg-[#d4a52c]/20 disabled:opacity-30">
              {confirmAction === 'promote_super' ? 'Confirm: Make SUPERUSER' : 'Make SUPERUSER'}
            </button>
          )}
          {isSuperUser && (
            <button onClick={() => { if (confirmAction === 'demote_super') { onDemoteSuper(user.user_id); setConfirmAction(null); } else setConfirmAction('demote_super'); }}
              disabled={actionLoading}
              className="ml-auto rounded-md border border-red-400/30 bg-red-400/10 px-3 py-1.5 text-[9px] font-bold text-red-400 hover:bg-red-400/20 disabled:opacity-30">
              {confirmAction === 'demote_super' ? 'Confirm: Remove Superuser' : 'Remove SUPERUSER'}
            </button>
          )}
        </div>
      </div>

      {/* Staff Title + Badge Designer */}
      {hasMetadata && (
        <>
          <div className="mb-4 rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
            <div className="mb-2 text-[9px] font-bold tracking-widest text-white/40 uppercase">Staff Title</div>
            <input type="text" value={staffTitle} onChange={(e) => setStaffTitle(e.target.value)} placeholder="e.g. Moderator"
              className="w-full rounded-md border border-white/[0.08] bg-black/30 px-3 py-2 text-[12px] text-white/80 placeholder:text-white/25 outline-none focus:border-[#c0911e]/35" />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {STAFF_TITLE_PRESETS.map((preset) => (
                <button key={preset} onClick={() => setStaffTitle(preset)}
                  className={`rounded border px-2 py-1 text-[9px] font-medium transition ${staffTitle === preset ? 'border-[#d4a52c]/40 bg-[#d4a52c]/15 text-[#f5e6b0]' : 'border-white/10 text-white/40 hover:text-white/70'}`}>
                  {preset}
                </button>
              ))}
            </div>
          </div>

          {/* Tag Assignment */}
          <div className="mb-4 rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
            <div className="mb-2 text-[9px] font-bold tracking-widest text-white/40 uppercase">Assigned Tags</div>
            {userTags.length > 0 ? (
              <div className="mb-2 flex flex-wrap gap-1.5">
                {userTags.map((tag) => (
                  <span key={tag.id} className="inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[8px] font-bold tracking-widest uppercase"
                    style={{ color: tag.text_color, background: tag.bg_color, borderColor: tag.border_color || `${tag.bg_color}40` }}>
                    {tag.title}
                    <button onClick={() => onRemoveTag(user.user_id, tag.id)} className="text-white/40 hover:text-red-400"><X className="h-2.5 w-2.5" /></button>
                  </span>
                ))}
              </div>
            ) : (
              <p className="mb-2 text-[10px] text-white/30">No tags assigned yet.</p>
            )}
            {availableTags.length > 0 && (
              <>
                {!tagSelectorOpen ? (
                  <button onClick={() => setTagSelectorOpen(true)}
                    className="flex items-center gap-1 rounded-md border border-white/10 px-2 py-1 text-[9px] font-bold text-white/60 hover:text-white/90">
                    <Plus className="h-3 w-3" /> Assign Tag
                  </button>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {availableTags.map((tag) => (
                      <button key={tag.id} onClick={() => { onAssignTag(user.user_id, tag.id); setTagSelectorOpen(false); }}
                        className="rounded border px-1.5 py-0.5 text-[8px] font-bold tracking-widest uppercase"
                        style={{ color: tag.text_color, background: tag.bg_color, borderColor: tag.border_color || `${tag.bg_color}40` }}>
                        + {tag.title}
                      </button>
                    ))}
                    <button onClick={() => setTagSelectorOpen(false)} className="text-[9px] text-white/40">Cancel</button>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Badge Designer */}
          <div className="mb-4 rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
            <div className="mb-3 flex items-center gap-2">
              <BadgeCheck className="h-4 w-4" style={{ color: GOLD }} strokeWidth={1.5} />
              <span className="text-[9px] font-bold tracking-widest text-white/40 uppercase">Public Staff Badge (Legacy)</span>
            </div>
            <div className="mb-3 flex items-center gap-2 rounded-md border border-white/[0.06] bg-black/30 px-3 py-2.5">
              <span className="text-[12px] font-semibold text-white">{user.display_name}</span>
              {badgeText && <span className="inline-flex items-center rounded border px-1.5 py-0.5 text-[7px] font-bold tracking-widest uppercase" style={{ color: badgeTextColor, background: badgeColor, borderColor: `${badgeColor}40` }}>{badgeText}</span>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-[9px] font-bold tracking-wider text-white/40 uppercase">Badge Text</label>
                <input type="text" value={badgeText} onChange={(e) => setBadgeText(e.target.value)} placeholder="MODERATOR"
                  className="w-full rounded-md border border-white/[0.08] bg-black/30 px-2 py-1.5 text-[11px] text-white/80 placeholder:text-white/25 outline-none focus:border-[#c0911e]/35" />
              </div>
              <div>
                <label className="mb-1 block text-[9px] font-bold tracking-wider text-white/40 uppercase">Badge Icon</label>
                <select value={badgeIcon ?? ''} onChange={(e) => setBadgeIcon(e.target.value || null)}
                  className="w-full rounded-md border border-white/[0.08] bg-black/30 px-2 py-1.5 text-[11px] text-white/80 outline-none focus:border-[#c0911e]/35">
                  <option value="">None</option>
                  {BADGE_ICONS.map((icon) => <option key={icon.name} value={icon.name}>{icon.label}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[9px] font-bold tracking-wider text-white/40 uppercase">Badge Color</label>
                <div className="flex items-center gap-2">
                  <input type="color" value={badgeColor} onChange={(e) => setBadgeColor(e.target.value)} className="h-8 w-8 rounded border border-white/10 bg-transparent" />
                  <input type="text" value={badgeColor} onChange={(e) => setBadgeColor(e.target.value)} className="flex-1 rounded-md border border-white/[0.08] bg-black/30 px-2 py-1.5 text-[10px] font-mono text-white/80" />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-[9px] font-bold tracking-wider text-white/40 uppercase">Text Color</label>
                <div className="flex items-center gap-2">
                  <input type="color" value={badgeTextColor} onChange={(e) => setBadgeTextColor(e.target.value)} className="h-8 w-8 rounded border border-white/10 bg-transparent" />
                  <input type="text" value={badgeTextColor} onChange={(e) => setBadgeTextColor(e.target.value)} className="flex-1 rounded-md border border-white/[0.08] bg-black/30 px-2 py-1.5 text-[10px] font-mono text-white/80" />
                </div>
              </div>
            </div>
            <button onClick={() => onSetMetadata(staffTitle, badgeText, badgeColor, badgeTextColor, badgeIcon)} disabled={actionLoading}
              className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-md border border-[#c0911e]/30 bg-[#c0911e]/10 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-[#f5e6b0] hover:bg-[#c0911e]/20 disabled:opacity-30">
              {actionLoading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Save Badge & Title
            </button>
          </div>
        </>
      )}
    </div>
  );
}
