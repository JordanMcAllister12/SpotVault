import {
  Trophy,
  Calendar,
  Gamepad2,
  Globe,
  User,
  Briefcase,
  GraduationCap,
  DollarSign,
  ShieldCheck,
  Award,
  FileText,
} from 'lucide-react';
import type { PokerResume } from '@/data/peopleDirectory';

const GOLD = '#d4a52c';
const GOLD_SOFT = '#f5e6b0';

interface Props {
  resume: PokerResume;
  displayName: string;
}

export function PokerResumeView({ resume, displayName }: Props) {
  return (
    <div className="space-y-4">
      {/* Header */}
      <div
        className="overflow-hidden rounded-2xl border border-white/[0.06] bg-black/30"
        style={{ boxShadow: '0 12px 40px -16px rgba(0,0,0,0.7)' }}
      >
        <div
          className="h-16 w-full"
          style={{
            background: 'linear-gradient(135deg, rgba(192,145,30,0.18), rgba(13,15,18,0.5))',
            borderBottom: '1px solid rgba(192,145,30,0.12)',
          }}
        />
        <div className="px-5 py-4 sm:px-6">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4" style={{ color: GOLD }} strokeWidth={1.5} />
            <h2 className="text-sm font-bold tracking-widest text-white/80 uppercase">
              Professional Poker Résumé
            </h2>
          </div>
          <p className="mt-2 text-[13px] leading-relaxed text-white/60">{resume.headline}</p>
        </div>
      </div>

      {/* Career overview cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {resume.yearsExperience != null && (
          <ResumeInfoCard
            icon={Calendar}
            label="Years of Experience"
            value={`${resume.yearsExperience}+ years`}
          />
        )}
        {resume.careerWinnings && (
          <ResumeInfoCard
            icon={DollarSign}
            label="Career Tournament Winnings"
            value={resume.careerWinnings.amount}
            verified={resume.careerWinnings.verified}
          />
        )}
        {resume.spotvaultRole && (
          <ResumeInfoCard icon={Briefcase} label="SpotVault Role" value={resume.spotvaultRole} />
        )}
        {resume.primaryFormats.length > 0 && (
          <ResumeInfoCard
            icon={Gamepad2}
            label="Primary Formats"
            value={resume.primaryFormats.join(' · ')}
          />
        )}
        {resume.platforms.length > 0 && (
          <ResumeInfoCard
            icon={Globe}
            label="Poker Platforms"
            value={resume.platforms.join(' · ')}
          />
        )}
        {resume.aliases.length > 0 && (
          <ResumeInfoCard
            icon={User}
            label="Player Aliases"
            value={resume.aliases.join(' · ')}
          />
        )}
      </div>

      {/* Notable results */}
      {resume.notableResults.length > 0 && (
        <div className="rounded-xl border border-white/[0.05] bg-black/25 p-5">
          <div className="mb-3 flex items-center gap-1.5">
            <Trophy className="h-4 w-4" style={{ color: GOLD }} strokeWidth={1.5} />
            <h3 className="text-[11px] font-bold tracking-widest text-white/40 uppercase">
              Major Tournament Results
            </h3>
          </div>
          <div className="space-y-2">
            {resume.notableResults.map((result, i) => (
              <div
                key={i}
                className="flex items-start gap-3 rounded-lg border border-white/[0.04] bg-white/[0.02] p-3"
              >
                <Award className="mt-0.5 h-4 w-4 shrink-0 text-white/25" strokeWidth={1.5} />
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] font-semibold text-white/80">{result.title}</p>
                  <p className="mt-0.5 text-[11px] text-white/50">{result.result}</p>
                  <p className="mt-0.5 text-[9px] text-white/30">{result.date}</p>
                </div>
                {result.verified && (
                  <span className="flex shrink-0 items-center gap-0.5 rounded border border-[#c091e]/20 bg-[#c091e]/8 px-1.5 py-0.5 text-[8px] font-bold tracking-widest text-[#d4a52c] uppercase">
                    <ShieldCheck className="h-2.5 w-2.5" strokeWidth={1.5} /> Verified
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Coaching summary */}
      {resume.coachingSummary && (
        <div className="rounded-xl border border-white/[0.05] bg-black/25 p-5">
          <div className="mb-2 flex items-center gap-1.5">
            <GraduationCap className="h-4 w-4" style={{ color: GOLD }} strokeWidth={1.5} />
            <h3 className="text-[11px] font-bold tracking-widest text-white/40 uppercase">
              Coaching
            </h3>
          </div>
          <p className="text-[13px] leading-relaxed text-white/60">{resume.coachingSummary}</p>
        </div>
      )}

      {/* Verification notice */}
      <div className="rounded-xl border border-white/[0.04] bg-white/[0.015] p-4 text-center">
        <p className="text-[10px] leading-relaxed text-white/30">
          Tournament results and career figures on this résumé are populated only with verified
          data. Unverified entries will not be shown.
        </p>
      </div>
    </div>
  );
}

function ResumeInfoCard({
  icon: Icon,
  label,
  value,
  verified,
}: {
  icon: typeof Trophy;
  label: string;
  value: string;
  verified?: boolean;
}) {
  return (
    <div
      className="flex items-start gap-3 rounded-xl border border-white/[0.05] bg-black/25 p-4"
    >
      <div
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#c091e]/15 bg-[#c091e]/8"
      >
        <Icon className="h-4 w-4" style={{ color: GOLD }} strokeWidth={1.5} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[9px] font-bold tracking-widest text-white/30 uppercase">{label}</div>
        <div className="mt-0.5 text-[13px] font-semibold text-white/80">{value}</div>
        {verified && (
          <span className="mt-1 inline-flex items-center gap-0.5 text-[8px] font-bold tracking-widest text-[#d4a52c] uppercase">
            <ShieldCheck className="h-2.5 w-2.5" strokeWidth={1.5} /> Verified
          </span>
        )}
      </div>
    </div>
  );
}
