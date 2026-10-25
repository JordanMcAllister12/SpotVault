import { useState, useMemo, useCallback, useEffect } from 'react';
import {
  X, ArrowLeft, ArrowRight, Play, Check, Sparkles,
} from 'lucide-react';
import {
  ECOSYSTEM_NODES,
  ECOSYSTEM_CATEGORIES,
  STATUS_LABELS,
  STATUS_COLORS,
  PLAYER_JOURNEY,
  type EcosystemNode,
  type EcosystemCategory,
} from '@/data/ecosystem';
import { GOLD, GOLD_BRIGHT } from '@/components/ui/industry';
import { PAGE_HEADER_GLASS } from '@/components/store/storeTokens';

interface Props {
  onBack: () => void;
}

type View = 'constellation' | 'journey';

const BG_DEEP = '#050608';
const BG_PANEL = 'rgba(10, 13, 17, 0.96)';
const BORDER_GOLD = 'rgba(212, 165, 44, 0.15)';
const BORDER_GOLD_BRIGHT = 'rgba(212, 165, 44, 0.4)';
const NODE_RADIUS = 28;
const CENTER_RADIUS = 52;

// Premium dark galaxy / outer-space environment layers.
// Deep navy-black space with subtle stars, faint nebula clouds, and
// restrained gold atmospheric lighting matching SpotVault's visual identity.
const GALAXY_BG_LAYERS = [
  // Base: deep space black-navy
  'radial-gradient(ellipse 100% 80% at 50% 40%, #0a0c14 0%, #060709 45%, #040508 100%)',
  // Nebula cloud 1: faint warm gold-amber drift (upper right)
  'radial-gradient(ellipse 45% 35% at 78% 22%, rgba(192,145,30,0.05) 0%, rgba(160,110,40,0.025) 30%, transparent 65%)',
  // Nebula cloud 2: cool deep-blue drift (lower left)
  'radial-gradient(ellipse 40% 30% at 18% 75%, rgba(40,60,120,0.06) 0%, rgba(20,30,80,0.03) 35%, transparent 70%)',
  // Nebula cloud 3: subtle violet-teal wisp (center-right)
  'radial-gradient(ellipse 35% 25% at 65% 65%, rgba(60,80,140,0.04) 0%, transparent 60%)',
  // Gold ambient glow: restrained warm halo at center
  'radial-gradient(ellipse 50% 40% at 50% 50%, rgba(192,145,30,0.02) 0%, transparent 55%)',
  // Bottom depth: darker gradient for grounding
  'linear-gradient(180deg, transparent 50%, rgba(4,5,8,0.6) 85%, #030407 100%)',
  // Vignette: darken edges for focus
  'radial-gradient(ellipse 90% 100% at 50% 50%, transparent 30%, rgba(3,4,7,0.5) 75%, rgba(2,3,5,0.8) 100%)',
];

// Per-category distance multipliers (1.0 = default). Portals & Education pulled in slightly.
const CATEGORY_DIST_OVERRIDE: Record<string, number> = {
  portals: 0.85,    // ~15% closer to center
  education: 0.88,  // ~12% closer
  industry: 0.90,   // ~10% closer
  community: 0.90,  // ~10% closer
  player_tools: 1.0, // stays at full distance
};

// Per-category child node ring radius multipliers — push children farther out
const NODE_RING_OVERRIDE: Record<string, number> = {
  player_tools: 1.35,  // needs the most spread (7 children)
  portals: 1.30,
  education: 1.30,
  industry: 1.30,
  community: 1.25,
};

// Per-category arc spread in degrees — wider arcs for more children
const ARC_SPREAD_OVERRIDE: Record<string, number> = {
  player_tools: 160,  // 7 children — widest arc
  portals: 140,
  education: 130,
  industry: 140,
  community: 120,
};

function getCategoryColor(cat: EcosystemCategory): string {
  const meta = ECOSYSTEM_CATEGORIES.find((c) => c.id === cat);
  return meta?.color ?? GOLD;
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = (angleDeg - 90) * (Math.PI / 180);
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

export function ExploreSpotVaultPage({ onBack }: Props) {
  const [view, setView] = useState<View>('constellation');
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<EcosystemNode | null>(null);
  const [activeCategory, setActiveCategory] = useState<EcosystemCategory | 'all'>('all');
  const [journeyStep, setJourneyStep] = useState(0);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const nodesByCategory = useMemo(() => {
    const map = new Map<EcosystemCategory, EcosystemNode[]>();
    for (const cat of ECOSYSTEM_CATEGORIES) {
      map.set(cat.id, ECOSYSTEM_NODES.filter((n) => n.category === cat.id));
    }
    return map;
  }, []);

  const filteredNodes = useMemo(() => {
    if (activeCategory === 'all') return ECOSYSTEM_NODES;
    return ECOSYSTEM_NODES.filter((n) => n.category === activeCategory);
  }, [activeCategory]);

  const isNodeHighlighted = useCallback(
    (nodeId: string): boolean => {
      if (!hoveredNode) return true;
      if (hoveredNode === nodeId) return true;
      const hovered = ECOSYSTEM_NODES.find((n) => n.id === hoveredNode);
      if (!hovered) return true;
      return hovered.relatedNodeIds.includes(nodeId);
    },
    [hoveredNode]
  );

  const isNodeDimmed = useCallback(
    (nodeId: string): boolean => {
      if (!hoveredNode) return false;
      return !isNodeHighlighted(nodeId);
    },
    [hoveredNode, isNodeHighlighted]
  );

  const handleNodeClick = useCallback((node: EcosystemNode) => {
    setSelectedNode(node);
  }, []);

  const journeyCurrent = PLAYER_JOURNEY[journeyStep];
  const journeyNode = ECOSYSTEM_NODES.find((n) => n.id === journeyCurrent?.nodeId);

  return (
    <div className="fixed inset-0 z-[80] overflow-y-auto" style={{ background: BG_DEEP }}>
      {/* Premium galaxy / outer-space environment */}
      <div className="pointer-events-none fixed inset-0">
        {GALAXY_BG_LAYERS.map((bg, i) => (
          <div key={i} className="absolute inset-0" style={{ background: bg }} />
        ))}
        {/* CSS starfield — three layers at different densities/opacities for depth */}
        <div className="absolute inset-0" style={{
          backgroundImage: 'radial-gradient(1px 1px at 20% 30%, rgba(255,255,255,0.8), transparent), radial-gradient(1px 1px at 60% 70%, rgba(255,255,255,0.6), transparent), radial-gradient(1px 1px at 80% 10%, rgba(255,255,255,0.7), transparent), radial-gradient(1px 1px at 40% 50%, rgba(255,255,255,0.5), transparent), radial-gradient(1px 1px at 90% 60%, rgba(255,255,255,0.7), transparent), radial-gradient(1px 1px at 10% 80%, rgba(255,255,255,0.6), transparent), radial-gradient(1px 1px at 50% 20%, rgba(255,255,255,0.5), transparent), radial-gradient(1px 1px at 30% 90%, rgba(255,255,255,0.6), transparent), radial-gradient(1px 1px at 70% 40%, rgba(255,255,255,0.4), transparent), radial-gradient(1px 1px at 15% 55%, rgba(255,255,255,0.5), transparent), radial-gradient(1px 1px at 85% 85%, rgba(255,255,255,0.6), transparent), radial-gradient(1px 1px at 55% 95%, rgba(255,255,255,0.4), transparent), radial-gradient(1px 1px at 95% 35%, rgba(255,255,255,0.5), transparent), radial-gradient(1px 1px at 25% 15%, rgba(255,255,255,0.7), transparent), radial-gradient(1px 1px at 45% 75%, rgba(255,255,255,0.4), transparent), radial-gradient(1px 1px at 75% 25%, rgba(255,255,255,0.6), transparent)',
          backgroundSize: '400px 400px',
          opacity: 0.7,
        }} />
        <div className="absolute inset-0" style={{
          backgroundImage: 'radial-gradient(0.5px 0.5px at 35% 45%, rgba(255,255,255,0.5), transparent), radial-gradient(0.5px 0.5px at 65% 25%, rgba(255,255,255,0.4), transparent), radial-gradient(0.5px 0.5px at 5% 65%, rgba(255,255,255,0.5), transparent), radial-gradient(0.5px 0.5px at 85% 55%, rgba(255,255,255,0.3), transparent), radial-gradient(0.5px 0.5px at 50% 85%, rgba(255,255,255,0.4), transparent), radial-gradient(0.5px 0.5px at 22% 12%, rgba(255,255,255,0.5), transparent), radial-gradient(0.5px 0.5px at 92% 92%, rgba(255,255,255,0.3), transparent), radial-gradient(0.5px 0.5px at 42% 62%, rgba(255,255,255,0.4), transparent), radial-gradient(0.5px 0.5px at 72% 82%, rgba(255,255,255,0.5), transparent), radial-gradient(0.5px 0.5px at 12% 38%, rgba(255,255,255,0.3), transparent)',
          backgroundSize: '300px 300px',
          opacity: 0.5,
        }} />
        {/* Faint gold-tinted larger stars */}
        <div className="absolute inset-0" style={{
          backgroundImage: 'radial-gradient(1.5px 1.5px at 28% 22%, rgba(212,165,44,0.4), transparent), radial-gradient(1.5px 1.5px at 72% 68%, rgba(212,165,44,0.3), transparent), radial-gradient(1.5px 1.5px at 48% 48%, rgba(245,230,176,0.25), transparent), radial-gradient(1.5px 1.5px at 88% 18%, rgba(212,165,44,0.3), transparent), radial-gradient(1.5px 1.5px at 18% 88%, rgba(245,230,176,0.2), transparent)',
          backgroundSize: '500px 500px',
          opacity: 0.6,
        }} />
        {/* Subtle vertical architectural lines like PortalShell */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              'repeating-linear-gradient(90deg, transparent 0px, transparent 120px, rgba(255,255,255,0.15) 120px, rgba(255,255,255,0.15) 121px)',
          }}
        />
      </div>

      {/* Header — three-row stacking on mobile, single-column on desktop */}
      <div className="relative z-10 border-b" style={{ background: PAGE_HEADER_GLASS.background, backdropFilter: PAGE_HEADER_GLASS.backdropFilter, WebkitBackdropFilter: PAGE_HEADER_GLASS.WebkitBackdropFilter, borderColor: 'rgba(190,145,65,0.22)' }}>
        <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 sm:py-6">
          {/* Row 1: Back button + title (mobile) / Back + view toggles (desktop) */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 shrink-0" style={{ color: GOLD }} strokeWidth={1.5} />
              <span className="text-[10px] font-bold tracking-[0.2em] uppercase" style={{ color: GOLD_BRIGHT }}>Discover SpotVault</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <button
                onClick={onBack}
                className="flex items-center gap-2 text-[11px] font-medium text-white/50 transition-colors hover:text-white/80"
              >
                <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.5} />
                Back
              </button>
              <div className="flex gap-2">
                <ViewToggle active={view === 'constellation'} onClick={() => setView('constellation')} label="Ecosystem" />
                <ViewToggle active={view === 'journey'} onClick={() => setView('journey')} label="Follow the Player" />
              </div>
            </div>
          </div>

          {/* Row 2: Title and subtitle */}
          <div className="mt-5 text-center">
            <h1 className="text-xl font-bold tracking-tight text-white sm:text-4xl">
              One connected ecosystem for poker.
            </h1>
            <p className="mx-auto mt-3 max-w-2xl text-[12px] leading-relaxed text-white/50 sm:text-sm">
              Players, coaches, creators, stables, businesses, and communities currently operate across a fragmented collection of tools and platforms. SpotVault is being built to connect them.
            </p>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="relative z-10">
        {view === 'constellation' && (
          <ConstellationView
            isMobile={isMobile}
            nodesByCategory={nodesByCategory}
            hoveredNode={hoveredNode}
            setHoveredNode={setHoveredNode}
            selectedNode={selectedNode}
            handleNodeClick={handleNodeClick}
            isNodeDimmed={isNodeDimmed}
            isNodeHighlighted={isNodeHighlighted}
            activeCategory={activeCategory}
            setActiveCategory={setActiveCategory}
            filteredNodes={filteredNodes}
          />
        )}
        {view === 'journey' && (
          <JourneyView
            journeyStep={journeyStep}
            setJourneyStep={setJourneyStep}
            journeyNode={journeyNode}
            journeyCurrent={journeyCurrent}
            isMobile={isMobile}
          />
        )}
      </div>

      {/* Info panel modal */}
      {selectedNode && (
        <InfoPanel node={selectedNode} onClose={() => setSelectedNode(null)} />
      )}
    </div>
  );
}

function ViewToggle({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className="rounded-lg px-3 py-1.5 text-[10px] font-bold tracking-widest uppercase transition-all"
      style={{
        background: active ? 'rgba(212,165,44,0.12)' : 'transparent',
        border: `1px solid ${active ? BORDER_GOLD_BRIGHT : 'rgba(255,255,255,0.08)'}`,
        color: active ? GOLD_BRIGHT : 'rgba(255,255,255,0.4)',
      }}
    >
      {label}
    </button>
  );
}

// ============================================================
// CONSTELLATION VIEW
// ============================================================
function ConstellationView({
  isMobile,
  nodesByCategory,
  hoveredNode,
  setHoveredNode,
  handleNodeClick,
  isNodeDimmed,
  isNodeHighlighted,
  activeCategory,
  setActiveCategory,
  filteredNodes,
}: {
  isMobile: boolean;
  nodesByCategory: Map<EcosystemCategory, EcosystemNode[]>;
  hoveredNode: string | null;
  setHoveredNode: (id: string | null) => void;
  selectedNode: EcosystemNode | null;
  handleNodeClick: (node: EcosystemNode) => void;
  isNodeDimmed: (id: string) => boolean;
  isNodeHighlighted: (id: string) => boolean;
  activeCategory: EcosystemCategory | 'all';
  setActiveCategory: (cat: EcosystemCategory | 'all') => void;
  filteredNodes: EcosystemNode[];
}) {
  // Layout: center = SpotVault, 5 categories at specific positions
  // PLAYER TOOLS — upper center, PORTALS — upper left, EDUCATION — upper right
  // INDUSTRY — lower left, COMMUNITY — lower right
  const W = isMobile ? 340 : 1200;
  const H = isMobile ? 680 : 860;
  const cx = W / 2;
  // Shift center down slightly so Player Tools has breathing room below filters
  const cy = isMobile ? H / 2 : H / 2 + 30;
  const baseCategoryDist = isMobile ? 115 : 260;
  const baseNodeRingRadius = isMobile ? 65 : 130;

  // Specific category positions (not evenly spaced — custom layout for visual balance)
  const categoryPositions = useMemo(() => {
    const positions: Record<string, { x: number; y: number; angle: number }> = {};
    const layout: Record<string, number> = {
      player_tools: 0,    // upper center
      portals: 288,        // upper left
      education: 72,       // upper right
      industry: 216,       // lower left
      community: 144,      // lower right
    };
    for (const cat of ECOSYSTEM_CATEGORIES) {
      const angle = layout[cat.id];
      const distMult = CATEGORY_DIST_OVERRIDE[cat.id] ?? 1.0;
      const dist = baseCategoryDist * distMult;
      const pos = polarToCartesian(cx, cy, dist, angle);
      positions[cat.id] = { ...pos, angle };
    }
    return positions;
  }, [cx, cy, baseCategoryDist]);

  // Compute node positions around each category — wide arcs for readability
  const nodePositions = useMemo(() => {
    const positions: Record<string, { x: number; y: number }> = {};
    for (const [catId, nodes] of nodesByCategory) {
      const catPos = categoryPositions[catId];
      if (!catPos) continue;
      const nodeCount = nodes.length;
      const ringMult = NODE_RING_OVERRIDE[catId] ?? 1.0;
      const ringRadius = baseNodeRingRadius * ringMult;
      const arcSpread = ARC_SPREAD_OVERRIDE[catId] ?? Math.min(150, Math.max(90, nodeCount * 24));
      const angleStep = nodeCount > 1 ? arcSpread / (nodeCount - 1) : 0;
      const startAngle = catPos.angle - arcSpread / 2;
      nodes.forEach((node, i) => {
        const angle = nodeCount === 1 ? catPos.angle : startAngle + i * angleStep;
        const pos = polarToCartesian(catPos.x, catPos.y, ringRadius, angle);
        positions[node.id] = pos;
      });
    }
    return positions;
  }, [nodesByCategory, categoryPositions, baseNodeRingRadius]);

  // Get related connection lines
  const connectionLines = useMemo(() => {
    const lines: { x1: number; y1: number; x2: number; y2: number; key: string; isHovered: boolean }[] = [];
    const hovered = hoveredNode ? ECOSYSTEM_NODES.find((n) => n.id === hoveredNode) : null;

    // Center to categories
    for (const cat of ECOSYSTEM_CATEGORIES) {
      const catPos = categoryPositions[cat.id];
      if (!catPos) continue;
      lines.push({
        x1: cx,
        y1: cy,
        x2: catPos.x,
        y2: catPos.y,
        key: `center-${cat.id}`,
        isHovered: !hoveredNode || hovered?.category === cat.id,
      });
    }

    // Categories to their nodes
    for (const [catId, nodes] of nodesByCategory) {
      const catPos = categoryPositions[catId];
      if (!catPos) continue;
      for (const node of nodes) {
        const nodePos = nodePositions[node.id];
        if (!nodePos) continue;
        lines.push({
          x1: catPos.x,
          y1: catPos.y,
          x2: nodePos.x,
          y2: nodePos.y,
          key: `cat-${node.id}`,
          isHovered: !hoveredNode || hovered?.id === node.id || hovered?.relatedNodeIds.includes(node.id) || hovered?.category === catId,
        });
      }
    }

    // Related node connections (cross-category)
    if (hovered) {
      for (const relatedId of hovered.relatedNodeIds) {
        const hoveredPos = nodePositions[hovered.id];
        const relatedPos = nodePositions[relatedId];
        if (hoveredPos && relatedPos) {
          lines.push({
            x1: hoveredPos.x,
            y1: hoveredPos.y,
            x2: relatedPos.x,
            y2: relatedPos.y,
            key: `rel-${hovered.id}-${relatedId}`,
            isHovered: true,
          });
        }
      }
    }

    return lines;
  }, [cx, cy, categoryPositions, nodePositions, nodesByCategory, hoveredNode]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      {/* Category filter pills */}
      <div className="mb-6 flex flex-wrap items-center justify-center gap-2">
        <FilterPill
          active={activeCategory === 'all'}
          onClick={() => setActiveCategory('all')}
          label="All"
        />
        {ECOSYSTEM_CATEGORIES.map((cat) => (
          <FilterPill
            key={cat.id}
            active={activeCategory === cat.id}
            onClick={() => setActiveCategory(cat.id)}
            label={cat.label}
            color={cat.color}
          />
        ))}
      </div>

      {/* Constellation SVG + node labels — inside a subtle visual container */}
      <div className="relative mx-auto flex w-full max-w-[min(340px,calc(100vw-32px))] justify-center sm:max-w-[90%]">
        <div
          className="relative w-full"
          style={{
            width: '100%',
            maxWidth: W,
            aspectRatio: `${W} / ${H}`,
            borderRadius: '24px',
            border: '1px solid rgba(212,165,44,0.05)',
            boxShadow: 'inset 0 0 100px rgba(0,0,0,0.4)',
          }}
        >
          {/* Subtle gold radial glow behind center */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              borderRadius: '24px',
              background: 'radial-gradient(ellipse 60% 45% at 50% 48%, rgba(212,165,44,0.03), transparent 65%)',
            }}
          />
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="absolute inset-0 h-full w-full"
            style={{ overflow: 'visible' }}
          >
            {/* Connection lines */}
            {connectionLines.map((line) => (
              <line
                key={line.key}
                x1={line.x1}
                y1={line.y1}
                x2={line.x2}
                y2={line.y2}
                stroke={line.isHovered ? 'rgba(212,165,44,0.28)' : 'rgba(255,255,255,0.04)'}
                strokeWidth={line.isHovered ? 1.2 : 0.5}
                style={{ transition: 'stroke 0.3s ease, stroke-width 0.3s ease' }}
              />
            ))}

            {/* Center node: SpotVault */}
            <g>
              <circle
                cx={cx}
                cy={cy}
                r={CENTER_RADIUS + 10}
                fill="none"
                stroke="rgba(212,165,44,0.06)"
                strokeWidth={1}
                style={{ animation: 'ecosystem-pulse 4s ease-in-out infinite' }}
              />
              <circle
                cx={cx}
                cy={cy}
                r={CENTER_RADIUS + 4}
                fill="none"
                stroke="rgba(212,165,44,0.1)"
                strokeWidth={1}
              />
              <circle
                cx={cx}
                cy={cy}
                r={CENTER_RADIUS}
                fill="rgba(212,165,44,0.1)"
                stroke="rgba(212,165,44,0.35)"
                strokeWidth={1.5}
              />
              <text
                x={cx}
                y={cy - 4}
                textAnchor="middle"
                fill={GOLD_BRIGHT}
                fontSize={isMobile ? 11 : 14}
                fontWeight="bold"
                style={{ letterSpacing: '0.05em' }}
              >
                SpotVault
              </text>
              <text
                x={cx}
                y={cy + 12}
                textAnchor="middle"
                fill="rgba(255,255,255,0.3)"
                fontSize={isMobile ? 7 : 8}
                fontWeight="600"
                style={{ letterSpacing: '0.15em' }}
              >
                ECOSYSTEM
              </text>
            </g>

            {/* Category nodes */}
            {ECOSYSTEM_CATEGORIES.map((cat) => {
              const pos = categoryPositions[cat.id];
              if (!pos) return null;
              const dimmed = hoveredNode !== null && !isNodeHighlighted(`cat-${cat.id}`);
              const isActive = activeCategory === cat.id;
              const catR = isMobile ? 22 : 32;
              return (
                <g key={cat.id}>
                  <circle
                    cx={pos.x}
                    cy={pos.y}
                    r={catR}
                    fill={dimmed ? 'rgba(10,13,17,0.5)' : `${cat.color}18`}
                    stroke={dimmed ? 'rgba(255,255,255,0.05)' : `${cat.color}55`}
                    strokeWidth={isActive ? 2 : 1}
                    style={{ transition: 'all 0.3s ease', opacity: dimmed ? 0.3 : 1 }}
                  />
                  <text
                    x={pos.x}
                    y={pos.y + 2}
                    textAnchor="middle"
                    fill={dimmed ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.85)'}
                    fontSize={isMobile ? 8 : 10}
                    fontWeight="bold"
                    style={{ letterSpacing: '0.05em', transition: 'opacity 0.3s ease' }}
                  >
                    {cat.label}
                  </text>
                </g>
              );
            })}

            {/* Individual feature nodes */}
            {filteredNodes.map((node) => {
              const pos = nodePositions[node.id];
              if (!pos) return null;
              const dimmed = isNodeDimmed(node.id);
              const isHovered = hoveredNode === node.id;
              const color = getCategoryColor(node.category);
              const r = isMobile ? 14 : 18;
              return (
                <g
                  key={node.id}
                  className="cursor-pointer"
                  onMouseEnter={() => setHoveredNode(node.id)}
                  onMouseLeave={() => setHoveredNode(null)}
                  onClick={() => handleNodeClick(node)}
                  style={{ transition: 'opacity 0.3s ease', opacity: dimmed ? 0.2 : 1 }}
                >
                  {/* Glow ring on hover */}
                  {isHovered && (
                    <circle
                      cx={pos.x}
                      cy={pos.y}
                      r={r + 8}
                      fill="none"
                      stroke={color}
                      strokeWidth={0.5}
                      opacity={0.3}
                      style={{ animation: 'ecosystem-pulse 1.5s ease-in-out infinite' }}
                    />
                  )}
                  <circle
                    cx={pos.x}
                    cy={pos.y}
                    r={r}
                    fill={isHovered ? `${color}25` : `${color}10`}
                    stroke={isHovered ? color : `${color}40`}
                    strokeWidth={isHovered ? 1.5 : 1}
                    style={{ transition: 'all 0.25s ease' }}
                  />
                  {/* Status dot */}
                  <circle
                    cx={pos.x + r * 0.65}
                    cy={pos.y - r * 0.65}
                    r={3}
                    fill={STATUS_COLORS[node.status]}
                    stroke={BG_DEEP}
                    strokeWidth={1}
                  />
                  {/* Node icon (simplified - use first letter) */}
                  <text
                    x={pos.x}
                    y={pos.y + 4}
                    textAnchor="middle"
                    fill={isHovered ? GOLD_BRIGHT : 'rgba(255,255,255,0.7)'}
                    fontSize={isMobile ? 9 : 11}
                    fontWeight="bold"
                  >
                    {node.title.charAt(0)}
                  </text>
                </g>
              );
            })}
          </svg>

          {/* HTML node labels overlaid (for better text rendering) */}
          {filteredNodes.map((node) => {
            const pos = nodePositions[node.id];
            if (!pos) return null;
            const dimmed = isNodeDimmed(node.id);
            const isHovered = hoveredNode === node.id;
            return (
              <div
                key={`label-${node.id}`}
                className="pointer-events-none absolute select-none"
                style={{
                  left: `${(pos.x / W) * 100}%`,
                  top: `${(pos.y / H) * 100}%`,
                  transform: 'translate(-50%, calc(-50% + 26px))',
                  opacity: dimmed ? 0.2 : 1,
                  transition: 'opacity 0.3s ease',
                }}
              >
                <span
                  className="text-center text-[9px] font-medium leading-tight sm:text-[12px]"
                  style={{
                    color: isHovered ? GOLD_BRIGHT : 'rgba(255,255,255,0.55)',
                    textShadow: '0 1px 4px rgba(0,0,0,0.9), 0 0 8px rgba(0,0,0,0.6)',
                    maxWidth: '90px',
                    display: 'inline-block',
                    whiteSpace: 'normal',
                    wordBreak: 'break-word',
                  }}
                >
                  {node.title}
                </span>
              </div>
            );
          })}

          {/* Hover tooltip */}
          {hoveredNode && (() => {
            const node = ECOSYSTEM_NODES.find((n) => n.id === hoveredNode);
            if (!node) return null;
            const pos = nodePositions[hoveredNode];
            if (!pos) return null;
            return (
              <div
                className="pointer-events-none absolute z-20 max-w-[200px] rounded-lg border p-2.5"
                style={{
                  left: `${(pos.x / W) * 100}%`,
                  top: `${(pos.y / H) * 100}%`,
                  transform: `translate(-50%, ${pos.y > H / 2 ? 'calc(-100% - 20px)' : '20px'})`,
                  borderColor: BORDER_GOLD,
                  background: BG_PANEL,
                  backdropFilter: 'blur(12px)',
                }}
              >
                <p className="text-[10px] font-bold text-white">{node.title}</p>
                <p className="mt-1 text-[9px] leading-relaxed text-white/55">{node.shortDescription}</p>
                <div className="mt-1.5 flex items-center gap-1.5">
                  <span
                    className="rounded-full px-1.5 py-0.5 text-[7px] font-bold uppercase tracking-wider"
                    style={{
                      background: `${STATUS_COLORS[node.status]}15`,
                      color: STATUS_COLORS[node.status],
                    }}
                  >
                    {STATUS_LABELS[node.status]}
                  </span>
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      {/* Two core ideas */}
      <div className="mx-auto mt-8 grid max-w-4xl gap-4 sm:grid-cols-2">
        <CoreIdeaCard
          number="01"
          title="Reimagining Poker Education"
          description="Moving from expensive, long-form courses toward shorter, targeted, evidence-based Spots that players purchase based on what they actually want to learn."
        />
        <CoreIdeaCard
          number="02"
          title="Connecting a Fragmented Industry"
          description="Bringing poker tools, education, community, creators, coaches, stables, businesses, and services into one connected ecosystem."
        />
      </div>

      {/* Legend */}
      <div className="mx-auto mt-6 flex max-w-4xl flex-wrap items-center justify-center gap-4">
        {Object.entries(STATUS_LABELS).map(([key, label]) => (
          <div key={key} className="flex items-center gap-1.5">
            <span
              className="h-2 w-2 rounded-full"
              style={{ background: STATUS_COLORS[key as keyof typeof STATUS_COLORS] }}
            />
            <span className="text-[9px] font-medium tracking-wider text-white/40 uppercase">{label}</span>
          </div>
        ))}
      </div>

      <style>{`
        @keyframes ecosystem-pulse {
          0%, 100% { opacity: 0.4; transform: scale(1); }
          50% { opacity: 0.8; transform: scale(1.05); }
        }
      `}</style>
    </div>
  );
}

function FilterPill({ active, onClick, label, color }: { active: boolean; onClick: () => void; label: string; color?: string }) {
  return (
    <button
      onClick={onClick}
      className="rounded-full px-3 py-1.5 text-[10px] font-bold tracking-wider uppercase transition-all"
      style={{
        background: active ? `${color ?? GOLD}15` : 'transparent',
        border: `1px solid ${active ? `${color ?? GOLD}40` : 'rgba(255,255,255,0.08)'}`,
        color: active ? color ?? GOLD_BRIGHT : 'rgba(255,255,255,0.4)',
      }}
    >
      {label}
    </button>
  );
}

function CoreIdeaCard({ number, title, description }: { number: string; title: string; description: string }) {
  return (
    <div
      className="rounded-xl border p-5"
      style={{ borderColor: BORDER_GOLD, background: 'rgba(10,13,17,0.6)' }}
    >
      <span className="text-[10px] font-mono font-bold tracking-widest" style={{ color: GOLD }}>{number}</span>
      <h3 className="mt-2 text-sm font-bold text-white">{title}</h3>
      <p className="mt-2 text-[11px] leading-relaxed text-white/50">{description}</p>
    </div>
  );
}

// ============================================================
// INFO PANEL (modal)
// ============================================================
function InfoPanel({ node, onClose }: { node: EcosystemNode; onClose: () => void }) {
  const Icon = node.icon;
  const color = getCategoryColor(node.category);

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg overflow-hidden rounded-2xl border"
        style={{ borderColor: BORDER_GOLD_BRIGHT, background: BG_PANEL, backdropFilter: 'blur(20px)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b p-5" style={{ borderColor: BORDER_GOLD }}>
          <div className="flex items-center gap-3">
            <div
              className="flex h-11 w-11 items-center justify-center rounded-xl"
              style={{ background: `${color}12`, border: `1px solid ${color}30` }}
            >
              <Icon className="h-5 w-5" strokeWidth={1.5} style={{ color }} />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">{node.title}</h2>
              <div className="mt-1 flex items-center gap-2">
                <span
                  className="rounded-full px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider"
                  style={{ background: `${STATUS_COLORS[node.status]}15`, color: STATUS_COLORS[node.status] }}
                >
                  {STATUS_LABELS[node.status]}
                </span>
                <span className="text-[9px] text-white/35">
                  {ECOSYSTEM_CATEGORIES.find((c) => c.id === node.category)?.label}
                </span>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="text-white/30 transition-colors hover:text-white/60">
            <X className="h-4 w-4" strokeWidth={1.5} />
          </button>
        </div>

        {/* Body */}
        <div className="max-h-[60vh] overflow-y-auto p-5" style={{ scrollbarWidth: 'thin' }}>
          <p className="text-[12px] leading-relaxed text-white/70">{node.longDescription}</p>

          <div className="mt-4 space-y-3">
            <InfoRow label="What it solves" value={node.problemSolved} />
            <InfoRow label="How it connects" value={node.connectionToSpotVault} />
          </div>

          {/* Related features */}
          {node.relatedNodeIds.length > 0 && (
            <div className="mt-4">
              <span className="text-[9px] font-bold tracking-widest text-white/40 uppercase">Connects to</span>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {node.relatedNodeIds.map((id) => {
                  const related = ECOSYSTEM_NODES.find((n) => n.id === id);
                  if (!related) return null;
                  const RelIcon = related.icon;
                  return (
                    <span
                      key={id}
                      className="inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[9px] font-medium"
                      style={{ borderColor: BORDER_GOLD, background: 'rgba(212,165,44,0.04)', color: 'rgba(255,255,255,0.6)' }}
                    >
                      <RelIcon className="h-2.5 w-2.5" strokeWidth={1.5} style={{ color: GOLD }} />
                      {related.title}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {/* Video placeholder */}
          <div className="mt-5">
            <span className="text-[9px] font-bold tracking-widest text-white/40 uppercase">Demo Video</span>
            {node.videoUrl ? (
              <div className="mt-2 overflow-hidden rounded-lg border" style={{ borderColor: BORDER_GOLD }}>
                <video src={node.videoUrl} controls className="w-full" />
              </div>
            ) : (
              <div
                className="mt-2 flex items-center justify-center rounded-lg border py-8"
                style={{ borderColor: 'rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}
              >
                <div className="flex flex-col items-center gap-2">
                  <Play className="h-6 w-6 text-white/15" strokeWidth={1} />
                  <span className="text-[10px] text-white/25">No demo video available</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        {node.route && (
          <div className="border-t p-4" style={{ borderColor: BORDER_GOLD }}>
            <button
              className="w-full rounded-lg py-2.5 text-[11px] font-bold tracking-widest uppercase transition-all"
              style={{
                background: 'rgba(212,165,44,0.12)',
                border: `1px solid ${BORDER_GOLD_BRIGHT}`,
                color: GOLD_BRIGHT,
              }}
            >
              Open {node.title}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-[9px] font-bold tracking-widest text-white/40 uppercase">{label}</span>
      <p className="mt-1 text-[11px] leading-relaxed text-white/55">{value}</p>
    </div>
  );
}

// ============================================================
// JOURNEY VIEW — "Follow the Player"
// ============================================================
function JourneyView({
  journeyStep,
  setJourneyStep,
  journeyNode,
  journeyCurrent,
  isMobile,
}: {
  journeyStep: number;
  setJourneyStep: (step: number) => void;
  journeyNode: EcosystemNode | undefined;
  journeyCurrent: typeof PLAYER_JOURNEY[0] | undefined;
  isMobile: boolean;
}) {
  if (!journeyCurrent || !journeyNode) return null;
  const JourneyIcon = journeyCurrent.icon;
  const color = getCategoryColor(journeyNode.category);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <div className="text-center">
        <h2 className="text-lg font-bold text-white sm:text-xl">See how SpotVault works</h2>
        <p className="mx-auto mt-2 max-w-xl text-[12px] leading-relaxed text-white/45">
          SpotVault isn't a collection of unrelated features. They reinforce one another. Follow a player's journey from identifying a leak to discussing it with the community.
        </p>
      </div>

      {/* Journey steps timeline */}
      <div className="mt-8 flex flex-col gap-3">
        {PLAYER_JOURNEY.map((step, i) => {
          const StepIcon = step.icon;
          const stepNode = ECOSYSTEM_NODES.find((n) => n.id === step.nodeId);
          const stepColor = stepNode ? getCategoryColor(stepNode.category) : GOLD;
          const isActive = i === journeyStep;
          const isPast = i < journeyStep;
          const isMobileLayout = isMobile;

          return (
            <div key={step.step}>
              <button
                onClick={() => setJourneyStep(i)}
                className="w-full text-left"
              >
                <div
                  className="flex items-start gap-3 rounded-xl border p-4 transition-all"
                  style={{
                    borderColor: isActive ? BORDER_GOLD_BRIGHT : isPast ? 'rgba(74,222,128,0.15)' : 'rgba(255,255,255,0.06)',
                    background: isActive ? 'rgba(212,165,44,0.06)' : isPast ? 'rgba(74,222,128,0.03)' : 'rgba(10,13,17,0.4)',
                  }}
                >
                  {/* Step number / icon */}
                  <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                    style={{
                      background: isActive ? `${stepColor}15` : isPast ? 'rgba(74,222,128,0.1)' : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${isActive ? stepColor : isPast ? 'rgba(74,222,128,0.3)' : 'rgba(255,255,255,0.08)'}`,
                    }}
                  >
                    {isPast ? (
                      <Check className="h-4 w-4" strokeWidth={2} style={{ color: '#4ade80' }} />
                    ) : (
                      <StepIcon className="h-4 w-4" strokeWidth={1.5} style={{ color: isActive ? stepColor : 'rgba(255,255,255,0.4)' }} />
                    )}
                  </div>

                  {/* Content */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-mono font-bold tracking-widest" style={{ color: isActive ? GOLD : 'rgba(255,255,255,0.3)' }}>
                        STEP {step.step}
                      </span>
                      {isActive && (
                        <span className="rounded-full px-1.5 py-0.5 text-[7px] font-bold uppercase tracking-wider" style={{ background: `${GOLD}15`, color: GOLD }}>
                          Current
                        </span>
                      )}
                    </div>
                    <h3 className="mt-1 text-[13px] font-bold text-white">{step.title}</h3>
                    {isActive && (
                      <p className="mt-1.5 text-[11px] leading-relaxed text-white/55">{step.description}</p>
                    )}
                  </div>
                </div>
              </button>

              {/* Connector arrow */}
              {i < PLAYER_JOURNEY.length - 1 && (
                <div className="flex justify-center py-0.5">
                  <ArrowRight className="h-3 w-3 rotate-90 text-white/15" strokeWidth={1.5} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Navigation buttons */}
      <div className="mt-6 flex items-center justify-between">
        <button
          onClick={() => setJourneyStep(Math.max(0, journeyStep - 1))}
          disabled={journeyStep === 0}
          className="flex items-center gap-2 rounded-lg border px-4 py-2 text-[10px] font-bold tracking-widest uppercase transition-all disabled:opacity-30"
          style={{ borderColor: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)' }}
        >
          <ArrowLeft className="h-3 w-3" strokeWidth={1.5} />
          Previous
        </button>
        <span className="text-[10px] font-mono text-white/30">
          {journeyStep + 1} / {PLAYER_JOURNEY.length}
        </span>
        <button
          onClick={() => setJourneyStep(Math.min(PLAYER_JOURNEY.length - 1, journeyStep + 1))}
          disabled={journeyStep === PLAYER_JOURNEY.length - 1}
          className="flex items-center gap-2 rounded-lg border px-4 py-2 text-[10px] font-bold tracking-widest uppercase transition-all disabled:opacity-30"
          style={{ borderColor: BORDER_GOLD_BRIGHT, color: GOLD_BRIGHT, background: 'rgba(212,165,44,0.08)' }}
        >
          Next
          <ArrowRight className="h-3 w-3" strokeWidth={1.5} />
        </button>
      </div>
    </div>
  );
}
