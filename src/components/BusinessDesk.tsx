import { useState } from 'react';
import {
  Search,
  X,
  MessageSquare,
  DoorOpen,
  Calendar,
  User,
  Lock,
  Send,
  Plus,
  Trash2,
  Phone,
  Mail,
  Star,
  Users,
  Mic,
  GraduationCap,
  Camera,
  TrendingUp,
  Briefcase,
  Handshake,
  ShieldCheck,
  StickyNote,
  CalendarDays,
  Contact as ContactIcon,
  Rss,
  Heart,
  Bookmark,
  Share2,
  Globe,
} from 'lucide-react';
import { GlassPanel, PrivacyBadge } from '@/components/PortalShell';
import {
  ROLODEX_CONTACTS,
  DESK_NOTES_SEED,
  DESK_MEETINGS,
  BUSINESS_WIRE_SEED,
  type RolodexContact,
  type DeskNote,
  type WirePost,
} from '@/types';

type DeskTool = 'none' | 'rolodex' | 'buzz' | 'notepad' | 'calendar' | 'wire';

const PORTAL_ICONS: Record<string, typeof User> = {
  'Player Portal': User,
  'Media Portal': Mic,
  'Business Portal': Briefcase,
  'Coach Portal': GraduationCap,
  'Creator Portal': Camera,
  'Investor Portal': TrendingUp,
  'Stable Portal': Users,
};

interface BusinessDeskProps {
  accent: string;
}

export function BusinessDesk({ accent }: BusinessDeskProps) {
  const [activeTool, setActiveTool] = useState<DeskTool>('none');

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      {/* Tool tabs */}
      <div className="flex flex-wrap gap-1.5 border-b border-white/[0.06] px-5 py-3">
        <DeskTab label="Home" accent={accent} active={activeTool === 'none'} onClick={() => setActiveTool('none')} />
        <DeskTab icon={ContactIcon} label="Rolodex" accent={accent} active={activeTool === 'rolodex'} onClick={() => setActiveTool('rolodex')} />
        <DeskTab icon={Send} label="Buzz" accent={accent} active={activeTool === 'buzz'} onClick={() => setActiveTool('buzz')} />
        <DeskTab icon={StickyNote} label="Notepad" accent={accent} active={activeTool === 'notepad'} onClick={() => setActiveTool('notepad')} />
        <DeskTab icon={CalendarDays} label="Calendar" accent={accent} active={activeTool === 'calendar'} onClick={() => setActiveTool('calendar')} />
        <DeskTab icon={Rss} label="Wire" accent={accent} active={activeTool === 'wire'} onClick={() => setActiveTool('wire')} badge="NEW" />
      </div>

      {/* Main desk area */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {activeTool === 'none' && <DeskHome accent={accent} onOpenTool={setActiveTool} />}
        {activeTool === 'rolodex' && <Rolodex accent={accent} />}
        {activeTool === 'buzz' && <BuzzSomeone accent={accent} />}
        {activeTool === 'notepad' && <Notepad accent={accent} />}
        {activeTool === 'calendar' && <DeskCalendar accent={accent} />}
        {activeTool === 'wire' && <BusinessWire accent={accent} />}
      </div>
    </div>
  );
}

function DeskTab({ icon: Icon, label, accent, active, onClick, badge }: { icon?: typeof User; label: string; accent: string; active: boolean; onClick: () => void; badge?: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[10px] font-semibold tracking-widest uppercase transition-all ${
        active ? 'border text-white' : 'border border-transparent text-white/40 hover:text-white/70'
      }`}
      style={active ? { borderColor: accent + '40', background: accent + '10' } : { border: '1px solid rgba(255,255,255,0.05)' }}
    >
      {Icon && <Icon className="h-3.5 w-3.5" strokeWidth={1.5} style={active ? { color: accent } : {}} />}
      {label}
      {badge && <span className="rounded-full px-1.5 py-0.5 text-[8px] font-bold" style={{ background: accent + '20', color: accent }}>{badge}</span>}
    </button>
  );
}

function DeskHome({ accent, onOpenTool }: { accent: string; onOpenTool: (t: DeskTool) => void }) {
  const tools = [
    { id: 'rolodex' as DeskTool, icon: ContactIcon, label: 'Rolodex', desc: 'Your professional contacts' },
    { id: 'buzz' as DeskTool, icon: Send, label: 'Buzz Someone', desc: 'Reach someone across the network' },
    { id: 'notepad' as DeskTool, icon: StickyNote, label: 'Notepad', desc: 'Private notes' },
    { id: 'calendar' as DeskTool, icon: CalendarDays, label: 'Calendar', desc: 'Upcoming meetings' },
    { id: 'wire' as DeskTool, icon: Rss, label: 'Business Wire', desc: 'Industry operators only' },
  ];

  return (
    <div className="p-5 lg:p-6">
      <div className="mb-5">
        <h1 className="text-2xl font-bold tracking-tight text-white">Your Office</h1>
        <p className="mt-1 text-sm text-white/40">Your workspace inside the poker industry.</p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {tools.map((t) => (
          <button
            key={t.id}
            onClick={() => onOpenTool(t.id)}
            className="group flex flex-col items-start gap-3 rounded-xl border border-white/8 bg-gradient-to-b from-white/[0.06] to-white/[0.02] p-5 text-left backdrop-blur-md transition-all hover:border-white/15 hover:from-white/[0.08]"
            style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06), 0 8px 24px -12px rgba(0,0,0,0.6)' }}
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border" style={{ borderColor: accent + '30', background: accent + '10' }}>
              <t.icon className="h-5 w-5" strokeWidth={1.5} style={{ color: accent }} />
            </div>
            <div>
              <div className="text-sm font-semibold text-white">{t.label}</div>
              <div className="mt-0.5 text-[11px] text-white/40">{t.desc}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ===== ROLODEX =====

function Rolodex({ accent }: { accent: string }) {
  const [filter, setFilter] = useState<string>('all');
  const [contacts, setContacts] = useState<RolodexContact[]>(ROLODEX_CONTACTS);

  const filters = [
    { id: 'all', label: 'My Contacts' },
    { id: 'recent', label: 'Recent' },
    { id: 'favorites', label: 'Favorites' },
    { id: 'companies', label: 'Companies' },
    { id: 'players', label: 'Players' },
    { id: 'creators', label: 'Creators' },
    { id: 'media', label: 'Media' },
    { id: 'coaches', label: 'Coaches' },
    { id: 'investors', label: 'Investors' },
    { id: 'stables', label: 'Stables' },
  ];

  const filtered = contacts.filter((c) => {
    if (filter === 'all' || filter === 'recent' || filter === 'favorites') return true;
    if (filter === 'companies') return c.role === 'Organization';
    if (filter === 'players') return c.role.includes('Player');
    if (filter === 'creators') return c.role.includes('Creator');
    if (filter === 'media') return c.role.includes('Media') || c.role.includes('Commentator');
    if (filter === 'coaches') return c.role.includes('Coach');
    if (filter === 'investors') return c.role.includes('Investor');
    if (filter === 'stables') return c.role.includes('Staking') || c.role.includes('Stable');
    return true;
  });

  const handleAction = (id: string) => {
    setContacts((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c;
        if (c.accessType === 'connect') return { ...c, accessType: 'message', accessLabel: 'Message', connected: true, relationship: 'connected' };
        return c;
      })
    );
  };

  return (
    <div className="flex h-full flex-col p-5 lg:p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold tracking-wide text-white">Rolodex</h2>
          <p className="mt-0.5 text-[11px] text-white/40">Your professional contacts across the SpotVault network.</p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="mb-4 flex flex-wrap gap-1.5">
        {filters.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`rounded-lg px-3 py-1.5 text-[10px] font-semibold tracking-widest uppercase transition-all ${
              filter === f.id ? 'border text-white' : 'border border-transparent text-white/40 hover:text-white/70'
            }`}
            style={filter === f.id ? { borderColor: accent + '40', background: accent + '10' } : { border: '1px solid rgba(255,255,255,0.05)' }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Contacts */}
      <div className="flex-1 space-y-2 overflow-y-auto">
        {filtered.map((c) => {
          const PortalIcon = PORTAL_ICONS[c.homePortal] || User;
          return (
            <GlassPanel key={c.id} className="p-4">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-[11px] font-semibold text-white/70">
                    {c.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                  </div>
                  <span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-black/50 ${c.online ? 'bg-emerald-400' : 'bg-white/20'}`} />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-semibold text-white">{c.name}</div>
                  <div className="text-[10px] text-white/40">{c.role} · {c.org}</div>
                  <div className="mt-0.5 flex items-center gap-1.5">
                    <PortalIcon className="h-2.5 w-2.5 text-white/30" strokeWidth={1.5} />
                    <span className="text-[9px] font-mono tracking-widest text-white/30 uppercase">{c.homePortal}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleAction(c.id)}
                    className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[10px] font-semibold tracking-widest uppercase transition-all"
                    style={{
                      borderColor: c.connected ? accent + '40' : 'rgba(255,255,255,0.1)',
                      background: c.connected ? accent + '10' : 'rgba(255,255,255,0.05)',
                      color: c.connected ? accent : 'rgba(255,255,255,0.5)',
                    }}
                  >
                    {c.accessLabel}
                  </button>
                </div>
              </div>

              {/* Action row */}
              <div className="mt-3 flex items-center gap-1.5 border-t border-white/5 pt-2.5">
                <ActionPill icon={MessageSquare} label="Message" accent={accent} disabled={!c.connected} />
                <ActionPill icon={DoorOpen} label="Invite to Room" accent={accent} disabled={!c.connected} />
                <ActionPill icon={Calendar} label="Request Meeting" accent={accent} disabled={!c.connected} />
                <ActionPill icon={User} label="View Profile" accent={accent} />
                {c.connected && <ActionPill icon={Star} label="Favorite" accent={accent} />}
              </div>
            </GlassPanel>
          );
        })}
      </div>
    </div>
  );
}

function ActionPill({ icon: Icon, label, accent, disabled }: { icon: typeof User; label: string; accent: string; disabled?: boolean }) {
  return (
    <button
      disabled={disabled}
      className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[10px] font-medium text-white/50 transition-all hover:bg-white/5 hover:text-white/80 disabled:opacity-25 disabled:cursor-not-allowed"
    >
      <Icon className="h-3 w-3" strokeWidth={1.5} style={{ color: disabled ? undefined : accent + '80' }} />
      {label}
    </button>
  );
}

// ===== BUZZ SOMEONE =====

function BuzzSomeone({ accent }: { accent: string }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<RolodexContact[]>([]);
  const [searched, setSearched] = useState(false);

  const search = () => {
    if (!query.trim()) return;
    const q = query.toLowerCase();
    const found = ROLODEX_CONTACTS.filter(
      (c) => c.name.toLowerCase().includes(q) || c.role.toLowerCase().includes(q) || c.org.toLowerCase().includes(q)
    );
    setResults(found);
    setSearched(true);
  };

  return (
    <div className="flex h-full flex-col p-5 lg:p-6">
      <div className="mb-4">
        <h2 className="text-lg font-bold tracking-wide text-white">Buzz Someone</h2>
        <p className="mt-0.5 text-[11px] text-white/40">Invite someone from another Portal into a conversation.</p>
      </div>

      <div className="mb-5">
        <div className="text-[9px] font-mono tracking-[0.25em] text-white/30 uppercase">Who do you want to reach?</div>
      </div>

      <div className="flex gap-2">
        <div className="flex flex-1 items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 backdrop-blur-sm">
          <Search className="h-4 w-4 text-white/30" strokeWidth={1.5} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && search()}
            placeholder="Search the SpotVault Industry Directory..."
            className="flex-1 bg-transparent text-sm text-white placeholder-white/30 outline-none"
          />
        </div>
        <button
          onClick={search}
          className="rounded-lg border px-4 py-2.5 text-[10px] font-semibold tracking-widest uppercase transition-all"
          style={{ borderColor: accent + '40', background: accent + '10', color: accent }}
        >
          Search
        </button>
      </div>

      <div className="mt-2 text-[10px] text-white/25">
        Try: <button onClick={() => { setQuery('Kevin Martin'); }} className="text-white/40 hover:text-white/70">Kevin Martin</button>
      </div>

      {/* Results */}
      {searched && (
        <div className="mt-5 flex-1 space-y-2 overflow-y-auto">
          {results.length === 0 ? (
            <div className="text-center text-sm text-white/30 py-8">No results found.</div>
          ) : (
            results.map((c) => {
              const PortalIcon = PORTAL_ICONS[c.homePortal] || User;
              return (
                <GlassPanel key={c.id} className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-[11px] font-semibold text-white/70">
                      {c.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-white">{c.name}</div>
                      <div className="text-[10px] text-white/40">{c.role}</div>
                      <div className="mt-0.5 flex items-center gap-1.5">
                        <PortalIcon className="h-2.5 w-2.5 text-white/30" strokeWidth={1.5} />
                        <span className="text-[9px] font-mono tracking-widest text-white/30 uppercase">{c.homePortal}</span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-1.5 border-t border-white/5 pt-2.5">
                    <ActionPill icon={MessageSquare} label={c.connected ? 'Message' : 'Connect'} accent={accent} disabled={!c.connected && c.accessType !== 'connect'} />
                    <ActionPill icon={DoorOpen} label="Invite to Room" accent={accent} disabled={!c.connected} />
                    <ActionPill icon={Calendar} label={c.accessLabel} accent={accent} />
                  </div>
                </GlassPanel>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

// ===== NOTEPAD =====

function Notepad({ accent }: { accent: string }) {
  const [notes, setNotes] = useState<DeskNote[]>(DESK_NOTES_SEED);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ title: '', body: '' });

  const addNote = () => {
    if (!draft.title.trim()) return;
    setNotes((prev) => [{ id: `n-${Date.now()}`, title: draft.title, body: draft.body, date: 'Today' }, ...prev]);
    setDraft({ title: '', body: '' });
    setEditing(false);
  };

  const deleteNote = (id: string) => {
    setNotes((prev) => prev.filter((n) => n.id !== id));
  };

  return (
    <div className="flex h-full flex-col p-5 lg:p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold tracking-wide text-white">Notepad</h2>
          <div className="mt-0.5 flex items-center gap-2">
            <Lock className="h-3 w-3 text-emerald-400/60" strokeWidth={1.5} />
            <p className="text-[11px] text-white/40">Private to you. No one else can see your notes.</p>
          </div>
        </div>
        <button
          onClick={() => setEditing(!editing)}
          className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[10px] font-semibold tracking-widest uppercase transition-all"
          style={{ borderColor: accent + '40', background: accent + '10', color: accent }}
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={1.5} />
          New Note
        </button>
      </div>

      {editing && (
        <GlassPanel className="mb-4 p-4">
          <input
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            placeholder="Note title..."
            className="w-full bg-transparent text-sm font-semibold text-white placeholder-white/30 outline-none"
          />
          <textarea
            value={draft.body}
            onChange={(e) => setDraft({ ...draft, body: e.target.value })}
            placeholder="Write your note..."
            className="mt-2 w-full resize-none bg-transparent text-sm text-white/80 placeholder-white/30 outline-none"
            rows={4}
          />
          <div className="mt-2 flex justify-end gap-2 border-t border-white/5 pt-2">
            <button onClick={() => { setEditing(false); setDraft({ title: '', body: '' }); }} className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] font-semibold tracking-widest text-white/50 uppercase hover:text-white">
              Cancel
            </button>
            <button onClick={addNote} className="rounded-lg border px-3 py-1.5 text-[10px] font-semibold tracking-widest uppercase" style={{ borderColor: accent + '40', background: accent + '10', color: accent }}>
              Save
            </button>
          </div>
        </GlassPanel>
      )}

      <div className="flex-1 space-y-2 overflow-y-auto">
        {notes.map((n) => (
          <GlassPanel key={n.id} className="p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <StickyNote className="h-3.5 w-3.5" strokeWidth={1.5} style={{ color: accent + '80' }} />
                  <span className="text-sm font-semibold text-white">{n.title}</span>
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-white/60">{n.body}</p>
                <div className="mt-2 text-[10px] font-mono text-white/25">{n.date}</div>
              </div>
              <button onClick={() => deleteNote(n.id)} className="ml-2 text-white/20 transition-colors hover:text-red-400">
                <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
              </button>
            </div>
          </GlassPanel>
        ))}
      </div>
    </div>
  );
}

// ===== CALENDAR =====

function DeskCalendar({ accent }: { accent: string }) {
  const [tab, setTab] = useState<'today' | 'this-week' | 'requested'>('today');

  const filtered = DESK_MEETINGS.filter((m) => m.when === tab);

  return (
    <div className="flex h-full flex-col p-5 lg:p-6">
      <div className="mb-4">
        <h2 className="text-lg font-bold tracking-wide text-white">Calendar</h2>
        <p className="mt-0.5 text-[11px] text-white/40">Upcoming meetings and requests.</p>
      </div>

      <div className="mb-4 flex gap-1.5">
        {(['today', 'this-week', 'requested'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-lg px-4 py-2 text-[10px] font-semibold tracking-widest uppercase transition-all ${
              tab === t ? 'border text-white' : 'border border-transparent text-white/40 hover:text-white/70'
            }`}
            style={tab === t ? { borderColor: accent + '40', background: accent + '10' } : { border: '1px solid rgba(255,255,255,0.05)' }}
          >
            {t === 'this-week' ? 'This Week' : t === 'today' ? 'Today' : 'Requested'}
          </button>
        ))}
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto">
        {filtered.map((m) => (
          <GlassPanel key={m.id} className="p-4">
            <div className="flex items-center gap-4">
              <div className="flex flex-col items-center justify-center rounded-lg border px-4 py-2" style={{ borderColor: accent + '30', background: accent + '8' }}>
                <CalendarDays className="h-4 w-4" strokeWidth={1.5} style={{ color: accent }} />
                <span className="mt-1 text-[10px] font-mono tracking-widest" style={{ color: accent }}>{m.time}</span>
              </div>
              <div className="flex-1">
                <div className="text-sm font-semibold text-white">{m.person}</div>
                <div className="text-[11px] text-white/40">{m.topic}</div>
              </div>
              <button className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] font-semibold tracking-widest text-white/50 uppercase transition-all hover:border-white/20 hover:text-white">
                Join
              </button>
            </div>
          </GlassPanel>
        ))}
        {filtered.length === 0 && (
          <div className="py-8 text-center text-sm text-white/30">No meetings scheduled.</div>
        )}
      </div>
    </div>
  );
}

// ===== BUSINESS WIRE =====

function BusinessWire({ accent }: { accent: string }) {
  const [posts, setPosts] = useState<WirePost[]>(BUSINESS_WIRE_SEED);
  const [composer, setComposer] = useState('');
  const [shareTarget, setShareTarget] = useState<WirePost | null>(null);

  const toggleLike = (id: string) => {
    setPosts((prev) => prev.map((p) => (p.id === id ? { ...p, liked: !p.liked, likes: p.liked ? p.likes - 1 : p.likes + 1 } : p)));
  };

  const toggleSave = (id: string) => {
    setPosts((prev) => prev.map((p) => (p.id === id ? { ...p, saved: !p.saved, saves: p.saved ? p.saves - 1 : p.saves + 1 } : p)));
  };

  const publishToCommunity = (id: string) => {
    setPosts((prev) => prev.map((p) => (p.id === id ? { ...p, publishedToCommunity: true } : p)));
    setShareTarget(null);
  };

  const submitPost = () => {
    if (!composer.trim()) return;
    const newPost: WirePost = {
      id: `bw-${Date.now()}`,
      author: 'SpotVault Business',
      handle: '@spotvaultbiz',
      portal: 'BUSINESS',
      body: composer.trim(),
      timestamp: 'just now',
      likes: 0,
      comments: 0,
      saves: 0,
    };
    setPosts((prev) => [newPost, ...prev]);
    setComposer('');
  };

  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto p-5 lg:p-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold tracking-wide text-white">Business Wire</h2>
            <PrivacyBadge label="Business-Only Space" sublabel="Visible only to approved Business Portal users" />
          </div>
          <p className="mt-1 text-[11px] text-white/40">Industry operators only. Posts here are not visible in Community Hub or public profiles.</p>
        </div>
      </div>

      <GlassPanel className="p-4">
        <textarea
          value={composer}
          onChange={(e) => setComposer(e.target.value)}
          placeholder="Post to the Business Wire..."
          className="w-full resize-none bg-transparent text-sm text-white placeholder-white/30 outline-none"
          rows={2}
        />
        <div className="mt-2 flex items-center justify-between border-t border-white/5 pt-2">
          <div className="flex items-center gap-1.5">
            <Lock className="h-3 w-3 text-emerald-400/60" strokeWidth={1.5} />
            <span className="text-[10px] font-mono tracking-widest text-emerald-400/50 uppercase">Business Wire — Private</span>
          </div>
          <button
            onClick={submitPost}
            disabled={!composer.trim()}
            className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] font-semibold tracking-widest text-white/70 uppercase transition-all hover:border-white/20 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Send className="h-3 w-3" strokeWidth={1.5} />
            Post
          </button>
        </div>
      </GlassPanel>

      <div className="flex flex-col gap-2.5">
        {posts.map((post) => (
          <GlassPanel key={post.id} className="p-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-[10px] font-semibold text-white/70">
                {post.author.split(' ').map((n) => n[0]).join('').slice(0, 2)}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-white">{post.author}</span>
                  <span className="text-[10px] text-white/30">{post.handle}</span>
                </div>
                <span className="text-[9px] font-mono tracking-widest uppercase" style={{ color: accent + '80' }}>
                  {post.portal} Portal · {post.timestamp}
                </span>
              </div>
              {post.publishedToCommunity && (
                <span className="flex items-center gap-1 rounded-full border border-emerald-400/20 bg-emerald-400/5 px-2 py-0.5 text-[8px] font-bold tracking-widest text-emerald-300 uppercase">
                  <Globe className="h-2.5 w-2.5" strokeWidth={2} />
                  Published
                </span>
              )}
            </div>
            <p className="mt-2.5 text-sm leading-relaxed text-white/80">{post.body}</p>
            <div className="mt-3 flex items-center gap-1 border-t border-white/5 pt-2.5">
              <button onClick={() => toggleLike(post.id)} className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-[10px] font-medium transition-colors hover:bg-white/5" style={{ color: post.liked ? accent : 'rgba(255,255,255,0.4)' }}>
                <Heart className="h-3.5 w-3.5" strokeWidth={1.5} fill={post.liked ? accent : 'none'} />
                {post.likes}
              </button>
              <button className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-[10px] font-medium text-white/40 transition-colors hover:bg-white/5 hover:text-white/70">
                <MessageSquare className="h-3.5 w-3.5" strokeWidth={1.5} />
                {post.comments}
              </button>
              <button onClick={() => toggleSave(post.id)} className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-[10px] font-medium transition-colors hover:bg-white/5" style={{ color: post.saved ? accent : 'rgba(255,255,255,0.4)' }}>
                <Bookmark className="h-3.5 w-3.5" strokeWidth={1.5} fill={post.saved ? accent : 'none'} />
                {post.saves}
              </button>
              <div className="ml-auto">
                <button
                  onClick={() => setShareTarget(post)}
                  disabled={post.publishedToCommunity}
                  className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-semibold tracking-wide text-white/60 transition-all hover:border-white/20 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <Share2 className="h-3 w-3" strokeWidth={1.5} />
                  {post.publishedToCommunity ? 'Shared' : 'Share to Community'}
                </button>
              </div>
            </div>
          </GlassPanel>
        ))}
      </div>

      {shareTarget && (
        <ShareConfirmModal post={shareTarget} accent={accent} onCancel={() => setShareTarget(null)} onConfirm={() => publishToCommunity(shareTarget.id)} />
      )}
    </div>
  );
}

function ShareConfirmModal({ post, accent, onCancel, onConfirm }: { post: WirePost; accent: string; onCancel: () => void; onConfirm: () => void }) {
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md mx-4 rounded-xl border border-white/10 bg-[#0a0c0e] p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4" style={{ color: accent }} strokeWidth={1.5} />
            <h3 className="text-sm font-bold tracking-wide text-white">Share to Community Hub</h3>
          </div>
          <button onClick={onCancel} className="text-white/30 transition-colors hover:text-white">
            <X className="h-4 w-4" strokeWidth={1.5} />
          </button>
        </div>
        <p className="mt-4 text-xs leading-relaxed text-white/60">This post will become visible to the wider SpotVault network. It will appear in the Community Hub and become accessible to all members.</p>
        <div className="mt-4 rounded-lg border border-white/5 bg-white/5 p-3">
          <div className="text-[10px] font-mono tracking-widest text-white/30 uppercase">{post.author}</div>
          <p className="mt-1 text-xs text-white/70">{post.body}</p>
        </div>
        <div className="mt-5 flex gap-2">
          <button onClick={onCancel} className="flex-1 rounded-lg border border-white/10 bg-white/5 py-2.5 text-[10px] font-semibold tracking-widest text-white/60 uppercase transition-all hover:border-white/20 hover:text-white">
            Cancel
          </button>
          <button onClick={onConfirm} className="flex-1 rounded-lg border py-2.5 text-[10px] font-semibold tracking-widest uppercase transition-all" style={{ borderColor: accent + '60', background: accent + '15', color: accent }}>
            Publish Publicly
          </button>
        </div>
      </div>
    </div>
  );
}
