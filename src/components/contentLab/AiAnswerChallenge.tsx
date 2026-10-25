import { useState, useCallback, useEffect } from 'react';
import {
  Swords, Check, Eye, Lock, Loader2, AlertCircle,
  ChevronDown, ChevronUp, Trash2, Pencil, Sparkles,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

const GOLD = '#d4a52c';
const GOLD_SOFT = '#f5e6b0';

// ============================================================
// Types
// ============================================================

export type GradingMode = 'exact_combinations' | 'conceptual' | 'strategic_reasoning';

export interface GradingRubric {
  essential_concepts?: string;
  partial_credit?: string;
  common_misconceptions?: string;
  acceptable_alternatives?: string;
  relative_importance?: string;
}

export interface AiAnswerChallengeConfig {
  challengeId: string;
  question: string;
  answerFormatInstructions: string;
  gradingMode: GradingMode;
  // answerKey and rubric are stored server-side, not in this config
}

export const DEFAULT_AI_CHALLENGE: AiAnswerChallengeConfig = {
  challengeId: '',
  question: '',
  answerFormatInstructions: '',
  gradingMode: 'conceptual',
};

export interface GradingResult {
  score: number;
  correct_elements: string[];
  missing_elements: string[];
  incorrect_elements: string[];
  explanation: string;
  grading_confidence: string;
}

// ============================================================
// Coach Configuration Panel
// ============================================================

interface CoachProps {
  config: AiAnswerChallengeConfig;
  onConfigChange: (config: AiAnswerChallengeConfig) => void;
  contentSpotId?: string;
  accountId?: string;
}

export function AiAnswerChallengeCoachConfig({ config, onConfigChange, contentSpotId, accountId }: CoachProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [answerKey, setAnswerKey] = useState('');
  const [rubric, setRubric] = useState<GradingRubric>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Load answer key from server when challengeId exists
  useEffect(() => {
    if (!config.challengeId) return;
    void (async () => {
      const { data } = await supabase
        .from('ai_answer_challenges')
        .select('answer_key, grading_rubric')
        .eq('id', config.challengeId)
        .maybeSingle();
      if (data) {
        setAnswerKey(data.answer_key || '');
        setRubric(data.grading_rubric || {});
      }
    })();
  }, [config.challengeId]);

  const update = useCallback((patch: Partial<AiAnswerChallengeConfig>) => {
    onConfigChange({ ...config, ...patch });
  }, [config, onConfigChange]);

  const updateRubric = useCallback((patch: Partial<GradingRubric>) => {
    setRubric({ ...rubric, ...patch });
  }, [rubric]);

  const saveAnswerKey = useCallback(async () => {
    if (!config.challengeId || !accountId) return;
    setSaving(true);
    setSaved(false);
    try {
      const { error } = await supabase
        .from('ai_answer_challenges')
        .upsert({
          id: config.challengeId,
          content_spot_id: contentSpotId || null,
          creator_id: accountId,
          question: config.question,
          answer_format_instructions: config.answerFormatInstructions,
          answer_key: answerKey,
          grading_mode: config.gradingMode,
          grading_rubric: rubric,
        });
      if (!error) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  }, [config.challengeId, config.question, config.answerFormatInstructions, config.gradingMode, answerKey, rubric, accountId, contentSpotId]);

  return (
    <div className="space-y-4 rounded-lg border border-[#c0911e]/20 bg-[#0a0c0e]/60 p-4">
      <div className="flex items-center gap-2">
        <Swords className="h-4 w-4" style={{ color: GOLD }} />
        <span className="text-[11px] font-bold tracking-widest text-[#f5e6b0] uppercase">AI Answer Challenge</span>
      </div>

      {/* Question */}
      <div>
        <label className="mb-1 block text-[9px] font-semibold tracking-widest text-white/40 uppercase">Question / Prompt</label>
        <textarea
          value={config.question}
          onChange={(e) => update({ question: e.target.value })}
          rows={2}
          placeholder="What range of hands should Hero triple barrel on this runout?"
          className="w-full resize-none rounded-md border border-[#232a32] bg-[#0a0c0e] px-3 py-2 text-[11px] text-white outline-none focus:border-[#c0911e]/40"
        />
      </div>

      {/* Answer Format Instructions */}
      <div>
        <label className="mb-1 block text-[9px] font-semibold tracking-widest text-white/40 uppercase">Answer Format Instructions</label>
        <textarea
          value={config.answerFormatInstructions}
          onChange={(e) => update({ answerFormatInstructions: e.target.value })}
          rows={2}
          placeholder="List the hands using poker notation, separated by commas. Example: 77, AKo, AKs."
          className="w-full resize-none rounded-md border border-[#232a32] bg-[#0a0c0e] px-3 py-2 text-[11px] text-white outline-none focus:border-[#c0911e]/40"
        />
      </div>

      {/* Grading Mode */}
      <div>
        <label className="mb-1.5 block text-[9px] font-semibold tracking-widest text-white/40 uppercase">Grading Mode</label>
        <div className="flex flex-wrap gap-2">
          {([
            { value: 'exact_combinations', label: 'Exact Combinations' },
            { value: 'conceptual', label: 'Conceptual' },
            { value: 'strategic_reasoning', label: 'Strategic Reasoning' },
          ] as const).map((opt) => (
            <button
              key={opt.value}
              onClick={() => update({ gradingMode: opt.value })}
              className="rounded-md border px-3 py-1.5 text-[10px] font-medium transition"
              style={{
                borderColor: config.gradingMode === opt.value ? 'rgba(212,165,44,0.4)' : 'rgba(255,255,255,0.08)',
                background: config.gradingMode === opt.value ? 'rgba(212,165,44,0.12)' : 'transparent',
                color: config.gradingMode === opt.value ? GOLD_SOFT : 'rgba(255,255,255,0.5)',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Answer Key — stored server-side */}
      <div>
        <div className="mb-1 flex items-center justify-between">
          <label className="text-[9px] font-semibold tracking-widest text-white/40 uppercase">Correct Answer / Answer Key</label>
          <span className="flex items-center gap-1 text-[8px] text-emerald-400/60">
            <Lock className="h-2.5 w-2.5" /> Stored securely
          </span>
        </div>
        <textarea
          value={answerKey}
          onChange={(e) => setAnswerKey(e.target.value)}
          rows={5}
          placeholder="Enter the correct answer and supporting explanation. This is stored server-side and never exposed to students before submission."
          className="w-full resize-none rounded-md border border-[#232a32] bg-[#0a0c0e] px-3 py-2 text-[11px] leading-relaxed text-white outline-none focus:border-[#c0911e]/40"
        />
      </div>

      {/* Advanced: Grading Rubric */}
      <div>
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center gap-1 text-[9px] font-bold uppercase text-white/40 hover:text-white/70"
        >
          {showAdvanced ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          Grading Rubric (Optional)
        </button>
        {showAdvanced && (
          <div className="mt-2 space-y-2">
            <div>
              <label className="mb-0.5 block text-[8px] font-semibold tracking-widest text-white/30 uppercase">Essential Concepts</label>
              <textarea
                value={rubric.essential_concepts || ''}
                onChange={(e) => updateRubric({ essential_concepts: e.target.value })}
                rows={2}
                placeholder="Key concepts the student must mention for full credit..."
                className="w-full resize-none rounded-md border border-[#232a32] bg-[#0a0c0e] px-3 py-2 text-[10px] text-white outline-none focus:border-[#c0911e]/40"
              />
            </div>
            <div>
              <label className="mb-0.5 block text-[8px] font-semibold tracking-widest text-white/30 uppercase">Partial Credit Rules</label>
              <textarea
                value={rubric.partial_credit || ''}
                onChange={(e) => updateRubric({ partial_credit: e.target.value })}
                rows={2}
                placeholder="When and how to award partial credit..."
                className="w-full resize-none rounded-md border border-[#232a32] bg-[#0a0c0e] px-3 py-2 text-[10px] text-white outline-none focus:border-[#c0911e]/40"
              />
            </div>
            <div>
              <label className="mb-0.5 block text-[8px] font-semibold tracking-widest text-white/30 uppercase">Common Misconceptions</label>
              <textarea
                value={rubric.common_misconceptions || ''}
                onChange={(e) => updateRubric({ common_misconceptions: e.target.value })}
                rows={2}
                placeholder="Answers that seem right but miss the point..."
                className="w-full resize-none rounded-md border border-[#232a32] bg-[#0a0c0e] px-3 py-2 text-[10px] text-white outline-none focus:border-[#c0911e]/40"
              />
            </div>
            <div>
              <label className="mb-0.5 block text-[8px] font-semibold tracking-widest text-white/30 uppercase">Acceptable Alternatives</label>
              <textarea
                value={rubric.acceptable_alternatives || ''}
                onChange={(e) => updateRubric({ acceptable_alternatives: e.target.value })}
                rows={2}
                placeholder="Alternative reasoning that should receive credit..."
                className="w-full resize-none rounded-md border border-[#232a32] bg-[#0a0c0e] px-3 py-2 text-[10px] text-white outline-none focus:border-[#c0911e]/40"
              />
            </div>
          </div>
        )}
      </div>

      {/* Save button */}
      <div className="flex items-center gap-3">
        <button
          onClick={saveAnswerKey}
          disabled={saving || !config.challengeId}
          className="flex items-center gap-2 rounded-lg border border-[#c0911e]/40 bg-[#c0911e]/15 px-4 py-2 text-[10px] font-bold tracking-widest uppercase text-[#f5e6b0] transition hover:bg-[#c0911e]/25 disabled:opacity-40"
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : saved ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Lock className="h-3.5 w-3.5" />}
          {saving ? 'Saving…' : saved ? 'Saved' : 'Save Answer Key'}
        </button>
        {!config.challengeId && (
          <span className="text-[9px] text-white/30">Save the document first to create this challenge.</span>
        )}
      </div>
    </div>
  );
}

// ============================================================
// Student View
// ============================================================

interface StudentProps {
  config: AiAnswerChallengeConfig;
}

export function AiAnswerChallengeStudent({ config }: StudentProps) {
  const [response, setResponse] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [grading, setGrading] = useState(false);
  const [gradingResult, setGradingResult] = useState<GradingResult | null>(null);
  const [coachAnswer, setCoachAnswer] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attemptNumber, setAttemptNumber] = useState(1);

  // Check for existing submission
  useEffect(() => {
    if (!config.challengeId) return;
    void (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;
      const { data } = await supabase
        .from('ai_answer_submissions')
        .select('id, student_answer, score, feedback, attempt_number')
        .eq('challenge_id', config.challengeId)
        .eq('student_id', session.user.id)
        .order('submitted_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data?.feedback) {
        setGradingResult(data.feedback as GradingResult);
        setCoachAnswer(''); // Will be fetched after reveal
        setSubmitted(true);
        setResponse(data.student_answer || '');
        setAttemptNumber((data.attempt_number || 1) + 1);
        // Fetch coach answer now that student has submitted
        const { data: challenge } = await supabase
          .from('ai_answer_challenges')
          .select('answer_key')
          .eq('id', config.challengeId)
          .maybeSingle();
        if (challenge) setCoachAnswer(challenge.answer_key);
      }
    })();
  }, [config.challengeId]);

  const handleSubmit = useCallback(async () => {
    if (!response.trim() || !config.challengeId) return;
    setGrading(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setError('You must be signed in to submit an answer.');
        setGrading(false);
        return;
      }

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/grade-challenge`;
      const resp = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          challengeId: config.challengeId,
          studentAnswer: response,
          attemptNumber,
        }),
      });

      if (!resp.ok) {
        const errBody = await resp.json().catch(() => ({}));
        setError(errBody.error || `Grading failed (${resp.status}). Please try again.`);
        setGrading(false);
        return;
      }

      const data = await resp.json();
      if (!data.grading) {
        setError('Grading returned an invalid response. Please try again.');
        setGrading(false);
        return;
      }

      setGradingResult(data.grading);
      setSubmitted(true);

      // Fetch coach answer now that submission is confirmed
      const { data: challenge } = await supabase
        .from('ai_answer_challenges')
        .select('answer_key')
        .eq('id', config.challengeId)
        .maybeSingle();
      if (challenge) setCoachAnswer(challenge.answer_key);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setGrading(false);
    }
  }, [response, config.challengeId, attemptNumber]);

  const handleReset = useCallback(() => {
    setResponse('');
    setSubmitted(false);
    setGradingResult(null);
    setCoachAnswer(null);
    setError(null);
  }, []);

  const scoreColor = gradingResult
    ? gradingResult.score >= 75 ? '#34d399'
    : gradingResult.score >= 50 ? GOLD
    : gradingResult.score >= 25 ? '#fbbf24'
    : '#f87171'
    : GOLD;

  return (
    <div className="overflow-hidden rounded-lg border border-[#c0911e]/15 bg-[#0a0c0e]/40">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-white/[0.06] px-4 py-2.5">
        <Swords className="h-3.5 w-3.5" style={{ color: GOLD }} />
        <span className="text-[10px] font-bold tracking-widest text-[#f5e6b0] uppercase">AI Answer Challenge</span>
      </div>

      {/* Question */}
      <div className="px-4 pt-3">
        {config.question && (
          <p className="text-[13px] font-medium leading-relaxed text-white/90">{config.question}</p>
        )}
        {config.answerFormatInstructions && (
          <div className="mt-2 rounded-md border border-white/[0.06] bg-black/20 px-3 py-2">
            <span className="mb-0.5 block text-[8px] font-bold tracking-widest text-white/30 uppercase">Expected Format</span>
            <p className="text-[11px] leading-relaxed text-white/60">{config.answerFormatInstructions}</p>
          </div>
        )}
      </div>

      {/* Two-panel layout */}
      <div className="flex flex-col gap-px bg-white/[0.04] sm:flex-row">
        {/* Left panel — Coach Answer */}
        <div className="flex-1 bg-[#0a0c0e] p-4">
          <div className="mb-2 flex items-center gap-1.5">
            {submitted ? (
              <Eye className="h-3.5 w-3.5 text-emerald-400" />
            ) : (
              <Lock className="h-3.5 w-3.5 text-white/30" />
            )}
            <span
              className="text-[9px] font-bold tracking-widest uppercase"
              style={{ color: submitted ? 'rgba(52,211,153,0.8)' : 'rgba(255,255,255,0.3)' }}
            >
              Coach's Answer
            </span>
          </div>
          {submitted && coachAnswer ? (
            <p className="whitespace-pre-wrap text-[12px] leading-relaxed text-white/80">{coachAnswer}</p>
          ) : submitted ? (
            <p className="text-[11px] italic text-white/40">Answer available after submission.</p>
          ) : (
            <div className="flex h-24 items-center justify-center rounded-md border border-dashed border-white/[0.08]">
              <span className="text-[10px] text-white/25">Locked — submit your answer to reveal</span>
            </div>
          )}
        </div>

        {/* Right panel — Student Answer */}
        <div className="flex-1 bg-[#0a0c0e] p-4">
          <div className="mb-2 flex items-center gap-1.5">
            <Pencil className="h-3.5 w-3.5" style={{ color: GOLD }} />
            <span className="text-[9px] font-bold tracking-widest uppercase" style={{ color: GOLD_SOFT }}>
              Your Answer
            </span>
          </div>
          {!submitted ? (
            <textarea
              value={response}
              onChange={(e) => setResponse(e.target.value)}
              rows={5}
              placeholder="Type your answer here..."
              className="w-full resize-none rounded-md border border-[#232a32] bg-[#0a0c0e] px-3 py-2 text-[12px] leading-relaxed text-white outline-none focus:border-[#c0911e]/40"
            />
          ) : (
            <div className="rounded-md border border-white/[0.06] bg-black/20 p-3">
              <p className="whitespace-pre-wrap text-[12px] leading-relaxed text-white/70">{response}</p>
            </div>
          )}
        </div>
      </div>

      {/* Submit / Error */}
      <div className="px-4 pb-3">
        {error && (
          <div className="mb-2 flex items-center gap-2 rounded-md border border-red-500/20 bg-red-500/[0.06] px-3 py-2">
            <AlertCircle className="h-3.5 w-3.5 shrink-0 text-red-400" />
            <span className="text-[11px] text-red-300/80">{error}</span>
          </div>
        )}

        {!submitted ? (
          <button
            onClick={handleSubmit}
            disabled={!response.trim() || grading}
            className="flex items-center gap-2 rounded-lg border border-[#c0911e]/40 bg-[#c0911e]/15 px-5 py-2 text-[11px] font-bold tracking-widest uppercase text-[#f5e6b0] transition hover:bg-[#c0911e]/25 disabled:opacity-40"
          >
            {grading ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Grading…</>
            ) : (
              <><Sparkles className="h-4 w-4" /> Submit & Grade</>
            )}
          </button>
        ) : (
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-[10px] font-bold tracking-widest uppercase text-white/50 transition hover:bg-white/10"
          >
            <Check className="h-3.5 w-3.5" /> Done
          </button>
        )}
      </div>

      {/* Grading Results */}
      {submitted && gradingResult && (
        <div className="border-t border-white/[0.06] px-4 py-3">
          {/* Score */}
          <div className="mb-3 flex items-center gap-3">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-full border-2 text-[16px] font-bold"
              style={{ borderColor: scoreColor, color: scoreColor }}
            >
              {gradingResult.score}
            </div>
            <div>
              <span className="text-[10px] font-bold tracking-widest text-white/40 uppercase">Score</span>
              <p className="text-[14px] font-semibold text-white/80">{gradingResult.score}/100</p>
            </div>
            <div className="ml-auto flex items-center gap-1.5">
              <span className="text-[8px] font-bold tracking-widest text-white/30 uppercase">Confidence</span>
              <span
                className="rounded-full border px-2 py-0.5 text-[8px] font-medium"
                style={{
                  borderColor: gradingResult.grading_confidence === 'high' ? 'rgba(52,211,153,0.3)' : gradingResult.grading_confidence === 'medium' ? 'rgba(212,165,44,0.3)' : 'rgba(248,113,113,0.3)',
                  color: gradingResult.grading_confidence === 'high' ? '#34d399' : gradingResult.grading_confidence === 'medium' ? GOLD : '#f87171',
                }}
              >
                {gradingResult.grading_confidence}
              </span>
            </div>
          </div>

          {/* Feedback sections */}
          <div className="space-y-2">
            {gradingResult.correct_elements.length > 0 && (
              <div className="rounded-md border border-emerald-500/15 bg-emerald-500/[0.04] px-3 py-2">
                <span className="mb-1 block text-[8px] font-bold tracking-widest text-emerald-300/70 uppercase">What You Got Right</span>
                <ul className="space-y-0.5">
                  {gradingResult.correct_elements.map((item, i) => (
                    <li key={i} className="text-[11px] leading-relaxed text-white/70">• {item}</li>
                  ))}
                </ul>
              </div>
            )}

            {gradingResult.missing_elements.length > 0 && (
              <div className="rounded-md border border-amber-500/15 bg-amber-500/[0.04] px-3 py-2">
                <span className="mb-1 block text-[8px] font-bold tracking-widest text-amber-300/70 uppercase">What Was Missing</span>
                <ul className="space-y-0.5">
                  {gradingResult.missing_elements.map((item, i) => (
                    <li key={i} className="text-[11px] leading-relaxed text-white/70">• {item}</li>
                  ))}
                </ul>
              </div>
            )}

            {gradingResult.incorrect_elements.length > 0 && (
              <div className="rounded-md border border-red-500/15 bg-red-500/[0.04] px-3 py-2">
                <span className="mb-1 block text-[8px] font-bold tracking-widest text-red-300/70 uppercase">Incorrect Elements</span>
                <ul className="space-y-0.5">
                  {gradingResult.incorrect_elements.map((item, i) => (
                    <li key={i} className="text-[11px] leading-relaxed text-white/70">• {item}</li>
                  ))}
                </ul>
              </div>
            )}

            {gradingResult.explanation && (
              <div className="rounded-md border border-[#c0911e]/15 bg-[#c0911e]/[0.04] px-3 py-2">
                <span className="mb-1 block text-[8px] font-bold tracking-widest text-[#f5e6b0]/60 uppercase">Strategic Explanation</span>
                <p className="text-[11px] leading-relaxed text-white/70">{gradingResult.explanation}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
