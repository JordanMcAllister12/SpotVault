import { useState, useEffect, useRef, useCallback } from 'react';
import { AvatarImg } from '@/components/shared/Avatar';
import {
  MapPin, Camera, Edit3, Check, X, Loader2, Trophy, Award, Calendar,
  BadgeCheck, ShieldCheck, Link2, Activity, Navigation, TrendingUp, Search,
  ArrowLeft, MessageSquare, Upload, Plus, Trash2, DollarSign,
  Image as ImageIcon, Pencil, FileText, Star, ExternalLink, GripVertical, Maximize2, ChevronLeft, ChevronRight,
} from 'lucide-react';
import {
  fetchProfile, upsertProfile, fetchAccomplishments,
  addAccomplishment, deleteAccomplishment, updateAccomplishment,
  uploadAvatar, uploadAccomplishmentProof, fetchAccomplishmentEvidence,
  deleteAccomplishmentEvidence,
  type UserProfile, type Accomplishment, type AccomplishmentEvidence,
} from '@/lib/profileStore';
import {
  fetchAccolades as fetchVisualAccolades,
  addAccolade,
  updateAccolade,
  deleteAccolade,
  uploadAccoladeImage,
  reorderAccolades,
  toggleAccoladeFeatured,
  type PlayerAccolade,
} from '@/lib/accoladesStore';
import { resolveDemoProfile } from '@/data/demoCommunityProfiles';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { matchCityByText, formatCityLabel, fetchAllCities, type CityRecord } from '@/lib/cityDatabase';
import { type PrivacySettings, getMyPrivacySettings, updatePrivacySettings, getFollowersEnriched, getFollowingEnriched, getFollowerCount, getFollowingCount, type FollowUser } from '@/lib/followEngine';
import { isStaff, isModerator, ModeratorBadge } from '@/components/community/StaffIdentity';
import { ConfigurableStaffBadge } from '@/components/community/ConfigurableStaffBadge';
import { SviTitleBadge } from '@/components/community/SviTitleBadge';
import { MembershipBadge, type BadgeAccountInfo } from '@/components/community/MembershipBadge';
import { resolveTierAsync } from '@/lib/entitlements';
import { fetchUserTitle } from '@/hooks/useUserTitles';
import { DEMO_ACCOUNTS } from '@/types';
import { supabase } from '@/lib/supabase';
import { SubscribeCard, PaidMessageButton } from '@/components/monetization/SubscribeCard';
import { SocialActionsBar } from '@/components/shared/SocialActionsBar';
import { dispatchOpenProfile } from '@/lib/profileEvents';


const GOLD = '#d4a52c';
const GOLD_SOFT = '#f5e6b0';
const BORDER = 'rgba(212,165,44,0.18)';

const POKER_ROLES = [
  'MTT Player', 'Cash Player', 'Coach', 'Creator', 'Streamer',
  'Business', 'Media', 'Stable', 'Investor', 'Industry', 'Other',
];

const CATEGORIES = [
  { value: 'tournament_win', label: 'Tournament Win' },
  { value: 'final_table', label: 'Final Table' },
  { value: 'online_score', label: 'Major Online Score' },
  { value: 'career_cashes', label: 'Career Cashes' },
  { value: 'ranking', label: 'Ranking' },
  { value: 'poker_role', label: 'Poker Role/Title' },
  { value: 'coaching_credential', label: 'Coaching Credential' },
  { value: 'industry_position', label: 'Industry Position' },
  { value: 'other', label: 'Other' },
];

export interface ProfilePageProps {
  accountId: string;
  fallbackName?: string;
  isOwn?: boolean;
  onBack: () => void;
  onMessage?: (accountId: string) => void;
  embedded?: boolean;
  initialTab?: 'about' | 'network' | 'accolades' | 'activity';
}

export function ProfilePage({ accountId, fallbackName, isOwn, onBack, onMessage, embedded, initialTab }: ProfilePageProps) {
  const isMobile = useMediaQuery('(max-width: 768px)');
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [demoProfile] = useState(() => resolveDemoProfile(accountId));
  const [accomplishments, setAccomplishments] = useState<Accomplishment[]>([]);
  const [evidenceMap, setEvidenceMap] = useState<Record<string, AccomplishmentEvidence[]>>({});
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'about' | 'network' | 'accolades' | 'activity'>(initialTab ?? 'about');
  const [showAddAccomplishment, setShowAddAccomplishment] = useState(false);
  const [editingAccomplishment, setEditingAccomplishment] = useState<Accomplishment | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  const [accolades, setAccolades] = useState<PlayerAccolade[]>([]);
  const [accoladeLightbox, setAccoladeLightbox] = useState<number | null>(null);
  const [showAddAccolade, setShowAddAccolade] = useState(false);
  const [editingAccolade, setEditingAccolade] = useState<PlayerAccolade | null>(null);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [followListOpen, setFollowListOpen] = useState<'followers' | 'following' | null>(null);
  const [followList, setFollowList] = useState<FollowUser[]>([]);
  const [followListLoading, setFollowListLoading] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [badgeInfo, setBadgeInfo] = useState<BadgeAccountInfo>({});

  const [form, setForm] = useState({
    display_name: '', username: '', bio: '', location: '', home_city_slug: null as string | null, poker_role: '', avatar_url: '',
    social_links: {} as Record<string, string>,
  });

  const loadProfile = useCallback(async () => {
    setLoading(true);
    const [p, accs, visAccs] = await Promise.all([
      fetchProfile(accountId),
      fetchAccomplishments(accountId),
      fetchVisualAccolades(accountId),
    ]);
    setProfile(p);
    setAccomplishments(accs);
    setAccolades(visAccs);
    if (p) {
      setForm({
        display_name: p.display_name,
        username: p.username || '',
        bio: p.bio,
        location: p.location,
        home_city_slug: p.home_city_slug,
        poker_role: p.poker_role,
        avatar_url: p.avatar_url,
        social_links: p.social_links || {},
      });
    } else if (fallbackName) {
      setForm((prev) => ({ ...prev, display_name: fallbackName }));
    }
    // Load evidence for each accomplishment
    const evMap: Record<string, AccomplishmentEvidence[]> = {};
    await Promise.all(accs.map(async (acc) => {
      const ev = await fetchAccomplishmentEvidence(acc.id);
      evMap[acc.id] = ev;
    }));
    setEvidenceMap(evMap);
    setLoading(false);
  }, [accountId, fallbackName]);

  useEffect(() => { loadProfile(); }, [loadProfile]);

  useEffect(() => {
    getFollowerCount(accountId).then(setFollowerCount);
    getFollowingCount(accountId).then(setFollowingCount);
  }, [accountId]);

  useEffect(() => {
    void (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setCurrentUserId(user.id);
    })();
  }, []);

  useEffect(() => {
    void (async () => {
      const [titleInfo, tier] = await Promise.all([
        fetchUserTitle(accountId),
        resolveTierAsync(accountId),
      ]);
      const acct = DEMO_ACCOUNTS.find((a) => a.id === accountId);
      setBadgeInfo({
        role: acct?.role,
        title: titleInfo?.title ?? null,
        membership_tier: tier,
        partnerAffiliation: acct?.partnerAffiliation ?? null,
      });
    })();
  }, [accountId]);

  const openFollowList = useCallback(async (type: 'followers' | 'following') => {
    setFollowListOpen(type);
    setFollowListLoading(true);
    const data = type === 'followers'
      ? await getFollowersEnriched(accountId)
      : await getFollowingEnriched(accountId);
    setFollowList(data);
    setFollowListLoading(false);
  }, [accountId]);

  const handleSave = async () => {
    setSaving(true);
    let formToSave = { ...form };
    if (!formToSave.home_city_slug && formToSave.location) {
      try {
        const cities = await fetchAllCities();
        const matched = matchCityByText(formToSave.location, cities);
        if (matched) {
          formToSave.home_city_slug = matched.slug;
          if (!formToSave.location || formToSave.location === form.location) {
            formToSave.location = formatCityLabel(matched);
          }
        }
      } catch { /* ignore — user can pick manually */ }
    }
    const ok = await upsertProfile({ account_id: accountId, ...formToSave });
    if (ok) {
      setForm(formToSave);
      setProfile({ account_id: accountId, ...formToSave, username: formToSave.username || null });
      setEditing(false);
    }
    setSaving(false);
  };

  const handleAvatarUpload = async (file: File) => {
    const url = await uploadAvatar(accountId, file);
    if (url) {
      setForm((prev) => ({ ...prev, avatar_url: url }));
      const ok = await upsertProfile({ account_id: accountId, ...form, avatar_url: url });
      if (ok) setProfile((prev) => prev ? { ...prev, avatar_url: url } : prev);
    }
  };

  const handleAddAccomplishment = async (data: {
    title: string; description: string; category: string;
    date: string; event: string; amount: string;
  }) => {
    const acc = await addAccomplishment(
      accountId, data.title, data.description, data.category,
      data.date || null, data.event || null,
      data.amount ? parseFloat(data.amount.replace(/[^0-9.]/g, '')) : null,
    );
    if (acc) {
      setAccomplishments((prev) => [acc, ...prev]);
      setEvidenceMap((prev) => ({ ...prev, [acc.id]: [] }));
      setShowAddAccomplishment(false);
    }
  };

  const handleUpdateAccomplishment = async (id: string, data: {
    title: string; description: string; category: string;
    date: string; event: string; amount: string;
  }) => {
    const ok = await updateAccomplishment(id, {
      title: data.title,
      description: data.description || null,
      category: data.category,
      accomplishment_date: data.date || null,
      event_name: data.event || null,
      prize_amount: data.amount ? parseFloat(data.amount.replace(/[^0-9.]/g, '')) : null,
    });
    if (ok) {
      setAccomplishments((prev) => prev.map((a) => a.id === id ? {
        ...a, title: data.title, description: data.description, category: data.category,
        accomplishment_date: data.date || null, event_name: data.event || null,
        prize_amount: data.amount ? parseFloat(data.amount.replace(/[^0-9.]/g, '')) : null,
      } : a));
      setEditingAccomplishment(null);
    }
  };

  const handleDeleteAccomplishment = async (id: string) => {
    const ok = await deleteAccomplishment(id);
    if (ok) {
      setAccomplishments((prev) => prev.filter((a) => a.id !== id));
      setEvidenceMap((prev) => {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      });
    }
  };

  const handleUploadProof = async (accomplishmentId: string, file: File) => {
    const url = await uploadAccomplishmentProof(accomplishmentId, file);
    if (url) {
      const ev = await fetchAccomplishmentEvidence(accomplishmentId);
      setEvidenceMap((prev) => ({ ...prev, [accomplishmentId]: ev }));
    }
  };

  const handleDeleteProof = async (evidenceId: string, accomplishmentId: string) => {
    const ok = await deleteAccomplishmentEvidence(evidenceId);
    if (ok) {
      const ev = await fetchAccomplishmentEvidence(accomplishmentId);
      setEvidenceMap((prev) => ({ ...prev, [accomplishmentId]: ev }));
    }
  };

  const handleAddAccolade = async (data: {
    image_url: string; title: string; result_text: string; caption: string;
    achievement_date: string; external_url: string; is_featured: boolean;
  }) => {
    const acc = await addAccolade(accountId, {
      image_url: data.image_url,
      title: data.title,
      result_text: data.result_text || null,
      caption: data.caption || null,
      achievement_date: data.achievement_date || null,
      external_url: data.external_url || null,
      is_featured: data.is_featured,
    });
    if (acc) {
      setAccolades((prev) => {
        const next = [...prev, acc];
        return next.sort((a, b) => Number(b.is_featured) - Number(a.is_featured) || a.display_order - b.display_order);
      });
      setShowAddAccolade(false);
    }
  };

  const handleUpdateAccolade = async (id: string, data: {
    image_url: string; title: string; result_text: string; caption: string;
    achievement_date: string; external_url: string; is_featured: boolean;
  }) => {
    const ok = await updateAccolade(id, {
      image_url: data.image_url,
      title: data.title,
      result_text: data.result_text || null,
      caption: data.caption || null,
      achievement_date: data.achievement_date || null,
      external_url: data.external_url || null,
      is_featured: data.is_featured,
    });
    if (ok) {
      setAccolades((prev) => prev.map((a) => a.id === id ? {
        ...a,
        image_url: data.image_url,
        title: data.title,
        result_text: data.result_text || null,
        caption: data.caption || null,
        achievement_date: data.achievement_date || null,
        external_url: data.external_url || null,
        is_featured: data.is_featured,
      } : a));
      setEditingAccolade(null);
    }
  };

  const handleDeleteAccolade = async (id: string) => {
    const ok = await deleteAccolade(id);
    if (ok) {
      setAccolades((prev) => prev.filter((a) => a.id !== id));
    }
  };

  const handleToggleFeatured = async (id: string, isFeatured: boolean) => {
    const ok = await toggleAccoladeFeatured(id, isFeatured);
    if (ok) {
      setAccolades((prev) => {
        const next = prev.map((a) => a.id === id ? { ...a, is_featured: isFeatured } : a);
        return next.sort((a, b) => Number(b.is_featured) - Number(a.is_featured) || a.display_order - b.display_order);
      });
    }
  };

  const handleMoveAccolade = async (id: string, direction: 'up' | 'down') => {
    const currentOrder = accolades.map((a) => a.id);
    const idx = currentOrder.indexOf(id);
    if (idx < 0) return;
    const swapWith = direction === 'up' ? idx - 1 : idx + 1;
    if (swapWith < 0 || swapWith >= currentOrder.length) return;
    [currentOrder[idx], currentOrder[swapWith]] = [currentOrder[swapWith], currentOrder[idx]];
    setAccolades((prev) => {
      const map = new Map(prev.map((a) => [a.id, a]));
      return currentOrder.map((oid) => map.get(oid)!).filter(Boolean);
    });
    await reorderAccolades(accountId, currentOrder);
  };

  const displayName = profile?.display_name || fallbackName || demoProfile?.displayName || 'SpotVault User';
  const username = profile?.username || '';
  const bio = profile?.bio || demoProfile?.bio || '';
  const location = profile?.location || demoProfile?.location || '';
  const homeCitySlug = profile?.home_city_slug || null;
  const role = profile?.poker_role || demoProfile?.role || '';
  const avatarUrl = profile?.avatar_url;
  const accountForProfile = DEMO_ACCOUNTS.find(a => a.id === accountId);
  const isStaffAccount = isStaff(accountForProfile);
  const isModeratorAccount = isModerator(accountForProfile);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-[#d4a52c]" />
      </div>
    );
  }

  const profileHeaderEl = (
    <>
    <ProfileHeader
      accountId={accountId}
      displayName={displayName}
      username={username}
      bio={bio}
      location={location}
      homeCitySlug={homeCitySlug}
      role={role}
      avatarUrl={avatarUrl}
      demoProfile={demoProfile}
      isOwn={!!isOwn}
      isStaffAccount={isStaffAccount}
      isModeratorAccount={isModeratorAccount}
      editing={editing}
      form={form}
      setForm={setForm}
      onAvatarUpload={handleAvatarUpload}
      onSave={handleSave}
      onCancelEdit={() => setEditing(false)}
      saving={saving}
      socialLinks={profile?.social_links ?? {}}
      onEdit={() => setEditing(true)}
      onMessage={onMessage ? () => { onMessage(accountId); onBack(); } : undefined}
      followerCount={followerCount}
      followingCount={followingCount}
      onOpenFollowers={() => openFollowList('followers')}
      onOpenFollowing={() => openFollowList('following')}
      badgeInfo={badgeInfo}
    />
    {!isOwn && currentUserId && (
      <div className="space-y-3 p-3">
        <SocialActionsBar
          targetUserId={accountId}
          recipientName={displayName}
          onMessage={onMessage ? () => { onMessage(accountId); onBack(); } : undefined}
        />
        <SubscribeCard creatorUserId={accountId} creatorName={displayName} currentUserId={currentUserId} portalType="creator" />
        <PaidMessageButton creatorUserId={accountId} currentUserId={currentUserId} portalType="creator" />
      </div>
    )}
    </>
  );

  const tabsPanelEl = !editing && (
    <div className="flex h-full flex-col">
      {/* Tabs — sticky at top of right column */}
      <div className="sticky top-0 z-10 hidden flex-wrap gap-0.5 border-b bg-[#0a0c0e]/90 px-3 pt-2 lg:flex" style={{ borderColor: 'rgba(255,255,255,0.06)', backdropFilter: 'blur(8px)' }}>
        <TabButton active={activeTab === 'about'} onClick={() => setActiveTab('about')} label="About" />
        <TabButton active={activeTab === 'accolades'} onClick={() => setActiveTab('accolades')} label="Accolades" count={accolades.length} />
        <TabButton active={activeTab === 'activity'} onClick={() => setActiveTab('activity')} label="Activity" />
      </div>

      {/* Tab content — scrollable */}
      <div className="min-h-0 flex-1 overflow-y-auto p-3 md:p-4" style={{ maxHeight: isMobile ? 'none' : 'calc(100vh - 260px)' }}>
        {activeTab === 'about' && (
          <AboutSection profile={profile} demoProfile={demoProfile} isOwn={!!isOwn} accountId={accountId} />
        )}

        {activeTab === 'accolades' && (
          <div className="space-y-4">
            <VisualAccoladesSection
              accolades={accolades}
              isOwn={!!isOwn}
              onAdd={() => setShowAddAccolade(true)}
              onEdit={(acc) => setEditingAccolade(acc)}
              onDelete={handleDeleteAccolade}
              onToggleFeatured={handleToggleFeatured}
              onMove={handleMoveAccolade}
              onOpenLightbox={(idx) => setAccoladeLightbox(idx)}
            />
          </div>
        )}

        {activeTab === 'activity' && (
          <ActivitySection isOwn={!!isOwn} displayName={displayName} />
        )}
      </div>
    </div>
  );

  const content = (
    <div className="flex flex-col lg:flex-row">
      {/* Mobile: Tabs appear first (below main account nav, above profile identity) */}
      {!editing && (
        <div className="flex shrink-0 flex-wrap gap-0.5 border-b bg-[#0a0c0e]/90 px-3 pt-2 lg:hidden" style={{ borderColor: 'rgba(255,255,255,0.06)', backdropFilter: 'blur(8px)' }}>
          <TabButton active={activeTab === 'about'} onClick={() => setActiveTab('about')} label="About" />
          <TabButton active={activeTab === 'accolades'} onClick={() => setActiveTab('accolades')} label="Accolades" count={accolades.length} />
          <TabButton active={activeTab === 'activity'} onClick={() => setActiveTab('activity')} label="Activity" />
        </div>
      )}
      {/* Left — Profile identity */}
      <div className="w-full border-b border-white/[0.06] lg:w-[42%] lg:shrink-0 lg:border-b-0 lg:border-r">
        {profileHeaderEl}
      </div>
      {/* Right — Profile information */}
      <div className="min-w-0 flex-1">
        {tabsPanelEl}
      </div>
    </div>
  );

  if (embedded) {
    return (
      <div className="w-full">
        {content}

        {/* Add/Edit Accomplishment modal */}
        {showAddAccomplishment && (
          <AccomplishmentForm
            onSave={handleAddAccomplishment}
            onCancel={() => setShowAddAccomplishment(false)}
          />
        )}
        {editingAccomplishment && (
          <AccomplishmentForm
            initial={editingAccomplishment}
            onSave={(data) => handleUpdateAccomplishment(editingAccomplishment.id, data)}
            onCancel={() => setEditingAccomplishment(null)}
          />
        )}

        {/* Add/Edit Accolade modal */}
        {showAddAccolade && (
          <AccoladeForm
            userId={accountId}
            onSave={handleAddAccolade}
            onCancel={() => setShowAddAccolade(false)}
          />
        )}
        {editingAccolade && (
          <AccoladeForm
            userId={accountId}
            initial={editingAccolade}
            onSave={(data) => handleUpdateAccolade(editingAccolade.id, data)}
            onCancel={() => setEditingAccolade(null)}
          />
        )}

        {/* Accolade lightbox */}
        {accoladeLightbox !== null && accolades[accoladeLightbox] && (
          <AccoladeLightbox
            accolades={accolades}
            startIndex={accoladeLightbox}
            onClose={() => setAccoladeLightbox(null)}
          />
        )}

        {/* Proof preview lightbox */}
        {proofPreview && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 backdrop-blur-md p-4" onClick={() => setProofPreview(null)}>
            <button className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/60 hover:text-white">
              <X className="h-4 w-4" strokeWidth={1.5} />
            </button>
            <img src={proofPreview} alt="Proof" className="max-h-[85vh] max-w-[90vw] rounded-lg border border-[#c091e]/30 object-contain" />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[80] flex flex-col" style={{ background: 'linear-gradient(180deg, rgba(5,6,8,0.85) 0%, rgba(5,6,8,0.92) 100%), url(/player-portal-high-roller-lounge.webp) center/cover no-repeat' }}>
      {/* Top bar */}
      <div className="flex shrink-0 items-center justify-between border-b px-4 py-3" style={{ borderColor: 'rgba(212,165,44,0.12)', background: 'rgba(8,10,12,0.88)', backdropFilter: 'blur(20px)' }}>
        <button onClick={onBack} className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[11px] font-semibold tracking-widest text-white/60 uppercase transition-colors hover:text-white">
          <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.5} /> Back
        </button>
        <span className="text-[10px] font-mono tracking-[0.2em] uppercase" style={{ color: 'rgba(212,165,44,0.4)' }}>User Profile</span>
        {!isOwn && onMessage ? (
          <button onClick={() => { onMessage(accountId); onBack(); }} className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-[10px] font-semibold tracking-widest uppercase transition-all" style={{ borderColor: GOLD + '40', background: GOLD + '10', color: GOLD_SOFT }}>
            <MessageSquare className="h-3 w-3" strokeWidth={1.5} /> Message
          </button>
        ) : (
          <div />
        )}
      </div>

      {/* Scrollable content */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl px-3 py-4 md:px-6 md:py-8">
          <div className="overflow-hidden rounded-2xl border" style={{ borderColor: 'rgba(212,165,44,0.18)', background: 'rgba(5,7,9,0.94)', backdropFilter: 'blur(12px)' }}>
            <div className="flex flex-col lg:flex-row" style={{ minHeight: isMobile ? 'auto' : 'calc(100vh - 220px)' }}>
              {/* Mobile: Tabs appear first (above profile identity), Desktop: tabs stay in right column */}
              {!editing && (
                <div className="flex shrink-0 flex-wrap gap-0.5 border-b bg-[#0a0c0e]/90 px-3 pt-2 lg:hidden" style={{ borderColor: 'rgba(255,255,255,0.06)', backdropFilter: 'blur(8px)' }}>
                  <TabButton active={activeTab === 'about'} onClick={() => setActiveTab('about')} label="About" />
                  <TabButton active={activeTab === 'accolades'} onClick={() => setActiveTab('accolades')} label="Accolades" count={accolades.length} />
                  <TabButton active={activeTab === 'activity'} onClick={() => setActiveTab('activity')} label="Activity" />
                </div>
              )}
              {/* Left — Profile identity */}
              <div className="w-full border-b border-white/[0.06] lg:w-[42%] lg:shrink-0 lg:border-b-0 lg:border-r">
                <ProfileHeader
                  accountId={accountId}
                  displayName={displayName}
                  username={username}
                  bio={bio}
                  location={location}
                  homeCitySlug={homeCitySlug}
                  role={role}
                  avatarUrl={avatarUrl}
                  demoProfile={demoProfile}
                  isOwn={!!isOwn}
                  isStaffAccount={isStaffAccount}
                  isModeratorAccount={isModeratorAccount}
                  editing={editing}
                  form={form}
                  setForm={setForm}
                  onAvatarUpload={handleAvatarUpload}
                  onSave={handleSave}
                  onCancelEdit={() => setEditing(false)}
                  saving={saving}
                  socialLinks={profile?.social_links ?? {}}
                  onEdit={() => setEditing(true)}
                  onMessage={onMessage ? () => { onMessage(accountId); onBack(); } : undefined}
                  followerCount={followerCount}
                  followingCount={followingCount}
                  onOpenFollowers={() => openFollowList('followers')}
                  onOpenFollowing={() => openFollowList('following')}
                />
              </div>
              {/* Right — Profile information */}
              <div className="min-w-0 flex-1">
                {!editing && (
                  <div className="flex h-full flex-col">
                    {/* Tabs — sticky (desktop only, mobile tabs are above profile header) */}
                    <div className="sticky top-0 z-10 hidden flex-wrap gap-0.5 border-b bg-[#0a0c0e]/90 px-3 pt-2 lg:flex" style={{ borderColor: 'rgba(255,255,255,0.06)', backdropFilter: 'blur(8px)' }}>
                      <TabButton active={activeTab === 'about'} onClick={() => setActiveTab('about')} label="About" />
                      <TabButton active={activeTab === 'accolades'} onClick={() => setActiveTab('accolades')} label="Accolades" count={accolades.length} />
                      <TabButton active={activeTab === 'activity'} onClick={() => setActiveTab('activity')} label="Activity" />
                    </div>

                    {/* Tab content — scrollable */}
                    <div className="min-h-0 flex-1 overflow-y-auto p-3 md:p-4" style={{ maxHeight: isMobile ? 'none' : 'calc(100vh - 260px)' }}>
                      {activeTab === 'about' && (
                        <AboutSection profile={profile} demoProfile={demoProfile} isOwn={!!isOwn} accountId={accountId} />
                      )}

                      {activeTab === 'accolades' && (
                        <div className="space-y-4">
                          <SviProfileRankSection userId={accountId} />
                          {isOwn && <SviBadgeCustomizer userId={accountId} />}
                          <VisualAccoladesSection
                            accolades={accolades}
                            isOwn={!!isOwn}
                            onAdd={() => setShowAddAccolade(true)}
                            onEdit={(acc) => setEditingAccolade(acc)}
                            onDelete={handleDeleteAccolade}
                            onToggleFeatured={handleToggleFeatured}
                            onMove={handleMoveAccolade}
                            onOpenLightbox={(idx) => setAccoladeLightbox(idx)}
                          />
                        </div>
                      )}

                      {activeTab === 'activity' && (
                        <ActivitySection isOwn={!!isOwn} displayName={displayName} />
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Add/Edit Accomplishment modal */}
      {showAddAccomplishment && (
        <AccomplishmentForm
          onSave={handleAddAccomplishment}
          onCancel={() => setShowAddAccomplishment(false)}
        />
      )}
      {editingAccomplishment && (
        <AccomplishmentForm
          initial={editingAccomplishment}
          onSave={(data) => handleUpdateAccomplishment(editingAccomplishment.id, data)}
          onCancel={() => setEditingAccomplishment(null)}
        />
      )}

      {/* Add/Edit Accolade modal */}
      {showAddAccolade && (
        <AccoladeForm
          userId={accountId}
          onSave={handleAddAccolade}
          onCancel={() => setShowAddAccolade(false)}
        />
      )}
      {editingAccolade && (
        <AccoladeForm
          userId={accountId}
          initial={editingAccolade}
          onSave={(data) => handleUpdateAccolade(editingAccolade.id, data)}
          onCancel={() => setEditingAccolade(null)}
        />
      )}

      {/* Accolade lightbox */}
      {accoladeLightbox !== null && accolades[accoladeLightbox] && (
        <AccoladeLightbox
          accolades={accolades}
          startIndex={accoladeLightbox}
          onClose={() => setAccoladeLightbox(null)}
        />
      )}

      {/* Follow list modal */}
      {followListOpen && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/80 backdrop-blur-md p-4" onClick={() => setFollowListOpen(null)}>
          <div className="flex max-h-[80vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-[#c0911e]/30 bg-[#0a0c0e]" onClick={(e) => e.stopPropagation()}>
            <div className="flex shrink-0 items-center justify-between border-b border-white/[0.06] px-4 py-3">
              <span className="text-[11px] font-bold tracking-widest text-white/60 uppercase">
                {followListOpen === 'followers' ? 'Followers' : 'Following'}
              </span>
              <button onClick={() => setFollowListOpen(null)} className="flex h-7 w-7 items-center justify-center rounded-full border border-white/10 text-white/50 hover:text-white">
                <X className="h-3.5 w-3.5" strokeWidth={1.5} />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              {followListLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-white/30" />
                </div>
              ) : followList.length === 0 ? (
                <div className="py-8 text-center text-[12px] text-white/30">
                  {followListOpen === 'followers' ? 'No followers yet' : 'Not following anyone yet'}
                </div>
              ) : (
                <div className="space-y-1.5">
                  {followList.map((user) => (
                    <button
                      key={user.user_id}
                      onClick={() => {
                        setFollowListOpen(null);
                        dispatchOpenProfile(user.user_id);
                      }}
                      className="flex w-full items-center gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 text-left transition-colors hover:border-[#c0911e]/20 hover:bg-white/[0.04]"
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-white/5 text-[11px] font-semibold text-white/70">
                        {user.avatar_url ? <AvatarImg src={user.avatar_url} alt="" className="h-full w-full rounded-full object-cover" style={{ objectPosition: user.avatar_url === '/assets/profiles/image copy 6.png' ? 'center 30%' : undefined }} fallback={(user.display_name || '?').charAt(0).toUpperCase()} /> : (user.display_name || '?').charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[12px] font-semibold text-white">{user.display_name || 'Unknown'}</p>
                        {user.username && <p className="truncate text-[10px] text-white/35">@{user.username}</p>}
                        {user.poker_role && <p className="truncate text-[9px] text-white/25">{user.poker_role}</p>}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Proof preview lightbox */}
      {proofPreview && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 backdrop-blur-md p-4" onClick={() => setProofPreview(null)}>
          <button className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/60 hover:text-white">
            <X className="h-4 w-4" strokeWidth={1.5} />
          </button>
          <img src={proofPreview} alt="Proof" className="max-h-[85vh] max-w-[90vw] rounded-lg border border-[#c0911e]/30 object-contain" />
        </div>
      )}
    </div>
  );
}

// ── Profile Header ──

function ProfileHeader({ accountId, displayName, username, bio, location, homeCitySlug, role, avatarUrl, demoProfile, isOwn, isStaffAccount, isModeratorAccount, editing, form, setForm, onAvatarUpload, onSave, onCancelEdit, saving, socialLinks, onEdit, onMessage, followerCount, followingCount, onOpenFollowers, onOpenFollowing, badgeInfo }: {
  accountId: string;
  displayName: string;
  username: string;
  bio: string;
  location: string;
  homeCitySlug: string | null;
  role: string;
  avatarUrl?: string;
  demoProfile: ReturnType<typeof resolveDemoProfile>;
  isOwn: boolean;
  isStaffAccount: boolean;
  isModeratorAccount: boolean;
  editing: boolean;
  form: any;
  setForm: (f: any) => void;
  onAvatarUpload: (file: File) => void;
  onSave: () => void;
  onCancelEdit: () => void;
  saving: boolean;
  socialLinks: Record<string, string>;
  onEdit?: () => void;
  onMessage?: () => void;
  followerCount: number;
  followingCount: number;
  onOpenFollowers: () => void;
  onOpenFollowing: () => void;
  badgeInfo: BadgeAccountInfo;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const socialPlatforms = ['Twitter', 'Instagram', 'Twitch', 'YouTube', 'Website'];
  const [citySearch, setCitySearch] = useState('');
  const [allCities, setAllCities] = useState<CityRecord[]>([]);
  const [cityLoading, setCityLoading] = useState(false);

  const [privacy, setPrivacy] = useState<PrivacySettings>({ who_can_follow: 'everyone', who_can_message: 'contacts_only', share_current_city: false });
  const [privacyLoading, setPrivacyLoading] = useState(false);

  useEffect(() => {
    if (editing && allCities.length === 0) {
      setCityLoading(true);
      fetchAllCities().then(cities => { setAllCities(cities); setCityLoading(false); });
      getMyPrivacySettings().then(p => setPrivacy(p));
    }
  }, [editing, allCities.length]);

  const selectedCity = allCities.find(c => c.slug === form.home_city_slug) ?? null;
  const cityResults = citySearch.trim()
    ? allCities.filter(c => {
        const q = citySearch.toLowerCase();
        const name = c.city_name.toLowerCase();
        const slug = c.slug.toLowerCase();
        const aliases = (c.aliases ?? []).map(a => a.toLowerCase());
        return name.includes(q) || slug.includes(q) || aliases.some(a => a.includes(q));
      }).slice(0, 6)
    : [];

  if (editing) {
    return (
      <div className="p-5 md:p-6">
        {/* Avatar upload */}
        <div className="mb-5 flex items-center gap-4">
          <div className="relative h-20 w-20 shrink-0">
            <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border-2 text-2xl font-bold" style={{ borderColor: GOLD + '80', background: GOLD + '15', color: GOLD_SOFT }}>
              {form.avatar_url ? <AvatarImg src={form.avatar_url} alt="" className="h-full w-full rounded-full object-cover" style={{ objectPosition: form.avatar_url === '/assets/profiles/image copy 6.png' ? 'center 25%' : undefined }} fallback={(form.display_name || 'S').charAt(0).toUpperCase()} /> : (form.display_name || 'S').charAt(0).toUpperCase()}
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border-2 border-[#0a0c0e] bg-[#d4a52c] text-[#0a0c0e]"
            >
              <Camera className="h-3.5 w-3.5" strokeWidth={2} />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onAvatarUpload(file);
              }}
            />
          </div>
          <div>
            <p className="text-[11px] font-bold tracking-widest text-white/50 uppercase">Profile Picture</p>
            <p className="mt-0.5 text-[10px] text-white/30">Make it yours — upload a photo, logo, custom artwork, or an AI-generated avatar.</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-[9px] font-semibold tracking-widest text-white/40 uppercase">Display Name</label>
            <input value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} placeholder="Your name" className="w-full rounded-lg border border-white/10 bg-white/5 px-3.5 py-3 text-sm text-white placeholder-white/30 outline-none focus:border-[#d4a52c]/40" />
          </div>
          <div>
            <label className="mb-1 block text-[9px] font-semibold tracking-widest text-white/40 uppercase">Username</label>
            <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-3">
              <span className="text-sm text-white/30">@</span>
              <input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value.replace(/[^a-zA-Z0-9_]/g, '') })} placeholder="username" className="flex-1 bg-transparent py-3 text-sm text-white placeholder-white/30 outline-none" />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-[9px] font-semibold tracking-widest text-white/40 uppercase">Bio</label>
            <textarea value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} placeholder="Tell the community about yourself..." rows={3} className="w-full resize-none rounded-lg border border-white/10 bg-white/5 px-3.5 py-3 text-sm text-white placeholder-white/30 outline-none focus:border-[#d4a52c]/40" />
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-[9px] font-semibold tracking-widest text-white/40 uppercase">Location (Display)</label>
              <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="e.g. Las Vegas, NV" className="w-full rounded-lg border border-white/10 bg-white/5 px-3.5 py-3 text-sm text-white placeholder-white/30 outline-none focus:border-[#d4a52c]/40" />
            </div>
            <div>
              <label className="mb-1 block text-[9px] font-semibold tracking-widest text-white/40 uppercase">Home City (Poker Scene)</label>
              {selectedCity ? (
                <div className="flex items-center justify-between rounded-lg border border-[#d4a52c]/30 bg-[#c091e]/8 px-3.5 py-3">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-3.5 w-3.5" style={{ color: GOLD }} strokeWidth={1.5} />
                    <span className="text-sm text-white/80">{selectedCity.city_name}, {selectedCity.region}</span>
                  </div>
                  <button onClick={() => setForm({ ...form, home_city_slug: null })} className="text-white/30 hover:text-white"><X className="h-3.5 w-3.5" strokeWidth={1.5} /></button>
                </div>
              ) : (
                <div className="relative">
                  <input
                    value={citySearch}
                    onChange={(e) => setCitySearch(e.target.value)}
                    placeholder="Search city… e.g. Winnipeg, Las Vegas"
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-3.5 py-3 text-sm text-white placeholder-white/30 outline-none focus:border-[#d4a52c]/40"
                  />
                  {cityLoading && <Loader2 className="absolute right-3 top-3.5 h-4 w-4 animate-spin text-white/20" strokeWidth={1.5} />}
                  {cityResults.length > 0 && (
                    <div className="absolute left-0 right-0 top-full z-20 mt-1 rounded-lg border border-white/10 bg-[#0a0c0e] py-1 shadow-2xl">
                      {cityResults.map(c => (
                        <button
                          key={c.slug}
                          onClick={() => { setForm({ ...form, home_city_slug: c.slug }); setCitySearch(''); }}
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-white/70 transition-colors hover:bg-white/5"
                        >
                          <MapPin className="h-3 w-3 text-white/30" strokeWidth={1.5} />
                          {c.city_name}, {c.region} {c.country ? `· ${c.country}` : ''}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <p className="mt-1 text-[9px] text-white/25">Links your profile to a city for local discovery.</p>
            </div>
            <div>
              <label className="mb-1 block text-[9px] font-semibold tracking-widest text-white/40 uppercase">Poker / Industry Role</label>
              <input value={form.poker_role} onChange={(e) => setForm({ ...form, poker_role: e.target.value })} placeholder="e.g. MTT Player, Coach" className="w-full rounded-lg border border-white/10 bg-white/5 px-3.5 py-3 text-sm text-white placeholder-white/30 outline-none focus:border-[#d4a52c]/40" />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-[9px] font-semibold tracking-widest text-white/40 uppercase">Social Links</label>
            <div className="space-y-2">
              {socialPlatforms.map((platform) => (
                <input
                  key={platform}
                  value={form.social_links[platform] || ''}
                  onChange={(e) => setForm({ ...form, social_links: { ...form.social_links, [platform]: e.target.value } })}
                  placeholder={platform}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3.5 py-2.5 text-[12px] text-white placeholder-white/30 outline-none focus:border-[#d4a52c]/40"
                />
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6 flex gap-3">
          <button onClick={onCancelEdit} className="flex-1 rounded-lg border border-white/10 bg-white/5 py-3 text-[11px] font-semibold tracking-widest text-white/60 uppercase hover:text-white" style={{ minHeight: 44 }}>
            Cancel
          </button>
          <button
            onClick={async () => {
              setPrivacyLoading(true);
              await updatePrivacySettings(privacy);
              setPrivacyLoading(false);
              onSave();
            }}
            disabled={saving || privacyLoading}
            className="flex items-center justify-center gap-1.5 flex-1 rounded-lg border py-3 text-[11px] font-semibold tracking-widest uppercase disabled:opacity-50" style={{ borderColor: GOLD + '60', background: GOLD + '20', color: GOLD_SOFT, minHeight: 44 }}>
            {(saving || privacyLoading) ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" strokeWidth={1.5} />} Save Changes
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 md:p-5">
      {(isOwn && !editing && onEdit) || (!isOwn && onMessage) ? (
        <div className="mb-3 flex justify-end">
          {isOwn && !editing && onEdit ? (
            <button
              onClick={onEdit}
              className="flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[10px] font-semibold tracking-widest uppercase transition-all active:scale-95"
              style={{ borderColor: GOLD + '40', background: GOLD + '10', color: GOLD_SOFT }}
              title="Edit Profile"
            >
              <Edit3 className="h-3 w-3" strokeWidth={1.5} /> Edit
            </button>
          ) : onMessage ? (
            <button
              onClick={onMessage}
              className="flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[10px] font-semibold tracking-widest uppercase transition-all active:scale-95"
              style={{ borderColor: GOLD + '40', background: GOLD + '10', color: GOLD_SOFT }}
              title="Send Message"
            >
              <MessageSquare className="h-3 w-3" strokeWidth={1.5} /> Message
            </button>
          ) : null}
        </div>
      ) : null}
      <div className="flex flex-col items-center gap-3 md:flex-row md:items-start md:gap-6">
        {/* Portrait avatar — 4:5, black-and-gold */}
        <div className="relative aspect-[4/5] w-24 shrink-0 overflow-hidden rounded-xl border shadow-lg sm:w-32 md:w-40" style={{ borderColor: GOLD + '60', background: GOLD + '12', boxShadow: '0 8px 32px rgba(212,165,44,0.15)' }}>
          {avatarUrl ? (
            <AvatarImg src={avatarUrl} alt="" className="h-full w-full object-cover" style={{ objectPosition: avatarUrl === '/assets/profiles/image copy 6.png' ? 'center 25%' : 'center' }} fallback={<div className="flex h-full w-full items-center justify-center text-3xl font-bold sm:text-4xl" style={{ color: GOLD_SOFT }}>{displayName.charAt(0).toUpperCase()}</div>} />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-3xl font-bold sm:text-4xl" style={{ color: GOLD_SOFT }}>
              {displayName.charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        {/* Identity */}
        <div className="w-full min-w-0 flex-1 text-center md:text-left">
          <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1.5 md:justify-start">
            <h1 className="text-xl font-bold md:text-2xl" style={{ color: isStaffAccount ? GOLD : '#ffffff' }}>{displayName}</h1>
            <MembershipBadge info={badgeInfo} size="sm" />
            {isModeratorAccount && <ModeratorBadge size="sm" />}
            <ConfigurableStaffBadge userId={accountId} size="sm" />
            <SviTitleBadge userId={accountId} size="sm" />
            {demoProfile?.isSpotVaultMember && (
              <BadgeCheck className="h-5 w-5 shrink-0" style={{ color: GOLD }} strokeWidth={2.5} />
            )}
          </div>
          {username && <p className="mt-1 text-sm text-white/40">@{username}</p>}
          {role && role.split(',').map((r) => r.trim()).filter(Boolean).filter((r) => !/founder|ceo|co-founder|chief/i.test(r)).length > 0 && (
            <div className="mt-2 flex flex-wrap justify-center gap-1.5 md:justify-start">
              {role.split(',').map((r) => r.trim()).filter(Boolean).filter((r) => !/founder|ceo|co-founder|chief/i.test(r)).map((r) => (
                <span key={r} className="rounded-full border px-2.5 py-0.5 text-[9px] font-bold tracking-widest uppercase" style={{ borderColor: GOLD + '40', background: GOLD + '12', color: GOLD }}>
                  {r}
                </span>
              ))}
            </div>
          )}
          {demoProfile && (
            <div className="mt-2 flex items-center justify-center gap-2 md:justify-start">
              <span className="rounded border px-2 py-0.5 text-[9px] font-bold tracking-widest uppercase" style={{ borderColor: GOLD + '40', background: GOLD + '12', color: GOLD }}>
                LVL {demoProfile.spotVaultLevel}
              </span>
              {demoProfile.isSpotVaultMember && (
                <span className="flex items-center gap-0.5 text-[9px] font-bold tracking-widest uppercase" style={{ color: GOLD_SOFT }}>
                  <ShieldCheck className="h-3 w-3" strokeWidth={2.5} /> Member
                </span>
              )}
            </div>
          )}
          {bio && <p className="mt-2 text-[13px] leading-relaxed text-white/70 md:mt-3 md:max-w-md">{bio}</p>}
          {/* Follower / Following counts */}
          <div className="mt-2 flex items-center justify-center gap-3 md:mt-3 md:justify-start">
            <button
              onClick={onOpenFollowers}
              className="flex items-center gap-1.5 rounded-lg border border-white/[0.06] bg-white/[0.02] px-2.5 py-1.5 transition-colors hover:border-[#c0911e]/20 hover:bg-white/[0.04]"
            >
              <span className="text-[13px] font-bold text-white">{followerCount}</span>
              <span className="text-[10px] font-medium tracking-wide text-white/40">Followers</span>
            </button>
            <button
              onClick={onOpenFollowing}
              className="flex items-center gap-1.5 rounded-lg border border-white/[0.06] bg-white/[0.02] px-2.5 py-1.5 transition-colors hover:border-[#c0911e]/20 hover:bg-white/[0.04]"
            >
              <span className="text-[13px] font-bold text-white">{followingCount}</span>
              <span className="text-[10px] font-medium tracking-wide text-white/40">Following</span>
            </button>
          </div>
          {location && (
            <div className="mt-2 flex items-center justify-center gap-1.5 text-[12px] text-white/40 md:justify-start">
              <MapPin className="h-3.5 w-3.5" strokeWidth={1.5} /> {location}
            </div>
          )}
          {homeCitySlug && (
            <div className="mt-2 flex flex-col items-center gap-2 md:items-start">
              <span className="flex items-center gap-1 text-[11px] text-white/50">
                <TrendingUp className="h-3 w-3" style={{ color: GOLD }} strokeWidth={1.5} />
                Home City: {allCities.find(c => c.slug === homeCitySlug)?.city_name ?? homeCitySlug}
              </span>
            </div>
          )}
          {socialLinks && Object.keys(socialLinks).length > 0 && (
            <div className="mt-3 flex flex-wrap justify-center gap-2 md:justify-start">
              {Object.entries(socialLinks).filter(([, v]) => v).map(([key, val]) => (
                <a
                  key={key}
                  href={val.startsWith('http') ? val : `https://${val}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] text-white/50 transition-colors hover:text-[#d4a52c]"
                >
                  <Link2 className="h-3 w-3" strokeWidth={1.5} /> {key}
                </a>
              ))}
            </div>
          )}
        </div>
      </div>


    </div>
  );
}

// ── Tab Button ──

function TabButton({ active, onClick, label, count }: {
  active: boolean;
  onClick: () => void;
  label: string;
  count?: number;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1 whitespace-nowrap border-b-2 px-3 py-2.5 text-[10px] font-bold tracking-wider uppercase transition-colors lg:px-4"
      style={{
        borderColor: active ? GOLD : 'transparent',
        color: active ? GOLD_SOFT : 'rgba(255,255,255,0.35)',
      }}
    >
      {label}
      {count != null && count > 0 && (
        <span className="rounded-full px-1.5 py-0.5 text-[8px] font-bold" style={{ background: GOLD + '20', color: GOLD_SOFT }}>{count}</span>
      )}
    </button>
  );
}

// ── About Section ──

function AboutSection({ profile, demoProfile, isOwn, accountId }: {
  profile: UserProfile | null;
  demoProfile: ReturnType<typeof resolveDemoProfile>;
  isOwn: boolean;
  accountId: string;
}) {
  return (
    <div className="mt-5 space-y-5">
      <div className="rounded-xl border p-4 md:p-5" style={{ borderColor: 'rgba(212,165,44,0.10)', background: 'rgba(8,10,12,0.75)', backdropFilter: 'blur(8px)' }}>
      {/* Bio */}
      {(profile?.bio || demoProfile?.bio) && (
        <div>
          <h3 className="mb-2 text-[10px] font-bold tracking-widest text-white/30 uppercase">About</h3>
          <p className="text-sm leading-relaxed text-white/70">{profile?.bio || demoProfile?.bio}</p>
        </div>
      )}

      {/* Demo profile details */}
      {demoProfile && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {demoProfile.specialty && (
            <InfoCard label="Specialty" value={demoProfile.specialty} icon={<Trophy className="h-3.5 w-3.5" style={{ color: GOLD }} strokeWidth={1.5} />} />
          )}
          {demoProfile.featuredResultValue && (
            <InfoCard label={demoProfile.featuredResultLabel || 'Featured Result'} value={demoProfile.featuredResultValue} icon={<Award className="h-3.5 w-3.5" style={{ color: GOLD }} strokeWidth={1.5} />} />
          )}
          {demoProfile.memberSince && (
            <InfoCard label="Member Since" value={demoProfile.memberSince} icon={<Calendar className="h-3.5 w-3.5" style={{ color: GOLD }} strokeWidth={1.5} />} />
          )}
          {demoProfile.onlineStatus && (
            <InfoCard label="Status" value={demoProfile.onlineStatus === 'online' ? 'Online Now' : 'Offline'} icon={<BadgeCheck className="h-3.5 w-3.5" style={{ color: demoProfile.onlineStatus === 'online' ? '#4ade80' : '#666' }} strokeWidth={1.5} />} />
          )}
        </div>
      )}

      {/* Social links */}
      {profile?.social_links && Object.keys(profile.social_links).length > 0 && (
        <div>
          <h3 className="mb-2 text-[10px] font-bold tracking-widest text-white/30 uppercase">Social Links</h3>
          <div className="flex flex-wrap gap-2">
            {Object.entries(profile.social_links).filter(([, v]) => v).map(([key, val]) => (
              <a
                key={key}
                href={val.startsWith('http') ? val : `https://${val}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[11px] text-white/60 transition-colors hover:text-[#d4a52c]"
              >
                <Link2 className="h-3 w-3" strokeWidth={1.5} /> {key}
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!profile?.bio && !demoProfile && !profile?.social_links && (
        <div className="rounded-xl border py-12 text-center" style={{ borderColor: 'rgba(212,165,44,0.08)', background: 'rgba(8,10,12,0.5)' }}>
          <p className="text-sm text-white/30">{isOwn ? 'Edit your profile to add a bio and social links.' : 'No additional information yet.'}</p>
        </div>
      )}
      </div>
    </div>
  );
}

function InfoCard({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border px-3.5 py-3" style={{ borderColor: 'rgba(212,165,44,0.08)', background: 'rgba(8,10,12,0.6)' }}>
      {icon}
      <div>
        <div className="text-[8px] font-bold tracking-widest text-white/30 uppercase">{label}</div>
        <div className="text-[12px] font-semibold text-white/70">{value}</div>
      </div>
    </div>
  );
}

// ── Activity Section ──

function ActivitySection({ isOwn, displayName }: { isOwn: boolean; displayName: string }) {
  const activities = [
    { type: 'content', label: 'Published a new spot', detail: 'River Overbet vs Reg — Final Table ICM', date: '2 days ago' },
    { type: 'comment', label: 'Left a review', detail: 'Great analysis on the 3-bet pot line', date: '5 days ago' },
    { type: 'session', label: 'Completed a coaching session', detail: 'Deep Final Table Review with Kevin Martin', date: '1 week ago' },
    { type: 'content', label: 'Published a new spot', detail: 'Bluff Catching River — BvB 3-Bet Pot', date: '2 weeks ago' },
  ];

  return (
    <div className="mt-5">
      <div className="rounded-xl border p-4 md:p-5" style={{ borderColor: 'rgba(212,165,44,0.10)', background: 'rgba(8,10,12,0.75)', backdropFilter: 'blur(8px)' }}>
        <div className="mb-3 flex items-center gap-1.5">
          <Activity className="h-4 w-4" style={{ color: GOLD }} strokeWidth={1.5} />
          <h3 className="text-[11px] font-bold tracking-widest text-white/40 uppercase">Recent Activity</h3>
        </div>
        {activities.length === 0 ? (
          <div className="rounded-xl border py-12 text-center" style={{ borderColor: 'rgba(212,165,44,0.08)', background: 'rgba(8,10,12,0.5)' }}>
            <Activity className="mx-auto h-8 w-8 text-white/15" strokeWidth={1.5} />
            <p className="mt-3 text-sm text-white/30">{isOwn ? 'Your public activity will appear here.' : 'No recent public activity.'}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {activities.map((act, i) => (
              <div key={i} className="flex items-start gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border" style={{ borderColor: 'rgba(212,165,44,0.2)', background: 'rgba(212,165,44,0.06)' }}>
                  {act.type === 'content' && <FileText className="h-3.5 w-3.5" style={{ color: GOLD }} strokeWidth={1.5} />}
                  {act.type === 'comment' && <MessageSquare className="h-3.5 w-3.5" style={{ color: GOLD }} strokeWidth={1.5} />}
                  {act.type === 'session' && <Calendar className="h-3.5 w-3.5" style={{ color: GOLD }} strokeWidth={1.5} />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] font-semibold text-white">{act.label}</p>
                  <p className="mt-0.5 text-[11px] text-white/50">{act.detail}</p>
                  <p className="mt-0.5 text-[9px] text-white/30">{act.date}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Accolades Section ──

function AccoladesSection({ accomplishments, evidenceMap, isOwn, onAdd, onEdit, onDelete, onUploadProof, onDeleteProof, onPreviewProof }: {
  accomplishments: Accomplishment[];
  evidenceMap: Record<string, AccomplishmentEvidence[]>;
  isOwn: boolean;
  onAdd: () => void;
  onEdit: (acc: Accomplishment) => void;
  onDelete: (id: string) => void;
  onUploadProof: (accomplishmentId: string, file: File) => void;
  onDeleteProof: (evidenceId: string, accomplishmentId: string) => void;
  onPreviewProof: (url: string) => void;
}) {
  return (
    <div className="mt-5">
      <div className="rounded-xl border p-4 md:p-5" style={{ borderColor: 'rgba(212,165,44,0.10)', background: 'rgba(8,10,12,0.75)', backdropFilter: 'blur(8px)' }}>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Trophy className="h-4 w-4" style={{ color: GOLD }} strokeWidth={1.5} />
          <h3 className="text-[11px] font-bold tracking-widest text-white/40 uppercase">Accolades & Accomplishments</h3>
        </div>
        {isOwn && (
          <button
            onClick={onAdd}
            className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] font-semibold tracking-widest text-white/50 uppercase transition-colors hover:text-[#d4a52c]"
          >
            <Plus className="h-3 w-3" strokeWidth={1.5} /> Add
          </button>
        )}
      </div>

      {accomplishments.length === 0 ? (
        <div className="rounded-xl border py-12 text-center" style={{ borderColor: 'rgba(212,165,44,0.08)', background: 'rgba(8,10,12,0.5)' }}>
          <Trophy className="mx-auto h-8 w-8 text-white/15" strokeWidth={1.5} />
          <p className="mt-3 text-sm text-white/30">{isOwn ? 'Add your first accolade to showcase your achievements.' : 'No accolades added yet.'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {accomplishments.map((acc) => (
            <AccoladeCard
              key={acc.id}
              accomplishment={acc}
              evidence={evidenceMap[acc.id] || []}
              isOwn={isOwn}
              onEdit={() => onEdit(acc)}
              onDelete={() => onDelete(acc.id)}
              onUploadProof={(file) => onUploadProof(acc.id, file)}
              onDeleteProof={(evId) => onDeleteProof(evId, acc.id)}
              onPreviewProof={onPreviewProof}
            />
          ))}
        </div>
      )}
      </div>
    </div>
  );
}

function AccoladeCard({ accomplishment, evidence, isOwn, onEdit, onDelete, onUploadProof, onDeleteProof, onPreviewProof }: {
  accomplishment: Accomplishment;
  evidence: AccomplishmentEvidence[];
  isOwn: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onUploadProof: (file: File) => void;
  onDeleteProof: (evidenceId: string) => void;
  onPreviewProof: (url: string) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const proofEvidence = evidence.find((e) => e.url);

  return (
    <div className="group rounded-xl border border-white/5 bg-white/[0.02] p-4 transition-colors hover:border-[#c0911e]/20">
      <div className="flex items-start gap-3">
        <Trophy className="mt-0.5 h-4 w-4 shrink-0" style={{ color: GOLD }} strokeWidth={1.5} />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-bold text-white">{accomplishment.title}</p>
          {accomplishment.description && (
            <p className="mt-0.5 text-[11px] leading-relaxed text-white/50">{accomplishment.description}</p>
          )}
          <div className="mt-1.5 flex flex-wrap gap-2 text-[10px] text-white/30">
            {accomplishment.accomplishment_date && (
              <span className="flex items-center gap-0.5">
                <Calendar className="h-3 w-3" /> {new Date(accomplishment.accomplishment_date).getFullYear()}
              </span>
            )}
            {accomplishment.event_name && <span>{accomplishment.event_name}</span>}
            {accomplishment.prize_amount != null && accomplishment.prize_amount > 0 && (
              <span className="flex items-center gap-0.5" style={{ color: GOLD_SOFT }}>
                <DollarSign className="h-3 w-3" /> {accomplishment.prize_amount.toLocaleString()}
              </span>
            )}
          </div>

          {/* Proof section */}
          <div className="mt-3">
            {proofEvidence?.url ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onPreviewProof(proofEvidence.url!)}
                  className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-[10px] text-white/50 transition-colors hover:text-[#d4a52c]"
                >
                  <ImageIcon className="h-3 w-3" strokeWidth={1.5} /> View Proof
                </button>
                <span className="rounded border px-1.5 py-0.5 text-[8px] font-bold tracking-widest uppercase" style={{ borderColor: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.4)' }}>
                  User Submitted
                </span>
                {isOwn && (
                  <button
                    onClick={() => onDeleteProof(proofEvidence.id)}
                    className="text-white/20 transition-colors hover:text-red-400"
                  >
                    <Trash2 className="h-3 w-3" strokeWidth={1.5} />
                  </button>
                )}
              </div>
            ) : isOwn ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1.5 rounded-lg border border-dashed border-white/15 bg-white/[0.02] px-2.5 py-1.5 text-[10px] text-white/40 transition-colors hover:text-[#d4a52c] hover:border-[#c0911e]/30"
                >
                  <Upload className="h-3 w-3" strokeWidth={1.5} /> Attach Proof
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) onUploadProof(file);
                  }}
                />
              </div>
            ) : null}
          </div>
        </div>

        {/* Edit/Delete for owner */}
        {isOwn && (
          <div className="flex shrink-0 gap-1">
            <button
              onClick={onEdit}
              className="text-white/20 transition-colors hover:text-[#d4a52c]"
            >
              <Pencil className="h-3.5 w-3.5" strokeWidth={1.5} />
            </button>
            <button
              onClick={onDelete}
              className="text-white/20 transition-colors hover:text-red-400"
            >
              <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Accomplishment Form (Add/Edit) ──

function AccomplishmentForm({ initial, onSave, onCancel }: {
  initial?: Accomplishment;
  onSave: (data: { title: string; description: string; category: string; date: string; event: string; amount: string }) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(initial?.title || '');
  const [description, setDescription] = useState(initial?.description || '');
  const [category, setCategory] = useState(initial?.category || 'other');
  const [date, setDate] = useState(initial?.accomplishment_date || '');
  const [event, setEvent] = useState(initial?.event_name || '');
  const [amount, setAmount] = useState(initial?.prize_amount != null ? String(initial.prize_amount) : '');

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={onCancel}>
      <div className="w-full max-w-md rounded-xl border bg-[#0a0c0e] p-5 shadow-2xl" style={{ borderColor: BORDER }} onClick={(e) => e.stopPropagation()}>
        <h3 className="mb-4 text-sm font-bold text-white">{initial ? 'Edit Accomplishment' : 'Add Accomplishment'}</h3>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-[9px] font-semibold tracking-widest text-white/40 uppercase">Title *</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. WSOP Main Event Cash" className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:border-[#d4a52c]/40" />
          </div>
          <div>
            <label className="mb-1 block text-[9px] font-semibold tracking-widest text-white/40 uppercase">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Short description..." rows={2} className="w-full resize-none rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:border-[#d4a52c]/40" />
          </div>
          <div>
            <label className="mb-1 block text-[9px] font-semibold tracking-widest text-white/40 uppercase">Category</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none focus:border-[#d4a52c]/40">
              {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-[9px] font-semibold tracking-widest text-white/40 uppercase">Date</label>
              <input type="date" value={date ? date.split('T')[0] : ''} onChange={(e) => setDate(e.target.value)} className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none focus:border-[#d4a52c]/40" />
            </div>
            <div>
              <label className="mb-1 block text-[9px] font-semibold tracking-widest text-white/40 uppercase">Prize Amount</label>
              <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="$50,000" className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:border-[#d4a52c]/40" />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-[9px] font-semibold tracking-widest text-white/40 uppercase">Event / Site</label>
            <input value={event} onChange={(e) => setEvent(e.target.value)} placeholder="e.g. WSOP, PokerStars" className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:border-[#d4a52c]/40" />
          </div>
        </div>
        <div className="mt-5 flex gap-2">
          <button onClick={onCancel} className="flex-1 rounded-lg border border-white/10 bg-white/5 py-3 text-[10px] font-semibold tracking-widest text-white/60 uppercase hover:text-white" style={{ minHeight: 44 }}>Cancel</button>
          <button
            onClick={() => title.trim() && onSave({ title, description, category, date, event, amount })}
            disabled={!title.trim()}
            className="flex items-center justify-center gap-1.5 flex-1 rounded-lg border py-3 text-[10px] font-semibold tracking-widest uppercase disabled:opacity-40"
            style={{ borderColor: GOLD + '40', background: GOLD + '15', color: GOLD_SOFT, minHeight: 44 }}
          >
            <Check className="h-3 w-3" strokeWidth={1.5} /> {initial ? 'Save' : 'Add'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Visual Accolades Section ──

function VisualAccoladesSection({ accolades, isOwn, onAdd, onEdit, onDelete, onToggleFeatured, onMove, onOpenLightbox }: {
  accolades: PlayerAccolade[];
  isOwn: boolean;
  onAdd: () => void;
  onEdit: (acc: PlayerAccolade) => void;
  onDelete: (id: string) => void;
  onToggleFeatured: (id: string, isFeatured: boolean) => void;
  onMove: (id: string, direction: 'up' | 'down') => void;
  onOpenLightbox: (index: number) => void;
}) {
  if (accolades.length === 0 && !isOwn) return null;

  return (
    <div className="mt-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Trophy className="h-4 w-4" style={{ color: GOLD }} strokeWidth={1.5} />
          <h3 className="text-[11px] font-bold tracking-widest text-white/40 uppercase">Showcase</h3>
        </div>
        {isOwn && (
          <button
            onClick={onAdd}
            className="flex items-center gap-1 rounded-lg border px-3 py-1.5 text-[10px] font-semibold tracking-widest uppercase transition-all active:scale-95"
            style={{ borderColor: GOLD + '40', background: GOLD + '10', color: GOLD_SOFT }}
          >
            <Plus className="h-3 w-3" strokeWidth={1.5} /> Add Accolade
          </button>
        )}
      </div>

      {accolades.length === 0 ? (
        <div className="rounded-xl border py-6 text-center" style={{ borderColor: 'rgba(212,165,44,0.08)', background: 'rgba(8,10,12,0.65)' }}>
          <Trophy className="mx-auto h-6 w-6 text-white/15" strokeWidth={1.5} />
          <p className="mt-2 text-[12px] leading-relaxed text-white/40">{isOwn ? 'Showcase your tournament wins, final tables, and career milestones.' : 'No accolades yet.'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3">
          {accolades.map((acc, idx) => (
            <AccoladeImageCard
              key={acc.id}
              accolade={acc}
              index={idx}
              total={accolades.length}
              isOwn={isOwn}
              onEdit={() => onEdit(acc)}
              onDelete={() => onDelete(acc.id)}
              onToggleFeatured={() => onToggleFeatured(acc.id, !acc.is_featured)}
              onMove={(dir) => onMove(acc.id, dir)}
              onOpen={() => onOpenLightbox(idx)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function AccoladeImageCard({ accolade, index, total, isOwn, onEdit, onDelete, onToggleFeatured, onMove, onOpen }: {
  accolade: PlayerAccolade;
  index: number;
  total: number;
  isOwn: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onToggleFeatured: () => void;
  onMove: (dir: 'up' | 'down') => void;
  onOpen: () => void;
}) {
  const [showActions, setShowActions] = useState(false);

  return (
    <div
      className="group relative overflow-hidden rounded-xl border transition-all"
      style={{ borderColor: accolade.is_featured ? GOLD + '50' : 'rgba(255,255,255,0.06)' }}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* Image */}
      <button onClick={onOpen} className="block w-full overflow-hidden" style={{ aspectRatio: '1 / 1' }}>
        <img
          src={accolade.image_url}
          alt={accolade.title}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          loading="lazy"
        />
      </button>

      {/* Featured star */}
      {accolade.is_featured && (
        <div className="absolute left-2 top-2 flex h-6 w-6 items-center justify-center rounded-full border backdrop-blur-sm" style={{ borderColor: GOLD + '60', background: 'rgba(5,7,9,0.7)' }}>
          <Star className="h-3 w-3 fill-current" style={{ color: GOLD }} strokeWidth={1.5} />
        </div>
      )}

      {/* Gradient overlay with info */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent p-2.5 sm:p-3">
        <p className="truncate text-[11px] font-bold text-white sm:text-[12px]">{accolade.title}</p>
        {accolade.result_text && (
          <p className="mt-0.5 truncate text-[9px] font-semibold sm:text-[10px]" style={{ color: GOLD_SOFT }}>{accolade.result_text}</p>
        )}
        {accolade.achievement_date && (
          <p className="mt-0.5 text-[8px] text-white/50">
            {new Date(accolade.achievement_date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
          </p>
        )}
      </div>

      {/* External link indicator */}
      {accolade.external_url && (
        <div className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full border backdrop-blur-sm" style={{ borderColor: 'rgba(255,255,255,0.15)', background: 'rgba(5,7,9,0.7)' }}>
          <ExternalLink className="h-3 w-3 text-white/60" strokeWidth={1.5} />
        </div>
      )}

      {/* Owner action bar — appears on hover/tap */}
      {isOwn && showActions && (
        <div className="absolute inset-x-0 top-0 flex items-center justify-between bg-gradient-to-b from-black/80 to-transparent p-2">
          <div className="flex gap-1">
            <button
              onClick={onToggleFeatured}
              className="flex h-6 w-6 items-center justify-center rounded-full border border-white/15 bg-black/60 text-white/70 backdrop-blur-sm transition-colors hover:text-[#d4a52c]"
              title={accolade.is_featured ? 'Unfeature' : 'Feature'}
            >
              <Star className={`h-3 w-3 ${accolade.is_featured ? 'fill-current' : ''}`} strokeWidth={1.5} style={{ color: accolade.is_featured ? GOLD : undefined }} />
            </button>
            <button
              onClick={() => onMove('up')}
              disabled={index === 0}
              className="flex h-6 w-6 items-center justify-center rounded-full border border-white/15 bg-black/60 text-white/70 backdrop-blur-sm transition-colors hover:text-white disabled:opacity-30"
              title="Move left"
            >
              <ChevronLeft className="h-3 w-3" strokeWidth={1.5} />
            </button>
            <button
              onClick={() => onMove('down')}
              disabled={index === total - 1}
              className="flex h-6 w-6 items-center justify-center rounded-full border border-white/15 bg-black/60 text-white/70 backdrop-blur-sm transition-colors hover:text-white disabled:opacity-30"
              title="Move right"
            >
              <ChevronRight className="h-3 w-3" strokeWidth={1.5} />
            </button>
          </div>
          <div className="flex gap-1">
            <button
              onClick={onEdit}
              className="flex h-6 w-6 items-center justify-center rounded-full border border-white/15 bg-black/60 text-white/70 backdrop-blur-sm transition-colors hover:text-[#d4a52c]"
              title="Edit"
            >
              <Pencil className="h-3 w-3" strokeWidth={1.5} />
            </button>
            <button
              onClick={onDelete}
              className="flex h-6 w-6 items-center justify-center rounded-full border border-white/15 bg-black/60 text-white/70 backdrop-blur-sm transition-colors hover:text-red-400"
              title="Delete"
            >
              <Trash2 className="h-3 w-3" strokeWidth={1.5} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Accolade Lightbox ──

function AccoladeLightbox({ accolades, startIndex, onClose }: {
  accolades: PlayerAccolade[];
  startIndex: number;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(startIndex);
  const acc = accolades[index];

  const goPrev = () => setIndex((i) => (i > 0 ? i - 1 : accolades.length - 1));
  const goNext = () => setIndex((i) => (i < accolades.length - 1 ? i + 1 : 0));

  return (
    <div className="fixed inset-0 z-[125] flex flex-col items-center justify-center bg-black/90 backdrop-blur-md p-4" onClick={onClose}>
      {/* Close */}
      <button onClick={onClose} className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/60 transition-colors hover:text-white">
        <X className="h-4 w-4" strokeWidth={1.5} />
      </button>

      {/* Nav arrows */}
      {accolades.length > 1 && (
        <>
          <button onClick={(e) => { e.stopPropagation(); goPrev(); }} className="absolute left-3 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/60 transition-colors hover:text-white">
            <ChevronLeft className="h-5 w-5" strokeWidth={1.5} />
          </button>
          <button onClick={(e) => { e.stopPropagation(); goNext(); }} className="absolute right-3 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/60 transition-colors hover:text-white">
            <ChevronRight className="h-5 w-5" strokeWidth={1.5} />
          </button>
        </>
      )}

      {/* Content */}
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col items-center" onClick={(e) => e.stopPropagation()}>
        <img
          src={acc.image_url}
          alt={acc.title}
          className="max-h-[70vh] w-auto rounded-lg border object-contain"
          style={{ borderColor: GOLD + '30' }}
        />
        <div className="mt-4 w-full max-w-lg text-center">
          <div className="flex items-center justify-center gap-2">
            {acc.is_featured && <Star className="h-4 w-4 fill-current" style={{ color: GOLD }} strokeWidth={1.5} />}
            <h3 className="text-base font-bold text-white">{acc.title}</h3>
          </div>
          {acc.result_text && (
            <p className="mt-1 text-[13px] font-semibold" style={{ color: GOLD_SOFT }}>{acc.result_text}</p>
          )}
          {acc.caption && (
            <p className="mt-2 text-[12px] leading-relaxed text-white/60">{acc.caption}</p>
          )}
          <div className="mt-3 flex flex-wrap items-center justify-center gap-3 text-[10px] text-white/40">
            {acc.achievement_date && (
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" strokeWidth={1.5} />
                {new Date(acc.achievement_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
              </span>
            )}
            {accolades.length > 1 && (
              <span>{index + 1} / {accolades.length}</span>
            )}
            {acc.external_url && (
              <a
                href={acc.external_url.startsWith('http') ? acc.external_url : `https://${acc.external_url}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-[10px] transition-colors hover:text-[#d4a52c]"
                style={{ color: GOLD_SOFT }}
              >
                <ExternalLink className="h-3 w-3" strokeWidth={1.5} /> View Result
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Accolade Form (Add/Edit) ──

function AccoladeForm({ userId, initial, onSave, onCancel }: {
  userId: string;
  initial?: PlayerAccolade;
  onSave: (data: {
    image_url: string; title: string; result_text: string; caption: string;
    achievement_date: string; external_url: string; is_featured: boolean;
  }) => void;
  onCancel: () => void;
}) {
  const [imageUrl, setImageUrl] = useState(initial?.image_url || '');
  const [title, setTitle] = useState(initial?.title || '');
  const [resultText, setResultText] = useState(initial?.result_text || '');
  const [caption, setCaption] = useState(initial?.caption || '');
  const [date, setDate] = useState(initial?.achievement_date || '');
  const [externalUrl, setExternalUrl] = useState(initial?.external_url || '');
  const [isFeatured, setIsFeatured] = useState(initial?.is_featured ?? false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = async (file: File) => {
    setUploading(true);
    const url = await uploadAccoladeImage(userId, file);
    if (url) setImageUrl(url);
    setUploading(false);
  };

  return (
    <div className="fixed inset-0 z-[115] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={onCancel}>
      <div className="flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-xl border bg-[#0a0c0e] shadow-2xl" style={{ borderColor: BORDER }} onClick={(e) => e.stopPropagation()}>
        <div className="flex shrink-0 items-center justify-between border-b border-white/[0.06] px-5 py-3">
          <h3 className="text-sm font-bold text-white">{initial ? 'Edit Accolade' : 'Add Accolade'}</h3>
          <button onClick={onCancel} className="flex h-7 w-7 items-center justify-center rounded-full border border-white/10 text-white/50 hover:text-white">
            <X className="h-3.5 w-3.5" strokeWidth={1.5} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {/* Image upload */}
          <div className="mb-4">
            <label className="mb-1.5 block text-[9px] font-semibold tracking-widest text-white/40 uppercase">Showcase Image *</label>
            {imageUrl ? (
              <div className="relative">
                <img src={imageUrl} alt="" className="h-40 w-full rounded-lg border border-white/10 object-cover" />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute bottom-2 right-2 flex items-center gap-1 rounded-lg border border-white/15 bg-black/70 px-2.5 py-1.5 text-[10px] text-white/70 backdrop-blur-sm transition-colors hover:text-[#d4a52c]"
                >
                  <Camera className="h-3 w-3" strokeWidth={1.5} /> Change
                </button>
              </div>
            ) : (
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="flex h-40 w-full flex-col items-center justify-center rounded-lg border-2 border-dashed border-white/15 bg-white/[0.02] text-white/40 transition-colors hover:border-[#c0911e]/30 hover:text-[#d4a52c] disabled:opacity-50"
              >
                {uploading ? (
                  <Loader2 className="h-6 w-6 animate-spin" strokeWidth={1.5} />
                ) : (
                  <>
                    <Upload className="h-6 w-6 mb-2" strokeWidth={1.5} />
                    <span className="text-[11px] font-semibold tracking-wide">Upload Image</span>
                    <span className="mt-0.5 text-[9px] text-white/25">PNG, JPEG, WebP</span>
                  </>
                )}
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleImageUpload(file);
              }}
            />
          </div>

          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-[9px] font-semibold tracking-widest text-white/40 uppercase">Title *</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. WSOP Main Event" className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:border-[#d4a52c]/40" />
            </div>
            <div>
              <label className="mb-1 block text-[9px] font-semibold tracking-widest text-white/40 uppercase">Result</label>
              <input value={resultText} onChange={(e) => setResultText(e.target.value)} placeholder="e.g. 1st Place — $1,500,000" className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:border-[#d4a52c]/40" />
            </div>
            <div>
              <label className="mb-1 block text-[9px] font-semibold tracking-widest text-white/40 uppercase">Caption / Story</label>
              <textarea value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Add context or a short story..." rows={2} className="w-full resize-none rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:border-[#d4a52c]/40" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-[9px] font-semibold tracking-widest text-white/40 uppercase">Date</label>
                <input type="date" value={date ? date.split('T')[0] : ''} onChange={(e) => setDate(e.target.value)} className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none focus:border-[#d4a52c]/40" />
              </div>
              <div>
                <label className="mb-1 block text-[9px] font-semibold tracking-widest text-white/40 uppercase">External Link</label>
                <input value={externalUrl} onChange={(e) => setExternalUrl(e.target.value)} placeholder="Hendon Mob, result page..." className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:border-[#d4a52c]/40" />
              </div>
            </div>
            <button
              onClick={() => setIsFeatured((f) => !f)}
              className="flex items-center gap-2 rounded-lg border px-3 py-2.5 text-[11px] font-semibold tracking-wide transition-all"
              style={{
                borderColor: isFeatured ? GOLD + '50' : 'rgba(255,255,255,0.1)',
                background: isFeatured ? GOLD + '12' : 'rgba(255,255,255,0.03)',
                color: isFeatured ? GOLD_SOFT : 'rgba(255,255,255,0.5)',
              }}
            >
              <Star className={`h-3.5 w-3.5 ${isFeatured ? 'fill-current' : ''}`} strokeWidth={1.5} style={{ color: isFeatured ? GOLD : undefined }} />
              {isFeatured ? 'Featured — shows first' : 'Mark as featured'}
            </button>
          </div>
        </div>

        <div className="flex shrink-0 gap-2 border-t border-white/[0.06] p-4">
          <button onClick={onCancel} className="flex-1 rounded-lg border border-white/10 bg-white/5 py-3 text-[10px] font-semibold tracking-widest text-white/60 uppercase hover:text-white" style={{ minHeight: 44 }}>Cancel</button>
          <button
            onClick={() => imageUrl.trim() && title.trim() && onSave({ image_url: imageUrl, title, result_text: resultText, caption, achievement_date: date, external_url: externalUrl, is_featured: isFeatured })}
            disabled={!imageUrl.trim() || !title.trim() || uploading}
            className="flex items-center justify-center gap-1.5 flex-1 rounded-lg border py-3 text-[10px] font-semibold tracking-widest uppercase disabled:opacity-40"
            style={{ borderColor: GOLD + '40', background: GOLD + '15', color: GOLD_SOFT, minHeight: 44 }}
          >
            <Check className="h-3 w-3" strokeWidth={1.5} /> {initial ? 'Save' : 'Add'}
          </button>
        </div>
      </div>
    </div>
  );
}
