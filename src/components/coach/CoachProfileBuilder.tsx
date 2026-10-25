import { useState, useEffect, useCallback } from 'react';
import {
  Camera, Plus, X, Eye, Save, Globe, DollarSign,
  Clock, Sparkles, Check, Upload,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface Props {
  account: { id: string; name: string };
}

const GAME_TYPES = ['MTT', 'Cash', 'Spin & Go', 'Sit & Go', 'Mixed Games', 'Live Poker', 'Other'];
const COACHING_INCLUDES_OPTIONS = [
  'Hand History Review', 'Database Review', 'Leak Finding', 'GTO / Solver Work',
  'Exploitative Strategy', 'Tournament Review', 'Final Table Review', 'ICM',
  'Preflop Strategy', 'Postflop Strategy', 'Mental Game', 'Bankroll Management',
  'Study Planning', 'Live Sessions / Sweats', 'Custom Study Material',
];

interface CoachProfile {
  display_name: string;
  real_name: string;
  profile_photo_url: string;
  bio: string;
  coaching_description: string;
  primary_games: string[];
  stakes_coached: string[];
  languages: string[];
  timezone: string;
  rate_per_hour: number;
  currency: string;
  min_session_length: number;
  package_pricing: { name: string; sessions: number; price: number }[];
  custom_pricing: boolean;
  coaching_includes: string[];
  available_for_coaching: boolean;
  is_published: boolean;
  profile_completion_pct: number;
}

const DEFAULT_PROFILE: CoachProfile = {
  display_name: '',
  real_name: '',
  profile_photo_url: '',
  bio: '',
  coaching_description: '',
  primary_games: [],
  stakes_coached: [],
  languages: [],
  timezone: '',
  rate_per_hour: 0,
  currency: 'USD',
  min_session_length: 30,
  package_pricing: [],
  custom_pricing: false,
  coaching_includes: [],
  available_for_coaching: true,
  is_published: false,
  profile_completion_pct: 0,
};

function computeCompletion(p: CoachProfile): number {
  let pct = 0;
  if (p.display_name) pct += 10;
  if (p.profile_photo_url) pct += 10;
  if (p.coaching_description) pct += 10;
  if (p.rate_per_hour > 0) pct += 10;
  if (p.primary_games.length > 0) pct += 10;
  if (p.coaching_includes.length > 0) pct += 10;
  if (p.stakes_coached.length > 0) pct += 5;
  if (p.languages.length > 0) pct += 5;
  if (p.timezone) pct += 5;
  if (p.package_pricing.length > 0 || p.custom_pricing) pct += 5;
  if (p.bio) pct += 5;
  if (p.available_for_coaching) pct += 5;
  if (p.is_published) pct += 10;
  return Math.min(100, pct);
}

export function CoachProfileBuilder({ account }: Props) {
  const [profile, setProfile] = useState<CoachProfile>(DEFAULT_PROFILE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [newPackage, setNewPackage] = useState({ name: '', sessions: 1, price: 0 });
  const [pokerUsername, setPokerUsername] = useState({ site: '', username: '' });
  const [pokerUsernames, setPokerUsernames] = useState<{ site: string; username: string }[]>([]);
  const [newStake, setNewStake] = useState('');
  const [newLanguage, setNewLanguage] = useState('');
  const [aiPrompt, setAiPrompt] = useState('');
  const [generating, setGenerating] = useState(false);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    const { data: userData } = await supabase.auth.getUser();
    const accountId = userData.user?.id ?? account.id;
    const { data } = await supabase
      .from('coach_listings')
      .select('*')
      .eq('account_id', accountId)
      .maybeSingle();
    if (data) {
      const loaded: CoachProfile = {
        ...DEFAULT_PROFILE,
        display_name: data.display_name ?? account.name,
        real_name: data.real_name ?? '',
        profile_photo_url: data.profile_photo_url ?? '',
        bio: data.bio ?? '',
        coaching_description: data.coaching_description ?? '',
        primary_games: data.primary_games ?? [],
        stakes_coached: data.stakes_coached ?? [],
        languages: data.languages ?? [],
        timezone: data.timezone ?? '',
        rate_per_hour: data.rate_per_hour ?? 0,
        currency: data.currency ?? 'USD',
        min_session_length: data.min_session_length ?? 30,
        package_pricing: data.package_pricing ?? [],
        custom_pricing: data.custom_pricing ?? false,
        coaching_includes: data.coaching_includes ?? [],
        available_for_coaching: data.available_for_coaching ?? true,
        is_published: data.is_published ?? false,
        profile_completion_pct: data.profile_completion_pct ?? 0,
      };
      setProfile(loaded);
      setPokerUsernames(data.poker_usernames ?? []);
    } else {
      setProfile((p) => ({ ...p, display_name: account.name }));
    }
    setLoading(false);
  }, [account.id, account.name]);

  useEffect(() => { void loadProfile(); }, [loadProfile]);

  const save = async (publish = false) => {
    setSaving(true);
    const { data: userData } = await supabase.auth.getUser();
    const accountId = userData.user?.id ?? account.id;
    const completion = computeCompletion(profile);
    const payload = {
      account_id: accountId,
      display_name: profile.display_name,
      real_name: profile.real_name,
      profile_photo_url: profile.profile_photo_url,
      bio: profile.bio,
      coaching_description: profile.coaching_description,
      primary_games: profile.primary_games,
      stakes_coached: profile.stakes_coached,
      languages: profile.languages,
      poker_usernames: pokerUsernames,
      timezone: profile.timezone,
      rate_per_hour: profile.rate_per_hour,
      currency: profile.currency,
      min_session_length: profile.min_session_length,
      package_pricing: profile.package_pricing,
      custom_pricing: profile.custom_pricing,
      coaching_includes: profile.coaching_includes,
      available_for_coaching: profile.available_for_coaching,
      is_published: publish ? true : profile.is_published,
      profile_completion_pct: completion,
    };
    await supabase.from('coach_listings').upsert(payload, { onConflict: 'account_id' });
    setProfile((p) => ({ ...p, profile_completion_pct: completion, is_published: publish ? true : p.is_published }));
    setSaving(false);
  };

  const generateDescription = () => {
    if (!aiPrompt.trim()) return;
    setGenerating(true);
    const prompt = aiPrompt.trim();
    const generated = `I'm a ${prompt.includes('MTT') ? 'tournament' : 'poker'} coach specializing in ${prompt}. ` +
      `With years of experience at the highest stakes, I help players identify leaks, ` +
      `develop winning strategies, and build the mental game needed to succeed. ` +
      `My coaching is data-driven, combining solver work with exploitative adjustments ` +
      `tailored to your specific games and opponents. Whether you're looking to move up ` +
      `in stakes, improve your fundamentals, or prepare for final tables, I'll create ` +
      `a customized study plan that targets your specific needs and goals.`;
    setTimeout(() => {
      setProfile((p) => ({ ...p, coaching_description: generated }));
      setGenerating(false);
      setAiPrompt('');
    }, 1200);
  };

  const toggleArrayItem = (arr: string[], item: string): string[] =>
    arr.includes(item) ? arr.filter((i) => i !== item) : [...arr, item];

  if (loading) {
    return <div className="flex items-center justify-center py-20 text-[11px] text-white/40">Loading coaching profile...</div>;
  }

  return (
    <div className="flex-1 overflow-y-auto p-4">
      <div className="mx-auto max-w-4xl space-y-4">
        {/* Top row: Available toggle + Preview */}
        <div className="flex items-center justify-between rounded-xl border border-[#1a1f25] bg-[#11151a]/70 px-4 py-2.5 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-mono tracking-widest text-[#5f6e7c] uppercase">Available for Coaching</span>
            <button
              onClick={() => setProfile((p) => ({ ...p, available_for_coaching: !p.available_for_coaching }))}
              className={`relative h-6 w-12 rounded-full transition-colors ${profile.available_for_coaching ? 'bg-[#c0911e]/40' : 'bg-[#232a32]'}`}
            >
              <span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-all ${profile.available_for_coaching ? 'left-7' : 'left-1'}`} />
            </button>
          </div>
          <button
            onClick={() => setShowPreview(true)}
            className="flex items-center gap-1.5 rounded-lg border border-[#232a32] bg-[#161b21] px-3 py-1.5 text-[10px] font-semibold tracking-widest text-[#84929f] uppercase transition-all hover:border-[#c0911e]/40 hover:text-[#d4a52c]"
          >
            <Eye className="h-3.5 w-3.5" /> Preview
          </button>
        </div>

        {/* Basic Information */}
        <Section title="Basic Information">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Display Name">
              <input value={profile.display_name} onChange={(e) => setProfile((p) => ({ ...p, display_name: e.target.value }))} className="input-base" placeholder="Your coaching name" />
            </Field>
            <Field label="Real Name (optional)">
              <input value={profile.real_name} onChange={(e) => setProfile((p) => ({ ...p, real_name: e.target.value }))} className="input-base" placeholder="Legal name" />
            </Field>
          </div>

          {/* Photo */}
          <Field label="Profile Photo">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-xl border border-[#232a32] bg-[#161b21]">
                {profile.profile_photo_url ? <img src={profile.profile_photo_url} alt="" className="h-full w-full rounded-xl object-cover" /> : <Camera className="h-6 w-6 text-[#5f6e7c]" strokeWidth={1.5} />}
              </div>
              <button className="flex items-center gap-1.5 rounded-lg border border-[#232a32] bg-[#161b21] px-3 py-2 text-[10px] font-semibold tracking-widest text-[#84929f] uppercase transition-all hover:border-[#c0911e]/40 hover:text-[#d4a52c]">
                <Upload className="h-3.5 w-3.5" /> Upload Photo
              </button>
            </div>
          </Field>

          {/* Poker Usernames */}
          <Field label="Poker Site Usernames">
            <div className="space-y-2">
              {pokerUsernames.map((u, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="rounded-lg border border-[#232a32] bg-[#161b21] px-3 py-1.5 text-xs text-[#aab6c2]">{u.site}: {u.username}</span>
                  <button onClick={() => setPokerUsernames(pokerUsernames.filter((_, j) => j !== i))} className="text-[#5f6e7c] hover:text-red-400"><X className="h-3.5 w-3.5" /></button>
                </div>
              ))}
              <div className="flex gap-2">
                <input value={pokerUsername.site} onChange={(e) => setPokerUsername((p) => ({ ...p, site: e.target.value }))} className="input-base flex-1" placeholder="Site (e.g. PokerStars)" />
                <input value={pokerUsername.username} onChange={(e) => setPokerUsername((p) => ({ ...p, username: e.target.value }))} className="input-base flex-1" placeholder="Username" />
                <button
                  onClick={() => { if (pokerUsername.site && pokerUsername.username) { setPokerUsernames([...pokerUsernames, pokerUsername]); setPokerUsername({ site: '', username: '' }); } }}
                  className="rounded-lg border border-[#232a32] bg-[#161b21] px-3 py-2 text-[10px] font-semibold text-[#84929f] uppercase hover:border-[#c0911e]/40 hover:text-[#d4a52c]"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </Field>

          {/* Primary Games */}
          <Field label="Primary Games">
            <div className="flex flex-wrap gap-2">
              {GAME_TYPES.map((g) => (
                <button
                  key={g}
                  onClick={() => setProfile((p) => ({ ...p, primary_games: toggleArrayItem(p.primary_games, g) }))}
                  className={`rounded-lg px-3 py-1.5 text-[10px] font-semibold tracking-widest uppercase transition-all ${profile.primary_games.includes(g) ? 'border border-[#c0911e]/40 bg-[#c0911e]/10 text-[#d4a52c]' : 'border border-[#232a32] bg-[#161b21] text-[#5f6e7c]'}`}
                >
                  {g}
                </button>
              ))}
            </div>
          </Field>

          {/* Stakes */}
          <Field label="Stakes / Buy-ins Coached">
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                {profile.stakes_coached.map((s) => (
                  <span key={s} className="flex items-center gap-1 rounded-lg border border-[#232a32] bg-[#161b21] px-3 py-1 text-xs text-[#aab6c2]">
                    {s}
                    <button onClick={() => setProfile((p) => ({ ...p, stakes_coached: p.stakes_coached.filter((x) => x !== s) }))} className="text-[#5f6e7c] hover:text-red-400"><X className="h-3 w-3" /></button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input value={newStake} onChange={(e) => setNewStake(e.target.value)} className="input-base flex-1" placeholder="e.g. $5-$50 ABI" onKeyDown={(e) => { if (e.key === 'Enter' && newStake) { setProfile((p) => ({ ...p, stakes_coached: [...p.stakes_coached, newStake] })); setNewStake(''); } }} />
                <button onClick={() => { if (newStake) { setProfile((p) => ({ ...p, stakes_coached: [...p.stakes_coached, newStake] })); setNewStake(''); } }} className="rounded-lg border border-[#232a32] bg-[#161b21] px-3 py-2 text-[#84929f] hover:text-[#d4a52c]"><Plus className="h-3.5 w-3.5" /></button>
              </div>
            </div>
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Languages">
              <div className="space-y-2">
                <div className="flex flex-wrap gap-2">
                  {profile.languages.map((l) => (
                    <span key={l} className="flex items-center gap-1 rounded-lg border border-[#232a32] bg-[#161b21] px-3 py-1 text-xs text-[#aab6c2]">
                      {l}
                      <button onClick={() => setProfile((p) => ({ ...p, languages: p.languages.filter((x) => x !== l) }))} className="text-[#5f6e7c] hover:text-red-400"><X className="h-3 w-3" /></button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input value={newLanguage} onChange={(e) => setNewLanguage(e.target.value)} className="input-base flex-1" placeholder="e.g. English" onKeyDown={(e) => { if (e.key === 'Enter' && newLanguage) { setProfile((p) => ({ ...p, languages: [...p.languages, newLanguage] })); setNewLanguage(''); } }} />
                  <button onClick={() => { if (newLanguage) { setProfile((p) => ({ ...p, languages: [...p.languages, newLanguage] })); setNewLanguage(''); } }} className="rounded-lg border border-[#232a32] bg-[#161b21] px-3 py-2 text-[#84929f] hover:text-[#d4a52c]"><Plus className="h-3.5 w-3.5" /></button>
                </div>
              </div>
            </Field>
            <Field label="Time Zone">
              <input value={profile.timezone} onChange={(e) => setProfile((p) => ({ ...p, timezone: e.target.value }))} className="input-base" placeholder="e.g. ET / UTC-5" />
            </Field>
          </div>
        </Section>

        {/* Coaching Rate */}
        <Section title="Coaching Rate">
          <div className="grid grid-cols-3 gap-4">
            <Field label="Hourly Rate">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-[#5f6e7c]" />
                <input type="number" value={profile.rate_per_hour || ''} onChange={(e) => setProfile((p) => ({ ...p, rate_per_hour: parseInt(e.target.value) || 0 }))} className="input-base" placeholder="150" />
              </div>
            </Field>
            <Field label="Currency">
              <select value={profile.currency} onChange={(e) => setProfile((p) => ({ ...p, currency: e.target.value }))} className="input-base">
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
                <option value="CAD">CAD</option>
              </select>
            </Field>
            <Field label="Min Session Length">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-[#5f6e7c]" />
                <select value={profile.min_session_length} onChange={(e) => setProfile((p) => ({ ...p, min_session_length: parseInt(e.target.value) }))} className="input-base">
                  {[15, 30, 45, 60, 90, 120].map((m) => <option key={m} value={m}>{m} min</option>)}
                </select>
              </div>
            </Field>
          </div>

          {/* Packages */}
          <Field label="Package Pricing (optional)">
            <div className="space-y-2">
              {profile.package_pricing.map((pkg, i) => (
                <div key={i} className="flex items-center justify-between rounded-lg border border-[#232a32] bg-[#161b21] px-3 py-2">
                  <span className="text-sm text-white">{pkg.name} — {pkg.sessions} sessions — ${pkg.price}</span>
                  <button onClick={() => setProfile((p) => ({ ...p, package_pricing: p.package_pricing.filter((_, j) => j !== i) }))} className="text-[#5f6e7c] hover:text-red-400"><X className="h-3.5 w-3.5" /></button>
                </div>
              ))}
              <div className="flex gap-2">
                <input value={newPackage.name} onChange={(e) => setNewPackage((p) => ({ ...p, name: e.target.value }))} className="input-base flex-1" placeholder="Package name" />
                <input type="number" value={newPackage.sessions || ''} onChange={(e) => setNewPackage((p) => ({ ...p, sessions: parseInt(e.target.value) || 1 }))} className="input-base w-20" placeholder="Sessions" />
                <input type="number" value={newPackage.price || ''} onChange={(e) => setNewPackage((p) => ({ ...p, price: parseInt(e.target.value) || 0 }))} className="input-base w-24" placeholder="Price $" />
                <button onClick={() => { if (newPackage.name && newPackage.price > 0) { setProfile((p) => ({ ...p, package_pricing: [...p.package_pricing, newPackage] })); setNewPackage({ name: '', sessions: 1, price: 0 }); } }} className="rounded-lg border border-[#232a32] bg-[#161b21] px-3 py-2 text-[#84929f] hover:text-[#d4a52c]"><Plus className="h-3.5 w-3.5" /></button>
              </div>
            </div>
          </Field>

          <Field label="Custom Pricing">
            <button
              onClick={() => setProfile((p) => ({ ...p, custom_pricing: !p.custom_pricing }))}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition-all ${profile.custom_pricing ? 'border border-[#c0911e]/40 bg-[#c0911e]/10 text-[#d4a52c]' : 'border border-[#232a32] bg-[#161b21] text-[#5f6e7c]'}`}
            >
              <span className={`h-4 w-4 rounded border ${profile.custom_pricing ? 'border-[#d4a52c] bg-[#d4a52c]' : 'border-[#475565]'}`}>
                {profile.custom_pricing && <Check className="h-3 w-3 text-black" />}
              </span>
              Contact for custom pricing
            </button>
          </Field>
        </Section>

        {/* What My Coaching Includes */}
        <Section title="What My Coaching Includes">
          <div className="flex flex-wrap gap-2">
            {COACHING_INCLUDES_OPTIONS.map((opt) => (
              <button
                key={opt}
                onClick={() => setProfile((p) => ({ ...p, coaching_includes: toggleArrayItem(p.coaching_includes, opt) }))}
                className={`rounded-lg px-3 py-1.5 text-[10px] font-semibold tracking-widest uppercase transition-all ${profile.coaching_includes.includes(opt) ? 'border border-[#c0911e]/40 bg-[#c0911e]/10 text-[#d4a52c]' : 'border border-[#232a32] bg-[#161b21] text-[#5f6e7c]'}`}
              >
                {opt}
              </button>
            ))}
          </div>

          <Field label="Coaching Description">
            <textarea
              value={profile.coaching_description}
              onChange={(e) => setProfile((p) => ({ ...p, coaching_description: e.target.value }))}
              className="input-base min-h-[120px] resize-y"
              placeholder="Describe your coaching approach, experience, and what students can expect..."
            />
          </Field>

          {/* AI Generate */}
          <div className="rounded-lg border border-[#c0911e]/20 bg-gradient-to-r from-[#c0911e]/8 to-transparent p-4">
            <div className="mb-2 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-[#d4a52c]" strokeWidth={1.5} />
              <span className="text-[10px] font-semibold tracking-widest text-[#d4a52c] uppercase">Generate With AI</span>
            </div>
            <textarea
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              className="input-base min-h-[60px] resize-y"
              placeholder="Enter rough info about yourself and your coaching... e.g. 'MTT coach, 10 years experience, ABI $100, specialize in final table play and ICM'"
            />
            <button
              onClick={generateDescription}
              disabled={!aiPrompt.trim() || generating}
              className="mt-2 flex items-center gap-1.5 rounded-lg border border-[#c0911e]/40 bg-gradient-to-b from-[#c0911e]/15 to-[#835e17]/15 px-4 py-2 text-[10px] font-semibold tracking-widest text-[#f5e6b0] uppercase transition-all hover:gold-glow disabled:opacity-40"
            >
              <Sparkles className="h-3.5 w-3.5" /> {generating ? 'Generating...' : 'Generate Description'}
            </button>
          </div>
        </Section>

        {/* Save / Publish */}
        <div className="flex gap-3">
          <button
            onClick={() => void save(false)}
            disabled={saving}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-[#232a32] bg-[#161b21] py-3 text-sm font-bold tracking-widest text-[#84929f] uppercase transition-all hover:border-[#c0911e]/40 hover:text-[#d4a52c] disabled:opacity-40"
          >
            <Save className="h-4 w-4" /> Save Draft
          </button>
          <button
            onClick={() => void save(true)}
            disabled={saving}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-[#c0911e]/40 bg-gradient-to-b from-[#c0911e]/15 to-[#835e17]/15 py-3 text-sm font-bold tracking-widest text-[#f5e6b0] uppercase transition-all hover:gold-glow disabled:opacity-40"
          >
            <Globe className="h-4 w-4" /> {profile.is_published ? 'Update Listing' : 'Publish Listing'}
          </button>
        </div>
      </div>

      {/* Preview Modal */}
      {showPreview && <PreviewModal profile={profile} onClose={() => setShowPreview(false)} />}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="metal-panel rounded-xl p-5 space-y-4">
      <h3 className="text-[11px] font-semibold tracking-[0.25em] text-[#aab6c2] uppercase">{title}</h3>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-[10px] font-mono tracking-widest text-[#5f6e7c] uppercase">{label}</label>
      {children}
    </div>
  );
}

function PreviewModal({ profile, onClose }: { profile: CoachProfile; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[210] flex items-center justify-center bg-[#050608]/80 backdrop-blur-sm" onClick={onClose}>
      <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-[#c0911e]/30 bg-gradient-to-b from-[#0e1115] to-[#0a0c0e] p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-bold tracking-wide text-white uppercase">Public Listing Preview</h2>
          <button onClick={onClose} className="rounded-lg border border-[#232a32] bg-[#161b21] p-2 text-[#84929f] hover:text-[#d4a52c]"><X className="h-4 w-4" strokeWidth={1.5} /></button>
        </div>

        {/* Profile header */}
        <div className="mb-5 flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-xl border border-[#c0911e]/30 bg-gradient-to-b from-[#2a2010] to-[#1a1408] text-lg font-bold text-[#d4a52c]">
            {profile.display_name?.[0] ?? '?'}
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">{profile.display_name || 'Your Name'}</h1>
            <p className="text-xs text-[#5f6e7c]">{profile.primary_games.join(' · ') || 'No games selected'}</p>
            <p className="text-xs text-[#d4a52c]">{profile.stakes_coached.join(', ') || 'No stakes set'}</p>
          </div>
        </div>

        <div className="mb-4 flex items-center gap-4">
          <span className="text-lg font-bold text-[#d4a52c]">${profile.rate_per_hour}/hour</span>
          {profile.custom_pricing && <span className="text-xs text-[#5f6e7c]">Custom pricing available</span>}
        </div>

        <button className="mb-5 w-full rounded-lg border border-[#c0911e]/40 bg-gradient-to-b from-[#c0911e]/15 to-[#835e17]/15 py-3 text-sm font-bold tracking-widest text-[#f5e6b0] uppercase transition-all hover:gold-glow">
          Book Coaching
        </button>

        <div className="space-y-4">
          <div>
            <h3 className="mb-1 text-[11px] font-semibold tracking-[0.25em] text-[#aab6c2] uppercase">About</h3>
            <p className="text-sm text-[#c7cfd8]">{profile.coaching_description || 'No description yet.'}</p>
          </div>
          <div>
            <h3 className="mb-1 text-[11px] font-semibold tracking-[0.25em] text-[#aab6c2] uppercase">What I Coach</h3>
            <div className="flex flex-wrap gap-2">
              {profile.coaching_includes.map((c) => (
                <span key={c} className="rounded-lg border border-[#232a32] bg-[#161b21] px-2 py-1 text-[10px] text-[#aab6c2]">{c}</span>
              ))}
            </div>
          </div>
          {profile.package_pricing.length > 0 && (
            <div>
              <h3 className="mb-1 text-[11px] font-semibold tracking-[0.25em] text-[#aab6c2] uppercase">Packages</h3>
              <div className="space-y-1">
                {profile.package_pricing.map((p, i) => (
                  <div key={i} className="text-sm text-white">{p.name} — {p.sessions} sessions — ${p.price}</div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
