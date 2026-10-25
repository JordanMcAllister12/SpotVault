import { useState } from 'react';
import {
  X, ChevronLeft, ChevronRight, HelpCircle,
  Lightbulb, Search, Bot, Upload,
} from 'lucide-react';

const GOLD = '#d4a52c';
const GOLD_SOFT = '#f5e6b0';

export interface CreatorGuideProps {
  onComplete: () => void;
  onDismiss: () => void;
}

interface Step {
  icon: React.ReactNode;
  title: string;
  body: React.ReactNode;
}

const STEPS: Step[] = [
  {
    icon: <Lightbulb className="h-8 w-8" style={{ color: GOLD }} />,
    title: 'What Makes a Great Spot?',
    body: (
      <div className="space-y-3.5 text-[13px] leading-relaxed text-white/70">
        <p>
          A Spot should teach something valuable that other players may not already understand.
        </p>
        <p>
          Think of creating a Spot the same way you would study for yourself. Don't just find the
          answer — try to determine <em>why</em> the strategy works.
        </p>
        <p>
          That process is how we learn, retain information, and build heuristics we can apply in
          future situations.
        </p>
        <p>
          A Spot might examine how a specific combo plays a hand and why, or break down a broader
          concept using specific examples.
        </p>
        <div className="rounded-lg border p-3 my-1" style={{ borderColor: 'rgba(212,165,44,0.22)', background: 'rgba(212,165,44,0.06)' }}>
          <p className="text-[12px] font-semibold" style={{ color: GOLD_SOFT }}>
            The goal isn't to show an answer. It's to help someone understand the strategy behind it.
          </p>
        </div>
        <p className="text-white/50 text-[11px]">
          Whenever useful, include hands, boards, ranges, diagrams, or visuals. Some players learn
          much better visually.
        </p>
      </div>
    ),
  },
  {
    icon: <Search className="h-8 w-8" style={{ color: GOLD }} />,
    title: 'Research, Solvers & Evidence',
    body: (
      <div className="space-y-3.5 text-[13px] leading-relaxed text-white/70">
        <p>
          Start with your own research and analysis. Study the Spot as though you're trying to
          improve your own game. Examine the situation, identify what the strategy appears to be,
          and work through why it makes sense.
        </p>
        <p>
          Use the SpotVault solver whenever possible. PioSOLVER may also be used for external solver
          evidence.
        </p>
        <p className="font-semibold text-white/85">Avoid presenting interpretations as facts.</p>
        <p className="text-white/50 text-[11px]">
          Solver output can show us what a strategy is doing, but our explanation of why it does it
          is still an interpretation.
        </p>
        <div className="rounded-lg border border-white/[0.07] bg-white/[0.03] p-3 space-y-2">
          <p className="text-[11px] font-semibold text-red-400/70 uppercase tracking-widest">Avoid</p>
          <p className="text-white/50 line-through">"The solver bets because X."</p>
          <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: GOLD }}>Prefer</p>
          <p className="text-white/80">
            "The solver appears to prefer betting here, potentially because of X, Y and Z."
          </p>
        </div>
        <p className="text-[11px] text-red-400/60">
          Do not upload screenshots from the GTO Wizard solver. Spots containing GTO Wizard
          solver screenshots may have the evidence removed or the Spot itself removed.
        </p>
      </div>
    ),
  },
  {
    icon: <Bot className="h-8 w-8" style={{ color: GOLD }} />,
    title: 'Using AI',
    body: (
      <div className="space-y-3.5 text-[13px] leading-relaxed text-white/70">
        <p>
          AI is encouraged as an editing and presentation tool — not as a replacement for your
          poker knowledge.
        </p>
        <p className="font-semibold text-white/85">Use AI to:</p>
        <ul className="space-y-1.5 pl-4">
          {[
            'Spell-check and proofread',
            'Improve formatting and organization',
            'Simplify complicated language',
            'Make your reasoning easier to understand',
            'Help create useful visuals or diagrams',
          ].map((item) => (
            <li key={item} className="flex items-start gap-2">
              <span style={{ color: GOLD }} className="mt-0.5 shrink-0">—</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
        <p>
          The underlying poker idea, research, and reasoning should come from you.
        </p>
        <p className="font-semibold text-white/85">
          Do not ask AI to create an entire poker concept or Spot from scratch.
        </p>
        <p className="text-white/50 text-[11px]">
          Generic AI-generated strategy is often easy to recognize and may provide little educational
          value.
        </p>
        <div className="rounded-lg border p-3 my-1" style={{ borderColor: 'rgba(212,165,44,0.22)', background: 'rgba(212,165,44,0.06)' }}>
          <p className="text-[12px] font-semibold" style={{ color: GOLD_SOFT }}>
            Use AI to make your thinking clearer — not to replace your thinking.
          </p>
        </div>
        <p className="text-white/50 text-[11px]">
          Keep the writing human. Clear, simple, natural language is usually better than something
          that sounds overly polished or AI-generated.
        </p>
      </div>
    ),
  },
  {
    icon: <Upload className="h-8 w-8" style={{ color: GOLD }} />,
    title: 'Creating & Publishing',
    body: (
      <div className="space-y-3.5 text-[13px] leading-relaxed text-white/70">
        <p>
          For most users, Spots are currently text-based. Text Spots can include hand histories,
          screenshots, charts, diagrams, images, and other supporting material.
        </p>
        <div className="rounded-lg border border-white/[0.07] bg-white/[0.03] p-3 space-y-1.5">
          <p className="text-[11px] font-semibold text-white/50 uppercase tracking-widest">Video & Monetization</p>
          <p>
            Video Spots and monetization are currently restricted to approved creators. Users who
            want access can apply by submitting their poker results and demonstrating exceptional
            performance or expertise.
          </p>
        </div>
        <p className="font-semibold text-white/85">Before publishing, ask yourself:</p>
        <ul className="space-y-1.5 pl-4">
          {[
            'Am I teaching something genuinely useful?',
            'Did I investigate the "why"?',
            'Did I do the underlying research and analysis myself?',
            'Did I provide evidence or specific examples?',
            'Is my reasoning clear without overstating certainty?',
            'Would a visual make this easier to understand?',
            'Does this sound like me rather than AI-generated content?',
          ].map((q, i) => (
            <li key={i} className="flex items-start gap-2">
              <span style={{ color: GOLD }} className="mt-0.5 shrink-0 font-mono text-[10px] font-bold">
                {String(i + 1).padStart(2, '0')}
              </span>
              <span>{q}</span>
            </li>
          ))}
        </ul>
        <p className="text-[12px] font-semibold pt-1" style={{ color: GOLD_SOFT }}>
          Great Spots combine expertise, evidence, curiosity, and clear explanation.
        </p>
      </div>
    ),
  },
];

export function CreatorGuide({ onComplete, onDismiss }: CreatorGuideProps) {
  const [step, setStep] = useState(0);
  const total = STEPS.length;
  const current = STEPS[step];
  const isLast = step === total - 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(8px)' }}>
      <div
        className="relative flex w-full max-w-lg flex-col overflow-hidden rounded-2xl"
        style={{
          background: 'linear-gradient(160deg, #0d0e10 0%, #0a0b0d 100%)',
          border: '1px solid rgba(212,165,44,0.22)',
          boxShadow: '0 32px 80px rgba(0,0,0,0.7), inset 0 1px 0 rgba(212,165,44,0.12)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
          <div className="flex items-center gap-2">
            <HelpCircle className="h-4 w-4" style={{ color: GOLD }} />
            <span className="text-[10px] font-mono tracking-[0.22em] uppercase" style={{ color: GOLD }}>
              Creator Guide
            </span>
          </div>
          <button
            onClick={onDismiss}
            className="rounded-full p-1 text-white/30 transition-colors hover:text-white/70"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Progress bar */}
        <div className="h-[2px] bg-white/[0.04]">
          <div
            className="h-full transition-all duration-300"
            style={{
              width: `${((step + 1) / total) * 100}%`,
              background: `linear-gradient(90deg, ${GOLD}, #f5e6b0)`,
            }}
          />
        </div>

        {/* Body */}
        <div className="flex min-h-[400px] flex-col gap-5 px-6 py-6">
          <div className="flex items-center gap-3">
            {current.icon}
            <div>
              <p className="text-[10px] font-mono tracking-[0.18em] uppercase text-white/30">
                {step + 1} / {total}
              </p>
              <h2 className="text-[18px] font-bold leading-tight text-white">
                {current.title}
              </h2>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {current.body}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-white/[0.06] px-5 py-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={step === 0}
              className="flex items-center gap-1 rounded-lg border border-white/10 px-3 py-1.5 text-[11px] font-semibold text-white/40 transition-all hover:border-white/20 hover:text-white/70 disabled:pointer-events-none disabled:opacity-30"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Back
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            {STEPS.map((_, i) => (
              <button
                key={i}
                onClick={() => setStep(i)}
                className="h-1.5 rounded-full transition-all duration-200"
                style={{
                  width: i === step ? '20px' : '6px',
                  background: i === step ? GOLD : 'rgba(255,255,255,0.15)',
                }}
              />
            ))}
          </div>

          {isLast ? (
            <button
              onClick={onComplete}
              className="flex items-center gap-1.5 rounded-lg px-5 py-2 text-[12px] font-bold text-[#0a0c0e] transition-all"
              style={{ background: `linear-gradient(135deg, ${GOLD}, #c0911e)` }}
            >
              Start Creating
            </button>
          ) : (
            <button
              onClick={() => setStep((s) => Math.min(total - 1, s + 1))}
              className="flex items-center gap-1 rounded-lg border px-4 py-1.5 text-[11px] font-semibold text-white/80 transition-all hover:text-white"
              style={{ borderColor: 'rgba(212,165,44,0.3)', background: 'rgba(212,165,44,0.06)' }}
            >
              Next
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
