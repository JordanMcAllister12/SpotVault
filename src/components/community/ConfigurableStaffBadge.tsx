import { ShieldCheck, Scale, Crown, Star, Wrench, Headphones, Code, Lightbulb } from 'lucide-react';
import { useStaffBadge } from '@/hooks/useStaffBadge';

const ICON_MAP: Record<string, typeof ShieldCheck> = {
  ShieldCheck,
  Scale,
  Crown,
  Star,
  Wrench,
  Headphones,
  Code,
  Lightbulb,
};

interface Props {
  userId: string | null | undefined;
  size?: 'xs' | 'sm' | 'md';
}

export function ConfigurableStaffBadge({ userId, size = 'sm' }: Props) {
  const meta = useStaffBadge(userId);
  if (!meta || !meta.badge_text) return null;

  const Icon = meta.badge_icon ? ICON_MAP[meta.badge_icon] : null;
  const sizeClasses = {
    xs: 'text-[6px] px-1 py-0.5 gap-0.5',
    sm: 'text-[7px] px-1.5 py-0.5 gap-0.5',
    md: 'text-[9px] px-2 py-1 gap-1',
  };
  const iconSize = size === 'xs' ? 7 : size === 'sm' ? 8 : 10;

  return (
    <span
      className={`shrink-0 inline-flex items-center rounded border font-bold tracking-widest uppercase ${sizeClasses[size]}`}
      style={{
        color: meta.badge_text_color,
        background: meta.badge_color,
        borderColor: `${meta.badge_color}40`,
      }}
    >
      {Icon && <Icon width={iconSize} height={iconSize} strokeWidth={2} />}
      {meta.badge_text}
    </span>
  );
}
