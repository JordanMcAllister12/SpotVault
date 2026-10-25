import { ShieldCheck, Scale, Crown, Star, Wrench, Headphones, Code, Lightbulb } from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { fetchStaffTags, getCachedStaffTags, subscribeStaffTags, type StaffTag } from '@/lib/staffAccountStore';

const ICON_MAP: Record<string, typeof ShieldCheck> = {
  ShieldCheck, Scale, Crown, Star, Wrench, Headphones, Code, Lightbulb,
};

interface Props {
  userId: string | null | undefined;
  size?: 'xs' | 'sm' | 'md';
}

export function StaffTagBadge({ userId, size = 'sm' }: Props) {
  const [tags, setTags] = useState<StaffTag[]>([]);
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    const unsub = subscribeStaffTags(() => forceUpdate((n) => n + 1));
    return () => { unsub(); };
  }, []);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase.rpc('sv_get_user_staff_tags', { p_user_id: userId });
      if (!cancelled && data) setTags(data as StaffTag[]);
    })();
    return () => { cancelled = true; };
  }, [userId]);

  if (!userId || tags.length === 0) return null;

  const sizeClasses = {
    xs: 'text-[6px] px-1 py-0.5 gap-0.5',
    sm: 'text-[7px] px-1.5 py-0.5 gap-0.5',
    md: 'text-[9px] px-2 py-1 gap-1',
  };
  const iconSize = size === 'xs' ? 7 : size === 'sm' ? 8 : 10;

  return (
    <>
      {tags.map((tag) => {
        const Icon = tag.icon ? ICON_MAP[tag.icon] : null;
        return (
          <span
            key={tag.id}
            className={`shrink-0 inline-flex items-center rounded border font-bold tracking-widest uppercase ${sizeClasses[size]}`}
            style={{
              color: tag.text_color,
              background: tag.bg_color,
              borderColor: tag.border_color || `${tag.bg_color}40`,
            }}
          >
            {Icon && <Icon width={iconSize} height={iconSize} strokeWidth={2} />}
            {tag.title}
          </span>
        );
      })}
    </>
  );
}
