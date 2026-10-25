import { useState, useEffect, useCallback } from 'react';
import {
  X, Loader2, Users, Clock, Shield, Lock, Unlock, Settings2,
  Check, UserMinus, ChevronRight, AlertCircle,
} from 'lucide-react';
import {
  fetchLoungeMembers, fetchPendingJoinRequests, approveJoinRequest,
  declineJoinRequest, updateMemberRole, removeLoungeMember,
  updateLoungeAccessMode, updateLoungeDiscoverability, updateLoungePassword,
  isLoungeModerator,
  type LoungeMembership, type JoinRequest,
} from '@/lib/loungeMembershipStore';
import { resolveDemoProfile } from '@/data/demoCommunityProfiles';
import { DEMO_ACCOUNTS } from '@/types';

const GOLD = '#d4a52c';
const GOLD_SOFT = '#f5e6b0';
const BORDER = 'rgba(212,165,44,0.18)';

interface Props {
  loungeSlug: string;
  loungeName: string;
  userId: string;
  memberships: LoungeMembership[];
  onClose: () => void;
}

type Tab = 'general' | 'access' | 'members' | 'requests' | 'roles';

export function LoungeManagementPanel({ loungeSlug, loungeName, userId, memberships, onClose }: Props) {
  const [tab, setTab] = useState<Tab>('general');
  const [members, setMembers] = useState<{ user_id: string; role: string; status: string; joined_at: string }[]>([]);
  const [requests, setRequests] = useState<JoinRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [accessMode, setAccessMode] = useState('open');
  const [discoverability, setDiscoverability] = useState('public');
  const [passwordValue, setPasswordValue] = useState('');
  const [passwordMsg, setPasswordMsg] = useState('');
  const [memberSearch, setMemberSearch] = useState('');

  const canManage = isLoungeModerator(memberships, loungeSlug);

  const loadMembers = useCallback(async () => {
    setLoading(true);
    const [mems, reqs] = await Promise.all([
      fetchLoungeMembers(loungeSlug),
      fetchPendingJoinRequests(loungeSlug),
    ]);
    setMembers(mems);
    setRequests(reqs);
    setLoading(false);
  }, [loungeSlug]);

  useEffect(() => {
    if (!canManage) return;
    void loadMembers();
  }, [canManage, loadMembers]);

  if (!canManage) {
    return (
      <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
        <div className="rounded-xl border p-6 text-center" style={{ borderColor: BORDER, background: 'rgba(8,10,12,0.96)' }} onClick={(e) => e.stopPropagation()}>
          <AlertCircle className="mx-auto h-6 w-6 text-amber-400/60" strokeWidth={1.5} />
          <p className="mt-3 text-[12px] text-white/60">You don't have moderator permissions for this Lounge.</p>
          <button onClick={onClose} className="mt-4 rounded-lg border border-white/10 px-4 py-2 text-[10px] font-bold tracking-widest uppercase text-white/50">Close</button>
        </div>
      </div>
    );
  }

  const getUserName = (id: string): string => {
    const demo = resolveDemoProfile(id);
    if (demo) return demo.displayName;
    const acct = DEMO_ACCOUNTS.find((a) => a.id === id);
    if (acct) return acct.name;
    return id.slice(0, 8);
  };

  async function handleApprove(req: JoinRequest) {
    setActionLoading(req.id);
    await approveJoinRequest(req.id, req.user_id, loungeSlug, userId);
    setActionLoading(null);
    await loadMembers();
  }

  async function handleDecline(req: JoinRequest) {
    setActionLoading(req.id);
    await declineJoinRequest(req.id, userId);
    setActionLoading(null);
    await loadMembers();
  }

  async function handleRoleChange(memberUserId: string, newRole: string) {
    setActionLoading(`role-${memberUserId}`);
    await updateMemberRole(loungeSlug, memberUserId, newRole);
    setActionLoading(null);
    await loadMembers();
  }

  async function handleRemoveMember(memberUserId: string) {
    setActionLoading(`remove-${memberUserId}`);
    await removeLoungeMember(loungeSlug, memberUserId);
    setActionLoading(null);
    await loadMembers();
  }

  async function handleSaveAccess() {
    setActionLoading('save-access');
    await updateLoungeAccessMode(loungeSlug, accessMode);
    await updateLoungeDiscoverability(loungeSlug, discoverability);
    setActionLoading(null);
  }

  async function handleSavePassword() {
    if (!passwordValue.trim()) return;
    setActionLoading('save-password');
    const ok = await updateLoungePassword(loungeSlug, passwordValue.trim());
    setActionLoading(null);
    if (ok) {
      setPasswordMsg('Password updated.');
      setPasswordValue('');
      setTimeout(() => setPasswordMsg(''), 3000);
    } else {
      setPasswordMsg('Failed to update password.');
    }
  }

  const filteredMembers = memberSearch.trim()
    ? members.filter((m) => getUserName(m.user_id).toLowerCase().includes(memberSearch.toLowerCase()))
    : members;

  const tabs: { id: Tab; label: string; icon: typeof Users }[] = [
    { id: 'general', label: 'General', icon: Settings2 },
    { id: 'access', label: 'Access', icon: Lock },
    { id: 'members', label: 'Members', icon: Users },
    { id: 'requests', label: 'Requests', icon: Clock },
    { id: 'roles', label: 'Roles', icon: Shield },
  ];

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border" style={{ borderColor: BORDER, background: 'rgba(8,10,12,0.97)' }} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-white/[0.06] px-5 py-3">
          <div className="flex items-center gap-2.5">
            <Settings2 className="h-4 w-4" style={{ color: GOLD }} strokeWidth={1.5} />
            <h2 className="text-[13px] font-bold text-white">Manage {loungeName}</h2>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white/80">
            <X className="h-4 w-4" strokeWidth={1.5} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex shrink-0 gap-0.5 border-b border-white/[0.04] px-3 py-2">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[10px] font-bold tracking-widest uppercase transition-colors"
              style={tab === t.id
                ? { background: 'rgba(212,165,44,0.1)', color: GOLD_SOFT }
                : { color: 'rgba(255,255,255,0.3)' }
              }
            >
              <t.icon className="h-3 w-3" strokeWidth={1.5} />
              {t.label}
              {t.id === 'requests' && requests.length > 0 && (
                <span className="ml-0.5 rounded-full bg-amber-400/20 px-1.5 text-[8px] text-amber-400">{requests.length}</span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {loading && tab !== 'general' && tab !== 'access' && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin" style={{ color: GOLD }} />
            </div>
          )}

          {/* GENERAL */}
          {tab === 'general' && (
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-[9px] font-bold tracking-widest uppercase text-white/40">Lounge Name</label>
                <p className="text-[12px] text-white/80">{loungeName}</p>
              </div>
              <div>
                <label className="mb-1 block text-[9px] font-bold tracking-widest uppercase text-white/40">Slug</label>
                <p className="font-mono text-[12px] text-white/60">{loungeSlug}</p>
              </div>
              <div>
                <label className="mb-1 block text-[9px] font-bold tracking-widest uppercase text-white/40">Member Count</label>
                <p className="text-[12px] text-white/80">{members.length} active</p>
              </div>
              <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                <p className="text-[10px] leading-relaxed text-white/40">
                  Lounge management allows you to configure access rules, manage members, approve join requests, and assign moderator roles. Lounge roles (Owner, Admin, Moderator) only apply within this Lounge and do not grant global SpotVault administrative permissions.
                </p>
              </div>
            </div>
          )}

          {/* ACCESS */}
          {tab === 'access' && (
            <div className="space-y-5">
              <div>
                <label className="mb-2 block text-[9px] font-bold tracking-widest uppercase text-white/40">Access Mode</label>
                <div className="space-y-2">
                  {[
                    { value: 'open', label: 'Open', desc: 'Anyone can join freely', icon: Unlock },
                    { value: 'approval', label: 'Approval Required', desc: 'Users must request to join', icon: Clock },
                    { value: 'password', label: 'Password Required', desc: 'Users must enter a password', icon: Lock },
                    { value: 'password_approval', label: 'Password + Approval', desc: 'Password and moderator approval', icon: Shield },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setAccessMode(opt.value)}
                      className="flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-all"
                      style={accessMode === opt.value
                        ? { borderColor: 'rgba(212,165,44,0.3)', background: 'rgba(212,165,44,0.06)' }
                        : { borderColor: 'rgba(255,255,255,0.06)', background: 'transparent' }
                      }
                    >
                      <opt.icon className="h-4 w-4 shrink-0" style={{ color: accessMode === opt.value ? GOLD : 'rgba(255,255,255,0.3)' }} strokeWidth={1.5} />
                      <div>
                        <div className="text-[11px] font-semibold text-white/80">{opt.label}</div>
                        <div className="text-[9px] text-white/40">{opt.desc}</div>
                      </div>
                      {accessMode === opt.value && <Check className="ml-auto h-3.5 w-3.5" style={{ color: GOLD }} strokeWidth={2} />}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-2 block text-[9px] font-bold tracking-widest uppercase text-white/40">Discoverability</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setDiscoverability('public')}
                    className="flex-1 rounded-lg border px-3 py-2 text-[10px] font-bold tracking-widest uppercase transition-all"
                    style={discoverability === 'public' ? { borderColor: 'rgba(212,165,44,0.3)', background: 'rgba(212,165,44,0.06)', color: GOLD_SOFT } : { borderColor: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)' }}
                  >
                    Publicly Searchable
                  </button>
                  <button
                    onClick={() => setDiscoverability('unlisted')}
                    className="flex-1 rounded-lg border px-3 py-2 text-[10px] font-bold tracking-widest uppercase transition-all"
                    style={discoverability === 'unlisted' ? { borderColor: 'rgba(212,165,44,0.3)', background: 'rgba(212,165,44,0.06)', color: GOLD_SOFT } : { borderColor: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)' }}
                  >
                    Unlisted
                  </button>
                </div>
                <p className="mt-1.5 text-[9px] text-white/30">
                  Unlisted Lounges don't appear in search — only reachable via invite or direct link.
                </p>
              </div>

              {(accessMode === 'password' || accessMode === 'password_approval') && (
                <div>
                  <label className="mb-1.5 block text-[9px] font-bold tracking-widest uppercase text-white/40">Lounge Password</label>
                  <div className="flex gap-2">
                    <input
                      type="password"
                      value={passwordValue}
                      onChange={(e) => setPasswordValue(e.target.value)}
                      placeholder="Set new password..."
                      className="flex-1 rounded-lg border border-white/[0.08] bg-black/40 px-3 py-2 text-[12px] text-white outline-none placeholder:text-white/25 focus:border-[#c0911e]/30"
                    />
                    <button
                      onClick={() => void handleSavePassword()}
                      disabled={actionLoading === 'save-password' || !passwordValue.trim()}
                      className="rounded-lg border px-4 py-2 text-[10px] font-bold tracking-widest uppercase transition disabled:opacity-40"
                      style={{ borderColor: BORDER, color: GOLD_SOFT, background: 'rgba(192,145,30,0.12)' }}
                    >
                      {actionLoading === 'save-password' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Save'}
                    </button>
                  </div>
                  {passwordMsg && <p className="mt-1.5 text-[10px] text-emerald-400">{passwordMsg}</p>}
                </div>
              )}

              <button
                onClick={() => void handleSaveAccess()}
                disabled={actionLoading === 'save-access'}
                className="w-full rounded-lg border py-2.5 text-[10px] font-bold tracking-widest uppercase transition disabled:opacity-40"
                style={{ borderColor: BORDER, color: GOLD_SOFT, background: 'rgba(192,145,30,0.1)' }}
              >
                {actionLoading === 'save-access' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Save Access Settings'}
              </button>
            </div>
          )}

          {/* MEMBERS */}
          {tab === 'members' && !loading && (
            <div className="space-y-3">
              <input
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                placeholder="Search members..."
                className="w-full rounded-lg border border-white/[0.08] bg-black/40 px-3 py-2 text-[11px] text-white outline-none placeholder:text-white/25 focus:border-[#c0911e]/30"
              />
              <div className="space-y-1">
                {filteredMembers.map((m) => (
                  <div key={m.user_id} className="flex items-center gap-3 rounded-lg border border-white/[0.04] px-3 py-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-white/5 text-[10px] font-bold text-white/50">
                      {getUserName(m.user_id).charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-[11px] font-semibold text-white/80">{getUserName(m.user_id)}</span>
                        {m.role && m.role !== 'member' && (
                          <span className="shrink-0 rounded px-1 py-0 text-[7px] font-bold tracking-wider uppercase" style={{ background: 'rgba(212,165,44,0.12)', color: GOLD_SOFT, border: `1px solid ${BORDER}` }}>
                            {m.role === 'owner' ? 'OWNER' : m.role === 'admin' ? 'ADMIN' : 'MOD'}
                          </span>
                        )}
                      </div>
                      <span className="text-[8px] text-white/30">Joined {new Date(m.joined_at).toLocaleDateString()}</span>
                    </div>
                    {m.role !== 'owner' && m.user_id !== userId && (
                      <button
                        onClick={() => void handleRemoveMember(m.user_id)}
                        disabled={actionLoading === `remove-${m.user_id}`}
                        className="rounded-md border border-red-400/20 px-2 py-1 text-[8px] font-bold tracking-widest uppercase text-red-400/60 transition hover:bg-red-400/10"
                      >
                        {actionLoading === `remove-${m.user_id}` ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Remove'}
                      </button>
                    )}
                  </div>
                ))}
                {filteredMembers.length === 0 && (
                  <p className="py-4 text-center text-[10px] text-white/30">No members found.</p>
                )}
              </div>
            </div>
          )}

          {/* REQUESTS */}
          {tab === 'requests' && !loading && (
            <div className="space-y-2">
              {requests.length === 0 ? (
                <div className="py-8 text-center">
                  <Clock className="mx-auto h-6 w-6 text-white/20" strokeWidth={1.5} />
                  <p className="mt-2 text-[11px] text-white/30">No pending join requests.</p>
                </div>
              ) : (
                requests.map((req) => (
                  <div key={req.id} className="flex items-center gap-3 rounded-lg border border-amber-400/15 bg-amber-400/[0.03] px-3 py-2.5">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full border border-amber-400/20 bg-amber-400/10 text-[10px] font-bold text-amber-400/70">
                      <Clock className="h-3.5 w-3.5" strokeWidth={1.5} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="text-[11px] font-semibold text-white/80">Join Request</span>
                      <div className="text-[8px] text-white/30">
                        {new Date(req.created_at).toLocaleDateString()}
                        {req.password_verified && ' · Password verified'}
                      </div>
                    </div>
                    <button
                      onClick={() => void handleDecline(req)}
                      disabled={actionLoading === req.id}
                      className="rounded-md border border-red-400/20 px-2.5 py-1 text-[8px] font-bold tracking-widest uppercase text-red-400/60 transition hover:bg-red-400/10"
                    >
                      Decline
                    </button>
                    <button
                      onClick={() => void handleApprove(req)}
                      disabled={actionLoading === req.id}
                      className="rounded-md border px-2.5 py-1 text-[8px] font-bold tracking-widest uppercase transition disabled:opacity-40"
                      style={{ borderColor: BORDER, color: GOLD_SOFT, background: 'rgba(192,145,30,0.1)' }}
                    >
                      {actionLoading === req.id ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Approve'}
                    </button>
                  </div>
                ))
              )}
            </div>
          )}

          {/* ROLES */}
          {tab === 'roles' && !loading && (
            <div className="space-y-2">
              <p className="mb-3 text-[10px] leading-relaxed text-white/40">
                Promote members to Moderator or Admin. Lounge roles only apply within this Lounge — they do not grant global SpotVault Staff permissions.
              </p>
              {members.map((m) => (
                <div key={m.user_id} className="flex items-center gap-3 rounded-lg border border-white/[0.04] px-3 py-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-white/5 text-[10px] font-bold text-white/50">
                    {getUserName(m.user_id).charAt(0).toUpperCase()}
                  </div>
                  <span className="min-w-0 flex-1 truncate text-[11px] font-semibold text-white/80">{getUserName(m.user_id)}</span>
                  <select
                    value={m.role ?? 'member'}
                    onChange={(e) => void handleRoleChange(m.user_id, e.target.value)}
                    disabled={m.role === 'owner' || m.user_id === userId || actionLoading === `role-${m.user_id}`}
                    className="rounded-md border border-white/[0.08] bg-black/40 px-2 py-1 text-[10px] text-white outline-none focus:border-[#c0911e]/30 disabled:opacity-50"
                  >
                    <option value="member">Member</option>
                    <option value="moderator">Moderator</option>
                    <option value="admin">Admin</option>
                    {m.role === 'owner' && <option value="owner">Owner</option>}
                  </select>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
