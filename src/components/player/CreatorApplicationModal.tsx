import { useState, useEffect } from 'react';
import { X, Upload, Check, AlertCircle, Loader2, Video, BookOpen } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { submitApplication, getMyApplications, type ApplicationType, type CreatorApplication } from '@/lib/creatorStore';

interface Props {
  open: boolean;
  onClose: () => void;
  userId: string;
  initialType?: ApplicationType;
}

export function CreatorApplicationModal({ open, onClose, userId, initialType = 'both' }: Props) {
  const [applicationType, setApplicationType] = useState<ApplicationType>(initialType);
  const [realName, setRealName] = useState('');
  const [screenNames, setScreenNames] = useState('');
  const [pokerSites, setPokerSites] = useState('');
  const [gameType, setGameType] = useState('');
  const [stakesAbi, setStakesAbi] = useState('');
  const [primaryFormats, setPrimaryFormats] = useState('');
  const [yearsPlaying, setYearsPlaying] = useState('');
  const [documentedResults, setDocumentedResults] = useState('');
  const [profileLinks, setProfileLinks] = useState('');
  const [otherResults, setOtherResults] = useState('');
  const [coachingExperience, setCoachingExperience] = useState('');
  const [socialLinks, setSocialLinks] = useState('');
  const [intendedContent, setIntendedContent] = useState('');
  const [attachments, setAttachments] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [existingApps, setExistingApps] = useState<CreatorApplication[]>([]);

  useEffect(() => {
    if (open) {
      setApplicationType(initialType);
      void loadExisting();
    }
  }, [open, initialType]);

  const loadExisting = async () => {
    const apps = await getMyApplications(userId);
    setExistingApps(apps);
  };

  const handleUpload = async (file: File) => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    setUploading(true);
    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'png';
    const path = `${userData.user.id}/creator-applications/${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from('user-uploads').upload(path, file);
    if (upErr) { setUploading(false); return; }
    const { data: urlData } = supabase.storage.from('user-uploads').getPublicUrl(path);
    setAttachments((prev) => [...prev, urlData.publicUrl]);
    setUploading(false);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    const id = await submitApplication(userId, {
      application_type: applicationType,
      real_name: realName,
      poker_screen_names: screenNames,
      main_poker_sites: pokerSites,
      game_type: gameType,
      stakes_abi: stakesAbi,
      primary_formats: primaryFormats,
      years_playing: yearsPlaying,
      documented_results: documentedResults,
      public_profile_links: profileLinks,
      other_results: otherResults,
      coaching_experience: coachingExperience,
      social_content_links: socialLinks,
      intended_content: intendedContent,
      attachment_urls: attachments,
    });
    setSubmitting(false);
    if (id) {
      setSuccess(true);
      void loadExisting();
    } else {
      setError('Failed to submit application. Please try again.');
    }
  };

  if (!open) return null;

  const hasPending = existingApps.some((a) => a.status === 'pending');

  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-[#d4a52c]/25 bg-[#0b0d0f] shadow-2xl">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-white/[0.06] px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-white">Creator Application</h2>
            <p className="mt-0.5 text-[10px] text-white/40">Apply for permission to publish premium content</p>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white"><X className="h-4 w-4" /></button>
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {success ? (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[#d4a52c]/40 bg-[#c091e]/15">
                <Check className="h-6 w-6 text-[#d4a52c]" />
              </div>
              <p className="text-sm font-semibold text-white">Application Submitted!</p>
              <p className="text-[11px] text-white/50">Staff will review your application. You'll be notified when a decision is made.</p>
              <button onClick={() => { setSuccess(false); onClose(); }} className="mt-2 rounded-lg border border-white/10 px-4 py-2 text-[10px] font-bold uppercase text-white/50 hover:text-white/70">Done</button>
            </div>
          ) : hasPending ? (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <AlertCircle className="h-8 w-8 text-amber-300" />
              <p className="text-sm font-semibold text-white">You have a pending application</p>
              <p className="text-[11px] text-white/50">Staff is reviewing your application. You'll be able to submit a new one once a decision is made.</p>
              <button onClick={onClose} className="mt-2 rounded-lg border border-white/10 px-4 py-2 text-[10px] font-bold uppercase text-white/50 hover:text-white/70">Close</button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Application type */}
              <div>
                <label className="text-[10px] font-semibold tracking-wide text-white/50 uppercase">Requesting Access To</label>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {([
                    ['video_spot', 'Video Spots', Video],
                    ['multispot', 'Multi-Spot Analysis', BookOpen],
                    ['both', 'Both', Check],
                  ] as [ApplicationType, string, typeof Video][]).map(([val, label, Icon]) => (
                    <button
                      key={val}
                      onClick={() => setApplicationType(val)}
                      className={`flex flex-col items-center gap-1.5 rounded-lg border px-3 py-3 transition ${
                        applicationType === val
                          ? 'border-[#d4a52c]/40 bg-[#c091e]/15 text-[#f5e6b0]'
                          : 'border-white/[0.06] bg-white/[0.02] text-white/40 hover:bg-white/[0.04]'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      <span className="text-[10px] font-semibold">{label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Real Name" value={realName} onChange={setRealName} placeholder="John Smith" />
                <Field label="Poker Screen Names" value={screenNames} onChange={setScreenNames} placeholder="PS: johnsmith, GG: jsmith" />
                <Field label="Main Poker Sites" value={pokerSites} onChange={setPokerSites} placeholder="PokerStars, GGPoker" />
                <Field label="Game Type" value={gameType} onChange={setGameType} placeholder="MTT, Cash, PKO" />
                <Field label="Stakes / ABI" value={stakesAbi} onChange={setStakesAbi} placeholder="$55 ABI" />
                <Field label="Primary Formats" value={primaryFormats} onChange={setPrimaryFormats} placeholder="Online MTTs, Live Events" />
                <Field label="Years Playing" value={yearsPlaying} onChange={setYearsPlaying} placeholder="8 years" />
                <Field label="Coaching/Creator Experience" value={coachingExperience} onChange={setCoachingExperience} placeholder="3 years coaching, 50+ students" />
              </div>

              <Field label="Documented Results" value={documentedResults} onChange={setDocumentedResults} placeholder="$250K in MTT cashes, 2 WSOP cashes..." textarea />
              <Field label="Public Profile Links" value={profileLinks} onChange={setProfileLinks} placeholder="Hendon Mob, SharkScope, etc." />
              <Field label="Other Results / Statistics" value={otherResults} onChange={setOtherResults} placeholder="ROI, ITM%, final tables..." />
              <Field label="Social / Content Links" value={socialLinks} onChange={setSocialLinks} placeholder="YouTube, Twitter, Twitch..." />
              <Field label="What do you intend to create?" value={intendedContent} onChange={setIntendedContent} placeholder="I plan to create multi-hand analysis packs from my deep runs..." textarea />

              {/* Attachments */}
              <div>
                <label className="text-[10px] font-semibold tracking-wide text-white/50 uppercase">Supporting Documents</label>
                <label className="mt-2 flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed py-4 transition hover:border-[#d4a52c]/40 hover:bg-white/[0.02]" style={{ borderColor: 'rgba(212,165,44,0.2)' }}>
                  {uploading ? (
                    <Loader2 className="h-4 w-4 animate-spin text-white/40" />
                  ) : (
                    <>
                      <Upload className="h-4 w-4 text-white/30" />
                      <span className="text-[8px] font-semibold uppercase text-white/35">Upload screenshots, results, documentation</span>
                    </>
                  )}
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      const files = Array.from(e.target.files ?? []);
                      for (const f of files) void handleUpload(f);
                      e.target.value = '';
                    }}
                  />
                </label>
                {attachments.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {attachments.map((url, i) => (
                      <div key={i} className="flex items-center gap-2 rounded-md border border-white/[0.06] bg-white/[0.02] px-2.5 py-1.5 text-[10px] text-white/50">
                        <Check className="h-3 w-3 text-emerald-400" />
                        <span className="truncate">Attachment {i + 1}</span>
                        <button onClick={() => setAttachments((prev) => prev.filter((_, idx) => idx !== i))} className="ml-auto text-white/30 hover:text-red-300">
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {error && (
                <div className="flex items-center gap-2 rounded-lg border border-red-300/20 bg-red-300/5 p-3 text-[11px] text-red-300">
                  <AlertCircle className="h-4 w-4 shrink-0" /> {error}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {!success && !hasPending && (
          <div className="flex shrink-0 justify-end gap-2 border-t border-white/[0.06] px-5 py-4">
            <button onClick={onClose} className="rounded-lg border border-white/10 px-4 py-2 text-[10px] font-bold uppercase text-white/50 hover:text-white/70">Cancel</button>
            <button
              onClick={() => void handleSubmit()}
              disabled={submitting}
              className="flex items-center gap-2 rounded-lg border border-[#d4a52c]/50 bg-[#c091e]/20 px-5 py-2 text-[10px] font-bold uppercase text-[#f5e6b0] hover:bg-[#c091e]/30 disabled:opacity-50"
            >
              {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              {submitting ? 'Submitting...' : 'Submit Application'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, textarea }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  textarea?: boolean;
}) {
  return (
    <div>
      <label className="text-[10px] font-semibold tracking-wide text-white/50 uppercase">{label}</label>
      {textarea ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="mt-1.5 h-20 w-full resize-none rounded-lg border border-white/10 bg-black/40 p-3 text-[11px] text-white/80 placeholder-white/25 focus:border-[#d4a52c]/40 focus:outline-none"
        />
      ) : (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="mt-1.5 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-[11px] text-white/80 placeholder-white/25 focus:border-[#d4a52c]/40 focus:outline-none"
        />
      )}
    </div>
  );
}
