import { useState, useCallback } from 'react';
import { PenLine, Check, Eye, Lock } from 'lucide-react';

const GOLD = '#d4a52c';
const GOLD_SOFT = '#f5e6b0';

export interface WrittenResponseConfig {
  question: string;
  answer: string;
  explanation: string;
  imageUrl: string | null;
}

export const DEFAULT_WRITTEN_RESPONSE: WrittenResponseConfig = {
  question: '',
  answer: '',
  explanation: '',
  imageUrl: null,
};

interface CoachProps {
  config: WrittenResponseConfig;
  onConfigChange: (config: WrittenResponseConfig) => void;
}

export function WrittenResponseCoachConfig({ config, onConfigChange }: CoachProps) {
  const update = useCallback((patch: Partial<WrittenResponseConfig>) => {
    onConfigChange({ ...config, ...patch });
  }, [config, onConfigChange]);

  return (
    <div className="space-y-3 rounded-lg border border-[#c0911e]/20 bg-[#0a0c0e]/60 p-4">
      <div className="flex items-center gap-2">
        <PenLine className="h-4 w-4" style={{ color: GOLD }} />
        <span className="text-[11px] font-bold tracking-widest text-[#f5e6b0] uppercase">Written Response + Reveal</span>
      </div>

      <div>
        <label className="mb-1 block text-[9px] font-semibold tracking-widest text-white/40 uppercase">Question / Prompt</label>
        <textarea
          value={config.question}
          onChange={(e) => update({ question: e.target.value })}
          rows={2}
          placeholder="What should the student reason about?"
          className="w-full resize-none rounded-md border border-[#232a32] bg-[#0a0c0e] px-3 py-2 text-[11px] text-white outline-none focus:border-[#c0911e]/40"
        />
      </div>

      <div>
        <label className="mb-1 block text-[9px] font-semibold tracking-widest text-white/40 uppercase">Hidden Answer / Solution</label>
        <textarea
          value={config.answer}
          onChange={(e) => update({ answer: e.target.value })}
          rows={4}
          placeholder="The coach's answer, revealed after the student submits..."
          className="w-full resize-none rounded-md border border-[#232a32] bg-[#0a0c0e] px-3 py-2 text-[11px] text-white outline-none focus:border-[#c0911e]/40"
        />
      </div>

      <div>
        <label className="mb-1 block text-[9px] font-semibold tracking-widest text-white/40 uppercase">Optional Explanation</label>
        <textarea
          value={config.explanation}
          onChange={(e) => update({ explanation: e.target.value })}
          rows={3}
          placeholder="Additional analysis shown alongside the answer..."
          className="w-full resize-none rounded-md border border-[#232a32] bg-[#0a0c0e] px-3 py-2 text-[11px] text-white outline-none focus:border-[#c0911e]/40"
        />
      </div>

      <div>
        <label className="mb-1 block text-[9px] font-semibold tracking-widest text-white/40 uppercase">Supporting Image URL (optional)</label>
        <input
          value={config.imageUrl || ''}
          onChange={(e) => update({ imageUrl: e.target.value || null })}
          placeholder="https://..."
          className="w-full rounded-md border border-[#232a32] bg-[#0a0c0e] px-3 py-2 text-[11px] text-white outline-none focus:border-[#c0911e]/40"
        />
        {config.imageUrl && (
          <img src={config.imageUrl} alt="Supporting" className="mt-2 max-h-40 rounded-md border border-white/10" />
        )}
      </div>
    </div>
  );
}

interface StudentProps {
  config: WrittenResponseConfig;
}

export function WrittenResponseStudent({ config }: StudentProps) {
  const [response, setResponse] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = useCallback(() => {
    if (!response.trim()) return;
    setSubmitted(true);
  }, [response]);

  const handleReset = useCallback(() => {
    setResponse('');
    setSubmitted(false);
  }, []);

  return (
    <div className="space-y-3 rounded-lg border border-[#c0911e]/15 bg-[#0a0c0e]/40 p-4">
      <div className="flex items-center gap-2">
        <PenLine className="h-4 w-4" style={{ color: GOLD }} />
        <span className="text-[11px] font-bold tracking-widest text-[#f5e6b0] uppercase">Exercise</span>
      </div>

      {config.question && (
        <p className="text-[12px] leading-relaxed text-white/80">{config.question}</p>
      )}

      {config.imageUrl && (
        <img src={config.imageUrl} alt="Exercise" className="max-h-60 rounded-lg border border-white/10" />
      )}

      {!submitted ? (
        <>
          <textarea
            value={response}
            onChange={(e) => setResponse(e.target.value)}
            rows={4}
            placeholder="Type your reasoning here..."
            className="w-full resize-none rounded-md border border-[#232a32] bg-[#0a0c0e] px-3 py-2 text-[12px] leading-relaxed text-white outline-none focus:border-[#c0911e]/40"
          />
          <button
            onClick={handleSubmit}
            disabled={!response.trim()}
            className="flex items-center gap-2 rounded-lg border border-[#c0911e]/40 bg-[#c0911e]/15 px-5 py-2 text-[11px] font-bold tracking-widest uppercase text-[#f5e6b0] transition hover:bg-[#c0911e]/25 disabled:opacity-40"
          >
            <Lock className="h-4 w-4" /> Submit & Reveal
          </button>
        </>
      ) : (
        <>
          <div className="rounded-md border border-white/[0.06] bg-black/20 p-3">
            <span className="mb-1 block text-[9px] font-bold tracking-widest text-white/40 uppercase">Your Answer</span>
            <p className="whitespace-pre-wrap text-[12px] leading-relaxed text-white/70">{response}</p>
          </div>

          <div className="rounded-md border border-emerald-500/20 bg-emerald-500/[0.05] p-3">
            <div className="mb-1.5 flex items-center gap-1.5">
              <Eye className="h-3.5 w-3.5 text-emerald-400" />
              <span className="text-[10px] font-bold tracking-widest text-emerald-300/80 uppercase">Coach's Answer</span>
            </div>
            <p className="whitespace-pre-wrap text-[12px] leading-relaxed text-white/80">{config.answer}</p>
          </div>

          {config.explanation && (
            <div className="rounded-md border border-[#c0911e]/15 bg-[#c0911e]/[0.04] p-3">
              <span className="mb-1 block text-[9px] font-bold tracking-widest text-[#f5e6b0]/60 uppercase">Explanation</span>
              <p className="whitespace-pre-wrap text-[12px] leading-relaxed text-white/70">{config.explanation}</p>
            </div>
          )}

          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-[10px] font-bold tracking-widest uppercase text-white/50 transition hover:bg-white/10"
          >
            <Check className="h-3.5 w-3.5" /> Done
          </button>
        </>
      )}
    </div>
  );
}
