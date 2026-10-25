import { useState, useEffect, useCallback } from 'react';
import {
  Building2, Plus, Trash2, Save, Check, X, Globe, MapPin,
  BriefcaseBusiness, Star, MessageSquare, Video, Phone, Mail,
  Users, Calendar, Clock, type LucideIcon,
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

const CATEGORIES = [
  { id: 'operator', label: 'Poker Operator' },
  { id: 'brand', label: 'Brand' },
  { id: 'agency', label: 'Agency' },
  { id: 'service_provider', label: 'Service Provider' },
  { id: 'software', label: 'Software Company' },
  { id: 'poker_room', label: 'Poker Room' },
  { id: 'staking', label: 'Staking Company' },
  { id: 'media', label: 'Media Company' },
  { id: 'other', label: 'Other' },
] as const;

const OPEN_TO_OPTIONS = [
  'Partnerships', 'Sponsorships', 'Hiring', 'Creator Collaborations',
  'Poker Player Sponsorship', 'Affiliate Relationships', 'Consulting',
  'B2B Services', 'Media Opportunities', 'Investment Discussions', 'Other',
] as const;

const PRICE_TYPES = [
  { id: 'fixed', label: 'Fixed Price' },
  { id: 'hourly', label: 'Hourly Rate' },
  { id: 'custom_quote', label: 'Custom Quote' },
  { id: 'free', label: 'Free' },
] as const;

const COMM_METHODS = [
  { id: 'chat', label: 'SpotVault Chat', icon: MessageSquare },
  { id: 'video', label: 'Video', icon: Video },
  { id: 'phone', label: 'Phone', icon: Phone },
  { id: 'email', label: 'Email', icon: Mail },
  { id: 'in_person', label: 'In Person', icon: Users },
  { id: 'other', label: 'Other', icon: Globe },
] as const;

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

type ProfileTab = 'company' | 'services' | 'availability' | 'open-to' | 'listing';

interface BusinessProfile {
  company_name: string;
  logo_url: string;
  cover_url: string;
  category: string;
  location: string;
  website: string;
  about: string;
  description: string;
  products_services: string;
  poker_involvement: string;
  social_links: Record<string, string>;
  contact_email: string;
  contact_phone: string;
  open_to: string[];
  show_in_directory: boolean;
}

interface BusinessService {
  id?: string;
  title: string;
  description: string;
  duration_minutes: number;
  price_type: string;
  price_amount: number;
  communication_methods: string[];
  is_active: boolean;
  requires_inquiry: boolean;
  sort_order: number;
}

interface AvailEntry {
  id?: string;
  entry_type: string;
  day_of_week: number | null;
  start_time: string | null;
  end_time: string | null;
  is_available: boolean;
  label: string;
}

export function BusinessProfilePage({ account }: { account: SpotVaultAccount }) {
  const [tab, setTab] = useState<ProfileTab>('company');

  const tabs: { id: ProfileTab; label: string; icon: LucideIcon }[] = [
    { id: 'company', label: 'Company', icon: Building2 },
    { id: 'services', label: 'Services', icon: BriefcaseBusiness },
    { id: 'availability', label: 'Availability', icon: Calendar },
    { id: 'open-to', label: 'Open To', icon: Star },
    { id: 'listing', label: 'Listing', icon: Globe },
  ];

  return (
    <PortalWorkspaceShell maxWidth="max-w-4xl">
    <div className="flex h-full min-h-0 flex-col gap-2 px-1 pb-2 sm:px-3">
      <div className="flex shrink-0 items-center gap-3 rounded-xl px-4 py-2.5 backdrop-blur-md"
        style={{ background: 'rgba(10,12,14,0.72)', border: '1px solid rgba(192,145,30,0.18)' }}>
        <div className="flex h-8 w-8 items-center justify-center rounded-lg"
          style={{ background: 'linear-gradient(135deg, rgba(192,145,30,0.12), rgba(192,145,30,0.04))', border: '1px solid rgba(192,145,30,0.15)' }}>
          <Building2 className="h-4 w-4" strokeWidth={1.5} style={{ color: GOLD }} />
        </div>
        <span className="text-sm font-bold text-white">Business Profile</span>
        <span className="text-[9px] font-mono tracking-[0.2em] uppercase" style={{ color: 'rgba(192,145,30,0.6)' }}>Who you are</span>
      </div>

      <div className="flex shrink-0 items-center gap-1 rounded-lg border p-1" style={{ borderColor: BORDER, background: DARK_PANEL }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-[11px] font-semibold uppercase tracking-wider transition-all ${tab === t.id ? 'text-[#080706]' : 'text-white/50 hover:text-white/70'}`}
            style={{ background: tab === t.id ? GOLD : 'transparent' }}>
            <t.icon size={13} /> {t.label}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {tab === 'company' && <CompanyTab account={account} />}
        {tab === 'services' && <ServicesTab account={account} />}
        {tab === 'availability' && <AvailabilityTab account={account} />}
        {tab === 'open-to' && <OpenToTab account={account} />}
        {tab === 'listing' && (
          <div className="mx-auto max-w-3xl space-y-4 p-4">
            <ProfessionalListingForm portalType="business-portal" userId={account.id} displayName={account.name} />
            <div className="border-t border-white/[0.06] pt-4">
              <PromotionComposer portalType="business-portal" />
            </div>
          </div>
        )}
      </div>
    </div>
    </PortalWorkspaceShell>
  );
}

function CompanyTab({ account }: { account: SpotVaultAccount }) {
  const [profile, setProfile] = useState<BusinessProfile>({
    company_name: account.name, logo_url: '', cover_url: '', category: 'other',
    location: '', website: '', about: '', description: '', products_services: '',
    poker_involvement: '', social_links: {}, contact_email: '', contact_phone: '',
    open_to: [], show_in_directory: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase.from('business_profiles').select('*').eq('account_id', account.id).maybeSingle();
      if (data) setProfile({
        company_name: data.company_name ?? account.name, logo_url: data.logo_url ?? '',
        cover_url: data.cover_url ?? '', category: data.category ?? 'other', location: data.location ?? '',
        website: data.website ?? '', about: data.about ?? '', description: data.description ?? '',
        products_services: data.products_services ?? '', poker_involvement: data.poker_involvement ?? '',
        social_links: data.social_links ?? {}, contact_email: data.contact_email ?? '',
        contact_phone: data.contact_phone ?? '', open_to: data.open_to ?? [],
        show_in_directory: data.show_in_directory ?? true,
      });
      setLoading(false);
    })();
  }, [account.id, account.name]);

  const save = async () => {
    setSaving(true);
    await supabase.from('business_profiles').upsert({
      account_id: account.id, company_name: profile.company_name, logo_url: profile.logo_url,
      cover_url: profile.cover_url, category: profile.category, location: profile.location,
      website: profile.website, about: profile.about, description: profile.description,
      products_services: profile.products_services, poker_involvement: profile.poker_involvement,
      social_links: profile.social_links, contact_email: profile.contact_email,
      contact_phone: profile.contact_phone, open_to: profile.open_to,
      show_in_directory: profile.show_in_directory,
    }, { onConflict: 'account_id' });
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2000);
  };

  if (loading) return <div className="py-20 text-center text-[11px] text-white/40">Loading...</div>;

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      <Section title="Company Information" icon={Building2}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Company Name"><input value={profile.company_name} onChange={(e) => setProfile(p => ({ ...p, company_name: e.target.value }))} className="input-base" /></Field>
          <Field label="Category">
            <select value={profile.category} onChange={(e) => setProfile(p => ({ ...p, category: e.target.value }))} className="input-base">
              {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </Field>
          <Field label="Location"><div className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5 text-white/25" /><input value={profile.location} onChange={(e) => setProfile(p => ({ ...p, location: e.target.value }))} className="input-base flex-1" placeholder="City, State" /></div></Field>
          <Field label="Website"><input value={profile.website} onChange={(e) => setProfile(p => ({ ...p, website: e.target.value }))} className="input-base" placeholder="yoursite.com" /></Field>
        </div>
        <Field label="About"><textarea value={profile.about} onChange={(e) => setProfile(p => ({ ...p, about: e.target.value }))} className="input-base min-h-[80px] resize-y" placeholder="Short description of your company..." /></Field>
        <Field label="Full Description"><textarea value={profile.description} onChange={(e) => setProfile(p => ({ ...p, description: e.target.value }))} className="input-base min-h-[100px] resize-y" placeholder="Detailed company description..." /></Field>
        <Field label="Products / Services"><textarea value={profile.products_services} onChange={(e) => setProfile(p => ({ ...p, products_services: e.target.value }))} className="input-base min-h-[60px] resize-y" placeholder="What do you offer?" /></Field>
        <Field label="Poker Industry Involvement"><textarea value={profile.poker_involvement} onChange={(e) => setProfile(p => ({ ...p, poker_involvement: e.target.value }))} className="input-base min-h-[60px] resize-y" placeholder="Your relationship to the poker world..." /></Field>
      </Section>

      <Section title="Logo & Cover" icon={Building2}>
        <Field label="Logo">
          <div className="flex items-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-white/[0.08] bg-[#c091e]/10 overflow-hidden">
              {profile.logo_url ? <img src={profile.logo_url} alt="" className="h-full w-full object-cover" /> : <Building2 className="h-5 w-5 text-white/30" strokeWidth={1.5} />}
            </div>
            <button className="flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2 text-[10px] font-semibold tracking-wide text-white/50 uppercase transition hover:text-white/70">
              <Plus className="h-3.5 w-3.5" /> Upload Logo
            </button>
          </div>
        </Field>
      </Section>

      <Section title="Contact & Social" icon={Globe}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Contact Email"><input value={profile.contact_email} onChange={(e) => setProfile(p => ({ ...p, contact_email: e.target.value }))} className="input-base" placeholder="business@company.com" /></Field>
          <Field label="Contact Phone"><input value={profile.contact_phone} onChange={(e) => setProfile(p => ({ ...p, contact_phone: e.target.value }))} className="input-base" placeholder="(555) 555-5555" /></Field>
          <Field label="X / Twitter"><input value={profile.social_links.twitter ?? ''} onChange={(e) => setProfile(p => ({ ...p, social_links: { ...p.social_links, twitter: e.target.value } }))} className="input-base" placeholder="@handle" /></Field>
          <Field label="Instagram"><input value={profile.social_links.instagram ?? ''} onChange={(e) => setProfile(p => ({ ...p, social_links: { ...p.social_links, instagram: e.target.value } }))} className="input-base" placeholder="@handle" /></Field>
          <Field label="LinkedIn"><input value={profile.social_links.linkedin ?? ''} onChange={(e) => setProfile(p => ({ ...p, social_links: { ...p.social_links, linkedin: e.target.value } }))} className="input-base" placeholder="linkedin.com/company" /></Field>
          <Field label="YouTube"><input value={profile.social_links.youtube ?? ''} onChange={(e) => setProfile(p => ({ ...p, social_links: { ...p.social_links, youtube: e.target.value } }))} className="input-base" placeholder="youtube.com/@channel" /></Field>
        </div>
      </Section>

      <Section title="Directory Visibility" icon={Users}>
        <ToggleRow label="Show my business in the People directory" checked={profile.show_in_directory} onChange={(v) => setProfile(p => ({ ...p, show_in_directory: v }))} />
      </Section>

      <div className="flex justify-end pb-4">
        <button onClick={save} disabled={saving} className="flex items-center gap-1.5 rounded-lg border border-[#c091e]/30 bg-[#c091e]/10 px-4 py-2.5 text-[11px] font-bold tracking-widest text-[#f5e6b0] uppercase transition hover:bg-[#c091e]/20 disabled:opacity-40">
          {saved ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}{saving ? 'Saving...' : saved ? 'Saved' : 'Save Profile'}
        </button>
      </div>
    </div>
  );
}

function ServicesTab({ account }: { account: SpotVaultAccount }) {
  const [services, setServices] = useState<BusinessService[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('business_services').select('*').eq('account_id', account.id).order('sort_order', { ascending: true });
    setServices((data ?? []) as BusinessService[]);
    setLoading(false);
  }, [account.id]);

  useEffect(() => { void load(); }, [load]);

  const saveAll = async () => {
    setSaving(true);
    for (const svc of services) {
      if (svc.id) {
        await supabase.from('business_services').update({
          title: svc.title, description: svc.description, duration_minutes: svc.duration_minutes,
          price_type: svc.price_type, price_amount: svc.price_amount, communication_methods: svc.communication_methods,
          is_active: svc.is_active, requires_inquiry: svc.requires_inquiry, sort_order: svc.sort_order,
          updated_at: new Date().toISOString(),
        }).eq('id', svc.id);
      } else {
        const { data } = await supabase.from('business_services').insert({
          account_id: account.id, title: svc.title, description: svc.description,
          duration_minutes: svc.duration_minutes, price_type: svc.price_type, price_amount: svc.price_amount,
          communication_methods: svc.communication_methods, is_active: svc.is_active,
          requires_inquiry: svc.requires_inquiry, sort_order: svc.sort_order,
        }).select('*').maybeSingle();
        if (data) svc.id = (data as BusinessService).id;
      }
    }
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2000);
  };

  const addService = () => setServices(prev => [...prev, {
    title: '', description: '', duration_minutes: 60, price_type: 'fixed', price_amount: 0,
    communication_methods: ['chat'], is_active: true, requires_inquiry: false, sort_order: prev.length,
  }]);

  const removeService = async (idx: number) => {
    const svc = services[idx];
    if (svc.id) await supabase.from('business_services').delete().eq('id', svc.id);
    setServices(prev => prev.filter((_, i) => i !== idx));
  };

  const toggleComm = (idx: number, method: string) => {
    setServices(prev => prev.map((s, i) => ({
      ...s,
      communication_methods: s.communication_methods.includes(method)
        ? s.communication_methods.filter(m => m !== method) : [...s.communication_methods, method],
    })));
  };

  if (loading) return <div className="py-20 text-center text-[11px] text-white/40">Loading...</div>;

  return (
    <div className="mx-auto max-w-3xl space-y-3 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-[11px] font-bold uppercase tracking-widest text-white/50">Professional Services</h3>
        <div className="flex items-center gap-2">
          <button onClick={addService} className="flex items-center gap-1 rounded-lg border px-3 py-2 text-[10px] font-bold uppercase tracking-widest transition-all hover:scale-105"
            style={{ borderColor: GOLD, color: '#080706', background: GOLD }}>
            <Plus size={12} /> Add Service
          </button>
          <button onClick={saveAll} disabled={saving} className="flex items-center gap-1 rounded-lg border px-3 py-2 text-[10px] font-bold uppercase tracking-widest transition-all hover:scale-105 disabled:opacity-50"
            style={{ borderColor: 'rgba(192,145,30,0.3)', color: GOLD_BRIGHT, background: 'rgba(192,145,30,0.08)' }}>
            {saved ? <Check size={12} /> : <Save size={12} />} {saving ? '...' : saved ? 'Saved' : 'Save'}
          </button>
        </div>
      </div>
      {services.length === 0 ? (
        <div className="rounded-xl border p-8 text-center" style={{ borderColor: BORDER, background: DARK_PANEL }}>
          <BriefcaseBusiness className="mx-auto mb-2 h-8 w-8 text-white/15" strokeWidth={1.5} />
          <p className="text-sm text-white/40">No services yet. Add professional services you offer.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {services.map((svc, idx) => (
            <div key={idx} className="rounded-xl border p-4" style={{ borderColor: BORDER, background: DARK_PANEL }}>
              <div className="flex items-start justify-between gap-2">
                <input value={svc.title} onChange={(e) => setServices(prev => prev.map((s, i) => i === idx ? { ...s, title: e.target.value } : s))} placeholder="Service title" className="input-base flex-1" />
                <button onClick={() => removeService(idx)} className="flex h-8 w-8 items-center justify-center rounded-md border transition-all hover:border-red-500/40 hover:bg-red-500/10" style={{ borderColor: BORDER, color: '#f87171' }}><Trash2 size={14} /></button>
              </div>
              <textarea value={svc.description} onChange={(e) => setServices(prev => prev.map((s, i) => i === idx ? { ...s, description: e.target.value } : s))} placeholder="Description" className="input-base mt-2 min-h-[50px] resize-y" />
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                <Field label="Duration">
                  <select value={svc.duration_minutes} onChange={(e) => setServices(prev => prev.map((s, i) => i === idx ? { ...s, duration_minutes: parseInt(e.target.value) } : s))} className="input-base">
                    {[15, 30, 45, 60, 90, 120].map(d => <option key={d} value={d}>{d} min</option>)}
                  </select>
                </Field>
                <Field label="Pricing">
                  <select value={svc.price_type} onChange={(e) => setServices(prev => prev.map((s, i) => i === idx ? { ...s, price_type: e.target.value } : s))} className="input-base">
                    {PRICE_TYPES.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                  </select>
                </Field>
                {(svc.price_type === 'fixed' || svc.price_type === 'hourly') && (
                  <Field label="Price (credits)">
                    <input type="number" value={svc.price_amount} onChange={(e) => setServices(prev => prev.map((s, i) => i === idx ? { ...s, price_amount: parseInt(e.target.value) || 0 } : s))} className="input-base" min={0} />
                  </Field>
                )}
              </div>
              <div className="mt-3">
                <div className="mb-1.5 text-[10px] font-mono tracking-widest text-white/30 uppercase">Communication Methods</div>
                <div className="flex flex-wrap gap-1.5">
                  {COMM_METHODS.map(m => (
                    <button key={m.id} onClick={() => toggleComm(idx, m.id)} className={`flex items-center gap-1 rounded-md border px-2.5 py-1 text-[10px] font-medium transition-all ${svc.communication_methods.includes(m.id) ? 'border-[#c091e]/30 bg-[#c091e]/10 text-[#d4a52c]' : 'border-white/[0.06] bg-white/[0.02] text-white/35 hover:text-white/55'}`}>
                      <m.icon size={11} /> {m.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mt-3 flex items-center gap-4">
                <ToggleRow label="Active" checked={svc.is_active} onChange={(v) => setServices(prev => prev.map((s, i) => i === idx ? { ...s, is_active: v } : s))} />
                <ToggleRow label="Inquire First" checked={svc.requires_inquiry} onChange={(v) => setServices(prev => prev.map((s, i) => i === idx ? { ...s, requires_inquiry: v } : s))} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AvailabilityTab({ account }: { account: SpotVaultAccount }) {
  const [entries, setEntries] = useState<AvailEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('creator_availability').select('*').eq('account_id', account.id).order('day_of_week', { ascending: true, nullsFirst: false });
    setEntries((data ?? []) as AvailEntry[]);
    setLoading(false);
  }, [account.id]);

  useEffect(() => { void load(); }, [load]);

  const saveAll = async () => {
    setSaving(true);
    for (const entry of entries) {
      if (entry.id) {
        await supabase.from('creator_availability').update({
          day_of_week: entry.day_of_week, start_time: entry.start_time, end_time: entry.end_time,
          is_available: entry.is_available, updated_at: new Date().toISOString(),
        }).eq('id', entry.id);
      } else {
        const { data } = await supabase.from('creator_availability').insert({
          account_id: account.id, entry_type: entry.entry_type, day_of_week: entry.day_of_week,
          start_time: entry.start_time, end_time: entry.end_time, is_available: entry.is_available,
        }).select('*').maybeSingle();
        if (data) entry.id = (data as AvailEntry).id;
      }
    }
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2000);
  };

  const addSlot = (dow: number) => setEntries(prev => [...prev, {
    entry_type: 'weekly', day_of_week: dow, start_time: '09:00', end_time: '17:00', is_available: true, label: '',
  }]);

  const removeSlot = (idx: number) => {
    const entry = entries[idx];
    if (entry.id) void supabase.from('creator_availability').delete().eq('id', entry.id);
    setEntries(prev => prev.filter((_, i) => i !== idx));
  };

  if (loading) return <div className="py-20 text-center text-[11px] text-white/40">Loading...</div>;

  return (
    <div className="mx-auto max-w-3xl space-y-3 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-[11px] font-bold uppercase tracking-widest text-white/50">Weekly Availability</h3>
        <button onClick={saveAll} disabled={saving} className="flex items-center gap-1 rounded-lg border px-3 py-2 text-[10px] font-bold uppercase tracking-widest transition-all hover:scale-105 disabled:opacity-50"
          style={{ borderColor: 'rgba(192,145,30,0.3)', color: GOLD_BRIGHT, background: 'rgba(192,145,30,0.08)' }}>
          {saved ? <Check size={12} /> : <Save size={12} />} {saving ? '...' : saved ? 'Saved' : 'Save'}
        </button>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {DAYS.map((day, dow) => {
          const dayEntries = entries.filter(e => e.entry_type === 'weekly' && e.day_of_week === dow);
          return (
            <div key={day} className="rounded-xl border p-3" style={{ borderColor: BORDER, background: DARK_PANEL }}>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-widest text-white/60">{day}</span>
                <button onClick={() => addSlot(dow)} className="text-white/30 hover:text-white/60"><Plus size={14} /></button>
              </div>
              {dayEntries.length === 0 ? (
                <div className="flex items-center gap-1.5 text-[10px] text-white/25"><Clock size={11} /> Unavailable</div>
              ) : (
                <div className="space-y-1.5">
                  {dayEntries.map((entry) => {
                    const realIdx = entries.indexOf(entry);
                    return (
                      <div key={realIdx} className="flex items-center gap-2 rounded-lg border px-2 py-1.5" style={{ borderColor: 'rgba(255,255,255,0.04)', background: 'rgba(255,255,255,0.015)' }}>
                        <Clock size={11} className="text-white/30" />
                        <input type="time" value={entry.start_time ?? ''} onChange={(e) => setEntries(prev => prev.map((en, i) => i === realIdx ? { ...en, start_time: e.target.value } : en))} className="rounded border border-white/[0.06] bg-black/30 px-1.5 py-0.5 text-[10px] text-white/70 outline-none" />
                        <span className="text-[10px] text-white/30">–</span>
                        <input type="time" value={entry.end_time ?? ''} onChange={(e) => setEntries(prev => prev.map((en, i) => i === realIdx ? { ...en, end_time: e.target.value } : en))} className="rounded border border-white/[0.06] bg-black/30 px-1.5 py-0.5 text-[10px] text-white/70 outline-none" />
                        <button onClick={() => removeSlot(realIdx)} className="ml-auto text-white/20 hover:text-red-400"><X size={12} /></button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function OpenToTab({ account }: { account: SpotVaultAccount }) {
  const [openTo, setOpenTo] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase.from('business_profiles').select('open_to').eq('account_id', account.id).maybeSingle();
      setOpenTo(data?.open_to ?? []);
      setLoading(false);
    })();
  }, [account.id]);

  const save = async () => {
    setSaving(true);
    await supabase.from('business_profiles').upsert({ account_id: account.id, open_to: openTo }, { onConflict: 'account_id' });
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2000);
  };

  const toggle = (opt: string) => setOpenTo(prev => prev.includes(opt) ? prev.filter(o => o !== opt) : [...prev, opt]);

  if (loading) return <div className="py-20 text-center text-[11px] text-white/40">Loading...</div>;

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      <Section title="What Are You Open To?" icon={Star}>
        <div className="flex flex-wrap gap-1.5">
          {OPEN_TO_OPTIONS.map(opt => (
            <button key={opt} onClick={() => toggle(opt)} className={`rounded-md border px-2.5 py-1.5 text-[10px] font-medium transition-all ${openTo.includes(opt) ? 'border-[#c091e]/30 bg-[#c091e]/10 text-[#d4a52c]' : 'border-white/[0.06] bg-white/[0.02] text-white/35 hover:text-white/55'}`}>
              {opt}
            </button>
          ))}
        </div>
      </Section>
      <div className="flex justify-end pb-4">
        <button onClick={save} disabled={saving} className="flex items-center gap-1.5 rounded-lg border border-[#c091e]/30 bg-[#c091e]/10 px-4 py-2.5 text-[11px] font-bold tracking-widest text-[#f5e6b0] uppercase transition hover:bg-[#c091e]/20 disabled:opacity-40">
          {saved ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}{saving ? 'Saving...' : saved ? 'Saved' : 'Save'}
        </button>
      </div>
    </div>
  );
}

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
  return <div><label className="mb-1 block text-[10px] font-mono tracking-widest text-white/30 uppercase">{label}</label>{children}</div>;
}

function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[11px] font-medium text-white/70">{label}</span>
      <button onClick={() => onChange(!checked)} className={`relative h-5 w-10 shrink-0 rounded-full transition-colors ${checked ? 'bg-[#c091e]/40' : 'bg-white/[0.08]'}`}>
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${checked ? 'left-5' : 'left-0.5'}`} />
      </button>
    </div>
  );
}
