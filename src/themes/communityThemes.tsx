export type CommunityThemeId = 'urban-park' | 'waterfront-promenade' | 'the-commons' | 'rooftop-social-club' | 'golf-course';

export interface CommunityTheme {
  id: CommunityThemeId;
  name: string;
  description: string;
}

export const COMMUNITY_THEMES: CommunityTheme[] = [
  {
    id: 'urban-park',
    name: 'Urban Park',
    description: 'Mature trees, grass, walking paths, distant skyline',
  },
  {
    id: 'waterfront-promenade',
    name: 'Waterfront Promenade',
    description: 'Boardwalk, water, pavilion, sunset atmosphere',
  },
  {
    id: 'the-commons',
    name: 'The Commons',
    description: 'Modern plaza, stone paving, civic gathering space',
  },
  {
    id: 'rooftop-social-club',
    name: 'Rooftop Social Club',
    description: 'Landscaped rooftop, skyline, pergolas, evening atmosphere',
  },
  {
    id: 'golf-course',
    name: 'Golf Course',
    description: 'Fairways, greens, bunkers, trees, country-club atmosphere',
  },
];

export const DEFAULT_COMMUNITY_THEME: CommunityThemeId = 'urban-park';

export const COMMUNITY_THEME_STORAGE_KEY = 'spotvault-community-theme';

export interface CommunityThemeSurface {
  panelBg: string;
  panelBgLight: string;
  cardBg: string;
  border: string;
  borderLight: string;
  accent: string;
  accentText: string;
  accentSoft: string;
  secondaryAccent: string;
  shadow: string;
  hoverBg: string;
  inputBg: string;
  tabActive: string;
}

export const COMMUNITY_THEME_SURFACES: Record<CommunityThemeId, CommunityThemeSurface> = {
  'urban-park': {
    panelBg: 'rgba(10, 12, 9, 0.82)',
    panelBgLight: 'rgba(14, 17, 12, 0.78)',
    cardBg: 'rgba(12, 15, 10, 0.85)',
    border: 'rgba(45, 55, 38, 0.35)',
    borderLight: 'rgba(60, 72, 50, 0.25)',
    accent: '#d4a52c',
    accentText: '#f5e6b0',
    accentSoft: 'rgba(212, 165, 44, 0.12)',
    secondaryAccent: 'rgba(120, 150, 90, 0.6)',
    shadow: '0 8px 32px rgba(0, 0, 0, 0.45), 0 0 1px rgba(80, 100, 60, 0.1)',
    hoverBg: 'rgba(20, 26, 18, 0.55)',
    inputBg: 'rgba(14, 18, 12, 0.7)',
    tabActive: 'rgba(212, 165, 44, 0.12)',
  },
  'waterfront-promenade': {
    panelBg: 'rgba(10, 13, 16, 0.80)',
    panelBgLight: 'rgba(14, 18, 22, 0.76)',
    cardBg: 'rgba(12, 16, 20, 0.83)',
    border: 'rgba(40, 55, 65, 0.35)',
    borderLight: 'rgba(55, 75, 85, 0.25)',
    accent: '#d4a52c',
    accentText: '#f5e6b0',
    accentSoft: 'rgba(212, 165, 44, 0.12)',
    secondaryAccent: 'rgba(80, 160, 170, 0.55)',
    shadow: '0 8px 32px rgba(0, 0, 0, 0.45), 0 0 1px rgba(60, 120, 130, 0.1)',
    hoverBg: 'rgba(18, 24, 28, 0.55)',
    inputBg: 'rgba(14, 20, 24, 0.7)',
    tabActive: 'rgba(212, 165, 44, 0.12)',
  },
  'the-commons': {
    panelBg: 'rgba(13, 14, 15, 0.82)',
    panelBgLight: 'rgba(18, 19, 21, 0.78)',
    cardBg: 'rgba(16, 17, 19, 0.85)',
    border: 'rgba(55, 52, 48, 0.35)',
    borderLight: 'rgba(75, 70, 62, 0.25)',
    accent: '#d4a52c',
    accentText: '#f5e6b0',
    accentSoft: 'rgba(212, 165, 44, 0.12)',
    secondaryAccent: 'rgba(170, 140, 90, 0.55)',
    shadow: '0 8px 32px rgba(0, 0, 0, 0.45), 0 0 1px rgba(120, 100, 70, 0.1)',
    hoverBg: 'rgba(24, 23, 22, 0.55)',
    inputBg: 'rgba(20, 20, 22, 0.7)',
    tabActive: 'rgba(212, 165, 44, 0.12)',
  },
  'rooftop-social-club': {
    panelBg: 'rgba(9, 8, 10, 0.84)',
    panelBgLight: 'rgba(14, 12, 14, 0.80)',
    cardBg: 'rgba(12, 10, 12, 0.87)',
    border: 'rgba(50, 42, 38, 0.35)',
    borderLight: 'rgba(70, 58, 50, 0.25)',
    accent: '#e0ad35',
    accentText: '#f5e6b0',
    accentSoft: 'rgba(224, 173, 53, 0.14)',
    secondaryAccent: 'rgba(180, 130, 80, 0.55)',
    shadow: '0 8px 32px rgba(0, 0, 0, 0.5), 0 0 1px rgba(140, 100, 60, 0.12)',
    hoverBg: 'rgba(20, 17, 18, 0.55)',
    inputBg: 'rgba(16, 13, 15, 0.7)',
    tabActive: 'rgba(224, 173, 53, 0.14)',
  },
  'golf-course': {
    panelBg: 'rgba(8, 12, 9, 0.62)',
    panelBgLight: 'rgba(12, 16, 12, 0.55)',
    cardBg: 'rgba(10, 14, 10, 0.66)',
    border: 'rgba(212, 168, 67, 0.20)',
    borderLight: 'rgba(120, 150, 90, 0.25)',
    accent: '#d4a52c',
    accentText: '#f5e6b0',
    accentSoft: 'rgba(212, 165, 44, 0.12)',
    secondaryAccent: 'rgba(90, 140, 70, 0.6)',
    shadow: '0 8px 30px rgba(0, 0, 0, 0.20)',
    hoverBg: 'rgba(20, 30, 18, 0.45)',
    inputBg: 'rgba(10, 16, 10, 0.6)',
    tabActive: 'rgba(212, 165, 44, 0.12)',
  },
};

export function CommunityThemeBackground({ themeId }: { themeId: CommunityThemeId }) {
  if (themeId === 'urban-park') return <UrbanParkBackground />;
  if (themeId === 'waterfront-promenade') return <WaterfrontPromenadeBackground />;
  if (themeId === 'the-commons') return <TheCommonsBackground />;
  if (themeId === 'rooftop-social-club') return <RooftopSocialClubBackground />;
  if (themeId === 'golf-course') return <GolfCourseBackground />;
  return null;
}

function UrbanParkBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Base — warm natural daylight sky */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(180deg, #2a2e28 0%, #3a3f36 15%, #44493e 30%, #4e534a 50%, #3e4338 75%, #2c3026 100%)',
        }}
      />

      {/* Sun glow — upper right, warm diffused */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 50% 40% at 78% 18%, rgba(180,150,90,0.18) 0%, transparent 70%)',
        }}
      />

      {/* Distant city skyline — far horizon */}
      <div
        className="absolute left-0 right-0"
        style={{
          bottom: '52%',
          height: '6%',
          background: 'linear-gradient(180deg, #3a3d33 0%, #2e312a 100%)',
          clipPath:
            'polygon(0% 100%, 0% 70%, 4% 70%, 4% 55%, 8% 55%, 8% 65%, 12% 65%, 12% 48%, 16% 48%, 16% 60%, 20% 60%, 20% 50%, 24% 50%, 24% 62%, 28% 62%, 28% 45%, 32% 45%, 32% 58%, 36% 58%, 36% 52%, 40% 52%, 40% 65%, 44% 65%, 44% 48%, 48% 48%, 48% 55%, 52% 55%, 52% 42%, 56% 42%, 56% 58%, 60% 58%, 60% 50%, 64% 50%, 64% 62%, 68% 62%, 68% 45%, 72% 45%, 72% 55%, 76% 55%, 76% 48%, 80% 48%, 80% 60%, 84% 60%, 84% 52%, 88% 52%, 88% 58%, 92% 58%, 92% 50%, 96% 50%, 96% 62%, 100% 62%, 100% 100%)',
          opacity: 0.5,
        }}
      />

      {/* Tree canopy — large mature trees, left side */}
      <div
        className="absolute"
        style={{
          left: '-5%',
          top: '20%',
          width: '40%',
          height: '55%',
          background:
            'radial-gradient(ellipse 60% 80% at 50% 40%, #1e2a1a 0%, #2a3522 30%, transparent 70%)',
          opacity: 0.7,
        }}
      />
      <div
        className="absolute"
        style={{
          left: '5%',
          top: '15%',
          width: '25%',
          height: '40%',
          background:
            'radial-gradient(ellipse 70% 90% at 40% 50%, #1a2418 0%, #242e1e 35%, transparent 75%)',
          opacity: 0.6,
        }}
      />

      {/* Tree canopy — right side */}
      <div
        className="absolute"
        style={{
          right: '-3%',
          top: '25%',
          width: '30%',
          height: '50%',
          background:
            'radial-gradient(ellipse 55% 75% at 55% 45%, #1e2a1a 0%, #2a3522 30%, transparent 70%)',
          opacity: 0.65,
        }}
      />

      {/* Grass field — foreground */}
      <div
        className="absolute bottom-0 left-0 right-0"
        style={{
          height: '48%',
          background:
            'linear-gradient(180deg, rgba(50,60,40,0.4) 0%, rgba(40,50,32,0.6) 30%, rgba(30,38,24,0.85) 70%, rgba(20,26,16,0.95) 100%)',
        }}
      />

      {/* Grass texture — subtle blades */}
      <div
        className="absolute bottom-0 left-0 right-0 opacity-[0.12]"
        style={{
          height: '48%',
          backgroundImage:
            'repeating-linear-gradient(85deg, rgba(80,100,60,0.3) 0px, transparent 2px, transparent 12px, rgba(70,90,50,0.2) 13px)',
        }}
      />

      {/* Walking path — curving through grass */}
      <div
        className="absolute"
        style={{
          bottom: '8%',
          left: '15%',
          width: '70%',
          height: '3%',
          background: 'linear-gradient(90deg, rgba(120,110,85,0.15) 0%, rgba(130,120,95,0.25) 50%, rgba(120,110,85,0.15) 100%)',
          borderRadius: '50%',
          filter: 'blur(3px)',
        }}
      />

      {/* Bench silhouettes */}
      <div
        className="absolute"
        style={{
          bottom: '18%',
          left: '22%',
          width: '8%',
          height: '2%',
          background: 'rgba(35,30,22,0.6)',
          borderRadius: '2px',
        }}
      />
      <div
        className="absolute"
        style={{
          bottom: '15%',
          right: '25%',
          width: '7%',
          height: '2%',
          background: 'rgba(35,30,22,0.5)',
          borderRadius: '2px',
        }}
      />

      {/* Modern pavilion — distant right */}
      <div
        className="absolute"
        style={{
          bottom: '40%',
          right: '12%',
          width: '14%',
          height: '10%',
          background: 'linear-gradient(180deg, rgba(60,65,58,0.4) 0%, rgba(40,45,38,0.6) 100%)',
          borderRadius: '4px 4px 0 0',
          opacity: 0.5,
        }}
      />

      {/* Light dappled shadows */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 30% 25% at 35% 55%, rgba(120,130,80,0.06) 0%, transparent 60%), radial-gradient(ellipse 25% 20% at 65% 50%, rgba(100,115,70,0.05) 0%, transparent 60%)',
        }}
      />

      {/* Vignette */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 95% 85% at 50% 50%, transparent 45%, rgba(15,18,12,0.22) 100%)',
        }}
      />
    </div>
  );
}

function WaterfrontPromenadeBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Late afternoon sky — warm sunset gradient */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(180deg, #2a1e16 0%, #3a2820 10%, #4a3228 20%, #5a3e2e 30%, #6a4a38 45%, #5a4030 60%, #3a2a20 80%, #1e1610 100%)',
        }}
      />

      {/* Sun glow — low on horizon */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 60% 35% at 50% 55%, rgba(200,130,70,0.22) 0%, transparent 70%)',
        }}
      />

      {/* Distant skyline — across water */}
      <div
        className="absolute left-0 right-0"
        style={{
          bottom: '42%',
          height: '7%',
          background: 'linear-gradient(180deg, #2a1e16 0%, #1a120e 100%)',
          clipPath:
            'polygon(0% 100%, 0% 75%, 3% 75%, 3% 60%, 6% 60%, 6% 70%, 9% 70%, 9% 50%, 12% 50%, 12% 65%, 15% 65%, 15% 55%, 18% 55%, 18% 72%, 21% 72%, 21% 45%, 24% 45%, 24% 60%, 27% 60%, 27% 52%, 30% 52%, 30% 68%, 33% 68%, 33% 40%, 36% 40%, 36% 55%, 39% 55%, 39% 48%, 42% 48%, 42% 62%, 45% 62%, 45% 35%, 48% 35%, 48% 52%, 51% 52%, 51% 45%, 54% 45%, 54% 58%, 57% 58%, 57% 42%, 60% 42%, 60% 55%, 63% 55%, 63% 48%, 66% 48%, 66% 62%, 69% 62%, 69% 50%, 72% 50%, 72% 58%, 75% 58%, 75% 45%, 78% 45%, 78% 55%, 81% 55%, 81% 62%, 84% 62%, 84% 50%, 87% 50%, 87% 55%, 90% 55%, 90% 65%, 93% 65%, 93% 52%, 96% 52%, 96% 60%, 100% 60%, 100% 100%)',
          opacity: 0.8,
        }}
      />

      {/* City light reflections on water — warm */}
      <div
        className="absolute left-0 right-0"
        style={{
          bottom: '28%',
          height: '14%',
          backgroundImage: `
            radial-gradient(1px 1px at 8% 30%, rgba(255,170,80,0.3), transparent 50%),
            radial-gradient(1px 1px at 14% 50%, rgba(255,160,70,0.25), transparent 50%),
            radial-gradient(1px 1px at 22% 35%, rgba(255,180,90,0.3), transparent 50%),
            radial-gradient(1px 1px at 30% 55%, rgba(255,165,75,0.2), transparent 50%),
            radial-gradient(1px 1px at 38% 40%, rgba(255,175,85,0.25), transparent 50%),
            radial-gradient(1px 1px at 46% 50%, rgba(255,170,80,0.2), transparent 50%),
            radial-gradient(1px 1px at 54% 35%, rgba(255,185,95,0.3), transparent 50%),
            radial-gradient(1px 1px at 62% 48%, rgba(255,165,75,0.2), transparent 50%),
            radial-gradient(1px 1px at 70% 42%, rgba(255,175,85,0.25), transparent 50%),
            radial-gradient(1px 1px at 78% 52%, rgba(255,170,80,0.2), transparent 50%),
            radial-gradient(1px 1px at 86% 38%, rgba(255,180,90,0.25), transparent 50%),
            radial-gradient(1px 1px at 94% 48%, rgba(255,165,75,0.2), transparent 50%)
          `,
        }}
      />

      {/* Water — reflective surface */}
      <div
        className="absolute bottom-0 left-0 right-0"
        style={{
          height: '42%',
          background:
            'linear-gradient(180deg, rgba(40,30,22,0.5) 0%, rgba(30,22,16,0.7) 30%, rgba(20,14,10,0.9) 70%, rgba(12,8,6,0.95) 100%)',
        }}
      />

      {/* Water shimmer — horizontal lines */}
      <div
        className="absolute bottom-0 left-0 right-0 opacity-[0.15]"
        style={{
          height: '42%',
          backgroundImage:
            'repeating-linear-gradient(0deg, transparent 0px, transparent 8px, rgba(200,140,80,0.15) 9px, transparent 10px)',
        }}
      />

      {/* Boardwalk / promenade — foreground edge */}
      <div
        className="absolute bottom-0 left-0 right-0"
        style={{
          height: '8%',
          background:
            'linear-gradient(180deg, rgba(45,38,30,0.7) 0%, rgba(30,25,20,0.9) 50%, rgba(20,16,12,0.95) 100%)',
        }}
      />

      {/* Boardwalk planks */}
      <div
        className="absolute bottom-0 left-0 right-0 opacity-[0.2]"
        style={{
          height: '8%',
          backgroundImage:
            'repeating-linear-gradient(90deg, transparent 0px, transparent 40px, rgba(60,50,38,0.4) 41px, transparent 42px)',
        }}
      />

      {/* Architectural pavilion — left side */}
      <div
        className="absolute"
        style={{
          bottom: '42%',
          left: '8%',
          width: '12%',
          height: '12%',
          background: 'linear-gradient(180deg, rgba(50,42,35,0.5) 0%, rgba(35,28,22,0.7) 100%)',
          borderRadius: '6px 6px 0 0',
          opacity: 0.6,
        }}
      />

      {/* Vignette */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 95% 85% at 50% 50%, transparent 45%, rgba(12,8,6,0.22) 100%)',
        }}
      />
    </div>
  );
}

function TheCommonsBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Base — cool civic stone atmosphere */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(180deg, #2a2d30 0%, #323639 15%, #3a3e42 30%, #3e4347 50%, #363a3e 70%, #2a2d30 85%, #1e2024 100%)',
        }}
      />

      {/* Overhead canopy light — diffused from above */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 70% 50% at 50% 0%, rgba(120,130,140,0.12) 0%, transparent 60%)',
        }}
      />

      {/* Surrounding modern buildings — left */}
      <div
        className="absolute"
        style={{
          left: 0,
          top: 0,
          width: '22%',
          height: '70%',
          background:
            'linear-gradient(90deg, rgba(30,33,36,0.9) 0%, rgba(40,44,48,0.6) 60%, transparent 100%)',
        }}
      />
      {/* Building windows — left */}
      <div
        className="absolute opacity-[0.15]"
        style={{
          left: '2%',
          top: '8%',
          width: '16%',
          height: '55%',
          backgroundImage: `
            radial-gradient(1px 1px at 20% 15%, rgba(180,190,200,0.4), transparent 50%),
            radial-gradient(1px 1px at 40% 25%, rgba(170,180,190,0.3), transparent 50%),
            radial-gradient(1px 1px at 60% 35%, rgba(180,190,200,0.35), transparent 50%),
            radial-gradient(1px 1px at 30% 45%, rgba(160,170,180,0.3), transparent 50%),
            radial-gradient(1px 1px at 50% 55%, rgba(180,190,200,0.35), transparent 50%),
            radial-gradient(1px 1px at 70% 65%, rgba(170,180,190,0.3), transparent 50%),
            radial-gradient(1px 1px at 25% 75%, rgba(180,190,200,0.25), transparent 50%),
            radial-gradient(1px 1px at 55% 85%, rgba(160,170,180,0.2), transparent 50%)
          `,
        }}
      />

      {/* Surrounding modern buildings — right */}
      <div
        className="absolute"
        style={{
          right: 0,
          top: 0,
          width: '20%',
          height: '70%',
          background:
            'linear-gradient(270deg, rgba(30,33,36,0.9) 0%, rgba(40,44,48,0.6) 60%, transparent 100%)',
        }}
      />
      {/* Building windows — right */}
      <div
        className="absolute opacity-[0.15]"
        style={{
          right: '2%',
          top: '10%',
          width: '14%',
          height: '55%',
          backgroundImage: `
            radial-gradient(1px 1px at 30% 15%, rgba(180,190,200,0.35), transparent 50%),
            radial-gradient(1px 1px at 50% 25%, rgba(170,180,190,0.3), transparent 50%),
            radial-gradient(1px 1px at 70% 35%, rgba(180,190,200,0.35), transparent 50%),
            radial-gradient(1px 1px at 40% 45%, rgba(160,170,180,0.3), transparent 50%),
            radial-gradient(1px 1px at 60% 55%, rgba(180,190,200,0.3), transparent 50%),
            radial-gradient(1px 1px at 35% 65%, rgba(170,180,190,0.25), transparent 50%),
            radial-gradient(1px 1px at 55% 75%, rgba(180,190,200,0.25), transparent 50%)
          `,
        }}
      />

      {/* Large architectural canopy — overhead structure */}
      <div
        className="absolute"
        style={{
          top: '8%',
          left: '15%',
          right: '15%',
          height: '12%',
          background:
            'linear-gradient(180deg, rgba(50,55,60,0.3) 0%, rgba(40,44,48,0.15) 100%)',
          borderRadius: '4px',
        }}
      />

      {/* Stone paving — foreground floor */}
      <div
        className="absolute bottom-0 left-0 right-0"
        style={{
          height: '40%',
          background:
            'linear-gradient(180deg, rgba(45,49,53,0.5) 0%, rgba(35,39,42,0.7) 30%, rgba(25,28,31,0.9) 70%, rgba(18,20,23,0.95) 100%)',
        }}
      />

      {/* Stone tile pattern */}
      <div
        className="absolute bottom-0 left-0 right-0 opacity-[0.12]"
        style={{
          height: '40%',
          backgroundImage:
            'repeating-linear-gradient(90deg, transparent 0px, transparent 60px, rgba(80,85,90,0.3) 61px, transparent 62px), repeating-linear-gradient(0deg, transparent 0px, transparent 60px, rgba(80,85,90,0.3) 61px, transparent 62px)',
        }}
      />

      {/* Trees integrated into architecture */}
      <div
        className="absolute"
        style={{
          bottom: '25%',
          left: '20%',
          width: '12%',
          height: '35%',
          background:
            'radial-gradient(ellipse 50% 70% at 50% 60%, rgba(30,40,28,0.5) 0%, transparent 70%)',
        }}
      />
      <div
        className="absolute"
        style={{
          bottom: '25%',
          right: '22%',
          width: '10%',
          height: '30%',
          background:
            'radial-gradient(ellipse 50% 70% at 50% 60%, rgba(30,40,28,0.45) 0%, transparent 70%)',
        }}
      />

      {/* Public seating — low stone benches */}
      <div
        className="absolute"
        style={{
          bottom: '12%',
          left: '30%',
          width: '15%',
          height: '1.5%',
          background: 'rgba(50,55,60,0.4)',
          borderRadius: '3px',
        }}
      />
      <div
        className="absolute"
        style={{
          bottom: '12%',
          right: '30%',
          width: '15%',
          height: '1.5%',
          background: 'rgba(50,55,60,0.4)',
          borderRadius: '3px',
        }}
      />

      {/* Vignette */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 90% 80% at 50% 50%, transparent 50%, rgba(15,17,20,0.22) 100%)',
        }}
      />
    </div>
  );
}

function GolfCourseBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: 'url(https://images.pexels.com/photos/19071701/pexels-photo-19071701.jpeg?auto=compress&cs=tinysrgb&w=1920)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          backgroundAttachment: 'fixed',
        }}
      />
      <div
        className="absolute inset-0"
        style={{ background: 'rgba(5, 8, 6, 0.15)' }}
      />
    </div>
  );
}

function RooftopSocialClubBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Evening sky — deep dusk with warm glow */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(180deg, #1a1620 0%, #241e28 10%, #2e2630 25%, #382e38 40%, #3a2e34 55%, #302528 70%, #221a1e 85%, #14101a 100%)',
        }}
      />

      {/* Warm horizon glow — city light from below */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 70% 30% at 50% 65%, rgba(180,120,70,0.15) 0%, transparent 70%)',
        }}
      />

      {/* City skyline — mid-distance, glowing windows */}
      <div
        className="absolute left-0 right-0"
        style={{
          bottom: '38%',
          height: '18%',
          background: 'linear-gradient(180deg, #1a141e 0%, #0e0a12 100%)',
          clipPath:
            'polygon(0% 100%, 0% 80%, 4% 80%, 4% 60%, 8% 60%, 8% 75%, 12% 75%, 12% 50%, 16% 50%, 16% 65%, 20% 65%, 20% 40%, 24% 40%, 24% 58%, 28% 58%, 28% 45%, 32% 45%, 32% 70%, 36% 70%, 36% 35%, 40% 35%, 40% 55%, 44% 55%, 44% 48%, 48% 48%, 48% 68%, 52% 68%, 52% 30%, 56% 30%, 56% 52%, 60% 52%, 60% 42%, 64% 42%, 64% 62%, 68% 62%, 68% 38%, 72% 38%, 72% 55%, 76% 55%, 76% 48%, 80% 48%, 80% 65%, 84% 65%, 84% 45%, 88% 45%, 88% 58%, 92% 58%, 92% 50%, 96% 50%, 96% 68%, 100% 68%, 100% 100%)',
          opacity: 0.85,
        }}
      />

      {/* City lights — warm window glow */}
      <div
        className="absolute left-0 right-0"
        style={{
          bottom: '38%',
          height: '18%',
          backgroundImage: `
            radial-gradient(1px 1px at 6% 45%, rgba(255,170,80,0.5), transparent 50%),
            radial-gradient(1px 1px at 10% 55%, rgba(255,160,70,0.4), transparent 50%),
            radial-gradient(1px 1px at 14% 40%, rgba(255,180,90,0.5), transparent 50%),
            radial-gradient(1px 1px at 18% 60%, rgba(255,165,75,0.4), transparent 50%),
            radial-gradient(1px 1px at 22% 48%, rgba(255,175,85,0.45), transparent 50%),
            radial-gradient(1px 1px at 26% 52%, rgba(255,170,80,0.4), transparent 50%),
            radial-gradient(1px 1px at 30% 42%, rgba(255,185,95,0.5), transparent 50%),
            radial-gradient(1px 1px at 34% 58%, rgba(255,160,70,0.4), transparent 50%),
            radial-gradient(1px 1px at 38% 48%, rgba(255,175,85,0.45), transparent 50%),
            radial-gradient(1px 1px at 42% 55%, rgba(255,170,80,0.4), transparent 50%),
            radial-gradient(1px 1px at 46% 45%, rgba(255,180,90,0.5), transparent 50%),
            radial-gradient(1px 1px at 50% 52%, rgba(255,165,75,0.4), transparent 50%),
            radial-gradient(1px 1px at 54% 40%, rgba(255,175,85,0.45), transparent 50%),
            radial-gradient(1px 1px at 58% 55%, rgba(255,170,80,0.4), transparent 50%),
            radial-gradient(1px 1px at 62% 48%, rgba(255,185,95,0.5), transparent 50%),
            radial-gradient(1px 1px at 66% 52%, rgba(255,160,70,0.4), transparent 50%),
            radial-gradient(1px 1px at 70% 42%, rgba(255,175,85,0.45), transparent 50%),
            radial-gradient(1px 1px at 74% 55%, rgba(255,170,80,0.4), transparent 50%),
            radial-gradient(1px 1px at 78% 48%, rgba(255,180,90,0.5), transparent 50%),
            radial-gradient(1px 1px at 82% 52%, rgba(255,165,75,0.4), transparent 50%),
            radial-gradient(1px 1px at 86% 45%, rgba(255,175,85,0.45), transparent 50%),
            radial-gradient(1px 1px at 90% 55%, rgba(255,170,80,0.4), transparent 50%),
            radial-gradient(1px 1px at 94% 48%, rgba(255,180,90,0.5), transparent 50%)
          `,
          opacity: 0.7,
        }}
      />

      {/* Rooftop floor — paved surface */}
      <div
        className="absolute bottom-0 left-0 right-0"
        style={{
          height: '38%',
          background:
            'linear-gradient(180deg, rgba(30,26,30,0.6) 0%, rgba(22,18,22,0.8) 30%, rgba(16,12,16,0.92) 70%, rgba(10,8,12,0.95) 100%)',
        }}
      />

      {/* Rooftop paving texture */}
      <div
        className="absolute bottom-0 left-0 right-0 opacity-[0.1]"
        style={{
          height: '38%',
          backgroundImage:
            'repeating-linear-gradient(90deg, transparent 0px, transparent 50px, rgba(60,55,60,0.3) 51px, transparent 52px)',
        }}
      />

      {/* Planters with trees — left */}
      <div
        className="absolute"
        style={{
          bottom: '30%',
          left: '5%',
          width: '10%',
          height: '20%',
          background:
            'radial-gradient(ellipse 60% 80% at 50% 60%, rgba(20,28,20,0.5) 0%, transparent 70%)',
        }}
      />

      {/* Planters with trees — right */}
      <div
        className="absolute"
        style={{
          bottom: '30%',
          right: '5%',
          width: '10%',
          height: '20%',
          background:
            'radial-gradient(ellipse 60% 80% at 50% 60%, rgba(20,28,20,0.45) 0%, transparent 70%)',
        }}
      />

      {/* Modern pergola — overhead structure */}
      <div
        className="absolute"
        style={{
          top: '12%',
          left: '20%',
          right: '20%',
          height: '10%',
          background:
            'linear-gradient(180deg, rgba(40,35,40,0.25) 0%, transparent 100%)',
        }}
      />
      {/* Pergola slats */}
      <div
        className="absolute opacity-[0.2]"
        style={{
          top: '12%',
          left: '20%',
          right: '20%',
          height: '4%',
          backgroundImage:
            'repeating-linear-gradient(90deg, transparent 0px, transparent 30px, rgba(80,70,80,0.4) 31px, transparent 32px)',
        }}
      />

      {/* Fire feature — warm glow */}
      <div
        className="absolute"
        style={{
          bottom: '15%',
          left: '42%',
          width: '16%',
          height: '4%',
          background:
            'radial-gradient(ellipse 60% 100% at 50% 100%, rgba(200,100,50,0.18) 0%, transparent 70%)',
        }}
      />

      {/* Lounge seating silhouettes */}
      <div
        className="absolute"
        style={{
          bottom: '14%',
          left: '28%',
          width: '10%',
          height: '3%',
          background: 'rgba(25,20,25,0.5)',
          borderRadius: '4px',
        }}
      />
      <div
        className="absolute"
        style={{
          bottom: '14%',
          right: '28%',
          width: '10%',
          height: '3%',
          background: 'rgba(25,20,25,0.5)',
          borderRadius: '4px',
        }}
      />

      {/* Vignette */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 95% 85% at 50% 50%, transparent 45%, rgba(10,8,14,0.22) 100%)',
        }}
      />
    </div>
  );
}
