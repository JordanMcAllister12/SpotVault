import { BarChart3 } from 'lucide-react';
import { Clock } from 'lucide-react';
import { Brain } from 'lucide-react';
import { Coins } from 'lucide-react';
import { getContentDepthStyle, getComprehensionStyle, getStakesStyle, estimateReadingTimeMinutes } from '@/lib/difficultyColors';

export function DifficultyTag({
  level,
  size = 'normal',
}: {
  level: string;
  size?: 'normal' | 'small';
}) {
  const style = getContentDepthStyle(level);
  if (!style) return null;

  const padding = size === 'small' ? 'px-1.5 py-0.5' : 'px-2 py-0.5';
  const fontSize = size === 'small' ? 'text-[8px]' : 'text-[9px]';

  return (
    <span
      className={`inline-flex items-center rounded-md border ${padding} ${fontSize} font-bold uppercase tracking-wider`}
      style={{
        background: style.bg,
        color: style.text,
        borderColor: style.border,
      }}
    >
      <BarChart3 className="h-3 w-3" strokeWidth={2} />
      {style.label}
    </span>
  );
}

export function ReadingTimeBadge({
  spot,
  size = 'normal',
}: {
  spot: {
    subtitle?: string | null;
    introduction?: string | null;
    hand_details?: string | null;
    content_html?: string | null;
  };
  size?: 'normal' | 'small';
}) {
  const minutes = estimateReadingTimeMinutes(spot);
  if (minutes === 0) return null;

  const fontSize = size === 'small' ? 'text-[8px]' : 'text-[9px]';
  const iconSize = size === 'small' ? 'h-2.5 w-2.5' : 'h-3 w-3';

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border border-white/10 px-1.5 py-0.5 ${fontSize} font-medium text-white/50`}
      title={`Estimated ${minutes} min read`}
    >
      <Clock className={iconSize} strokeWidth={1.5} />
      {minutes} min read
    </span>
  );
}

export function ComprehensionTag({
  level,
  size = 'normal',
}: {
  level: string;
  size?: 'normal' | 'small';
}) {
  const style = getComprehensionStyle(level);
  if (!style) return null;

  const padding = size === 'small' ? 'px-1.5 py-0.5' : 'px-2 py-0.5';
  const fontSize = size === 'small' ? 'text-[8px]' : 'text-[9px]';

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border ${padding} ${fontSize} font-bold uppercase tracking-wider`}
      style={{
        background: style.bg,
        color: style.text,
        borderColor: style.border,
      }}
    >
      <Brain className={size === 'small' ? 'h-2.5 w-2.5' : 'h-3 w-3'} strokeWidth={2} />
      {style.label}
    </span>
  );
}

export function StakesTag({
  level,
  size = 'normal',
}: {
  level: string;
  size?: 'normal' | 'small';
}) {
  const style = getStakesStyle(level);
  if (!style) return null;

  const padding = size === 'small' ? 'px-1.5 py-0.5' : 'px-2 py-0.5';
  const fontSize = size === 'small' ? 'text-[8px]' : 'text-[9px]';

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border ${padding} ${fontSize} font-semibold uppercase tracking-wider`}
      style={{
        background: style.bg,
        color: style.text,
        borderColor: style.border,
      }}
    >
      <Coins className={size === 'small' ? 'h-2.5 w-2.5' : 'h-3 w-3'} strokeWidth={1.5} />
      {style.label}
    </span>
  );
}
