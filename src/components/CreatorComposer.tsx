import { useState } from 'react';
import {
  Camera, X, Image as ImageIcon, Video, Link2, Tag, AtSign, BarChart3,
  Eye, Send, FileText, Sparkles, Plus, Trash2, Check, Loader2,
} from 'lucide-react';

interface ComposerProps {
  onClose: () => void;
  onPublish: (post: CreatorPost) => void;
}

export interface CreatorPost {
  id: string;
  text: string;
  headline: string;
  images: string[];
  videoUrl: string;
  linkUrl: string;
  tags: string[];
  mentions: string[];
  poll?: { question: string; options: string[] };
  createdAt: string;
}

export function CreatorComposer({ onClose, onPublish }: ComposerProps) {
  const [step, setStep] = useState<'compose' | 'preview'>('compose');
  const [text, setText] = useState('');
  const [headline, setHeadline] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [videoUrl, setVideoUrl] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [mentions, setMentions] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [mentionInput, setMentionInput] = useState('');
  const [showPoll, setShowPoll] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState<string[]>(['', '']);

  const addTag = () => {
    const t = tagInput.trim().replace(/^#/, '');
    if (t && !tags.includes(t)) { setTags([...tags, t]); setTagInput(''); }
  };
  const addMention = () => {
    const m = mentionInput.trim().replace(/^@/, '');
    if (m && !mentions.includes(m)) { setMentions([...mentions, m]); setMentionInput(''); }
  };

  const buildPost = (): CreatorPost => ({
    id: `post-${Date.now()}`,
    text, headline, images, videoUrl, linkUrl, tags, mentions,
    poll: showPoll && pollQuestion.trim() ? { question: pollQuestion, options: pollOptions.filter((o) => o.trim()) } : undefined,
    createdAt: new Date().toISOString(),
  });

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-xl border border-white/10 bg-[#0a0c0e] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/5 px-5 py-3">
          <div className="flex items-center gap-2">
            <Camera className="h-4 w-4 text-[#d4a52c]" strokeWidth={1.5} />
            <h3 className="text-sm font-bold tracking-wide text-white">
              {step === 'compose' ? 'Create Post' : 'Preview'}
            </h3>
          </div>
          <div className="flex items-center gap-2">
            {step === 'preview' && (
              <button onClick={() => setStep('compose')} className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] font-semibold tracking-widest text-white/60 uppercase hover:text-white">Edit</button>
            )}
            <button onClick={onClose} className="text-white/30 hover:text-white"><X className="h-4 w-4" strokeWidth={1.5} /></button>
          </div>
        </div>

        {step === 'compose' ? (
          <div className="flex-1 overflow-y-auto p-5">
            {/* Headline */}
            <input
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              placeholder="Headline (optional)..."
              className="w-full bg-transparent text-lg font-bold text-white placeholder-white/30 outline-none"
            />

            {/* Body text */}
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="What's on your mind?"
              className="mt-3 w-full resize-none bg-transparent text-sm leading-relaxed text-white/80 placeholder-white/30 outline-none"
              rows={5}
            />

            {/* Media placeholders */}
            <div className="mt-3 flex flex-wrap gap-2">
              <button onClick={() => setImages([...images, `placeholder-${Date.now()}`])} className="flex h-16 w-16 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/30 transition-all hover:border-[#d4a52c]/30 hover:text-[#d4a52c]">
                <ImageIcon className="h-4 w-4" strokeWidth={1.5} />
              </button>
              {images.map((img, i) => (
                <div key={i} className="relative h-16 w-16 rounded-lg border border-white/10 bg-gradient-to-br from-[#1a1d20] to-[#0a0c0e]">
                  <button onClick={() => setImages(images.filter((_, idx) => idx !== i))} className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full border border-white/20 bg-[#0a0c0e]">
                    <X className="h-2.5 w-2.5 text-white/50" strokeWidth={2} />
                  </button>
                </div>
              ))}
            </div>

            {/* Link */}
            <div className="mt-3 flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2">
              <Link2 className="h-3.5 w-3.5 text-white/30" strokeWidth={1.5} />
              <input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="Add a link..." className="flex-1 bg-transparent text-xs text-white placeholder-white/30 outline-none" />
            </div>

            {/* Tags & Mentions */}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {tags.map((t) => (
                <span key={t} className="flex items-center gap-1 rounded-full border border-[#d4a52c]/20 bg-[#d4a52c]/10 px-2.5 py-1 text-[10px] text-[#d4a52c]">
                  #{t}
                  <button onClick={() => setTags(tags.filter((x) => x !== t))}><X className="h-2.5 w-2.5" strokeWidth={2} /></button>
                </span>
              ))}
              <div className="flex items-center gap-1">
                <Tag className="h-3 w-3 text-white/20" strokeWidth={1.5} />
                <input value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())} placeholder="Add tag..." className="w-20 bg-transparent text-[11px] text-white placeholder-white/30 outline-none" />
              </div>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {mentions.map((m) => (
                <span key={m} className="flex items-center gap-1 rounded-full border border-blue-400/20 bg-blue-400/10 px-2.5 py-1 text-[10px] text-blue-300">
                  @{m}
                  <button onClick={() => setMentions(mentions.filter((x) => x !== m))}><X className="h-2.5 w-2.5" strokeWidth={2} /></button>
                </span>
              ))}
              <div className="flex items-center gap-1">
                <AtSign className="h-3 w-3 text-white/20" strokeWidth={1.5} />
                <input value={mentionInput} onChange={(e) => setMentionInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addMention())} placeholder="Mention..." className="w-20 bg-transparent text-[11px] text-white placeholder-white/30 outline-none" />
              </div>
            </div>

            {/* Poll */}
            <div className="mt-3">
              <button onClick={() => setShowPoll(!showPoll)} className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] font-semibold tracking-widest text-white/50 uppercase hover:text-white">
                <BarChart3 className="h-3 w-3" strokeWidth={1.5} /> {showPoll ? 'Remove Poll' : 'Add Poll'}
              </button>
              {showPoll && (
                <div className="mt-2 space-y-2 rounded-lg border border-white/10 bg-white/5 p-3">
                  <input value={pollQuestion} onChange={(e) => setPollQuestion(e.target.value)} placeholder="Poll question..." className="w-full bg-transparent text-xs text-white placeholder-white/30 outline-none" />
                  {pollOptions.map((opt, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input value={opt} onChange={(e) => setPollOptions(pollOptions.map((o, idx) => idx === i ? e.target.value : o))} placeholder={`Option ${i + 1}`} className="flex-1 bg-transparent text-[11px] text-white placeholder-white/30 outline-none" />
                      {pollOptions.length > 2 && <button onClick={() => setPollOptions(pollOptions.filter((_, idx) => idx !== i))}><Trash2 className="h-3 w-3 text-white/30" strokeWidth={1.5} /></button>}
                    </div>
                  ))}
                  {pollOptions.length < 4 && <button onClick={() => setPollOptions([...pollOptions, ''])} className="flex items-center gap-1 text-[10px] text-white/40 hover:text-white"><Plus className="h-3 w-3" strokeWidth={1.5} /> Add option</button>}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-5">
            {/* Social-style preview */}
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-[10px] font-semibold text-white/60">SV</div>
                <div>
                  <div className="text-xs font-semibold text-white">Creator Account</div>
                  <div className="text-[9px] text-white/30">Just now</div>
                </div>
              </div>
              {headline && <h3 className="mt-3 text-base font-bold text-white">{headline}</h3>}
              {text && <p className="mt-2 text-sm leading-relaxed text-white/80">{text}</p>}
              {images.length > 0 && (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {images.map((_, i) => <div key={i} className="aspect-video rounded-lg border border-white/5 bg-gradient-to-br from-[#1a1d20] to-[#0a0c0e]" />)}
                </div>
              )}
              {linkUrl && (
                <div className="mt-3 rounded-lg border border-white/10 bg-white/5 p-3">
                  <div className="text-[10px] font-mono text-white/30">{linkUrl}</div>
                </div>
              )}
              {showPoll && pollQuestion && (
                <div className="mt-3 space-y-2">
                  <div className="text-xs font-semibold text-white">{pollQuestion}</div>
                  {pollOptions.filter((o) => o.trim()).map((opt, i) => (
                    <div key={i} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[11px] text-white/60">{opt}</div>
                  ))}
                </div>
              )}
              <div className="mt-3 flex flex-wrap gap-1.5">
                {tags.map((t) => <span key={t} className="text-[10px] text-[#d4a52c]">#{t}</span>)}
                {mentions.map((m) => <span key={m} className="text-[10px] text-blue-300">@{m}</span>)}
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-white/5 px-5 py-3">
          <div className="text-[9px] font-mono tracking-widest text-white/20 uppercase">Creator Publishing</div>
          <div className="flex gap-2">
            {step === 'compose' ? (
              <button
                onClick={() => setStep('preview')}
                disabled={!text.trim() && !headline.trim()}
                className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-[10px] font-semibold tracking-widest text-white/60 uppercase transition-all hover:text-white disabled:opacity-30"
              >
                <Eye className="h-3 w-3" strokeWidth={1.5} /> Preview
              </button>
            ) : (
              <button
                onClick={() => { onPublish(buildPost()); onClose(); }}
                className="flex items-center gap-1.5 rounded-lg border border-[#c0911e]/40 bg-[#c0911e]/15 px-4 py-2 text-[10px] font-semibold tracking-widest text-[#f5e6b0] uppercase transition-all hover:border-[#c0911e]/60"
              >
                <Send className="h-3 w-3" strokeWidth={1.5} /> Publish
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
