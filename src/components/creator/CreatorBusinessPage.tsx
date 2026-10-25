import { useState, useEffect, useCallback } from 'react';
import {
  BriefcaseBusiness, UserCircle, Calendar, Handshake, Camera,
  Plus, Trash2, Save, Check, X, Clock, DollarSign, MessageSquare,
  Video, Phone, Users, Globe, Mic2, Star, TrendingUp,
  type LucideIcon,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { SpotVaultAccount } from '@/types';

import { ProfessionalListingForm } from '@/components/professional/ProfessionalListingForm';
import { PromotionComposer } from '@/components/professional/PromotionComposer';
import { PortalWorkspaceShell } from '@/components/shared/PortalWorkspaceShell';

const GOLD = '#d4a52c';
const GOLD_BRIGHT = '#f5e6b0';
const BORDER = 'rgba(255,255,255,0.08)';
const DARK_PANEL = 'rgba(8,11,14,0.92)';

type BusinessTab = 'profile' | 'services' | 'availability' | 'opportunities' | 'media' | 'listing';

interface CreatorService {
  id?: string;
  name: string;
  description: string;
  duration_minutes: number;
  price_type: 'fixed' | 'hourly' | 'starting_at' | 'negotiable' | 'contact_for_rate' | 'free';
  price_amount: number;
  communication_methods: string[];
  is_active: boolean;
  requires_approval: boolean;
  sort_order: number;
}

interface AvailabilityEntry {
  id?: string;
  entry_type: 'weekly' | 'specific_date' | 'blocked_date' | 'vacation';
  day_of_week: number | null;
  specific_date: string | null;
  start_time: string | null;
  end_time: string | null;
  is_available: boolean;
  label: string;
}

interface CreatorOpportunities {
  open_to: string[];
  looking_for_notes: string;
  contact_preference: string;
}

interface CreatorMediaKit {
  additional_photos: string[];
  youtube_subscribers: number | null;
  twitch_followers: number | null;
  twitter_followers: number | null;
  instagram_followers: number | null;
  avg_stream_viewers: number | null;
  tiktok_followers: number | null;
  poker_accomplishments: string;
}

const PRICE_TYPES = [
  { id: 'fixed', label: 'Fixed Rate' },
  { id: 'hourly', label: 'Hourly Rate' },
  { id: 'starting_at', label: 'Starting At' },
  { id: 'negotiable', label: 'Negotiable' },
  { id: 'contact_for_rate', label: 'Contact for Rate' },
  { id: 'free', label: 'Free' },
] as const;

const COMM_METHODS = [
  { id: 'chat', label: 'SpotVault Chat', icon: MessageSquare },
  { id: 'voice_call', label: 'Voice Call', icon: Phone },
  { id: 'video_call', label: 'Video Call', icon: Video },
  { id: 'in_person', label: 'In Person', icon: Users },
  { id: 'discord', label: 'Discord', icon: MessageSquare },
  { id: 'other', label: 'Other', icon: Globe },
] as const;

const OPPORTUNITY_OPTIONS = [
  'Sponsorships', 'Brand Partnerships', 'Poker Site Partnerships',
  'Content Collaborations', 'Stream Collaborations', 'Podcast Appearances',
  'Interviews', 'Commentary', 'Tournament Coverage', 'Live Event Appearances',
  'Coaching', 'Consulting', 'Affiliate Partnerships', 'Product Reviews',
  'Media Work', 'Speaking Opportunities', 'Investment / Business Opportunities', 'Other',
] as const;

const CONTACT_PREFS = [
  { id: 'book_directly', label: 'Book Directly' },
  { id: 'send_message_first', label: 'Send Message First' },
  { id: 'submit_opportunity', label: 'Submit Opportunity' },
  { id: 'business_inquiries_only', label: 'Business Inquiries Only' },
  { id: 'open_to_all', label: 'Open to All Inquiries' },
] as const;

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function CreatorBusinessPage({ account }: { account: SpotVaultAccount }) {
  const [tab, setTab] = useState<BusinessTab>('profile');

  const tabs: { id: BusinessTab; label: string; icon: LucideIcon }[] = [
    { id: 'profile', label: 'Profile', icon: UserCircle },
    { id: 'services', label: 'Services', icon: BriefcaseBusiness },
    { id: 'availability', label: 'Availability', icon: Calendar },
    { id: 'opportunities', label: 'Opportunities', icon: Handshake },
    { id: 'media', label: 'Media', icon: Camera },
    { id: 'listing', label: 'Listing', icon: Globe },
  ];

  return (
    <PortalWorkspaceShell maxWidth="max-w-4xl">
    <div className="flex h-full min-h-0 flex-col gap-2 px-1 pb-2 sm:px-3">
      {/* Header */}
      <div className="flex shrink-0 items-center gap-3 rounded-xl px-4 py-2.5 backdrop-blur-md"
        style={{ background: 'rgba(10,12,14,0.72)', border: '1px solid rgba(192,145,30,0.18)' }}>
        <div className="flex h-8 w-8 items-center justify-center rounded-lg"
          style={{ background: 'linear-gradient(135deg, rgba(192,145,30,0.12), rgba(192,145,30,0.04))', border: '1px solid rgba(192,145,30,0.15)' }}>
          <BriefcaseBusiness className="h-4 w-4" strokeWidth={1.5} style={{ color: GOLD }} />
        </div>
        <span className="text-sm font-bold text-white">Creator Business</span>
        <span className="text-[9px] font-mono tracking-[0.2em] uppercase" style={{ color: 'rgba(192,145,30,0.6)' }}>How people can work with you</span>
      </div>

      {/* Tabs */}
      <div className="flex shrink-0 items-center gap-1 rounded-lg border p-1" style={{ borderColor: BORDER, background: DARK_PANEL }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-[11px] font-semibold uppercase tracking-wider transition-all ${tab === t.id ? 'text-[#080706]' : 'text-white/50 hover:text-white/70'}`}
            style={{ background: tab === t.id ? GOLD : 'transparent' }}>
            <t.icon size={13} /> {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {tab === 'profile' && <ProfileTab account={account} />}
        {tab === 'services' && <ServicesTab account={account} />}
        {tab === 'availability' && <AvailabilityTab account={account} />}
        {tab === 'opportunities' && <OpportunitiesTab account={account} />}
        {tab === 'media' && <MediaTab account={account} />}
        {tab === 'listing' && (
          <div className="mx-auto max-w-3xl space-y-4 p-4">
            <ProfessionalListingForm portalType="creator-portal" userId={account.id} displayName={account.name} />
            <div className="border-t border-white/[0.06] pt-4">
              <PromotionComposer portalType="creator-portal" />
            </div>
          </div>
        )}
      </div>
    </div>
    </PortalWorkspaceShell>
  );
}

// ════════════════════════════════════════════════════════════════
// PROFILE TAB — delegates to creator_public_profiles table
// ════════════════════════════════════════════════════════════════

interface CreatorPublicProfile {
  display_name: string;
  tagline: string;
  bio: string;
  location: string;
  role: string;
  profile_photo_url: string;
  banner_url: string;
  specialties: string[];
  social_links: Record<string, string>;
}

function ProfileTab({ account }: { account: SpotVaultAccount }) {
  const [profile, setProfile] = useState<CreatorPublicProfile>({
    display_name: account.name,
    tagline: '', bio: '', location: '', role: 'creator',
    profile_photo_url: '', banner_url: '', specialties: [], social_links: {},
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase
        .from('creator_public_profiles')
        .select('*')
        .eq('account_id', account.id)
        .maybeSingle();
      if (data) {
        setProfile({
          display_name: data.display_name ?? account.name,
          tagline: data.tagline ?? '', bio: data.bio ?? '', location: data.location ?? '',
          role: data.role ?? 'creator', profile_photo_url: data.profile_photo_url ?? '',
          banner_url: data.banner_url ?? '', specialties: data.specialties ?? [],
          social_links: data.social_links ?? {},
        });
      }
      setLoading(false);
    })();
  }, [account.id, account.name]);

  const save = async () => {
    setSaving(true);
    await supabase.from('creator_public_profiles').upsert({
      account_id: account.id,
      display_name: profile.display_name, tagline: profile.tagline, bio: profile.bio,
      location: profile.location, role: profile.role, profile_photo_url: profile.profile_photo_url,
      banner_url: profile.banner_url, specialties: profile.specialties, social_links: profile.social_links,
    }, { onConflict: 'account_id' });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const ROLE_OPTIONS = [
    { id: 'creator', label: 'Content Creator' },
    { id: 'poker_pro', label: 'Poker Professional' },
    { id: 'coach', label: 'Coach' },
    { id: 'performance', label: 'Performance' },
    { id: 'industry_pro', label: 'Industry Professional' },
  ];

  const SPECIALTY_OPTIONS = [
    'Content Creator', 'Streamer', 'MTT', 'Cash', 'ICM', 'Final Tables',
    'Mental Game', 'Performance', 'Fitness', 'Nutrition', 'Staking',
    'Sponsorship', 'Media', 'Tournament Strategy', 'PLO',
  ];

  if (loading) return <div className="py-20 text-center text-[11px] text-white/40">Loading...</div>;

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      <Section title="Professional Identity" icon={UserCircle}>
        <Field label="Display Name">
          <input value={profile.display_name} onChange={(e) => setProfile(p => ({ ...p, display_name: e.target.value }))} className="input-base" />
        </Field>
        <Field label="Professional Headline">
          <input value={profile.tagline} onChange={(e) => setProfile(p => ({ ...p, tagline: e.target.value }))} className="input-base" placeholder="e.g. Poker Creator · Streamer · Tournament Player" />
        </Field>
        <Field label="About Me">
          <textarea value={profile.bio} onChange={(e) => setProfile(p => ({ ...p, bio: e.target.value }))} className="input-base min-h-[100px] resize-y" placeholder="Tell people about yourself..." />
        </Field>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Location (optional)">
            <input value={profile.location} onChange={(e) => setProfile(p => ({ ...p, location: e.target.value }))} className="input-base" placeholder="City, State" />
          </Field>
          <Field label="Primary Role">
            <select value={profile.role} onChange={(e) => setProfile(p => ({ ...p, role: e.target.value }))} className="input-base">
              {ROLE_OPTIONS.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Specialties">
          <div className="flex flex-wrap gap-1.5">
            {SPECIALTY_OPTIONS.map(s => (
              <button key={s} onClick={() => setProfile(p => ({
                ...p,
                specialties: p.specialties.includes(s) ? p.specialties.filter(x => x !== s) : [...p.specialties, s],
              }))}
                className={`rounded-md border px-2.5 py-1 text-[10px] font-medium transition-all ${profile.specialties.includes(s) ? 'border-[#c091e]/30 bg-[#c091e]/10 text-[#d4a52c]' : 'border-white/[0.06] bg-white/[0.02] text-white/35 hover:text-white/55'}`}>
                {s}
              </button>
            ))}
          </div>
        </Field>
      </Section>

      <Section title="Photos" icon={Camera}>
        <Field label="Profile Photo">
          <div className="flex items-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-white/[0.08] bg-[#c091e]/10 overflow-hidden">
              {profile.profile_photo_url ? <img src={profile.profile_photo_url} alt="" className="h-full w-full object-cover" /> : <Camera className="h-5 w-5 text-white/30" strokeWidth={1.5} />}
            </div>
            <button className="flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2 text-[10px] font-semibold tracking-wide text-white/50 uppercase transition hover:text-white/70">
              <Plus className="h-3.5 w-3.5" /> Upload Photo
            </button>
          </div>
        </Field>
      </Section>

      <Section title="Social Links" icon={Globe}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="X / Twitter"><input value={profile.social_links.twitter ?? ''} onChange={(e) => setProfile(p => ({ ...p, social_links: { ...p.social_links, twitter: e.target.value } }))} className="input-base" placeholder="@username" /></Field>
          <Field label="Instagram"><input value={profile.social_links.instagram ?? ''} onChange={(e) => setProfile(p => ({ ...p, social_links: { ...p.social_links, instagram: e.target.value } }))} className="input-base" placeholder="@username" /></Field>
          <Field label="YouTube"><input value={profile.social_links.youtube ?? ''} onChange={(e) => setProfile(p => ({ ...p, social_links: { ...p.social_links, youtube: e.target.value } }))} className="input-base" placeholder="youtube.com/@channel" /></Field>
          <Field label="Twitch"><input value={profile.social_links.twitch ?? ''} onChange={(e) => setProfile(p => ({ ...p, social_links: { ...p.social_links, twitch: e.target.value } }))} className="input-base" placeholder="twitch.tv/channel" /></Field>
          <Field label="TikTok"><input value={profile.social_links.tiktok ?? ''} onChange={(e) => setProfile(p => ({ ...p, social_links: { ...p.social_links, tiktok: e.target.value } }))} className="input-base" placeholder="@username" /></Field>
          <Field label="Website"><input value={profile.social_links.website ?? ''} onChange={(e) => setProfile(p => ({ ...p, social_links: { ...p.social_links, website: e.target.value } }))} className="input-base" placeholder="yoursite.com" /></Field>
        </div>
      </Section>

      <div className="flex justify-end pb-4">
        <button onClick={save} disabled={saving}
          className="flex items-center gap-1.5 rounded-lg border border-[#c091e]/30 bg-[#c091e]/10 px-4 py-2.5 text-[11px] font-bold tracking-widest text-[#f5e6b0] uppercase transition hover:bg-[#c091e]/20 disabled:opacity-40">
          {saved ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
          {saving ? 'Saving...' : saved ? 'Saved' : 'Save Profile'}
        </button>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// SERVICES TAB
// ════════════════════════════════════════════════════════════════

function ServicesTab({ account }: { account: SpotVaultAccount }) {
  const [services, setServices] = useState<CreatorService[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('creator_services')
      .select('*')
      .eq('account_id', account.id)
      .order('sort_order', { ascending: true });
    setServices((data ?? []) as CreatorService[]);
    setLoading(false);
  }, [account.id]);

  useEffect(() => { void load(); }, [load]);

  const saveAll = async () => {
    setSaving(true);
    for (const svc of services) {
      if (svc.id) {
        await supabase.from('creator_services').update({
          name: svc.name, description: svc.description, duration_minutes: svc.duration_minutes,
          price_type: svc.price_type, price_amount: svc.price_amount, communication_methods: svc.communication_methods,
          is_active: svc.is_active, requires_approval: svc.requires_approval, sort_order: svc.sort_order,
          updated_at: new Date().toISOString(),
        }).eq('id', svc.id);
      } else {
        const { data } = await supabase.from('creator_services').insert({
          account_id: account.id, name: svc.name, description: svc.description,
          duration_minutes: svc.duration_minutes, price_type: svc.price_type, price_amount: svc.price_amount,
          communication_methods: svc.communication_methods, is_active: svc.is_active,
          requires_approval: svc.requires_approval, sort_order: svc.sort_order,
        }).select('*').maybeSingle();
        if (data) svc.id = (data as CreatorService).id;
      }
    }
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const addService = () => {
    setServices(prev => [...prev, {
      name: '', description: '', duration_minutes: 60, price_type: 'fixed', price_amount: 0,
      communication_methods: ['chat'], is_active: true, requires_approval: false, sort_order: prev.length,
    }]);
  };

  const removeService = async (idx: number) => {
    const svc = services[idx];
    if (svc.id) await supabase.from('creator_services').delete().eq('id', svc.id);
    setServices(prev => prev.filter((_, i) => i !== idx));
  };

  const toggleCommMethod = (idx: number, method: string) => {
    setServices(prev => prev.map((s, i) => ({
      ...s,
      communication_methods: s.communication_methods.includes(method)
        ? s.communication_methods.filter(m => m !== method)
        : [...s.communication_methods, method],
    })));
  };

  if (loading) return <div className="py-20 text-center text-[11px] text-white/40">Loading...</div>;

  return (
    <div className="mx-auto max-w-3xl space-y-3 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-[11px] font-bold uppercase tracking-widest text-white/50">Your Services</h3>
        <div className="flex items-center gap-2">
          <button onClick={addService} className="flex items-center gap-1 rounded-lg border px-3 py-2 text-[10px] font-bold uppercase tracking-widest transition-all hover:scale-105"
            style={{ borderColor: GOLD, color: '#080706', background: GOLD }}>
            <Plus size={12} /> Add Service
          </button>
          <button onClick={saveAll} disabled={saving}
            className="flex items-center gap-1 rounded-lg border px-3 py-2 text-[10px] font-bold uppercase tracking-widest transition-all hover:scale-105 disabled:opacity-50"
            style={{ borderColor: 'rgba(192,145,30,0.3)', color: GOLD_BRIGHT, background: 'rgba(192,145,30,0.08)' }}>
            {saved ? <Check size={12} /> : <Save size={12} />} {saving ? '...' : saved ? 'Saved' : 'Save'}
          </button>
        </div>
      </div>

      {services.length === 0 ? (
        <div className="rounded-xl border p-8 text-center" style={{ borderColor: BORDER, background: DARK_PANEL }}>
          <BriefcaseBusiness className="mx-auto mb-2 h-8 w-8 text-white/15" strokeWidth={1.5} />
          <p className="text-sm text-white/40">No services yet. Add what people can book you for.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {services.map((svc, idx) => (
            <div key={idx} className="rounded-xl border p-4" style={{ borderColor: BORDER, background: DARK_PANEL }}>
              <div className="flex items-start justify-between gap-2">
                <input value={svc.name} onChange={(e) => setServices(prev => prev.map((s, i) => i === idx ? { ...s, name: e.target.value } : s))}
                  placeholder="Service name (e.g. 30-Min Chat)"
                  className="input-base flex-1" />
                <button onClick={() => removeService(idx)} className="flex h-8 w-8 items-center justify-center rounded-md border transition-all hover:border-red-500/40 hover:bg-red-500/10"
                  style={{ borderColor: BORDER, color: '#f87171' }}>
                  <Trash2 size={14} />
                </button>
              </div>
              <textarea value={svc.description} onChange={(e) => setServices(prev => prev.map((s, i) => i === idx ? { ...s, description: e.target.value } : s))}
                placeholder="Description" className="input-base mt-2 min-h-[50px] resize-y" />
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                <Field label="Duration">
                  <select value={svc.duration_minutes} onChange={(e) => setServices(prev => prev.map((s, i) => i === idx ? { ...s, duration_minutes: parseInt(e.target.value) } : s))} className="input-base">
                    {[15, 30, 45, 60, 90, 120].map(d => <option key={d} value={d}>{d} min</option>)}
                  </select>
                </Field>
                <Field label="Pricing">
                  <select value={svc.price_type} onChange={(e) => setServices(prev => prev.map((s, i) => i === idx ? { ...s, price_type: e.target.value as CreatorService['price_type'] } : s))} className="input-base">
                    {PRICE_TYPES.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                  </select>
                </Field>
                {(svc.price_type === 'fixed' || svc.price_type === 'hourly' || svc.price_type === 'starting_at') && (
                  <Field label="Price (credits)">
                    <input type="number" value={svc.price_amount} onChange={(e) => setServices(prev => prev.map((s, i) => i === idx ? { ...s, price_amount: parseInt(e.target.value) || 0 } : s))} className="input-base" min={0} />
                  </Field>
                )}
              </div>
              <div className="mt-3">
                <div className="mb-1.5 text-[10px] font-mono tracking-widest text-white/30 uppercase">Communication Methods</div>
                <div className="flex flex-wrap gap-1.5">
                  {COMM_METHODS.map(m => (
                    <button key={m.id} onClick={() => toggleCommMethod(idx, m.id)}
                      className={`flex items-center gap-1 rounded-md border px-2.5 py-1 text-[10px] font-medium transition-all ${svc.communication_methods.includes(m.id) ? 'border-[#c091e]/30 bg-[#c091e]/10 text-[#d4a52c]' : 'border-white/[0.06] bg-white/[0.02] text-white/35 hover:text-white/55'}`}>
                      <m.icon size={11} /> {m.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mt-3 flex items-center gap-4">
                <ToggleRow label="Active" checked={svc.is_active} onChange={(v) => setServices(prev => prev.map((s, i) => i === idx ? { ...s, is_active: v } : s))} />
                <ToggleRow label="Requires Approval" checked={svc.requires_approval} onChange={(v) => setServices(prev => prev.map((s, i) => i === idx ? { ...s, requires_approval: v } : s))} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// AVAILABILITY TAB
// ════════════════════════════════════════════════════════════════

function AvailabilityTab({ account }: { account: SpotVaultAccount }) {
  const [entries, setEntries] = useState<AvailabilityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('creator_availability')
      .select('*')
      .eq('account_id', account.id)
      .order('day_of_week', { ascending: true, nullsFirst: false });
    setEntries((data ?? []) as AvailabilityEntry[]);
    setLoading(false);
  }, [account.id]);

  useEffect(() => { void load(); }, [load]);

  const saveAll = async () => {
    setSaving(true);
    for (const entry of entries) {
      if (entry.id) {
        await supabase.from('creator_availability').update({
          day_of_week: entry.day_of_week, specific_date: entry.specific_date,
          start_time: entry.start_time, end_time: entry.end_time,
          is_available: entry.is_available, label: entry.label,
          updated_at: new Date().toISOString(),
        }).eq('id', entry.id);
      } else {
        const { data } = await supabase.from('creator_availability').insert({
          account_id: account.id, entry_type: entry.entry_type, day_of_week: entry.day_of_week,
          specific_date: entry.specific_date, start_time: entry.start_time, end_time: entry.end_time,
          is_available: entry.is_available, label: entry.label,
        }).select('*').maybeSingle();
        if (data) entry.id = (data as AvailabilityEntry).id;
      }
    }
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const addWeekly = (dayOfWeek: number) => {
    setEntries(prev => [...prev, {
      entry_type: 'weekly', day_of_week: dayOfWeek, specific_date: null,
      start_time: '09:00', end_time: '17:00', is_available: true, label: '',
    }]);
  };

  const addBlock = () => {
    setEntries(prev => [...prev, {
      entry_type: 'blocked_date', day_of_week: null, specific_date: new Date().toISOString().slice(0, 10),
      start_time: null, end_time: null, is_available: false, label: 'Unavailable',
    }]);
  };

  const removeEntry = async (idx: number) => {
    const entry = entries[idx];
    if (entry.id) await supabase.from('creator_availability').delete().eq('id', entry.id);
    setEntries(prev => prev.filter((_, i) => i !== idx));
  };

  if (loading) return <div className="py-20 text-center text-[11px] text-white/40">Loading...</div>;

  return (
    <div className="mx-auto max-w-3xl space-y-3 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-[11px] font-bold uppercase tracking-widest text-white/50">Weekly Availability</h3>
        <div className="flex items-center gap-2">
          <button onClick={addBlock} className="flex items-center gap-1 rounded-lg border px-3 py-2 text-[10px] font-bold uppercase tracking-widest transition-all hover:scale-105"
            style={{ borderColor: BORDER, color: '#9ca3af', background: 'rgba(255,255,255,0.02)' }}>
            <Plus size={12} /> Block Date
          </button>
          <button onClick={saveAll} disabled={saving}
            className="flex items-center gap-1 rounded-lg border px-3 py-2 text-[10px] font-bold uppercase tracking-widest transition-all hover:scale-105 disabled:opacity-50"
            style={{ borderColor: 'rgba(192,145,30,0.3)', color: GOLD_BRIGHT, background: 'rgba(192,145,30,0.08)' }}>
            {saved ? <Check size={12} /> : <Save size={12} />} {saving ? '...' : saved ? 'Saved' : 'Save'}
          </button>
        </div>
      </div>

      {/* Weekly grid */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {DAYS.map((day, dow) => {
          const dayEntries = entries.filter(e => e.entry_type === 'weekly' && e.day_of_week === dow);
          return (
            <div key={day} className="rounded-xl border p-3" style={{ borderColor: BORDER, background: DARK_PANEL }}>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-widest text-white/60">{day}</span>
                <button onClick={() => addWeekly(dow)} className="text-white/30 hover:text-white/60"><Plus size={14} /></button>
              </div>
              {dayEntries.length === 0 ? (
                <div className="flex items-center gap-1.5 text-[10px] text-white/25">
                  <Clock size={11} /> Unavailable
                </div>
              ) : (
                <div className="space-y-1.5">
                  {dayEntries.map((entry, eIdx) => {
                    const realIdx = entries.indexOf(entry);
                    return (
                      <div key={eIdx} className="flex items-center gap-2 rounded-lg border px-2 py-1.5" style={{ borderColor: 'rgba(255,255,255,0.04)', background: 'rgba(255,255,255,0.015)' }}>
                        <Clock size={11} className="text-white/30" />
                        <input type="time" value={entry.start_time ?? ''} onChange={(e) => setEntries(prev => prev.map((en, i) => i === realIdx ? { ...en, start_time: e.target.value } : en))} className="rounded border border-white/[0.06] bg-black/30 px-1.5 py-0.5 text-[10px] text-white/70 outline-none" />
                        <span className="text-[10px] text-white/30">–</span>
                        <input type="time" value={entry.end_time ?? ''} onChange={(e) => setEntries(prev => prev.map((en, i) => i === realIdx ? { ...en, end_time: e.target.value } : en))} className="rounded border border-white/[0.06] bg-black/30 px-1.5 py-0.5 text-[10px] text-white/70 outline-none" />
                        <button onClick={() => removeEntry(realIdx)} className="ml-auto text-white/20 hover:text-red-400"><X size={12} /></button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Blocked dates */}
      {entries.filter(e => e.entry_type === 'blocked_date').length > 0 && (
        <div>
          <h3 className="mb-2 text-[11px] font-bold uppercase tracking-widest text-white/50">Blocked / Unavailable Dates</h3>
          <div className="space-y-1.5">
            {entries.filter(e => e.entry_type === 'blocked_date').map((entry) => {
              const realIdx = entries.indexOf(entry);
              return (
                <div key={realIdx} className="flex items-center gap-2 rounded-lg border px-3 py-2" style={{ borderColor: BORDER, background: DARK_PANEL }}>
                  <input type="date" value={entry.specific_date ?? ''} onChange={(e) => setEntries(prev => prev.map((en, i) => i === realIdx ? { ...en, specific_date: e.target.value } : en))} className="rounded border border-white/[0.06] bg-black/30 px-2 py-1 text-[10px] text-white/70 outline-none" />
                  <input value={entry.label} onChange={(e) => setEntries(prev => prev.map((en, i) => i === realIdx ? { ...en, label: e.target.value } : en))} placeholder="Label" className="input-base flex-1" />
                  <button onClick={() => removeEntry(realIdx)} className="text-white/20 hover:text-red-400"><X size={14} /></button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// OPPORTUNITIES TAB
// ════════════════════════════════════════════════════════════════

function OpportunitiesTab({ account }: { account: SpotVaultAccount }) {
  const [data, setData] = useState<CreatorOpportunities>({ open_to: [], looking_for_notes: '', contact_preference: 'open_to_all' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    void (async () => {
      const { data: d } = await supabase
        .from('creator_opportunities')
        .select('*')
        .eq('account_id', account.id)
        .maybeSingle();
      if (d) setData({ open_to: d.open_to ?? [], looking_for_notes: d.looking_for_notes ?? '', contact_preference: d.contact_preference ?? 'open_to_all' });
      setLoading(false);
    })();
  }, [account.id]);

  const save = async () => {
    setSaving(true);
    await supabase.from('creator_opportunities').upsert({
      account_id: account.id, open_to: data.open_to, looking_for_notes: data.looking_for_notes,
      contact_preference: data.contact_preference,
    }, { onConflict: 'account_id' });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const toggle = (opt: string) => {
    setData(d => ({ ...d, open_to: d.open_to.includes(opt) ? d.open_to.filter(o => o !== opt) : [...d.open_to, opt] }));
  };

  if (loading) return <div className="py-20 text-center text-[11px] text-white/40">Loading...</div>;

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      <Section title="What Opportunities Are You Open To?" icon={Handshake}>
        <div className="flex flex-wrap gap-1.5">
          {OPPORTUNITY_OPTIONS.map(opt => (
            <button key={opt} onClick={() => toggle(opt)}
              className={`rounded-md border px-2.5 py-1.5 text-[10px] font-medium transition-all ${data.open_to.includes(opt) ? 'border-[#c091e]/30 bg-[#c091e]/10 text-[#d4a52c]' : 'border-white/[0.06] bg-white/[0.02] text-white/35 hover:text-white/55'}`}>
              {opt}
            </button>
          ))}
        </div>
      </Section>

      <Section title="What Are You Looking For?" icon={Star}>
        <textarea value={data.looking_for_notes} onChange={(e) => setData(d => ({ ...d, looking_for_notes: e.target.value }))}
          placeholder="e.g. Interested in poker-related sponsorships, stream collaborations, tournament commentary and podcast appearances. Open to discussing longer-term ambassador relationships."
          className="input-base min-h-[100px] resize-y" />
      </Section>

      <Section title="How Should People Approach You?" icon={MessageSquare}>
        <div className="space-y-2">
          {CONTACT_PREFS.map(pref => (
            <button key={pref.id} onClick={() => setData(d => ({ ...d, contact_preference: pref.id }))}
              className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2.5 text-left transition-all ${data.contact_preference === pref.id ? 'border-[#c091e]/30 bg-[#c091e]/10 text-[#f5e6b0]' : 'border-white/[0.06] bg-white/[0.02] text-white/40 hover:text-white/60'}`}>
              <div className={`flex h-4 w-4 items-center justify-center rounded-full border ${data.contact_preference === pref.id ? 'border-[#d4a52c] bg-[#d4a52c]' : 'border-white/20'}`}>
                {data.contact_preference === pref.id && <Check size={10} className="text-[#080706]" />}
              </div>
              <span className="text-[11px] font-medium">{pref.label}</span>
            </button>
          ))}
        </div>
      </Section>

      <div className="flex justify-end pb-4">
        <button onClick={save} disabled={saving}
          className="flex items-center gap-1.5 rounded-lg border border-[#c091e]/30 bg-[#c091e]/10 px-4 py-2.5 text-[11px] font-bold tracking-widest text-[#f5e6b0] uppercase transition hover:bg-[#c091e]/20 disabled:opacity-40">
          {saved ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
          {saving ? 'Saving...' : saved ? 'Saved' : 'Save'}
        </button>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// MEDIA TAB
// ════════════════════════════════════════════════════════════════

function MediaTab({ account }: { account: SpotVaultAccount }) {
  const [kit, setKit] = useState<CreatorMediaKit>({
    additional_photos: [], youtube_subscribers: null, twitch_followers: null,
    twitter_followers: null, instagram_followers: null, avg_stream_viewers: null,
    tiktok_followers: null, poker_accomplishments: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase
        .from('creator_media_kit')
        .select('*')
        .eq('account_id', account.id)
        .maybeSingle();
      if (data) setKit({
        additional_photos: data.additional_photos ?? [], youtube_subscribers: data.youtube_subscribers,
        twitch_followers: data.twitch_followers, twitter_followers: data.twitter_followers,
        instagram_followers: data.instagram_followers, avg_stream_viewers: data.avg_stream_viewers,
        tiktok_followers: data.tiktok_followers, poker_accomplishments: data.poker_accomplishments ?? '',
      });
      setLoading(false);
    })();
  }, [account.id]);

  const save = async () => {
    setSaving(true);
    await supabase.from('creator_media_kit').upsert({
      account_id: account.id, additional_photos: kit.additional_photos,
      youtube_subscribers: kit.youtube_subscribers, twitch_followers: kit.twitch_followers,
      twitter_followers: kit.twitter_followers, instagram_followers: kit.instagram_followers,
      avg_stream_viewers: kit.avg_stream_viewers, tiktok_followers: kit.tiktok_followers,
      poker_accomplishments: kit.poker_accomplishments,
    }, { onConflict: 'account_id' });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (loading) return <div className="py-20 text-center text-[11px] text-white/40">Loading...</div>;

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      <Section title="Audience Statistics (optional)" icon={TrendingUp}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <StatField label="YouTube Subs" value={kit.youtube_subscribers} onChange={(v) => setKit(k => ({ ...k, youtube_subscribers: v }))} />
          <StatField label="Twitch Followers" value={kit.twitch_followers} onChange={(v) => setKit(k => ({ ...k, twitch_followers: v }))} />
          <StatField label="X Followers" value={kit.twitter_followers} onChange={(v) => setKit(k => ({ ...k, twitter_followers: v }))} />
          <StatField label="Instagram" value={kit.instagram_followers} onChange={(v) => setKit(k => ({ ...k, instagram_followers: v }))} />
          <StatField label="TikTok" value={kit.tiktok_followers} onChange={(v) => setKit(k => ({ ...k, tiktok_followers: v }))} />
          <StatField label="Avg Stream Viewers" value={kit.avg_stream_viewers} onChange={(v) => setKit(k => ({ ...k, avg_stream_viewers: v }))} />
        </div>
      </Section>

      <Section title="Poker Results / Accomplishments" icon={Star}>
        <textarea value={kit.poker_accomplishments} onChange={(e) => setKit(k => ({ ...k, poker_accomplishments: e.target.value }))}
          placeholder="e.g. WSOP Bracelet Winner, $4.2M in live earnings, 2021 WSOP $1,500 NLHE champion..."
          className="input-base min-h-[80px] resize-y" />
      </Section>

      <Section title="Additional Photos" icon={Camera}>
        <div className="flex flex-wrap gap-2">
          {kit.additional_photos.map((url, i) => (
            <div key={i} className="group relative h-20 w-20 overflow-hidden rounded-lg border" style={{ borderColor: BORDER }}>
              <img src={url} alt="" className="h-full w-full object-cover" />
              <button onClick={() => setKit(k => ({ ...k, additional_photos: k.additional_photos.filter((_, idx) => idx !== i) }))}
                className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-red-400 opacity-0 transition-opacity group-hover:opacity-100">
                <X size={11} />
              </button>
            </div>
          ))}
          <button className="flex h-20 w-20 items-center justify-center rounded-lg border-2 border-dashed transition-all hover:scale-105"
            style={{ borderColor: 'rgba(255,255,255,0.15)' }}>
            <Plus size={20} className="text-white/30" />
          </button>
        </div>
        <p className="mt-2 text-[10px] text-white/30">Additional photos appear as a gallery on your public profile.</p>
      </Section>

      <div className="flex justify-end pb-4">
        <button onClick={save} disabled={saving}
          className="flex items-center gap-1.5 rounded-lg border border-[#c091e]/30 bg-[#c091e]/10 px-4 py-2.5 text-[11px] font-bold tracking-widest text-[#f5e6b0] uppercase transition hover:bg-[#c091e]/20 disabled:opacity-40">
          {saved ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
          {saving ? 'Saving...' : saved ? 'Saved' : 'Save'}
        </button>
      </div>
    </div>
  );
}

// ── Shared UI helpers ──

function Section({ title, icon: Icon, children }: { title: string; icon: LucideIcon; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border p-4" style={{ borderColor: BORDER, background: DARK_PANEL }}>
      <div className="mb-3 flex items-center gap-2 border-b pb-3" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
        <Icon className="h-4 w-4" strokeWidth={1.5} style={{ color: 'rgba(212,165,44,0.6)' }} />
        <h3 className="text-[11px] font-bold tracking-widest text-white/50 uppercase">{title}</h3>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-[10px] font-mono tracking-widest text-white/30 uppercase">{label}</label>
      {children}
    </div>
  );
}

function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[11px] font-medium text-white/70">{label}</span>
      <button onClick={() => onChange(!checked)}
        className={`relative h-5 w-10 shrink-0 rounded-full transition-colors ${checked ? 'bg-[#c091e]/40' : 'bg-white/[0.08]'}`}>
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${checked ? 'left-5' : 'left-0.5'}`} />
      </button>
    </div>
  );
}

function StatField({ label, value, onChange }: { label: string; value: number | null; onChange: (v: number | null) => void }) {
  return (
    <div>
      <label className="mb-1 block text-[10px] font-mono tracking-widest text-white/30 uppercase">{label}</label>
      <input type="number" value={value ?? ''} onChange={(e) => onChange(e.target.value ? parseInt(e.target.value) : null)}
        className="input-base" placeholder="—" min={0} />
    </div>
  );
}
