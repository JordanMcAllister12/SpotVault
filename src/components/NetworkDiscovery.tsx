import { useState, useEffect, useCallback } from 'react';
import { AvatarImg } from '@/components/shared/Avatar';
import { MapPin, Navigation, Loader2, Users, UserPlus, Check, Clock } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
  getUsersByHomeCity, followUser, getMyFollowing, type FollowUser,
} from '@/lib/followEngine';
import {
  fetchAllCities, resolveCoordinates, formatCityShort, type CityRecord,
} from '@/lib/cityDatabase';
import { fetchProfile, type UserProfile } from '@/lib/profileStore';
import type { SpotVaultAccount } from '@/types';

const GOLD = '#d4a52c';
const GOLD_SOFT = '#f5e6b0';
const BORDER = 'rgba(212, 165, 44, 0.18)';

type CityMode = 'home' | 'current';
type FollowState = 'idle' | 'following' | 'requested';

interface SuggestedUser extends FollowUser {
  followState: FollowState;
  loading: boolean;
}

interface Props {
  account: SpotVaultAccount | null;
}

export function NetworkDiscovery({ account }: Props) {
  const [mode, setMode] = useState<CityMode>('home');
  const [suggestions, setSuggestions] = useState<SuggestedUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [cityLabel, setCityLabel] = useState<string>('');
  const [citySlug, setCitySlug] = useState<string | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [followingSet, setFollowingSet] = useState<Set<string>>(new Set());

  // Load current user's profile and following list
  useEffect(() => {
    if (!account?.id) return;
    let cancelled = false;
    (async () => {
      const [prof, following] = await Promise.all([
        fetchProfile(account.id),
        getMyFollowing(),
      ]);
      if (cancelled) return;
      setProfile(prof);
      setFollowingSet(new Set(following));
    })();
    return () => { cancelled = true; };
  }, [account?.id]);

  // Load suggestions when mode or city changes
  const loadSuggestions = useCallback(async (slug: string | null) => {
    if (!slug) {
      setSuggestions([]);
      return;
    }
    setLoading(true);
    const users = await getUsersByHomeCity(slug);
    const enriched: SuggestedUser[] = users.map((u) => ({
      ...u,
      followState: followingSet.has(u.user_id) ? 'following' : 'idle',
      loading: false,
    }));
    setSuggestions(enriched);
    setLoading(false);
  }, [followingSet]);

  // Home city mode
  useEffect(() => {
    if (mode !== 'home') return;
    const slug = profile?.home_city_slug ?? null;
    setCitySlug(slug);
    if (slug) {
      // Look up city label
      (async () => {
        const cities = await fetchAllCities();
        const city = cities.find((c) => c.slug === slug);
        setCityLabel(city ? formatCityShort(city) : slug.replace(/-/g, ' '));
      })();
      loadSuggestions(slug);
    } else {
      setCityLabel('');
      setSuggestions([]);
    }
  }, [mode, profile?.home_city_slug, loadSuggestions]);

  // Current city mode — use geolocation
  const detectCurrentCity = useCallback(async () => {
    setLocating(true);
    setLocationError(null);
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported on this device.');
      setLocating(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        const city = await resolveCoordinates(latitude, longitude);
        if (city) {
          setCitySlug(city.slug);
          setCityLabel(formatCityShort(city));
          loadSuggestions(city.slug);
        } else {
          setLocationError('Could not identify a nearby city from your location.');
        }
        setLocating(false);
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setLocationError('Location permission denied. Enable location access to see nearby players.');
        } else {
          setLocationError('Could not determine your location.');
        }
        setLocating(false);
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 },
    );
  }, [loadSuggestions]);

  // Switch to current city mode — auto-detect if not yet done
  useEffect(() => {
    if (mode === 'current' && !citySlug && !locating && !locationError) {
      detectCurrentCity();
    }
  }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleFollow = useCallback(async (userId: string) => {
    setSuggestions((prev) =>
      prev.map((s) => (s.user_id === userId ? { ...s, loading: true } : s)),
    );
    const result = await followUser(userId);
    setSuggestions((prev) =>
      prev.map((s) =>
        s.user_id === userId
          ? {
              ...s,
              loading: false,
              followState: result === 'following' ? 'following' : result === 'requested' ? 'requested' : s.followState,
            }
          : s,
      ),
    );
    if (result === 'following' || result === 'requested') {
      setFollowingSet((prev) => new Set(prev).add(userId));
    }
  }, []);

  const homeActive = mode === 'home';
  const currentActive = mode === 'current';
  const activeBtn = 'border border-[#c0911e]/50 bg-[#1a1408] text-[#f5e6b0]';
  const inactiveBtn = 'border border-transparent text-white/50 hover:text-white/70';

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* City mode toggle */}
      <div className="shrink-0 px-3 pt-2">
        <div className="flex items-center gap-1 rounded-lg border border-[#1a1f25] bg-[#0d1115] p-0.5">
          <button
            onClick={() => setMode('home')}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-[9px] font-bold tracking-wider uppercase transition-all ${homeActive ? activeBtn : inactiveBtn}`}
          >
            <MapPin className="h-3 w-3" strokeWidth={1.5} />
            Home City
          </button>
          <button
            onClick={() => setMode('current')}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-[9px] font-bold tracking-wider uppercase transition-all ${currentActive ? activeBtn : inactiveBtn}`}
          >
            <Navigation className="h-3 w-3" strokeWidth={1.5} />
            Current City
          </button>
        </div>
      </div>

      {/* City label */}
      <div className="shrink-0 px-3 pt-2">
        {cityLabel ? (
          <div className="flex items-center gap-1.5">
            <MapPin className="h-3 w-3 text-white/30" strokeWidth={1.5} />
            <span className="text-[11px] font-semibold text-white/60">{cityLabel}</span>
          </div>
        ) : mode === 'home' ? (
          <p className="text-[10px] leading-relaxed text-white/30">
            Set your Home City in your profile to see players near you.
          </p>
        ) : null}
      </div>

      {/* Content area */}
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2.5">
        {/* Home city with no slug */}
        {mode === 'home' && !profile?.home_city_slug && (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <MapPin className="mb-2 h-6 w-6 text-white/15" strokeWidth={1.5} />
            <p className="text-[10px] leading-relaxed text-white/35">
              No Home City set. Add one to your profile to discover local players.
            </p>
          </div>
        )}

        {/* Current city — locating */}
        {mode === 'current' && locating && (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <Loader2 className="mb-2 h-5 w-5 animate-spin" style={{ color: GOLD }} strokeWidth={1.5} />
            <p className="text-[10px] text-white/40">Finding your city...</p>
          </div>
        )}

        {/* Current city — error / permission needed */}
        {mode === 'current' && locationError && (
          <div className="flex flex-col items-center justify-center py-4 text-center">
            <Navigation className="mb-2 h-6 w-6 text-white/15" strokeWidth={1.5} />
            <p className="mb-3 text-[10px] leading-relaxed text-white/40">{locationError}</p>
            <button
              onClick={detectCurrentCity}
              className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-[9px] font-bold tracking-wider uppercase transition-all hover:scale-105"
              style={{ borderColor: BORDER, color: GOLD_SOFT, background: 'rgba(192,145,30,0.08)' }}
            >
              <Navigation className="h-3 w-3" strokeWidth={1.5} />
              Use My Location
            </button>
            <p className="mt-2 max-w-[200px] text-[8px] leading-relaxed text-white/25">
              Your precise location is not displayed or stored. Location is used only to identify your current city.
            </p>
          </div>
        )}

        {/* Current city — no slug yet, no error, not locating (shouldn't normally show) */}
        {mode === 'current' && !citySlug && !locating && !locationError && (
          <div className="flex flex-col items-center justify-center py-4 text-center">
            <p className="mb-3 text-[10px] leading-relaxed text-white/40">
              See SpotVault players in your current city.
            </p>
            <button
              onClick={detectCurrentCity}
              className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-[9px] font-bold tracking-wider uppercase transition-all hover:scale-105"
              style={{ borderColor: BORDER, color: GOLD_SOFT, background: 'rgba(192,145,30,0.08)' }}
            >
              <Navigation className="h-3 w-3" strokeWidth={1.5} />
              Use My Location
            </button>
            <p className="mt-2 max-w-[200px] text-[8px] leading-relaxed text-white/25">
              Your precise location is not displayed or stored. Location is used only to identify your current city.
            </p>
          </div>
        )}

        {/* Loading suggestions */}
        {loading && !locating && (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-4 w-4 animate-spin" style={{ color: GOLD }} strokeWidth={1.5} />
          </div>
        )}

        {/* Suggestions list */}
        {!loading && !locating && (citySlug || mode === 'home') && suggestions.length === 0 && cityLabel && (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <Users className="mb-2 h-6 w-6 text-white/15" strokeWidth={1.5} />
            <p className="text-[10px] leading-relaxed text-white/35">
              No SpotVault players found in {cityLabel} yet.
            </p>
          </div>
        )}

        {!loading && !locating && suggestions.length > 0 && (
          <div className="space-y-1.5">
            {suggestions.map((user) => (
              <SuggestionCard key={user.user_id} user={user} onFollow={handleFollow} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SuggestionCard({ user, onFollow }: { user: SuggestedUser; onFollow: (userId: string) => void }) {
  const initials = user.display_name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div
      className="flex items-center gap-2.5 rounded-lg border px-2.5 py-2"
      style={{ borderColor: 'rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}
    >
      {/* Avatar */}
      {user.avatar_url ? (
        <AvatarImg
          src={user.avatar_url}
          alt={user.display_name}
          className="h-8 w-8 shrink-0 rounded-full object-cover"
          style={{ objectPosition: user.avatar_url === '/assets/profiles/image copy 6.png' ? 'center 30%' : undefined }}
          fallback={<div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold text-white/70" style={{ borderColor: BORDER, background: 'rgba(212,165,44,0.08)' }}>{initials}</div>}
        />
      ) : (
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold text-white/70"
          style={{ borderColor: BORDER, background: 'rgba(212,165,44,0.08)' }}
        >
          {initials}
        </div>
      )}

      {/* Info */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-[11px] font-semibold text-white/80">{user.display_name}</p>
        {user.username && (
          <p className="truncate text-[9px] text-white/35">@{user.username}</p>
        )}
        {user.poker_role && (
          <p className="truncate text-[8px] text-white/25">{user.poker_role}</p>
        )}
      </div>

      {/* Follow button */}
      {user.followState === 'following' ? (
        <span className="flex shrink-0 items-center gap-1 rounded-md border border-[#4ade80]/20 bg-[#4ade80]/8 px-2 py-1 text-[8px] font-bold tracking-wider uppercase text-[#4ade80]">
          <Check className="h-3 w-3" strokeWidth={2} />
          Following
        </span>
      ) : user.followState === 'requested' ? (
        <span className="flex shrink-0 items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[8px] font-bold tracking-wider uppercase text-white/50">
          <Clock className="h-3 w-3" strokeWidth={1.5} />
          Requested
        </span>
      ) : (
        <button
          onClick={() => onFollow(user.user_id)}
          disabled={user.loading}
          className="flex shrink-0 items-center gap-1 rounded-md border px-2.5 py-1 text-[8px] font-bold tracking-wider uppercase transition-all hover:scale-105 disabled:opacity-50"
          style={{ borderColor: BORDER, color: GOLD_SOFT, background: 'rgba(192,145,30,0.1)' }}
        >
          {user.loading ? (
            <Loader2 className="h-3 w-3 animate-spin" strokeWidth={1.5} />
          ) : (
            <UserPlus className="h-3 w-3" strokeWidth={1.5} />
          )}
          Follow
        </button>
      )}
    </div>
  );
}
