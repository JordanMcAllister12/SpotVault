export type InvestorThemeId = 'executive-office' | 'glass-tower-vancouver' | 'glass-tower-toronto' | 'the-vault';

export interface InvestorTheme {
  id: InvestorThemeId;
  name: string;
  description: string;
}

export const INVESTOR_THEMES: InvestorTheme[] = [
  {
    id: 'executive-office',
    name: 'Executive Office',
    description: 'Luxurious modern office with nighttime city views',
  },
  {
    id: 'glass-tower-vancouver',
    name: 'Glass Tower — Vancouver',
    description: 'High-rise glass office above Vancouver at dusk',
  },
  {
    id: 'glass-tower-toronto',
    name: 'Glass Tower — Toronto',
    description: 'Capital office above the financial district at night',
  },
  {
    id: 'the-vault',
    name: 'The Vault',
    description: 'Secure capital command center inside the vault',
  },
];

export const DEFAULT_INVESTOR_THEME: InvestorThemeId = 'executive-office';

export function InvestorThemeBackground({ themeId }: { themeId: InvestorThemeId }) {
  if (themeId === 'executive-office') return <ExecutiveOfficeBackground />;
  if (themeId === 'glass-tower-vancouver') return <GlassTowerVancouverBackground />;
  if (themeId === 'glass-tower-toronto') return <GlassTowerTorontoBackground />;
  if (themeId === 'the-vault') return <TheVaultBackground />;
  return null;
}

function ExecutiveOfficeBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Base warm charcoal room */}
      <div className="absolute inset-0 bg-[#0a0807]" />

      {/* Warm ceiling light */}
      <div
        className="absolute inset-x-0 top-0 h-[40%]"
        style={{
          background:
            'radial-gradient(ellipse 65% 90% at 50% 0%, rgba(95,68,36,0.13) 0%, transparent 70%)',
        }}
      />

      {/* Floor-to-ceiling windows — right wall */}
      <div className="absolute inset-y-0 right-0 w-[44%]">
        {/* Glass base — dark with faint warmth */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(90deg, rgba(10,8,7,0.98) 0%, rgba(14,11,9,0.92) 12%, rgba(20,15,12,0.82) 100%)',
          }}
        />

        {/* Distant city lights — warm amber tones */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `
              radial-gradient(1.5px 1.5px at 10% 44%, rgba(255,190,110,0.5), transparent 50%),
              radial-gradient(1px 1px at 16% 50%, rgba(255,200,120,0.4), transparent 50%),
              radial-gradient(1.5px 1.5px at 22% 47%, rgba(255,180,100,0.45), transparent 50%),
              radial-gradient(1px 1px at 28% 53%, rgba(255,210,130,0.35), transparent 50%),
              radial-gradient(1px 1px at 34% 49%, rgba(255,190,110,0.4), transparent 50%),
              radial-gradient(1.5px 1.5px at 40% 56%, rgba(255,200,120,0.3), transparent 50%),
              radial-gradient(1px 1px at 46% 46%, rgba(255,180,100,0.35), transparent 50%),
              radial-gradient(1px 1px at 52% 52%, rgba(255,210,140,0.3), transparent 50%),
              radial-gradient(1.5px 1.5px at 58% 49%, rgba(255,190,110,0.4), transparent 50%),
              radial-gradient(1px 1px at 64% 54%, rgba(255,200,120,0.35), transparent 50%),
              radial-gradient(1px 1px at 70% 47%, rgba(255,180,100,0.3), transparent 50%),
              radial-gradient(1.5px 1.5px at 76% 51%, rgba(255,210,130,0.4), transparent 50%),
              radial-gradient(1px 1px at 82% 55%, rgba(255,190,110,0.35), transparent 50%),
              radial-gradient(1px 1px at 88% 49%, rgba(255,200,120,0.3), transparent 50%),
              radial-gradient(1.5px 1.5px at 94% 53%, rgba(255,180,100,0.35), transparent 50%),
              radial-gradient(1px 1px at 7% 61%, rgba(255,200,120,0.3), transparent 50%),
              radial-gradient(1px 1px at 14% 66%, rgba(255,190,110,0.25), transparent 50%),
              radial-gradient(1px 1px at 21% 70%, rgba(255,210,130,0.2), transparent 50%),
              radial-gradient(1px 1px at 31% 73%, rgba(255,180,100,0.2), transparent 50%),
              radial-gradient(1px 1px at 44% 76%, rgba(255,200,120,0.15), transparent 50%),
              radial-gradient(1px 1px at 56% 71%, rgba(255,190,110,0.2), transparent 50%),
              radial-gradient(1px 1px at 68% 67%, rgba(255,210,130,0.25), transparent 50%),
              radial-gradient(1px 1px at 80% 73%, rgba(255,200,120,0.15), transparent 50%),
              radial-gradient(1px 1px at 90% 69%, rgba(255,190,110,0.2), transparent 50%)
            `,
            opacity: 0.75,
          }}
        />

        {/* Building silhouettes — horizontal banding */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(180deg, transparent 33%, rgba(7,5,4,0.35) 42%, rgba(7,5,4,0.5) 52%, transparent 72%)',
          }}
        />

        {/* Window mullions — vertical dividers */}
        <div className="absolute inset-0 flex justify-around px-[6%] opacity-25">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-full w-px bg-[#1a1510]" />
          ))}
        </div>
        {/* Horizontal mullions */}
        <div className="absolute inset-x-0 top-[12%] h-px bg-[#1a1510] opacity-25" />
        <div className="absolute inset-x-0 bottom-[12%] h-px bg-[#1a1510] opacity-25" />

        {/* Window frame edges */}
        <div className="absolute inset-y-0 left-0 w-[2px] bg-[#15110d]" />
        <div className="absolute inset-y-0 right-0 w-[2px] bg-[#15110d]" />
      </div>

      {/* Dark wood floor */}
      <div
        className="absolute bottom-0 left-0 right-0 h-[16%]"
        style={{
          background:
            'linear-gradient(180deg, rgba(24,17,11,0.55) 0%, rgba(16,11,7,0.85) 50%, rgba(10,7,5,0.95) 100%)',
        }}
      />
      {/* Wood grain */}
      <div
        className="absolute bottom-0 left-0 right-0 h-[16%] opacity-[0.18]"
        style={{
          backgroundImage:
            'repeating-linear-gradient(90deg, rgba(42,30,18,0.35) 0px, transparent 1px, transparent 90px, rgba(42,30,18,0.25) 91px)',
        }}
      />
      {/* Warm floor reflection from windows */}
      <div
        className="absolute bottom-0 right-0 h-[16%] w-[44%]"
        style={{
          background:
            'linear-gradient(180deg, rgba(70,46,22,0.07) 0%, transparent 100%)',
        }}
      />

      {/* Left wall shadow for depth */}
      <div
        className="absolute inset-y-0 left-0 w-[18%]"
        style={{
          background:
            'linear-gradient(90deg, rgba(16,12,9,0.55) 0%, transparent 100%)',
        }}
      />

      {/* Vignette for depth recession */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 95% 85% at 50% 50%, transparent 35%, rgba(4,3,2,0.55) 100%)',
        }}
      />
    </div>
  );
}

function GlassTowerVancouverBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: "url('/assets/investor-glass-tower-vancouver.webp')",
          backgroundSize: 'cover',
          backgroundPosition: 'center center',
          backgroundRepeat: 'no-repeat',
        }}
      />
    </div>
  );
}

function GlassTowerTorontoBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* ===== Full-bleed photographic background ===== */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: 'url(/glass-tower-toronto.webp)' }}
      />
      {/* Very light dark gradient for depth — keeps skyline clearly visible */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(180deg, rgba(0,0,0,0.10) 0%, transparent 20%, transparent 80%, rgba(0,0,0,0.15) 100%)',
        }}
      />
    </div>
  );
}


function TheVaultBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* ===== Base — graphite vault atmosphere ===== */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(180deg, #0a0908 0%, #0c0a09 20%, #0e0c0a 40%, #0b0a08 65%, #070605 100%)',
        }}
      />

      {/* ===== Massive circular vault architecture — background ===== */}
      {/* Outer vault ring — huge gear/portal structure */}
      <div
        className="absolute"
        style={{
          top: '-15%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '130%',
          aspectRatio: '1',
          borderRadius: '50%',
          background:
            'radial-gradient(circle, transparent 58%, rgba(20,18,16,0.4) 62%, rgba(28,25,22,0.5) 66%, transparent 70%)',
        }}
      />
      {/* Vault ring inner edge — gunmetal */}
      <div
        className="absolute"
        style={{
          top: '-12%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '120%',
          aspectRatio: '1',
          borderRadius: '50%',
          border: '2px solid rgba(40,36,33,0.4)',
          boxShadow: 'inset 0 0 60px rgba(0,0,0,0.5)',
        }}
      />
      {/* Vault concentric rings — structural depth */}
      <div
        className="absolute"
        style={{
          top: '-8%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '108%',
          aspectRatio: '1',
          borderRadius: '50%',
          border: '1px solid rgba(50,45,41,0.25)',
        }}
      />
      <div
        className="absolute"
        style={{
          top: '-5%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '96%',
          aspectRatio: '1',
          borderRadius: '50%',
          border: '1px solid rgba(45,40,37,0.2)',
        }}
      />

      {/* Vault door seam — central vertical split */}
      <div
        className="absolute"
        style={{
          top: '-15%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '2px',
          height: '65%',
          background:
            'linear-gradient(180deg, transparent 0%, rgba(15,13,12,0.6) 15%, rgba(10,9,8,0.7) 50%, rgba(15,13,12,0.6) 85%, transparent 100%)',
        }}
      />

      {/* Vault locking mechanism — radial bolts */}
      {Array.from({ length: 12 }).map((_, i) => {
        const angle = (i * 30 - 90) * (Math.PI / 180);
        const radius = 52;
        const x = 50 + Math.cos(angle) * radius;
        const y = 18 + Math.sin(angle) * radius;
        return (
          <div
            key={`bolt-${i}`}
            className="absolute"
            style={{
              left: `${x}%`,
              top: `${y}%`,
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: 'rgba(35,32,29,0.5)',
              boxShadow: '0 0 3px rgba(0,0,0,0.4)',
              transform: 'translate(-50%, -50%)',
            }}
          />
        );
      })}

      {/* ===== Vault wall panels — brushed steel charcoal ===== */}
      {/* Left wall panel */}
      <div
        className="absolute"
        style={{
          top: '8%',
          left: '0',
          width: '18%',
          height: '72%',
          background:
            'linear-gradient(135deg, rgba(18,16,15,0.5) 0%, rgba(12,11,10,0.3) 100%)',
          borderRight: '1px solid rgba(40,36,33,0.3)',
        }}
      />
      {/* Right wall panel */}
      <div
        className="absolute"
        style={{
          top: '8%',
          right: '0',
          width: '18%',
          height: '72%',
          background:
            'linear-gradient(225deg, rgba(18,16,15,0.5) 0%, rgba(12,11,10,0.3) 100%)',
          borderLeft: '1px solid rgba(40,36,33,0.3)',
        }}
      />

      {/* Structural seams — horizontal */}
      <div className="absolute inset-x-0 top-[15%] h-px bg-[#2a2622]/20" />
      <div className="absolute inset-x-0 top-[55%] h-px bg-[#2a2622]/15" />
      <div className="absolute inset-x-0 top-[75%] h-px bg-[#2a2622]/20" />

      {/* ===== Recessed wall lighting — subtle gold ===== */}
      {/* Left wall light strip */}
      <div
        className="absolute"
        style={{
          top: '20%',
          left: '16%',
          width: '2px',
          height: '50%',
          background:
            'linear-gradient(180deg, transparent 0%, rgba(192,145,30,0.12) 20%, rgba(192,145,30,0.15) 50%, rgba(192,145,30,0.12) 80%, transparent 100%)',
          boxShadow: '0 0 8px rgba(192,145,30,0.06)',
        }}
      />
      {/* Right wall light strip */}
      <div
        className="absolute"
        style={{
          top: '20%',
          right: '16%',
          width: '2px',
          height: '50%',
          background:
            'linear-gradient(180deg, transparent 0%, rgba(192,145,30,0.12) 20%, rgba(192,145,30,0.15) 50%, rgba(192,145,30,0.12) 80%, transparent 100%)',
          boxShadow: '0 0 8px rgba(192,145,30,0.06)',
        }}
      />

      {/* ===== Built-in information displays — vault wall screens ===== */}
      {/* Left display panel */}
      <div
        className="absolute"
        style={{
          top: '25%',
          left: '3%',
          width: '11%',
          height: '22%',
          background:
            'linear-gradient(180deg, rgba(15,14,13,0.7) 0%, rgba(8,7,6,0.8) 100%)',
          border: '1px solid rgba(45,40,37,0.25)',
          borderRadius: '2px',
          boxShadow: 'inset 0 0 20px rgba(0,0,0,0.4)',
        }}
      >
        {/* Screen content — faint data lines */}
        <div
          className="absolute inset-0"
          style={{
            padding: '8px 6px',
            backgroundImage: `
              linear-gradient(180deg, transparent 10%, rgba(192,145,30,0.06) 11%, transparent 12%, transparent 18%, rgba(192,145,30,0.04) 19%, transparent 20%, transparent 28%, rgba(192,145,30,0.05) 29%, transparent 30%, transparent 40%, rgba(192,145,30,0.04) 41%, transparent 42%, transparent 55%, rgba(192,145,30,0.06) 56%, transparent 57%, transparent 70%, rgba(192,145,30,0.04) 71%, transparent 72%, transparent 85%, rgba(192,145,30,0.05) 86%, transparent 87%)
            `,
          }}
        />
        {/* Active status indicator */}
        <div
          className="absolute"
          style={{
            top: '6px',
            right: '6px',
            width: '4px',
            height: '4px',
            borderRadius: '50%',
            background: 'rgba(192,145,30,0.5)',
            boxShadow: '0 0 4px rgba(192,145,30,0.3)',
          }}
        />
      </div>

      {/* Right display panel */}
      <div
        className="absolute"
        style={{
          top: '25%',
          right: '3%',
          width: '11%',
          height: '22%',
          background:
            'linear-gradient(180deg, rgba(15,14,13,0.7) 0%, rgba(8,7,6,0.8) 100%)',
          border: '1px solid rgba(45,40,37,0.25)',
          borderRadius: '2px',
          boxShadow: 'inset 0 0 20px rgba(0,0,0,0.4)',
        }}
      >
        <div
          className="absolute inset-0"
          style={{
            padding: '8px 6px',
            backgroundImage: `
              linear-gradient(180deg, transparent 15%, rgba(192,145,30,0.05) 16%, transparent 17%, transparent 25%, rgba(192,145,30,0.04) 26%, transparent 27%, transparent 38%, rgba(192,145,30,0.06) 39%, transparent 40%, transparent 52%, rgba(192,145,30,0.04) 53%, transparent 54%, transparent 66%, rgba(192,145,30,0.05) 67%, transparent 68%, transparent 80%, rgba(192,145,30,0.04) 81%, transparent 82%)
            `,
          }}
        />
        <div
          className="absolute"
          style={{
            top: '6px',
            right: '6px',
            width: '4px',
            height: '4px',
            borderRadius: '50%',
            background: 'rgba(192,145,30,0.5)',
            boxShadow: '0 0 4px rgba(192,145,30,0.3)',
          }}
        />
      </div>

      {/* ===== SV monogram — embossed into vault wall, center background ===== */}
      <div
        className="absolute"
        style={{
          top: '14%',
          left: '50%',
          transform: 'translateX(-50%)',
          fontSize: '72px',
          fontWeight: 700,
          letterSpacing: '0.15em',
          color: 'rgba(40,36,33,0.18)',
          textShadow: '0 0 1px rgba(0,0,0,0.3)',
          fontFamily: 'system-ui, sans-serif',
          lineHeight: 1,
        }}
      >
        SV
      </div>
      {/* SPOTVAULT text — below monogram */}
      <div
        className="absolute"
        style={{
          top: '30%',
          left: '50%',
          transform: 'translateX(-50%)',
          fontSize: '9px',
          fontWeight: 500,
          letterSpacing: '0.4em',
          color: 'rgba(192,145,30,0.10)',
          fontFamily: 'system-ui, sans-serif',
          whiteSpace: 'nowrap',
        }}
      >
        SPOTVAULT
      </div>
      {/* CAPITAL NETWORK text */}
      <div
        className="absolute"
        style={{
          top: '33%',
          left: '50%',
          transform: 'translateX(-50%)',
          fontSize: '7px',
          fontWeight: 400,
          letterSpacing: '0.5em',
          color: 'rgba(35,32,29,0.25)',
          fontFamily: 'system-ui, sans-serif',
          whiteSpace: 'nowrap',
        }}
      >
        CAPITAL NETWORK
      </div>

      {/* ===== Overhead architectural lighting — dim ===== */}
      <div
        className="absolute inset-x-0 top-0 h-[12%]"
        style={{
          background:
            'radial-gradient(ellipse 60% 100% at 50% 0%, rgba(40,36,33,0.12) 0%, transparent 70%)',
        }}
      />

      {/* ===== Vault mechanism ambient glow — center ===== */}
      <div
        className="absolute"
        style={{
          top: '10%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '60%',
          height: '50%',
          background:
            'radial-gradient(ellipse 50% 60% at 50% 50%, rgba(192,145,30,0.04) 0%, transparent 60%)',
        }}
      />

      {/* ===== Floor — dark stone / metal ===== */}
      <div
        className="absolute bottom-0 left-0 right-0 h-[20%]"
        style={{
          background:
            'linear-gradient(180deg, rgba(14,12,11,0.85) 0%, rgba(6,5,5,0.95) 50%, rgba(2,2,1,0.98) 100%)',
        }}
      />
      {/* Gold floor seam — where wall meets floor */}
      <div
        className="absolute bottom-[20%] left-0 right-0 h-px"
        style={{
          background:
            'linear-gradient(90deg, transparent 5%, rgba(192,145,30,0.15) 30%, rgba(192,145,30,0.18) 50%, rgba(192,145,30,0.15) 70%, transparent 95%)',
          boxShadow: '0 0 6px rgba(192,145,30,0.05)',
        }}
      />
      {/* Floor panel lines — metal grates */}
      <div className="absolute bottom-[10%] left-[10%] right-[10%] h-px bg-[#2a2622]/15" />
      <div className="absolute bottom-[5%] left-[15%] right-[15%] h-px bg-[#2a2622]/10" />

      {/* ===== Executive desk / table silhouette — foreground ===== */}
      {/* Central command table */}
      <div
        className="absolute"
        style={{
          bottom: '17%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '40%',
          height: '4%',
          background:
            'linear-gradient(180deg, #0c0a09 0%, #050403 100%)',
          borderRadius: '3px 3px 0 0',
          opacity: 0.8,
        }}
      />
      {/* Table gold edge */}
      <div
        className="absolute"
        style={{
          bottom: '21%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '40%',
          height: '1px',
          background: 'rgba(192,145,30,0.12)',
        }}
      />
      {/* Table warm glow */}
      <div
        className="absolute"
        style={{
          bottom: '17%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '44%',
          height: '10%',
          background:
            'radial-gradient(ellipse 50% 100% at 50% 100%, rgba(180,130,60,0.06) 0%, transparent 70%)',
        }}
      />

      {/* ===== Metal edge highlights — brushed steel reflections ===== */}
      {/* Left vertical edge light */}
      <div
        className="absolute"
        style={{
          top: '10%',
          left: '0',
          width: '1px',
          height: '70%',
          background:
            'linear-gradient(180deg, transparent 0%, rgba(80,72,66,0.08) 30%, rgba(80,72,66,0.06) 70%, transparent 100%)',
        }}
      />
      {/* Right vertical edge light */}
      <div
        className="absolute"
        style={{
          top: '10%',
          right: '0',
          width: '1px',
          height: '70%',
          background:
            'linear-gradient(180deg, transparent 0%, rgba(80,72,66,0.08) 30%, rgba(80,72,66,0.06) 70%, transparent 100%)',
        }}
      />

      {/* ===== Vignette — cinematic depth ===== */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 85% 75% at 50% 40%, transparent 25%, rgba(2,2,1,0.6) 100%)',
        }}
      />
    </div>
  );
}
