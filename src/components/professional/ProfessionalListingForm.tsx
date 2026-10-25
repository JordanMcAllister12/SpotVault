import { useState, useEffect, useCallback } from 'react';
import { Loader2, Plus, X, Check, Save, Trash2, ExternalLink, Eye } from 'lucide-react';
import {
  fetchMyListing,
  createListing,
  updateListing,
  deleteListing,
  fetchEntitlements,
  updateRolodexSettings,
  type ProfessionalListing,
  type PortalType,
  type ServiceEntry,
  type LinkEntry,
  type ProfessionalEntitlement,
} from '@/lib/professionalListingStore';

const ROLE_OPTIONS: { id: string; label: string }[] = [
  { id: 'creator-portal', label: 'Creators / Pros' },
  { id: 'coach-portal', label: 'Coaches' },
  { id: 'business-portal', label: 'Businesses' },
  { id: 'stable-portal', label: 'Stables' },
  { id: 'media-portal', label: 'Media' },
];

const AVAILABLE_FOR_SUGGESTIONS = [
  'Coaching', 'Content creation', 'Sponsorships', 'Partnerships', 'Commentary',
  'Streaming', 'Video production', 'Writing', 'Stable work', 'Player recruitment',
  'Consulting', 'Advertising', 'Affiliate partnerships', 'Events', 'Media appearances',
];
import { GOLD, CARD_BORDER, CARD_BG, CARD_SHADOW } from '@/components/store/storeTokens';

interface Props {
  portalType: PortalType;
  userId: string;
  displayName: string;
  onSaved?: () => void;
}

export function ProfessionalListingForm({ portalType, userId, displayName, onSaved }: Props) {
  const [listing, setListing] = useState<ProfessionalListing | null>(null);
  const [entitlement, setEntitlement] = useState<ProfessionalEntitlement | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [formDisplayName, setFormDisplayName] = useState(displayName);
  const [title, setTitle] = useState('');
  const [shortBio, setShortBio] = useState('');
  const [longDesc, setLongDesc] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [specialties, setSpecialties] = useState<string[]>([]);
  const [newSpecialty, setNewSpecialty] = useState('');
  const [services, setServices] = useState<ServiceEntry[]>([]);
  const [hourlyRate, setHourlyRate] = useState('');
  const [packagePricing, setPackagePricing] = useState('');
  const [contactForPricing, setContactForPricing] = useState(false);
  const [isAvailable, setIsAvailable] = useState(true);
  const [availabilityText, setAvailabilityText] = useState('');
  const [acceptsOnline, setAcceptsOnline] = useState(true);
  const [acceptsInPerson, setAcceptsInPerson] = useState(false);
  const [location, setLocation] = useState('');
  const [isRemote, setIsRemote] = useState(true);
  const [links, setLinks] = useState<LinkEntry[]>([]);
  const [ctaLabel, setCtaLabel] = useState('Contact');
  const [ctaUrl, setCtaUrl] = useState('');
  const [rolodexOptedIn, setRolodexOptedIn] = useState(false);
  const [visibleToRoles, setVisibleToRoles] = useState<string[]>([]);
  const [availableFor, setAvailableFor] = useState<string[]>([]);
  const [newAvailableFor, setNewAvailableFor] = useState('');
  const [allowSvMessages, setAllowSvMessages] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [existing, ent] = await Promise.all([
        fetchMyListing(portalType),
        fetchEntitlements(portalType),
      ]);
      setListing(existing);
      setEntitlement(ent);
      if (existing) {
        setFormDisplayName(existing.display_name);
        setTitle(existing.professional_title);
        setShortBio(existing.short_bio);
        setLongDesc(existing.long_description ?? '');
        setImageUrl(existing.profile_image_url ?? '');
        setSpecialties(existing.specialties ?? []);
        setServices(existing.services ?? []);
        setHourlyRate(existing.pricing?.hourlyRate ?? '');
        setPackagePricing(existing.pricing?.packagePricing ?? '');
        setContactForPricing(existing.pricing?.contactForPricing ?? false);
        setIsAvailable(existing.availability?.isAvailable ?? true);
        setAvailabilityText(existing.availability?.availabilityText ?? '');
        setAcceptsOnline(existing.availability?.acceptsOnline ?? true);
        setAcceptsInPerson(existing.availability?.acceptsInPerson ?? false);
        setLocation(existing.location ?? '');
        setIsRemote(existing.is_remote);
        setLinks(existing.links ?? []);
        setCtaLabel(existing.contact_cta_label ?? 'Contact');
        setCtaUrl(existing.contact_cta_url ?? '');
        setRolodexOptedIn((existing as Record<string, unknown>).rolodex_opted_in as boolean ?? false);
        setVisibleToRoles((existing as Record<string, unknown>).visible_to_roles as string[] ?? []);
        setAvailableFor((existing as Record<string, unknown>).available_for as string[] ?? []);
        setAllowSvMessages((existing as Record<string, unknown>).allow_spotvault_messages as boolean ?? true);
      }
    } catch (err) {
      console.error('Error loading listing:', err);
    } finally {
      setLoading(false);
    }
  }, [portalType]);

  useEffect(() => { void load(); }, [load]);

  const handleSave = async () => {
    setSaving(true);
    setMsg(null);
    try {
      const payload = {
        portal_type: portalType,
        display_name: formDisplayName,
        professional_title: title,
        short_bio: shortBio,
        long_description: longDesc,
        profile_image_url: imageUrl || null,
        specialties,
        services,
        pricing: { hourlyRate, packagePricing, contactForPricing },
        availability: { isAvailable, availabilityText, acceptsOnline, acceptsInPerson },
        location,
        is_remote: isRemote,
        links,
        contact_cta_label: ctaLabel,
        contact_cta_url: ctaUrl || null,
      };

      if (listing) {
        await updateListing(listing.id, payload);
        await updateRolodexSettings(listing.id, {
          rolodex_opted_in: rolodexOptedIn,
          visible_to_roles: visibleToRoles,
          available_for: availableFor,
          allow_spotvault_messages: allowSvMessages,
        });
        setMsg('Listing updated successfully.');
      } else {
        const created = await createListing(payload);
        setListing(created);
        setMsg('Listing created! It will be reviewed by our team before going live.');
      }
      onSaved?.();
      setTimeout(() => setMsg(null), 4000);
    } catch (err) {
      setMsg('Error saving listing. Please try again.');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!listing) return;
    if (!confirm('Delete your professional listing? This cannot be undone.')) return;
    try {
      await deleteListing(listing.id);
      setListing(null);
      setMsg('Listing deleted.');
      setTimeout(() => setMsg(null), 3000);
    } catch (err) {
      setMsg('Error deleting listing.');
      console.error(err);
    }
  };

  const addSpecialty = () => {
    const s = newSpecialty.trim();
    if (s && !specialties.includes(s)) {
      setSpecialties([...specialties, s]);
      setNewSpecialty('');
    }
  };

  const addService = () => {
    setServices([...services, { name: '', description: '', price: '', priceUnit: '' }]);
  };

  const updateService = (index: number, field: keyof ServiceEntry, value: string) => {
    const updated = [...services];
    updated[index] = { ...updated[index], [field]: value };
    setServices(updated);
  };

  const removeService = (index: number) => {
    setServices(services.filter((_, i) => i !== index));
  };

  const addLink = () => {
    setLinks([...links, { label: '', url: '' }]);
  };

  const updateLink = (index: number, field: keyof LinkEntry, value: string) => {
    const updated = [...links];
    updated[index] = { ...updated[index], [field]: value };
    setLinks(updated);
  };

  const removeLink = (index: number) => {
    setLinks(links.filter((_, i) => i !== index));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin" style={{ color: GOLD }} />
      </div>
    );
  }

  const isCoach = portalType === 'coach-portal';
  const isBusiness = portalType === 'business-portal';
  const isCreator = portalType === 'creator-portal';

  return (
    <div className="space-y-5">
      {/* Status banner */}
      {listing && (
        <div className="flex items-center gap-2.5 rounded-lg border px-3 py-2.5" style={{
          borderColor: listing.moderation_status === 'approved' ? 'rgba(74,222,128,0.25)' : listing.moderation_status === 'pending' ? 'rgba(212,165,44,0.25)' : 'rgba(239,68,68,0.25)',
          background: listing.moderation_status === 'approved' ? 'rgba(74,222,128,0.06)' : listing.moderation_status === 'pending' ? 'rgba(212,165,44,0.06)' : 'rgba(239,68,68,0.06)',
        }}>
          {listing.moderation_status === 'approved' ? (
            <><Check className="h-4 w-4 text-emerald-400" /> <span className="text-[11px] font-medium text-emerald-300">Your listing is approved and live in the People directory.</span></>
          ) : listing.moderation_status === 'pending' ? (
            <><Loader2 className="h-4 w-4 animate-spin" style={{ color: GOLD }} /> <span className="text-[11px] font-medium" style={{ color: GOLD }}>Your listing is pending review by our team.</span></>
          ) : listing.moderation_status === 'rejected' ? (
            <><X className="h-4 w-4 text-red-400" /> <span className="text-[11px] font-medium text-red-300">Your listing was rejected. {listing.moderation_note || 'Please review and update your listing.'}</span></>
          ) : (
            <><X className="h-4 w-4 text-red-400" /> <span className="text-[11px] font-medium text-red-300">Your listing has been suspended. {listing.moderation_note || 'Contact support for assistance.'}</span></>
          )}
        </div>
      )}

      {/* Entitlements info */}
      {entitlement && (
        <div className="rounded-lg border px-3 py-2" style={{ borderColor: CARD_BORDER, background: CARD_BG }}>
          <div className="flex flex-wrap items-center gap-3 text-[10px] text-white/50">
            <span className="flex items-center gap-1">
              <Check className="h-3 w-3 text-emerald-400" /> Directory listing
            </span>
            {entitlement.passive_feed_discovery_enabled && (
              <span className="flex items-center gap-1">
                <Check className="h-3 w-3 text-emerald-400" /> Info Feed discovery
              </span>
            )}
            <span className="flex items-center gap-1">
              <Check className="h-3 w-3 text-emerald-400" /> {entitlement.monthly_main_feed_post_allowance} promotional posts/month
            </span>
          </div>
        </div>
      )}

      {/* Core info section */}
      <Section title="Professional Information">
        <Field label="Display Name">
          <input value={formDisplayName} onChange={(e) => setFormDisplayName(e.target.value)} className={inputCls} placeholder="Your professional name" />
        </Field>
        <Field label="Professional Title">
          <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} placeholder={isCoach ? 'Poker Coach' : isBusiness ? 'Business Name' : 'Poker Creator'} />
        </Field>
        <Field label="Short Bio">
          <input value={shortBio} onChange={(e) => setShortBio(e.target.value)} className={inputCls} placeholder="One sentence describing what you do" />
        </Field>
        <Field label="Long Description">
          <textarea value={longDesc} onChange={(e) => setLongDesc(e.target.value)} className={`${inputCls} min-h-[100px] resize-y`} placeholder="Detailed description of your professional background and offerings" />
        </Field>
        <Field label="Profile Image URL">
          <input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} className={inputCls} placeholder="https://..." />
        </Field>
      </Section>

      {/* Specialties */}
      <Section title={isCoach ? 'Coaching Specialties' : isBusiness ? 'Business Categories' : 'Content Specialties'}>
        <div className="flex flex-wrap gap-1.5">
          {specialties.map((s) => (
            <span key={s} className="inline-flex items-center gap-1 rounded-md border border-[#c0911e]/30 bg-[#c0911e]/10 px-2 py-1 text-[10px] font-medium text-[#d4a52c]">
              {s}
              <button onClick={() => setSpecialties(specialties.filter((x) => x !== s))} className="text-[#d4a52c]/50 hover:text-[#d4a52c]">
                <X className="h-2.5 w-2.5" />
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-1.5">
          <input
            value={newSpecialty}
            onChange={(e) => setNewSpecialty(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSpecialty(); } }}
            className={inputCls}
            placeholder={isCoach ? 'Tournament strategy' : isBusiness ? 'Poker software' : 'Tournament analysis'}
          />
          <button onClick={addSpecialty} className="shrink-0 rounded-lg border border-[#232a32] bg-[#161b21] px-3 py-2 text-[10px] font-semibold text-white/60 hover:border-[#38424e]">
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
      </Section>

      {/* Services — dynamic by portal type */}
      <Section title={isCoach ? 'Coaching Services' : isBusiness ? 'Products & Services' : 'Content & Services'}>
        {services.map((svc, i) => (
          <div key={i} className="rounded-lg border border-[#1a1f25] bg-[#0e0c0a] p-3">
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-mono uppercase tracking-wider text-white/40">Service {i + 1}</span>
              <button onClick={() => removeService(i)} className="text-white/30 hover:text-red-400">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <input value={svc.name} onChange={(e) => updateService(i, 'name', e.target.value)} className={inputCls} placeholder="Service name (e.g. 1-on-1 coaching)" />
              <input value={svc.price ?? ''} onChange={(e) => updateService(i, 'price', e.target.value)} className={inputCls} placeholder="Price (e.g. $150)" />
              <input value={svc.priceUnit ?? ''} onChange={(e) => updateService(i, 'priceUnit', e.target.value)} className={inputCls} placeholder="Unit (e.g. /hour, /session)" />
              <input value={svc.description ?? ''} onChange={(e) => updateService(i, 'description', e.target.value)} className={inputCls} placeholder="Brief description" />
            </div>
          </div>
        ))}
        <button onClick={addService} className="flex items-center gap-1.5 rounded-lg border border-dashed border-[#232a32] px-3 py-2 text-[10px] font-semibold text-white/50 hover:border-[#38424e] hover:text-white/70">
          <Plus className="h-3.5 w-3.5" /> Add Service
        </button>
      </Section>

      {/* Pricing */}
      <Section title="Pricing">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Field label={isCoach ? "Hourly Rate" : "Base Price"}>
            <input value={hourlyRate} onChange={(e) => setHourlyRate(e.target.value)} className={inputCls} placeholder="$150/hr" />
          </Field>
          <Field label="Package Pricing">
            <input value={packagePricing} onChange={(e) => setPackagePricing(e.target.value)} className={inputCls} placeholder="5 sessions for $600" />
          </Field>
        </div>
        <label className="flex items-center gap-2 text-[11px] text-white/60">
          <input type="checkbox" checked={contactForPricing} onChange={(e) => setContactForPricing(e.target.checked)} className="accent-[#d4a52c]" />
          Contact for pricing
        </label>
      </Section>

      {/* Availability */}
      <Section title="Availability">
        <label className="flex items-center gap-2 text-[11px] text-white/60">
          <input type="checkbox" checked={isAvailable} onChange={(e) => setIsAvailable(e.target.checked)} className="accent-[#d4a52c]" />
          Currently accepting new {isCoach ? 'students' : 'clients'}
        </label>
        <Field label="Availability Notes">
          <input value={availabilityText} onChange={(e) => setAvailabilityText(e.target.value)} className={inputCls} placeholder="Weekdays 9am-5pm EST" />
        </Field>
        <div className="flex flex-wrap gap-3">
          <label className="flex items-center gap-2 text-[11px] text-white/60">
            <input type="checkbox" checked={acceptsOnline} onChange={(e) => setAcceptsOnline(e.target.checked)} className="accent-[#d4a52c]" /> Online
          </label>
          <label className="flex items-center gap-2 text-[11px] text-white/60">
            <input type="checkbox" checked={acceptsInPerson} onChange={(e) => setAcceptsInPerson(e.target.checked)} className="accent-[#d4a52c]" /> In-person
          </label>
        </div>
      </Section>

      {/* Location */}
      <Section title="Location">
        <Field label="Location">
          <input value={location} onChange={(e) => setLocation(e.target.value)} className={inputCls} placeholder="City, Country" />
        </Field>
        <label className="flex items-center gap-2 text-[11px] text-white/60">
          <input type="checkbox" checked={isRemote} onChange={(e) => setIsRemote(e.target.checked)} className="accent-[#d4a52c]" /> Available remotely / online
        </label>
      </Section>

      {/* Links */}
      <Section title="Links">
        {links.map((link, i) => (
          <div key={i} className="flex gap-1.5">
            <input value={link.label} onChange={(e) => updateLink(i, 'label', e.target.value)} className={inputCls} placeholder="Label (e.g. Website)" />
            <input value={link.url} onChange={(e) => updateLink(i, 'url', e.target.value)} className={inputCls} placeholder="https://..." />
            <button onClick={() => removeLink(i)} className="shrink-0 rounded-lg border border-[#232a32] bg-[#161b21] px-3 text-white/30 hover:text-red-400">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        <button onClick={addLink} className="flex items-center gap-1.5 rounded-lg border border-dashed border-[#232a32] px-3 py-2 text-[10px] font-semibold text-white/50 hover:border-[#38424e] hover:text-white/70">
          <Plus className="h-3.5 w-3.5" /> Add Link
        </button>
      </Section>

      {/* Contact CTA */}
      <Section title="Contact CTA">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Field label="CTA Button Label">
            <input value={ctaLabel} onChange={(e) => setCtaLabel(e.target.value)} className={inputCls} placeholder="Contact" />
          </Field>
          <Field label="CTA Destination URL">
            <input value={ctaUrl} onChange={(e) => setCtaUrl(e.target.value)} className={inputCls} placeholder="https://... or mailto:..." />
          </Field>
        </div>
      </Section>

      {/* Industry Rolodex */}
      <Section title="Industry Rolodex">
        <label className="flex items-center gap-2 text-[11px] text-white/60">
          <input type="checkbox" checked={rolodexOptedIn} onChange={(e) => setRolodexOptedIn(e.target.checked)} className="accent-[#d4a52c]" />
          List me in the Industry Rolodex
        </label>
        <p className="text-[10px] text-white/35">
          When enabled, your professional profile becomes discoverable by other SpotVault professionals. You control who can find and contact you.
        </p>
        {rolodexOptedIn && (
          <>
            <div>
              <label className="mb-1.5 block text-[10px] font-medium text-white/40">Who can find &amp; contact me?</label>
              <div className="flex flex-wrap gap-2">
                {ROLE_OPTIONS.map((role) => {
                  const checked = visibleToRoles.length === 0 || visibleToRoles.includes(role.id);
                  return (
                    <label key={role.id} className="flex items-center gap-1.5 rounded-lg border border-[#232a32] bg-[#161b21] px-3 py-1.5 text-[10px] text-white/60">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          if (e.target.checked) {
                            const next = [...new Set([...visibleToRoles, role.id])];
                            setVisibleToRoles(next.length === ROLE_OPTIONS.length ? [] : next);
                          } else {
                            setVisibleToRoles(visibleToRoles.filter((r) => r !== role.id));
                          }
                        }}
                        className="accent-[#d4a52c]"
                      />
                      {role.label}
                    </label>
                  );
                })}
              </div>
              <p className="mt-1 text-[9px] text-white/30">
                {visibleToRoles.length === 0 ? 'Visible to all professional portal users.' : `Visible to: ${visibleToRoles.map((r) => ROLE_OPTIONS.find((ro) => ro.id === r)?.label ?? r).join(', ')}`}
              </p>
            </div>
            <div>
              <label className="mb-1.5 block text-[10px] font-medium text-white/40">Available For</label>
              <div className="flex flex-wrap gap-1.5">
                {availableFor.map((a) => (
                  <span key={a} className="inline-flex items-center gap-1 rounded-md border border-[#c0911e]/30 bg-[#c0911e]/10 px-2 py-1 text-[10px] font-medium text-[#d4a52c]">
                    {a}
                    <button onClick={() => setAvailableFor(availableFor.filter((x) => x !== a))} className="text-[#d4a52c]/50 hover:text-[#d4a52c]">
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </span>
                ))}
              </div>
              <div className="mt-1.5 flex gap-1.5">
                <input
                  value={newAvailableFor}
                  onChange={(e) => setNewAvailableFor(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); const v = newAvailableFor.trim(); if (v && !availableFor.includes(v)) { setAvailableFor([...availableFor, v]); setNewAvailableFor(''); } } }}
                  className={inputCls}
                  placeholder="Add a service (e.g. Sponsorships)"
                  list="available-for-suggestions"
                />
                <datalist id="available-for-suggestions">
                  {AVAILABLE_FOR_SUGGESTIONS.map((s) => <option key={s} value={s} />)}
                </datalist>
                <button onClick={() => { const v = newAvailableFor.trim(); if (v && !availableFor.includes(v)) { setAvailableFor([...availableFor, v]); setNewAvailableFor(''); } }} className="shrink-0 rounded-lg border border-[#232a32] bg-[#161b21] px-3 py-2 text-[10px] font-semibold text-white/60 hover:border-[#38424e]">
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            <label className="flex items-center gap-2 text-[11px] text-white/60">
              <input type="checkbox" checked={allowSvMessages} onChange={(e) => setAllowSvMessages(e.target.checked)} className="accent-[#d4a52c]" />
              Allow SpotVault messages from other professionals
            </label>
          </>
        )}
      </Section>

      {/* Actions */}
      <div className="flex items-center gap-2 border-t border-white/[0.06] pt-4">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-1.5 rounded-lg border border-[#c0911e]/40 bg-gradient-to-b from-[#c0911e]/15 to-[#835e17]/15 px-4 py-2.5 text-[11px] font-bold tracking-widest text-[#f5e6b0] uppercase transition-all hover:from-[#c0911e]/25 hover:to-[#835e17]/25 disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          {listing ? 'Update Listing' : 'Create Listing'}
        </button>
        {listing && (
          <button
            onClick={handleDelete}
            className="flex items-center gap-1.5 rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-2.5 text-[11px] font-bold tracking-widest text-red-400 uppercase transition hover:bg-red-500/10"
          >
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </button>
        )}
        {msg && <span className="text-[11px] font-medium text-[#d4a52c]">{msg}</span>}
      </div>
    </div>
  );
}

const inputCls = 'w-full rounded-lg border border-[#232a32] bg-[#161b21] px-3 py-2 text-[11px] text-white/80 placeholder-white/25 outline-none transition-colors focus:border-[#c0911e]/30';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border p-4" style={{ borderColor: CARD_BORDER, background: CARD_BG, boxShadow: CARD_SHADOW }}>
      <h3 className="mb-3 text-[11px] font-bold uppercase tracking-widest text-white/50">{title}</h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-[10px] font-medium text-white/40">{label}</label>
      {children}
    </div>
  );
}
