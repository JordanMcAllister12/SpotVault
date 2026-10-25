// Isolated mini playing card for the inline Hand History Replayer.
// Card faces are rendered by the shared PremiumCardFace SVG component so they
// match the full-size table cards exactly (resolution, shadow, typography,
// suit rendering). Card backs are unchanged.

import { PremiumCardFace } from './PremiumCardFace';

export function MiniPlayingCard({ card, hero = false }: { card: string; hero?: boolean; mobile?: boolean }) {
  const w = hero ? 50 : 41;
  const h = hero ? 70 : 59;
  return <PremiumCardFace card={card} width={w} height={h} hero={hero} />;
}

export function MiniCardBack({ hero = false }: { hero?: boolean; mobile?: boolean }) {
  const w = hero ? 50 : 41;
  const h = hero ? 70 : 59;
  return (
    <div
      className="mini-playing-card-back"
      style={{
        width: w,
        height: h,
        borderRadius: 7,
        flexShrink: 0,
        overflow: 'hidden',
        boxShadow: '0 3px 10px rgba(0,0,0,0.55)',
        position: 'relative',
      }}
    >
      <img
        src="/assets/images/image copy copy.png"
        alt="card back"
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          objectPosition: 'center center',
          borderRadius: 6,
        }}
      />
    </div>
  );
}
