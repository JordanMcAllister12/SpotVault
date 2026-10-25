import { useState } from 'react';
import { Megaphone, MessageSquare, ChevronRight, Plus, Star, Radio, Store, TrendingUp, ShoppingBag } from 'lucide-react';
import { SERVICE_LISTINGS, type ServiceListing } from '@/data/universalData';
import { MARKETPLACE_ITEMS } from '@/types';

const GOLD = '#d4a52c';
const BORDER = 'rgba(212, 165, 44, 0.18)';

type Tab = 'services' | 'bulletins' | 'advertise';

export function AdvertisingPage({ onNavigateToMarketplace }: { onNavigateToMarketplace?: (providerId?: string) => void }) {
  const [tab, setTab] = useState<Tab>('services');
  const [showPostForm, setShowPostForm] = useState(false);

  return (
    <div className="network-page-content py-6 lg:py-8">
      {/* Page header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Advertising</h1>
          <p className="mt-1 text-[13px] text-white/40">The professional-services directory. Promote yourself or your business.</p>
        </div>
        {tab !== 'advertise' && (
          <button
            onClick={() => setShowPostForm((v) => !v)}
            className="flex items-center gap-1.5 rounded-lg border px-3.5 py-2 text-[10px] font-semibold tracking-widest uppercase transition-all"
            style={{ borderColor: BORDER, background: GOLD + '15', color: GOLD }}
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={1.5} /> {tab === 'services' ? 'Post Service' : 'Post Bulletin'}
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="mb-5 flex flex-wrap gap-1 rounded-xl border border-white/[0.08] bg-black/25 p-1.5 backdrop-blur-md">
        {([
          { id: 'services', label: 'Services' },
          { id: 'bulletins', label: 'Bulletins' },
          { id: 'advertise', label: 'Advertise on SpotVault' },
        ] as { id: Tab; label: string }[]).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`rounded-lg border px-4 py-2 text-[10px] font-semibold tracking-widest uppercase transition-all ${
              tab === t.id
                ? 'border-[#d4a52c]/40 bg-[#c0911e]/15 text-[#f5e6b0] shadow-[0_0_18px_-8px_rgba(212,165,44,0.55)]'
                : 'border-white/[0.08] bg-black/20 text-white/60 hover:border-[#d4a52c]/30 hover:text-[#f5e6b0]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Body */}
      <div>
        {showPostForm && tab !== 'advertise' && (
          <PostServiceForm onClose={() => setShowPostForm(false)} isBulletin={tab === 'bulletins'} />
        )}

        {tab === 'services' && (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {SERVICE_LISTINGS.map((s) => <ServiceCard key={s.id} service={s} onViewProducts={onNavigateToMarketplace} />)}
          </div>
        )}

        {tab === 'bulletins' && (
          <div className="space-y-3">
            {BULLETINS.map((b) => <BulletinCard key={b.id} bulletin={b} />)}
          </div>
        )}

        {tab === 'advertise' && <AdvertiseOnSpotVault />}
      </div>
    </div>
  );
}

function ServiceCard({ service, onViewProducts }: { service: ServiceListing; onViewProducts?: (providerId?: string) => void }) {
  const hasProducts = MARKETPLACE_ITEMS.some((m) => m.providerId === service.id);
  return (
    <div className="metal-panel group rounded-xl p-5 transition-all hover:border-[#38424e]">
      <div className="flex items-center gap-2">
        <span className="text-[9px] font-mono tracking-widest text-[#5f6e7c] uppercase">{service.category}</span>
        {service.featured && (
          <span className="flex items-center gap-1 rounded border px-1.5 py-0.5 text-[7px] font-bold tracking-widest uppercase" style={{ borderColor: BORDER, background: GOLD + '15', color: GOLD }}>
            <Star className="h-2 w-2" strokeWidth={1.5} /> Featured
          </span>
        )}
      </div>
      <h3 className="mt-1 text-sm font-semibold text-white">{service.title}</h3>
      <div className="mt-0.5 text-xs text-[#5f6e7c]">by {service.provider}</div>
      <p className="mt-2 text-xs leading-relaxed text-[#7A7D7F]">{service.description}</p>
      {service.price && <div className="mt-2 text-xs font-bold" style={{ color: GOLD }}>{service.price}</div>}
      <div className="mt-2 flex flex-wrap gap-1.5">
        {service.tags.map((tag) => (
          <span key={tag} className="rounded border border-[#232a32] bg-[#161b21] px-2 py-0.5 text-[8px] font-medium tracking-wide text-[#5f6e7c] uppercase">{tag}</span>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-2 border-t border-[#1a1f25] pt-3">
        <button className="flex items-center gap-1 rounded-lg border border-[#232a32] bg-[#161b21] px-3 py-1.5 text-[10px] font-semibold tracking-widest text-[#aab6c2] uppercase transition-all hover:border-[#c0911e]/40 hover:text-[#d4a52c]">
          View Service <ChevronRight className="h-3 w-3" strokeWidth={1.5} />
        </button>
        <button className="flex items-center gap-1 rounded-lg border border-[#232a32] px-3 py-1.5 text-[10px] font-semibold tracking-widest text-[#aab6c2] uppercase transition-all hover:border-[#38424e] hover:text-white">
          <MessageSquare className="h-3 w-3" strokeWidth={1.5} /> Message
        </button>
        {hasProducts && (
          <button onClick={() => onViewProducts?.(service.id)} className="flex items-center gap-1 rounded-lg border border-[#c0911e]/30 bg-[#c0911e]/10 px-3 py-1.5 text-[10px] font-semibold tracking-widest text-[#d4a52c] uppercase transition-all hover:bg-[#c0911e]/20">
            <ShoppingBag className="h-3 w-3" strokeWidth={1.5} /> View Products
          </button>
        )}
      </div>
    </div>
  );
}

interface Bulletin {
  id: string;
  author: string;
  title: string;
  body: string;
  posted: string;
}

const BULLETINS: Bulletin[] = [
  { id: 'b1', author: 'MTT Stable', title: 'Looking for 3 profitable MTT players for Q4 staking', body: 'Verified results required. Coaching and bankroll management included. DM for application details.', posted: '3h ago' },
  { id: 'b2', author: 'StreamForge', title: 'Poker stream overlay pack — 50% off launch week', body: 'Professional overlay templates for Twitch and YouTube. Animated alerts, labels, and transitions included.', posted: '6h ago' },
  { id: 'b3', author: 'CardMedia Productions', title: 'Available for WSOP 2027 coverage — booking now', body: 'Full tournament photography and content production. Book early for series rates. Limited availability.', posted: '1d ago' },
  { id: 'b4', author: 'BluffBox Studio', title: 'Custom poker training app development — accepting Q4 projects', body: 'Build your own training tool with GTO integration, hand replayer, and progress tracking. React + Node stack.', posted: '2d ago' },
];

function BulletinCard({ bulletin }: { bulletin: Bulletin }) {
  return (
    <div className="metal-panel rounded-xl p-5 transition-all hover:border-[#38424e]">
      <div className="text-[9px] font-mono tracking-widest text-[#5f6e7c] uppercase">{bulletin.author} · {bulletin.posted}</div>
      <h3 className="mt-1 text-sm font-semibold text-white">{bulletin.title}</h3>
      <p className="mt-2 text-xs leading-relaxed text-[#7A7D7F]">{bulletin.body}</p>
      <div className="mt-3 flex gap-2">
        <button className="rounded-lg border border-[#232a32] bg-[#161b21] px-3 py-1.5 text-[10px] font-semibold tracking-widest text-[#aab6c2] uppercase transition-all hover:border-[#c0911e]/40 hover:text-[#d4a52c]">
          View Bulletin
        </button>
        <button className="flex items-center gap-1 rounded-lg border border-[#232a32] px-3 py-1.5 text-[10px] font-semibold tracking-widest text-[#aab6c2] uppercase transition-all hover:border-[#38424e] hover:text-white">
          <MessageSquare className="h-3 w-3" strokeWidth={1.5} /> Contact
        </button>
      </div>
    </div>
  );
}

function AdvertiseOnSpotVault() {
  const placements = [
    { icon: Radio, title: 'Industry Wire Promoted Posts', desc: 'Boost your announcement to the top of the Industry Wire feed across all portals.' },
    { icon: TrendingUp, title: 'Network Placements', desc: 'Targeted ad placements across the SpotVault network and portal environments.' },
    { icon: Store, title: 'Marketplace Promotion', desc: 'Feature your marketplace listings with promoted placement and enhanced visibility.' },
    { icon: Megaphone, title: 'Sponsored Content', desc: 'Sponsored articles, interviews, and featured content across SpotVault media surfaces.' },
    { icon: Star, title: 'Featured Listings', desc: 'Highlight your jobs, services, or products with featured badges and priority placement.' },
    { icon: Radio, title: 'Portal TV / Media Screen Ads', desc: 'Display ads on portal TV walls and media screens throughout the platform.' },
  ];
  return (
    <div>
      <div className="mb-5 rounded-xl border border-[#1a1f25] bg-[#11151a]/40 p-5">
        <h2 className="text-sm font-semibold text-white">Advertise on SpotVault</h2>
        <p className="mt-1 text-xs leading-relaxed text-[#7A7D7F]">SpotVault offers a range of advertising placements across the poker industry network. From promoted Industry Wire posts to sponsored content and featured listings, reach the poker audience where they already engage.</p>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {placements.map((p) => {
          const Icon = p.icon;
          return (
            <div key={p.title} className="metal-panel rounded-xl p-5">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border" style={{ borderColor: BORDER, background: GOLD + '10' }}>
                  <Icon className="h-4 w-4" style={{ color: GOLD }} strokeWidth={1.5} />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">{p.title}</h3>
                  <p className="mt-1 text-xs leading-relaxed text-[#7A7D7F]">{p.desc}</p>
                </div>
              </div>
              <button className="mt-3 rounded-lg border border-[#c0911e]/30 bg-[#c0911e]/10 px-3 py-1.5 text-[10px] font-semibold tracking-widest text-[#d4a52c] uppercase transition-all hover:bg-[#c0911e]/20">
                Inquire
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PostServiceForm({ onClose, isBulletin }: { onClose: () => void; isBulletin: boolean }) {
  return (
    <div className="mb-4 rounded-xl border border-[#1a1f25] bg-[#11151a]/60 p-5">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[12px] font-semibold text-white">{isBulletin ? 'Post a Bulletin' : 'Post a Service'}</span>
        <button onClick={onClose} className="text-[#5f6e7c] hover:text-white"><Megaphone className="h-4 w-4 rotate-90" strokeWidth={1.5} /></button>
      </div>
      <div className="mb-3 rounded-lg border border-[#1a1f25] bg-[#11151a]/40 px-4 py-2.5">
        <p className="text-[11px] leading-relaxed text-white/45">
          <span className="font-bold text-white/65">Advertising</span> is for promoting yourself or your business. If you are selling a specific product, session, or package, create a listing in <span className="font-semibold text-[#d4a52c]">Marketplace</span> instead.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Title" placeholder="e.g. Video Editing for Streamers" />
        {!isBulletin && <Field label="Category" placeholder="e.g. Video Editing" />}
        <Field label="Provider / Company" placeholder="Your name or company" />
        {!isBulletin && <Field label="Price (optional)" placeholder="e.g. Starting at $350" />}
      </div>
      <div className="mt-3">
        <label className="mb-1 block text-[9px] font-semibold tracking-widest text-[#5f6e7c] uppercase">Description</label>
        <textarea className="h-20 w-full rounded-lg border border-[#232a32] bg-[#161b21] px-3 py-2 text-xs text-[#aab6c2]" placeholder="Describe your service..." />
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <button onClick={onClose} className="rounded-lg border border-[#232a32] px-4 py-2 text-[10px] font-semibold tracking-widest text-[#84929f] uppercase hover:text-white">Cancel</button>
        <button className="rounded-lg border border-[#c0911e]/30 bg-[#c0911e]/15 px-4 py-2 text-[10px] font-semibold tracking-widest text-[#d4a52c] uppercase hover:bg-[#c0911e]/25">Publish</button>
      </div>
    </div>
  );
}

function Field({ label, placeholder }: { label: string; placeholder: string }) {
  return (
    <div>
      <label className="mb-1 block text-[9px] font-semibold tracking-widest text-[#5f6e7c] uppercase">{label}</label>
      <input className="w-full rounded-lg border border-[#232a32] bg-[#161b21] px-3 py-2 text-xs text-[#aab6c2]" placeholder={placeholder} />
    </div>
  );
}
