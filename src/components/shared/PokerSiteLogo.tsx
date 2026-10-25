import { MapPin, Spade } from 'lucide-react';

interface SiteStyle {
  label: string;
  bg: string;
  text: string;
  logo?: string;
}

const SITE_STYLES: Record<string, SiteStyle> = {
  ggpoker: { label: 'GGPoker', bg: '#f4f4f4', text: '#111111', logo: '/assets/poker-sites/image.webp' },
  pokerstars: { label: 'PokerStars', bg: '#111318', text: '#ffffff', logo: '/assets/poker-sites/image copy.webp' },
  acr: { label: 'ACR Poker', bg: '#000000', text: '#ffffff', logo: '/assets/poker-sites/image copy 2.webp' },
  coinpoker: { label: 'CoinPoker', bg: '#101116', text: '#ffffff', logo: '/assets/poker-sites/image copy 3.webp' },
  wpt_global: { label: 'WPT Global', bg: '#1a1a2e', text: '#6b8afd' },
  '888poker': { label: '888poker', bg: '#1a2a2a', text: '#5ec8d4' },
  partypoker: { label: 'PartyPoker', bg: '#2a1a2a', text: '#c850d4' },
  wsop: { label: 'WSOP', bg: '#1a2a1a', text: '#c8d450' },
  live_poker: { label: 'Live Poker', bg: '#1a1a1a', text: '#8a93a2' },
};

function normalizeSite(site: string | null | undefined): string | null {
  const normalized = site?.trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (!normalized) return null;
  if (['gg', 'ggpoker', 'gg_poker'].includes(normalized)) return 'ggpoker';
  if (['pokerstars', 'poker_stars', 'stars'].includes(normalized)) return 'pokerstars';
  if (['acr', 'acr_poker', 'americas_cardroom'].includes(normalized)) return 'acr';
  if (['coinpoker', 'coin_poker'].includes(normalized)) return 'coinpoker';
  return normalized;
}

export function PokerSiteLogo({ site, size = 36 }: { site: string | null | undefined; size?: number }) {
  const normalizedSite = normalizeSite(site);
  const style = normalizedSite ? SITE_STYLES[normalizedSite] : undefined;

  if (!style) {
    return (
      <div className="flex items-center justify-center rounded-xl border" style={{ width: size, height: size, background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(192,145,30,0.12)' }}>
        <Spade style={{ color: 'rgba(192,145,30,0.4)' }} strokeWidth={1.5} size={size * 0.5} />
      </div>
    );
  }

  return (
    <div
      className="flex items-center justify-center overflow-hidden rounded-xl border"
      style={{ width: size, height: size, background: style.bg, borderColor: 'rgba(192,145,30,0.15)' }}
      title={style.label}
    >
      {style.logo ? (
        <img src={style.logo} alt={`${style.label} logo`} className="h-full w-full object-contain" />
      ) : normalizedSite === 'live_poker' ? (
        <MapPin style={{ color: style.text }} strokeWidth={1.5} size={size * 0.4} />
      ) : (
        <span style={{ color: style.text, fontSize: size * 0.28, fontWeight: 800, lineHeight: 1 }}>{style.label}</span>
      )}
    </div>
  );
}
