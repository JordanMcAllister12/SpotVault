import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

const profileCache = new Map<string, string | null>();

async function fetchAvatarUrl(userId: string): Promise<string | null> {
  if (profileCache.has(userId)) return profileCache.get(userId) ?? null;
  const { data } = await supabase
    .from('user_profiles')
    .select('avatar_url')
    .eq('user_id', userId)
    .single();
  const url = data?.avatar_url ?? null;
  profileCache.set(userId, url);
  return url;
}

const FOCAL_POINT_OVERRIDES: Record<string, string> = {
  '28635338-812c-4c83-a7b7-b10d007e7715': 'center 30%',
};

const FOCAL_URL_OVERRIDES: Record<string, string> = {
  '/assets/profiles/image copy 6.webp': 'center 30%',
};

function encodeAvatarUrl(url: string): string {
  if (url.startsWith('/') && !url.startsWith('//')) {
    const queryIdx = url.indexOf('?');
    const path = queryIdx >= 0 ? url.slice(0, queryIdx) : url;
    const query = queryIdx >= 0 ? url.slice(queryIdx) : '';
    const encoded = path
      .split('/')
      .map((seg) => encodeURIComponent(seg).replace(/%2F/g, '/'))
      .join('/');
    return encoded + query;
  }
  return url;
}

interface AvatarProps {
  userId?: string;
  name: string;
  avatarUrl?: string | null;
  size?: number;
  className?: string;
  ringClass?: string;
}

export function Avatar({ userId, name, avatarUrl, size = 36, className = '', ringClass = 'border-white/[0.08]' }: AvatarProps) {
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(avatarUrl ?? null);
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setImgError(false);
    if (avatarUrl) {
      setResolvedUrl(avatarUrl);
      return;
    }
    if (userId) {
      fetchAvatarUrl(userId).then(setResolvedUrl);
    }
  }, [userId, avatarUrl]);

  const initials = name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  if (resolvedUrl && !imgError) {
    const focalPoint = (userId && FOCAL_POINT_OVERRIDES[userId])
      || FOCAL_URL_OVERRIDES[resolvedUrl]
      || 'center';
    const safeUrl = encodeAvatarUrl(resolvedUrl);
    return (
      <div
        className={`shrink-0 overflow-hidden rounded-full border ${ringClass} bg-[#c091e]/10 ${className}`}
        style={{ width: size, height: size }}
      >
        <img
          src={safeUrl}
          alt={name}
          className="h-full w-full object-cover"
          style={{ objectPosition: focalPoint }}
          loading="lazy"
          onError={() => setImgError(true)}
        />
      </div>
    );
  }

  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full border ${ringClass} bg-[#c091e]/10 ${className}`}
      style={{ width: size, height: size }}
    >
      <span className="font-bold text-[#d4a52c]/60" style={{ fontSize: size * 0.36 }}>
        {initials}
      </span>
    </div>
  );
}

export function AvatarImg({ src, alt = '', className, style, fallback }: { src: string; alt?: string; className?: string; style?: React.CSSProperties; fallback?: React.ReactNode }) {
  const [error, setError] = useState(false);
  if (error) return <>{fallback ?? null}</>;
  return <img src={encodeAvatarUrl(src)} alt={alt} className={className} style={style} loading="lazy" onError={() => setError(true)} />;
}

export function clearAvatarCache(userId?: string) {
  if (userId) {
    profileCache.delete(userId);
  } else {
    profileCache.clear();
  }
}
