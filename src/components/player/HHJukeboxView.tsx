import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Music, Package, Star, Zap, Check, Clock,
  ChevronRight, ShoppingCart,
  ArrowLeft, BookOpen, Trophy,
  Search, Filter, Loader2, X,
  Play, ChevronLeft, ChevronDown, Award, FileText, Plus,
} from 'lucide-react';
import { canCreateMultispot } from '@/lib/creatorStore';
import {
  fetchPublishedProducts, fetchProduct, fetchProductHands, fetchProductAnalysis,
  fetchUserPurchases, createPurchase, isPurchased,
  fetchProgress, fetchAllProgress, upsertProgress,
  type JukeboxProduct, type JukeboxProductHand, type JukeboxHandAnalysis,
  type JukeboxProgress,
} from '@/lib/jukeboxStore';
import { useDemoUserState, spendCredits, addCredits } from '@/lib/demoUserStore';
import { HHReplayer } from '@/features/hh-replayer/HHReplayer';
import { supabase } from '@/lib/supabase';
import { phase2HandToNormalized, type Phase2HandRecord } from '@/features/hh-replayer/adapter';
import type { NormalizedHand } from '@/features/hh-replayer/types';
import {
  GOLD, CARD_BORDER as BORDER, CARD_BG, CARD_SHADOW,
  STORE_MAX_WIDTH, STORE_PADDING,
} from '@/components/store/storeTokens';
import { PageHeader } from '@/components/shared/PageHeader';

const DARK_PANEL = 'rgba(6, 8, 10, 0.55)';
const DARKER_PANEL = 'rgba(5,4,3,0.92)';

type View = 'list' | 'detail' | 'study';

interface HHJukeboxViewProps {
  userId?: string;
  onOpenHandWorkspace?: () => void;
}

export function HHJukeboxView({ userId, onOpenHandWorkspace }: HHJukeboxViewProps) {
  const [view, setView] = useState<View>('list');
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [canCreate, setCanCreate] = useState(false);
  const demoUser = useDemoUserState();
  const effectiveUserId = userId ?? 'demo-user';

  useEffect(() => {
    (async () => {
      const allowed = await canCreateMultispot(effectiveUserId);
      setCanCreate(allowed);
    })();
  }, [effectiveUserId]);

  const goToList = useCallback(() => {
    setView('list');
    setSelectedProductId(null);
  }, []);

  const openProduct = useCallback((productId: string) => {
    setSelectedProductId(productId);
    setView('detail');
  }, []);

  const openStudy = useCallback((productId: string) => {
    setSelectedProductId(productId);
    setView('study');
  }, []);

  const refresh = useCallback(() => setRefreshKey(k => k + 1), []);

  return (
    <div className={`mx-auto ${STORE_MAX_WIDTH} ${STORE_PADDING}`}>
      {/* Header */}
      <PageHeader icon={Music} title="Multi-Spot Analysis" subtitle="Multi-hand analysis from approved creators">
        {canCreate && onOpenHandWorkspace && (
          <button
            onClick={onOpenHandWorkspace}
            className="flex items-center gap-1.5 rounded-lg border border-[#c0911e]/40 bg-[#c0911e]/15 px-3 py-2 text-[10px] font-bold tracking-widest text-[#f5e6b0] uppercase transition hover:bg-[#c0911e]/25"
          >
            <Plus className="h-3.5 w-3.5" /> Create
          </button>
        )}
      </PageHeader>

      {/* Content */}
      {view === 'list' && (
        <MarketplaceSection key={`mp-${refreshKey}`} userId={effectiveUserId} onOpenProduct={openProduct} onPurchase={refresh} />
      )}
      {view === 'detail' && selectedProductId && (
        <ProductDetail productId={selectedProductId} userId={effectiveUserId} onBack={goToList} onPurchased={() => { goToList(); refresh(); }} onStudy={openStudy} />
      )}
      {view === 'study' && selectedProductId && (
        <StudyView productId={selectedProductId} userId={effectiveUserId} onBack={goToList} />
      )}

      {/* Credit balance */}
      <div className="mt-4 flex items-center justify-center gap-2 text-[10px] font-mono text-white/30">
        <Zap className="h-3 w-3" style={{ color: GOLD }} strokeWidth={1.5} />
        Balance: <span className="font-bold" style={{ color: GOLD }}>{demoUser.credits.toLocaleString()}</span> credits
      </div>
    </div>
  );
}

// ── Tab Button ──────────────────────────────────────────────────

// (TabButton removed — no longer needed without the My Analysis tab)

// ── Marketplace ────────────────────────────────────────────────

function MarketplaceSection({ userId, onOpenProduct, onPurchase }: {
  userId: string;
  onOpenProduct: (id: string) => void;
  onPurchase: () => void;
}) {
  const [products, setProducts] = useState<JukeboxProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [purchasedIds, setPurchasedIds] = useState<Set<string>>(new Set());
  const [gameFilter, setGameFilter] = useState('All');
  const [typeFilter, setTypeFilter] = useState('All');
  const [sortMode, setSortMode] = useState<'recent' | 'popular' | 'price_low' | 'price_high' | 'rating'>('recent');
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [prods, purchases] = await Promise.all([
        fetchPublishedProducts({ gameType: gameFilter, productType: typeFilter, sort: sortMode }),
        fetchUserPurchases(userId),
      ]);
      setProducts(prods);
      setPurchasedIds(new Set(purchases.map(p => p.product_id)));
      setLoading(false);
    })();
  }, [userId, gameFilter, typeFilter, sortMode]);

  const filtered = useMemo(() => {
    return products;
  }, [products]);

  return (
    <div>
      {/* Collapsible Filters */}
      <div className="mb-4">
        <button
          onClick={() => setFiltersOpen(o => !o)}
          className="flex w-full items-center justify-between rounded-lg border border-[#232a32] bg-[#161b21] px-3 py-2 text-[10px] font-semibold tracking-widest uppercase text-white/50 transition-colors hover:text-white/70"
        >
          <span className="flex items-center gap-1.5">
            <Filter className="h-3.5 w-3.5" strokeWidth={1.5} />
            Filters
            {(gameFilter !== 'All' || typeFilter !== 'All' || sortMode !== 'recent') && (
              <span className="rounded-full bg-[#c0911e]/20 px-1.5 py-0.5 text-[8px] font-bold text-[#f5e6b0]">
                {[gameFilter !== 'All', typeFilter !== 'All', sortMode !== 'recent'].filter(Boolean).length}
              </span>
            )}
          </span>
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${filtersOpen ? 'rotate-180' : ''}`} strokeWidth={1.5} />
        </button>
        {filtersOpen && (
          <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-[#232a32] bg-[#161b21]/50 p-3">
            <FilterChip label="Game" value={gameFilter} options={['All', 'MTT', 'Cash', 'PKO']} onChange={setGameFilter} />
            <FilterChip label="Type" value={typeFilter} options={['All', 'hand_pack', 'full_tournament']} displayMap={{ hand_pack: 'Hand Pack', full_tournament: 'Full Tournament' }} onChange={setTypeFilter} />
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] font-mono uppercase tracking-wider text-white/30">Sort</span>
              <select
                value={sortMode}
                onChange={e => setSortMode(e.target.value as typeof sortMode)}
                className="rounded-md border border-[#232a32] bg-[#161b21] px-2 py-1 text-[10px] font-medium text-white/60 outline-none focus:border-[#c0911e]/40"
              >
                <option value="recent">Recent</option>
                <option value="popular">Popular</option>
                <option value="rating">Top Rated</option>
                <option value="price_low">Price: Low</option>
                <option value="price_high">Price: High</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin" style={{ color: GOLD }} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-20 text-center">
          <Package className="mx-auto mb-3 h-10 w-10 text-white/20" strokeWidth={1.5} />
          <p className="text-[12px] text-white/40">No products found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 items-start gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(item => (
            <MarketplaceCard
              key={item.id}
              product={item}
              purchased={purchasedIds.has(item.id)}
              onOpen={() => onOpenProduct(item.id)}
              onPurchase={onPurchase}
              userId={userId}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function FilterChip({ label, value, options, onChange, displayMap }: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
  displayMap?: Record<string, string>;
}) {
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
      <span className="text-[9px] font-mono uppercase tracking-wider text-white/30">{label}</span>
      <div className="flex flex-wrap gap-1">
        {options.map(opt => (
          <button
            key={opt}
            onClick={() => onChange(opt)}
            className={`rounded-md border px-2 py-1 text-[10px] font-medium transition-all ${
              value === opt
                ? 'border-[#c0911e]/40 bg-[#c0911e]/15 text-[#f5e6b0]'
                : 'border-[#232a32] bg-[#161b21] text-white/40 hover:border-[#38424e]'
            }`}
          >
            {displayMap?.[opt] ?? opt}
          </button>
        ))}
      </div>
    </div>
  );
}

function MarketplaceCard({ product, purchased, onOpen, onPurchase, userId }: {
  product: JukeboxProduct;
  purchased: boolean;
  onOpen: () => void;
  onPurchase: () => void;
  userId: string;
}) {
  const [purchasing, setPurchasing] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const handleBuy = async () => {
    if (purchased || product.price === 0) {
      onPurchase();
      return;
    }
    if (!spendCredits(product.price)) {
      setMsg('Insufficient credits');
      setTimeout(() => setMsg(null), 3000);
      return;
    }
    setPurchasing(true);
    const result = await createPurchase(userId, product.id, product.price);
    setPurchasing(false);
    if (result.success) {
      setMsg('Purchased!');
      onPurchase();
      setTimeout(() => setMsg(null), 2000);
    } else {
      addCredits(product.price);
      setMsg(result.error ?? 'Purchase failed');
      setTimeout(() => setMsg(null), 3000);
    }
  };

  return (
    <div
      className="cursor-pointer rounded-xl border p-2.5 transition-all hover:border-[#c0911e]/30"
      style={{ borderColor: BORDER, background: CARD_BG, boxShadow: CARD_SHADOW }}
      onClick={onOpen}
    >
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ background: `${product.thumbnail_color}15`, border: `1px solid ${product.thumbnail_color}30` }}>
          {product.product_type === 'full_tournament' ? <Trophy className="h-3.5 w-3.5" strokeWidth={1.5} style={{ color: product.thumbnail_color }} /> : <Package className="h-3.5 w-3.5" strokeWidth={1.5} style={{ color: product.thumbnail_color }} />}
        </div>
        <div className="min-w-0 flex-1">
          <span className="truncate text-[9px] font-bold text-white/50">{product.creator_name}</span>
          <h3 className="truncate text-[12px] font-bold leading-tight text-white">{product.title}</h3>
        </div>
      </div>

      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[9px] text-white/40">
        <span>{product.hand_count} hands</span>
        <span className="text-white/15">·</span>
        <span>{product.game_type}</span>
        {product.buy_in && (<><span className="text-white/15">·</span><span>{product.buy_in}</span></>)}
        {product.theme && <span className="rounded border border-[#232a32] bg-[#161b21] px-1 py-0 text-[8px] font-medium text-white/40 uppercase">{product.theme}</span>}
      </div>

      <div className="mt-1.5 flex items-center justify-between border-t border-[#1a1f25] pt-1.5">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <Star className="h-3 w-3" style={{ fill: GOLD, color: GOLD }} />
            <span className="text-[10px] font-bold text-[#d4a52c]">{Number(product.rating).toFixed(1)}</span>
          </div>
          <span className="text-[9px] text-white/30">{product.purchase_count} purchases</span>
        </div>
        {purchased ? (
          <span className="flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-[10px] font-bold text-emerald-400 uppercase">
            <Check className="h-3 w-3" strokeWidth={2} /> Owned
          </span>
        ) : product.price === 0 ? (
          <button
            onClick={(e) => { e.stopPropagation(); handleBuy(); }}
            className="flex items-center gap-1.5 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-[10px] font-bold text-emerald-400 uppercase transition-all hover:bg-emerald-500/20"
          >
            Free
          </button>
        ) : (
          <button
            onClick={(e) => { e.stopPropagation(); handleBuy(); }}
            disabled={purchasing}
            className="flex items-center gap-1.5 rounded-md border border-[#c0911e]/40 bg-gradient-to-b from-[#c0911e]/15 to-[#835e17]/15 px-3 py-1.5 text-[10px] font-bold tracking-widest text-[#f5e6b0] uppercase transition-all hover:from-[#c0911e]/25 hover:to-[#835e17]/25 disabled:opacity-50"
          >
            {purchasing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Zap className="h-3 w-3" strokeWidth={1.5} />} {product.price}
          </button>
        )}
      </div>
      {msg && <div className="mt-1 text-center text-[10px] font-medium text-[#d4a52c]">{msg}</div>}
    </div>
  );
}

// ── Product Detail ──────────────────────────────────────────────

function ProductDetail({ productId, userId, onBack, onPurchased, onStudy }: {
  productId: string;
  userId: string;
  onBack: () => void;
  onPurchased: () => void;
  onStudy: (id: string) => void;
}) {
  const [product, setProduct] = useState<JukeboxProduct | null>(null);
  const [hands, setHands] = useState<JukeboxProductHand[]>([]);
  const [analysis, setAnalysis] = useState<JukeboxHandAnalysis[]>([]);
  const [owned, setOwned] = useState(false);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [prod, h, a, isOwn] = await Promise.all([
        fetchProduct(productId),
        fetchProductHands(productId),
        fetchProductAnalysis(productId),
        isPurchased(userId, productId),
      ]);
      setProduct(prod);
      setHands(h);
      setAnalysis(a);
      setOwned(isOwn);
      setLoading(false);
    })();
  }, [productId, userId]);

  const handlePurchase = async () => {
    if (!product || owned) return;
    if (product.price > 0 && !spendCredits(product.price)) {
      setMsg('Insufficient credits');
      setTimeout(() => setMsg(null), 3000);
      return;
    }
    setPurchasing(true);
    const result = await createPurchase(userId, productId, product.price);
    setPurchasing(false);
    if (result.success) {
      setOwned(true);
      setMsg('Purchase successful!');
      setTimeout(() => { onPurchased(); }, 1500);
    } else {
      if (product.price > 0) addCredits(product.price);
      setMsg(result.error ?? 'Purchase failed');
      setTimeout(() => setMsg(null), 3000);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin" style={{ color: GOLD }} />
      </div>
    );
  }

  if (!product) {
    return <div className="py-20 text-center text-[12px] text-white/40">Product not found</div>;
  }

  return (
    <div>
      <button onClick={onBack} className="mb-4 flex items-center gap-1.5 text-[11px] font-medium text-white/40 transition-colors hover:text-[#d4a52c]">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to Marketplace
      </button>

      <div className="rounded-xl border p-5" style={{ borderColor: BORDER, background: DARK_PANEL }}>
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl" style={{ background: `${product.thumbnail_color}15`, border: `1px solid ${product.thumbnail_color}30` }}>
            {product.product_type === 'full_tournament' ? <Trophy className="h-6 w-6" strokeWidth={1.5} style={{ color: product.thumbnail_color }} /> : <Package className="h-6 w-6" strokeWidth={1.5} style={{ color: product.thumbnail_color }} />}
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[10px] font-bold text-white/50">{product.creator_name}</span>
            <h2 className="text-lg font-bold text-white">{product.title}</h2>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-white/40">
              <span>{product.hand_count} hands</span>
              <span className="text-white/15">·</span>
              <span>{product.game_type}</span>
              {product.buy_in && (<><span className="text-white/15">·</span><span>{product.buy_in}</span></>)}
              {product.theme && (<><span className="text-white/15">·</span><span>{product.theme}</span></>)}
            </div>
          </div>
        </div>

        <p className="mt-4 text-[12px] leading-relaxed text-white/60">{product.description}</p>

        <div className="mt-4 flex items-center gap-4">
          <div className="flex items-center gap-1">
            <Star className="h-3.5 w-3.5" style={{ fill: GOLD, color: GOLD }} />
            <span className="text-[11px] font-bold text-[#d4a52c]">{Number(product.rating).toFixed(1)}</span>
          </div>
          <span className="text-[10px] text-white/30">{product.purchase_count} purchases</span>
          <span className="text-[10px] text-white/30">{product.product_type === 'full_tournament' ? 'Full Tournament' : 'Hand Pack'}</span>
        </div>

        {/* Hand list preview */}
        <div className="mt-4 rounded-lg border border-[#1a1f25] p-3">
          <span className="text-[10px] font-mono uppercase tracking-wider text-white/30">Hands in this pack</span>
          <div className="mt-2 space-y-1">
            {hands.slice(0, 8).map((h, i) => (
              <div key={h.id} className="flex items-center gap-2 text-[11px] text-white/50">
                <span className="font-mono text-white/30">{i + 1}.</span>
                <span className="font-mono">{h.hand_id}</span>
              </div>
            ))}
            {hands.length > 8 && <span className="text-[10px] text-white/30">...and {hands.length - 8} more</span>}
          </div>
        </div>

        {/* Action */}
        <div className="mt-5 flex items-center gap-3">
          {owned ? (
            <button
              onClick={() => onStudy(productId)}
              className="flex items-center gap-2 rounded-lg border border-[#c0911e]/40 bg-gradient-to-b from-[#c0911e]/20 to-[#835e17]/20 px-5 py-2.5 text-[12px] font-bold tracking-widest text-[#f5e6b0] uppercase transition-all hover:from-[#c0911e]/30 hover:to-[#835e17]/30"
            >
              <BookOpen className="h-4 w-4" /> Study
            </button>
          ) : (
            <button
              onClick={handlePurchase}
              disabled={purchasing}
              className="flex items-center gap-2 rounded-lg border border-[#c0911e]/40 bg-gradient-to-b from-[#c0911e]/20 to-[#835e17]/20 px-5 py-2.5 text-[12px] font-bold tracking-widest text-[#f5e6b0] uppercase transition-all hover:from-[#c0911e]/30 hover:to-[#835e17]/30 disabled:opacity-50"
            >
              {purchasing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
              {product.price === 0 ? 'Get Free' : `Buy — ${product.price} credits`}
            </button>
          )}
          {msg && <span className="text-[11px] font-medium text-[#d4a52c]">{msg}</span>}
        </div>
      </div>
    </div>
  );
}

// (MyJukeboxSection/Group/Card removed — purchased products now live in My Spots)

// ── Study / Playback ────────────────────────────────────────────

function StudyView({ productId, userId, onBack }: {
  productId: string;
  userId: string;
  onBack: () => void;
}) {
  const [product, setProduct] = useState<JukeboxProduct | null>(null);
  const [hands, setHands] = useState<JukeboxProductHand[]>([]);
  const [analysisMap, setAnalysisMap] = useState<Map<string, JukeboxHandAnalysis>>(new Map());
  const [progress, setProgress] = useState<JukeboxProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentHandIndex, setCurrentHandIndex] = useState(0);
  const [currentHand, setCurrentHand] = useState<NormalizedHand | null>(null);
  const [handLoading, setHandLoading] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [prod, h, a, prog] = await Promise.all([
        fetchProduct(productId),
        fetchProductHands(productId),
        fetchProductAnalysis(productId),
        fetchProgress(userId, productId),
      ]);
      setProduct(prod);
      setHands(h);
      setAnalysisMap(new Map(a.map(x => [x.hand_id, x])));
      setProgress(prog);
      // Resume at last position
      const startIdx = prog?.current_hand_index ?? 0;
      setCurrentHandIndex(Math.min(startIdx, h.length - 1));
      setLoading(false);
    })();
  }, [productId, userId]);

  // Load hand when index changes
  useEffect(() => {
    if (hands.length === 0 || currentHandIndex >= hands.length) return;
    const handId = hands[currentHandIndex].hand_id;
    setHandLoading(true);
    (async () => {
      const { data, error } = await supabase
        .from('poker_hand_records')
        .select('*')
        .eq('hand_id', handId)
        .maybeSingle();
      setHandLoading(false);
      if (error || !data) {
        setCurrentHand(null);
        return;
      }
      try {
        const normalized = phase2HandToNormalized(data as unknown as Phase2HandRecord);
        setCurrentHand(normalized);
      } catch {
        setCurrentHand(null);
      }
    })();
  }, [hands, currentHandIndex]);

  const markStudied = useCallback(async () => {
    if (!product || hands.length === 0) return;
    const handId = hands[currentHandIndex].hand_id;
    const studied = new Set(progress?.studied_hand_ids ?? []);
    studied.add(handId);
    const studiedArr = Array.from(studied);
    const isComplete = studiedArr.length >= hands.length;

    const updated = {
      studied_hand_ids: studiedArr,
      current_hand_index: currentHandIndex,
      is_completed: isComplete,
      completed_at: isComplete ? new Date().toISOString() : null,
    };

    setProgress(prev => prev ? { ...prev, ...updated } : null);
    await upsertProgress(userId, productId, updated);
  }, [product, hands, currentHandIndex, progress, userId, productId]);

  const goNext = useCallback(() => {
    if (currentHandIndex < hands.length - 1) {
      setCurrentHandIndex(i => i + 1);
    }
  }, [currentHandIndex, hands.length]);

  const goPrev = useCallback(() => {
    if (currentHandIndex > 0) {
      setCurrentHandIndex(i => i - 1);
    }
  }, [currentHandIndex]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin" style={{ color: GOLD }} />
      </div>
    );
  }

  if (!product) return <div className="py-20 text-center text-[12px] text-white/40">Product not found</div>;

  const studied = progress?.studied_hand_ids.length ?? 0;
  const pct = hands.length > 0 ? Math.round((studied / hands.length) * 100) : 0;
  const currentAnalysis = currentHand ? analysisMap.get(currentHand.handId) : null;

  return (
    <div>
      <button onClick={onBack} className="mb-4 flex items-center gap-1.5 text-[11px] font-medium text-white/40 transition-colors hover:text-[#d4a52c]">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to Marketplace
      </button>

      {/* Study header */}
      <div className="mb-4 rounded-xl border p-4" style={{ borderColor: BORDER, background: DARK_PANEL }}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-white">{product.title}</h3>
            <span className="text-[10px] text-white/40">by {product.creator_name}</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <div className="h-2 w-24 overflow-hidden rounded-full bg-[#161b21]">
                <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: GOLD }} />
              </div>
              <span className="text-[10px] font-mono text-white/40">{studied}/{hands.length}</span>
            </div>
            {progress?.is_completed && (
              <span className="flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[9px] font-bold text-emerald-400 uppercase">
                <Check className="h-2.5 w-2.5" /> Completed
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Hand navigation */}
      <div className="mb-3 flex items-center justify-between rounded-lg border px-3 py-2" style={{ borderColor: BORDER, background: DARK_PANEL }}>
        <button onClick={goPrev} disabled={currentHandIndex === 0} className="flex h-7 w-7 items-center justify-center rounded-md transition-all disabled:opacity-30 hover:bg-white/5" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: '#9ca3af' }}>
          <ChevronLeft size={14} />
        </button>
        <span className="text-[11px] font-medium text-white/60">
          Hand {currentHandIndex + 1} of {hands.length}
        </span>
        <button onClick={goNext} disabled={currentHandIndex >= hands.length - 1} className="flex h-7 w-7 items-center justify-center rounded-md transition-all disabled:opacity-30 hover:bg-white/5" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: '#9ca3af' }}>
          <ChevronRight size={14} />
        </button>
      </div>

      {/* Replayer */}
      <div className="rounded-xl border p-4" style={{ borderColor: 'rgba(192,145,30,0.12)', background: DARKER_PANEL }}>
        {handLoading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin" style={{ color: GOLD }} />
            <span className="mt-2 text-[11px] text-white/40">Loading hand...</span>
          </div>
        ) : currentHand ? (
          <HHReplayer hand={currentHand} variant="full" />
        ) : (
          <div className="py-20 text-center">
            <p className="text-[12px] text-white/40">Unable to load this hand</p>
            <p className="mt-1 text-[10px] text-white/30">Hand ID: {hands[currentHandIndex]?.hand_id ?? 'unknown'}</p>
          </div>
        )}
      </div>

      {/* Creator Analysis */}
      {currentAnalysis && (currentAnalysis.analysis_text || currentAnalysis.preflop_notes || currentAnalysis.flop_notes || currentAnalysis.turn_notes || currentAnalysis.river_notes) && (
        <div className="mt-4 rounded-xl border p-4" style={{ borderColor: BORDER, background: DARK_PANEL }}>
          <div className="mb-3 flex items-center gap-2">
            <FileText className="h-3.5 w-3.5" style={{ color: GOLD }} />
            <h4 className="text-[11px] font-bold uppercase tracking-widest text-white/50">Creator Analysis</h4>
          </div>
          {currentAnalysis.analysis_text && (
            <p className="mb-3 text-[12px] leading-relaxed text-white/70">{currentAnalysis.analysis_text}</p>
          )}
          <div className="space-y-2">
            {currentAnalysis.preflop_notes && <AnalysisStreet street="Preflop" text={currentAnalysis.preflop_notes} />}
            {currentAnalysis.flop_notes && <AnalysisStreet street="Flop" text={currentAnalysis.flop_notes} />}
            {currentAnalysis.turn_notes && <AnalysisStreet street="Turn" text={currentAnalysis.turn_notes} />}
            {currentAnalysis.river_notes && <AnalysisStreet street="River" text={currentAnalysis.river_notes} />}
          </div>
        </div>
      )}

      {/* Action bar */}
      <div className="mt-4 flex items-center justify-between">
        <button
          onClick={markStudied}
          className="flex items-center gap-2 rounded-lg border border-[#c0911e]/40 bg-[#c0911e]/15 px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-[#f5e6b0] transition-all hover:bg-[#c0911e]/25"
        >
          <Check className="h-3.5 w-3.5" /> Mark as Studied
        </button>
        {currentHandIndex < hands.length - 1 ? (
          <button
            onClick={() => { markStudied(); goNext(); }}
            className="flex items-center gap-2 rounded-lg border border-[#c0911e]/40 bg-gradient-to-b from-[#c0911e]/20 to-[#835e17]/20 px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-[#f5e6b0] transition-all hover:from-[#c0911e]/30 hover:to-[#835e17]/30"
          >
            Next Hand <ChevronRight className="h-3.5 w-3.5" />
          </button>
        ) : (
          <span className="text-[11px] font-medium text-emerald-400">Last hand</span>
        )}
      </div>
    </div>
  );
}

function AnalysisStreet({ street, text }: { street: string; text: string }) {
  return (
    <div className="rounded-md border border-[#1a1f25] bg-[#0e0c0a] p-2.5">
      <span className="text-[9px] font-mono uppercase tracking-wider" style={{ color: GOLD }}>{street}</span>
      <p className="mt-1 text-[11px] leading-relaxed text-white/60">{text}</p>
    </div>
  );
}

