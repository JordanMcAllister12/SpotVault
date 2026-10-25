import { useState, useCallback, useRef, useEffect } from 'react';
import { Sparkles, Loader2, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { ENTITLEMENTS, FEATURE_FLAGS, formatUsage, PERMISSIONS, type MembershipTier } from '@/lib/entitlements';

const GOLD = '#d4a52c';
const GOLD_SOFT = '#f5e6b0';

const AI_ACTIONS = [
  { id: 'improve', label: 'Improve Writing' },
  { id: 'shorten', label: 'Shorten' },
  { id: 'expand', label: 'Expand' },
  { id: 'grammar', label: 'Fix Grammar' },
  { id: 'simplify', label: 'Simplify' },
  { id: 'professional', label: 'Professional' },
  { id: 'casual', label: 'Casual' },
] as const;

type AIAction = (typeof AI_ACTIONS)[number]['id'] | 'custom';

interface Props {
  onTransform: (selectedText: string, action: AIAction, customInstruction?: string) => Promise<string | null>;
  targetRef: React.RefObject<HTMLTextAreaElement | HTMLInputElement>;
  value: string;
  onChange: (value: string) => void;
  tier?: MembershipTier;
  weekUsed?: number;
}

export function AIAssistInline({ onTransform, targetRef, value, onChange, tier = 'free', weekUsed = 0 }: Props) {
  const entitlements = ENTITLEMENTS[tier];
  // AI Assist is Coming Soon — disable for all tiers until the flag is enabled
  const canUseAI = FEATURE_FLAGS.aiAssistEnabled && PERMISSIONS[tier].canUseAiAssist;
  const [menuOpen, setMenuOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customPrompt, setCustomPrompt] = useState('');
  const [showCustom, setShowCustom] = useState(false);
  const savedSelectionRef = useRef<{ start: number; end: number; selectedText: string } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const captureSelection = useCallback((): { start: number; end: number; selectedText: string } | null => {
    const el = targetRef.current;
    if (!el) return null;
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;
    const selectedText = value.substring(start, end).trim();
    if (!selectedText || start === end) return null;
    return { start, end, selectedText };
  }, [targetRef, value]);

  const handleButtonClick = useCallback(() => {
    if (!canUseAI) {
      setError('AI Assist is coming soon.');
      setTimeout(() => setError(null), 4000);
      return;
    }
    const sel = captureSelection();
    if (!sel) {
      setError('Highlight text first to use AI Assist.');
      setTimeout(() => setError(null), 3000);
      return;
    }
    savedSelectionRef.current = sel;
    setMenuOpen(true);
  }, [captureSelection, canUseAI]);

  const handleAction = useCallback(async (action: AIAction) => {
    const sel = savedSelectionRef.current;
    if (!sel) return;
    setLoading(true);
    setError(null);
    const instruction = action === 'custom' ? customPrompt.trim() : undefined;
    if (action === 'custom' && !instruction) {
      setError('Enter a custom instruction.');
      setLoading(false);
      return;
    }
    const result = await onTransform(sel.selectedText, action, instruction);
    setLoading(false);
    if (result === null) {
      setError('AI couldn\'t process that. Try again.');
      setTimeout(() => setError(null), 3000);
      return;
    }
    const newValue = value.substring(0, sel.start) + result + value.substring(sel.end);
    onChange(newValue);
    savedSelectionRef.current = null;
    setMenuOpen(false);
    setShowCustom(false);
    setCustomPrompt('');
    requestAnimationFrame(() => {
      const el = targetRef.current;
      if (el) {
        el.focus();
        const newCursor = sel.start + result.length;
        el.setSelectionRange(newCursor, newCursor);
      }
    });
  }, [savedSelectionRef, value, onChange, targetRef, customPrompt, onTransform]);

  useEffect(() => {
    if (!menuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (buttonRef.current && !buttonRef.current.contains(e.target as Node)) {
        const menu = document.getElementById('ai-assist-menu');
        if (menu && !menu.contains(e.target as Node)) {
          setMenuOpen(false);
          setShowCustom(false);
          setError(null);
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  return (
    <div className="relative inline-flex">
      <button
        ref={buttonRef}
        onClick={handleButtonClick}
        title="AI Assist — highlight text first"
        className="flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[8px] font-bold tracking-widest uppercase transition-all hover:opacity-80"
        style={{ borderColor: 'rgba(212,165,44,0.25)', background: 'rgba(212,165,44,0.06)', color: GOLD_SOFT }}
      >
        <Sparkles className="h-2.5 w-2.5" strokeWidth={1.5} />
        AI
      </button>

      {error && !menuOpen && (
        <div className="absolute top-full right-0 z-[60] mt-1 rounded-md border border-amber-400/20 bg-[#0d1115] px-2.5 py-1.5 text-[9px] text-amber-300/80 shadow-xl whitespace-nowrap">
          {error}
        </div>
      )}

      {menuOpen && (
        <div
          id="ai-assist-menu"
          className="absolute top-full right-0 z-[60] mt-1 w-52 rounded-lg border border-[#c0911e]/20 bg-[#0d1115] p-1.5 shadow-2xl"
        >
          <div className="mb-1.5 flex items-center justify-between px-1">
            <span className="text-[8px] font-bold tracking-widest uppercase" style={{ color: GOLD_SOFT }}>AI Assist</span>
            <button onClick={() => { setMenuOpen(false); setShowCustom(false); }} className="text-white/30 hover:text-white/60">
              <X className="h-3 w-3" strokeWidth={1.5} />
            </button>
          </div>
          <div className="mb-1.5 rounded-md border border-white/[0.06] bg-black/40 px-2 py-1">
            <p className="text-[8px] text-white/30">Selected:</p>
            <p className="truncate text-[9px] italic text-white/50">"{savedSelectionRef.current?.selectedText}"</p>
          </div>
          {loading ? (
            <div className="flex items-center justify-center py-3">
              <Loader2 className="h-4 w-4 animate-spin" style={{ color: GOLD }} strokeWidth={1.5} />
            </div>
          ) : showCustom ? (
            <div className="space-y-1.5">
              <input
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder="e.g. Make it more aggressive..."
                autoFocus
                className="w-full rounded-md border border-white/10 bg-black/40 px-2 py-1.5 text-[10px] text-white/80 outline-none placeholder:text-white/25 focus:border-[#c0911e]/30"
              />
              <div className="flex gap-1">
                <button onClick={() => setShowCustom(false)} className="flex-1 rounded-md border border-white/10 py-1.5 text-[9px] font-bold uppercase text-white/40">Back</button>
                <button onClick={() => handleAction('custom')} disabled={!customPrompt.trim()} className="flex-1 rounded-md border py-1.5 text-[9px] font-bold uppercase transition disabled:opacity-30" style={{ borderColor: 'rgba(212,165,44,0.3)', color: GOLD_SOFT, background: 'rgba(212,165,44,0.1)' }}>Apply</button>
              </div>
            </div>
          ) : (
            <div className="space-y-0.5">
              {AI_ACTIONS.map((a) => (
                <button
                  key={a.id}
                  onClick={() => handleAction(a.id)}
                  className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-[10px] text-white/70 transition-colors hover:bg-white/5 hover:text-white/90"
                >
                  <Sparkles className="h-2.5 w-2.5 shrink-0" style={{ color: GOLD }} strokeWidth={1.5} />
                  {a.label}
                </button>
              ))}
              <div className="my-1 h-px bg-white/[0.04]" />
              <button
                onClick={() => setShowCustom(true)}
                className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-[10px] text-white/70 transition-colors hover:bg-white/5"
              >
                <Sparkles className="h-2.5 w-2.5 shrink-0" style={{ color: GOLD }} strokeWidth={1.5} />
                Custom Instruction…
              </button>
              <div className="mt-1.5 border-t border-white/[0.04] px-1 pt-1.5">
                <p className="text-[8px] text-white/30">
                  {formatUsage(weekUsed, entitlements.aiAssistsWeekly)} this week
                </p>
              </div>
            </div>
          )}
          {error && (
            <p className="mt-1 px-1 text-[8px] text-red-400/70">{error}</p>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * AIAssistRichInline — same menu UX as AIAssistInline, but for a contentEditable
 * element (the RichTextEditor) instead of a textarea/input. Captures the current
 * DOM selection within the editable div, calls onTransform, and replaces the
 * selected range with the AI result.
 */
interface RichProps {
  onTransform: (selectedText: string, action: AIAction, customInstruction?: string) => Promise<string | null>;
  targetRef: React.RefObject<HTMLDivElement>;
  onChange: (html: string) => void;
  tier?: MembershipTier;
  weekUsed?: number;
}

export function AIAssistRichInline({ onTransform, targetRef, onChange, tier = 'free', weekUsed = 0 }: RichProps) {
  const entitlements = ENTITLEMENTS[tier];
  const canUseAI = FEATURE_FLAGS.aiAssistEnabled && PERMISSIONS[tier].canUseAiAssist;
  const [menuOpen, setMenuOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customPrompt, setCustomPrompt] = useState('');
  const [showCustom, setShowCustom] = useState(false);
  const savedRangeRef = useRef<Range | null>(null);
  const savedSelectionRef = useRef<string | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const captureSelection = useCallback((): string | null => {
    const el = targetRef.current;
    if (!el) return null;
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) return null;
    const range = sel.getRangeAt(0);
    if (!el.contains(range.commonAncestorContainer)) return null;
    const text = range.toString().trim();
    if (!text) return null;
    return text;
  }, [targetRef]);

  const handleButtonClick = useCallback(() => {
    if (!canUseAI) {
      setError('AI Assist is coming soon.');
      setTimeout(() => setError(null), 4000);
      return;
    }
    const sel = window.getSelection();
    const text = captureSelection();
    if (!text || !sel || sel.rangeCount === 0) {
      setError('Highlight text first to use AI Assist.');
      setTimeout(() => setError(null), 3000);
      return;
    }
    savedRangeRef.current = sel.getRangeAt(0).cloneRange();
    savedSelectionRef.current = text;
    setMenuOpen(true);
  }, [captureSelection, canUseAI]);

  const handleAction = useCallback(async (action: AIAction) => {
    if (!savedSelectionRef.current || !savedRangeRef.current) return;
    setLoading(true);
    setError(null);
    const instruction = action === 'custom' ? customPrompt.trim() : undefined;
    if (action === 'custom' && !instruction) {
      setError('Enter a custom instruction.');
      setLoading(false);
      return;
    }
    const result = await onTransform(savedSelectionRef.current, action, instruction);
    setLoading(false);
    if (result === null) {
      setError('AI couldn\'t process that. Try again.');
      setTimeout(() => setError(null), 3000);
      return;
    }
    const range = savedRangeRef.current;
    range.deleteContents();
    range.insertNode(document.createTextNode(result));
    if (targetRef.current) {
      onChange(targetRef.current.innerHTML);
    }
    savedRangeRef.current = null;
    savedSelectionRef.current = null;
    setMenuOpen(false);
    setShowCustom(false);
    setCustomPrompt('');
  }, [savedSelectionRef, savedRangeRef, onChange, targetRef, customPrompt, onTransform]);

  useEffect(() => {
    if (!menuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (buttonRef.current && !buttonRef.current.contains(e.target as Node)) {
        const menu = document.getElementById('ai-assist-menu');
        if (menu && !menu.contains(e.target as Node)) {
          setMenuOpen(false);
          setShowCustom(false);
          setError(null);
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  return (
    <div className="relative inline-flex">
      <button
        ref={buttonRef}
        onClick={handleButtonClick}
        title="AI Assist — highlight text first"
        className="flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[8px] font-bold tracking-widest uppercase transition-all hover:opacity-80"
        style={{ borderColor: 'rgba(212,165,44,0.25)', background: 'rgba(212,165,44,0.06)', color: GOLD_SOFT }}
      >
        <Sparkles className="h-2.5 w-2.5" strokeWidth={1.5} />
        AI
      </button>

      {error && !menuOpen && (
        <div className="absolute top-full right-0 z-[60] mt-1 rounded-md border border-amber-400/20 bg-[#0d1115] px-2.5 py-1.5 text-[9px] text-amber-300/80 shadow-xl whitespace-nowrap">
          {error}
        </div>
      )}

      {menuOpen && (
        <div
          id="ai-assist-menu"
          className="absolute top-full right-0 z-[60] mt-1 w-52 rounded-lg border border-[#c0911e]/20 bg-[#0d1115] p-1.5 shadow-2xl"
        >
          <div className="mb-1.5 flex items-center justify-between px-1">
            <span className="text-[8px] font-bold tracking-widest uppercase" style={{ color: GOLD_SOFT }}>AI Assist</span>
            <button onClick={() => { setMenuOpen(false); setShowCustom(false); }} className="text-white/30 hover:text-white/60">
              <X className="h-3 w-3" strokeWidth={1.5} />
            </button>
          </div>
          <div className="mb-1.5 rounded-md border border-white/[0.06] bg-black/40 px-2 py-1">
            <p className="text-[8px] text-white/30">Selected:</p>
            <p className="truncate text-[9px] italic text-white/50">"{savedSelectionRef.current}"</p>
          </div>
          {loading ? (
            <div className="flex items-center justify-center py-3">
              <Loader2 className="h-4 w-4 animate-spin" style={{ color: GOLD }} strokeWidth={1.5} />
            </div>
          ) : showCustom ? (
            <div className="space-y-1.5">
              <input
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder="e.g. Make it more aggressive..."
                autoFocus
                className="w-full rounded-md border border-white/10 bg-black/40 px-2 py-1.5 text-[10px] text-white/80 outline-none placeholder:text-white/25 focus:border-[#c0911e]/30"
              />
              <div className="flex gap-1">
                <button onClick={() => setShowCustom(false)} className="flex-1 rounded-md border border-white/10 py-1.5 text-[9px] font-bold uppercase text-white/40">Back</button>
                <button onClick={() => handleAction('custom')} disabled={!customPrompt.trim()} className="flex-1 rounded-md border py-1.5 text-[9px] font-bold uppercase transition disabled:opacity-30" style={{ borderColor: 'rgba(212,165,44,0.3)', color: GOLD_SOFT, background: 'rgba(212,165,44,0.1)' }}>Apply</button>
              </div>
            </div>
          ) : (
            <div className="space-y-0.5">
              {AI_ACTIONS.map((a) => (
                <button
                  key={a.id}
                  onClick={() => handleAction(a.id)}
                  className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-[10px] text-white/70 transition-colors hover:bg-white/5 hover:text-white/90"
                >
                  <Sparkles className="h-2.5 w-2.5 shrink-0" style={{ color: GOLD }} strokeWidth={1.5} />
                  {a.label}
                </button>
              ))}
              <div className="my-1 h-px bg-white/[0.04]" />
              <button
                onClick={() => setShowCustom(true)}
                className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-[10px] text-white/70 transition-colors hover:bg-white/5"
              >
                <Sparkles className="h-2.5 w-2.5 shrink-0" style={{ color: GOLD }} strokeWidth={1.5} />
                Custom Instruction…
              </button>
              <div className="mt-1.5 border-t border-white/[0.04] px-1 pt-1.5">
                <p className="text-[8px] text-white/30">
                  {formatUsage(weekUsed, entitlements.aiAssistsWeekly)} this week
                </p>
              </div>
            </div>
          )}
          {error && (
            <p className="mt-1 px-1 text-[8px] text-red-400/70">{error}</p>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Default transform function that calls the ai-assist edge function
 * with selected-text-only mode.
 */
export async function defaultAITransform(
  selectedText: string,
  action: string,
  customInstruction?: string,
): Promise<string | null> {
  try {
    const { data, error } = await supabase.functions.invoke('ai-assist', {
      body: {
        mode: 'inline',
        fieldType: 'inline',
        context: { title: selectedText, subtitle: null, introduction: null, hand_details: null, content_html: '', tags: {}, source: '' },
        currentText: selectedText,
        action,
        customInstruction,
      },
    });
    if (error) return null;
    const result = data as { suggestion?: string; error?: string };
    if (result.error || !result.suggestion) return null;
    return result.suggestion;
  } catch {
    return null;
  }
}
