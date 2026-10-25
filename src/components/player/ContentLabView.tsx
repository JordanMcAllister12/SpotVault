import { useState, useCallback, useRef, useEffect } from 'react';
import {
  ChevronDown, Save, Send, Library, Upload,
  Plus, Trash2, X, Check, Loader2, FileText, Eye,
  Bold, Italic, Underline, List, ListOrdered, Quote, Link2,
  Heading1, Heading2, Heading3, Undo2, Redo2,
  ImageIcon, AlertCircle,
  Globe, LayoutTemplate, PenLine, Tags, Settings2, HelpCircle,
  ChevronRight, RefreshCcw, ArrowLeft,
} from 'lucide-react';
import {
  fetchAIAssistUsage, recordAIAssistUsage, generateAIAssist,
  hasEnoughContext, getMissingContextMessage,
  AI_ASSIST_PER_SPOT_LIMIT,
  type AIFieldType, type AIAssistUsage, type SpotContext,
} from '@/lib/aiAssistStore';
import { resolveTier, ENTITLEMENTS, FEATURE_FLAGS, PERMISSIONS, formatUsage } from '@/lib/entitlements';
import { AIAssistRichInline, defaultAITransform } from '@/components/shared/AIAssistInline';
import type { SpotVaultAccount } from '@/types';
import {
  type ContentSpot, type ContentTags, type QuizQuestion,
  type SpotType, type ContentBlock,
  TAG_OPTIONS, TAG_LABELS, SOURCE_OPTIONS, SPOT_TYPE_OPTIONS,
  POKER_SITE_OPTIONS, POKER_SITE_LABELS, DIFFICULTY_OPTIONS, DIFFICULTY_LABELS,
  COMPREHENSION_OPTIONS, COMPREHENSION_LABELS, STAKES_OPTIONS, STAKES_LABELS,
  type ComprehensionDifficulty, type TournamentStakes,
  fetchMySpots, fetchSpotById, saveDraft, updateExistingSpot, publishSpot, submitSpot, createNewSpot, deleteSpot,
} from '@/lib/contentLab';
import { PokerSiteLogo } from '@/components/shared/PokerSiteLogo';
import { DifficultyTag, ReadingTimeBadge, ComprehensionTag, StakesTag } from '@/components/shared/DifficultyTag';
import { getContentDepthStyle, normalizeContentDepth, getComprehensionStyle, normalizeComprehension, getStakesStyle, normalizeStakes } from '@/lib/difficultyColors';
import { persistPendingEvidence, type PendingEvidence } from '@/lib/evidenceStore';
import { FreeformBlockEditor, renderFreeformBlocks } from './FreeformBlockEditor';
import { WorkPackEditor } from './WorkPackEditor';
import { DocumentEditor, DocumentRenderer } from '@/components/contentLab/DocumentEditor';
import { EvidenceSection } from './EvidenceSection';
import { RecordingAttachments } from './RecordingAttachments';
import { supabase } from '@/lib/supabase';
import { findManualHand, type ManualHandRecord } from '@/lib/manualHandStore';
import { useUserPreferences } from '@/hooks/useUserPreferences';
import { CreatorGuide } from './CreatorGuide';
import { CardInsertionPalette, useCardInsertionTarget } from './CardInsertionPalette';
import { Spade as SpadeIcon, ImagePlus, PlayCircle } from 'lucide-react';
import { EditableTextField } from './EditableTextField';

const GOLD = '#d4a52c';
const GOLD_SOFT = '#f5e6b0';
const BORDER = 'rgba(212, 165, 44, 0.18)';

interface Props {
  account: SpotVaultAccount;
  onOpenLibrary?: () => void;
  editSpot?: ContentSpot | null;
  onEditConsumed?: () => void;
  onExitEditor?: () => void;
  portalSlug?: string | null;
}

type Section = 'source' | 'details' | 'content' | 'visual' | 'hand' | 'tags' | 'publishing';

type CreationMode = 'new' | 'draft' | 'edit';

function blankSpot(accountId: string, accountName: string, portalSlug?: string | null): ContentSpot {
  return {
    id: '',
    account_id: accountId,
    creator_name: accountName,
    status: 'draft',
    source: '',
    title: '',
    subtitle: null,
    introduction: null,
    hand_details: null,
    visual_details: null,
    content_html: '',
    image_urls: [],
    tags: {},
    is_monetized: false,
    price_credits: 0,
    show_in_courses: false,
    quiz: null,
    spot_type: 'structured',
    content_blocks: null,
    work_pack_stages: null,
    document_json: null,
    hand_id: null,
    poker_site: null,
    difficulty: null,
    comprehension_difficulty: null,
    tournament_stakes: null,
    published_at: null,
    portal_slug: portalSlug ?? null,
    created_at: '',
    updated_at: '',
  };
}

export function ContentLabView({ account, onOpenLibrary, editSpot, onEditConsumed, onExitEditor, portalSlug }: Props) {
  const [authUid, setAuthUid] = useState<string | null>(null);
  const [guideOpen, setGuideOpen] = useState(false);
  const [creationMode, setCreationMode] = useState<CreationMode>('new');
  const [typeSelected, setTypeSelected] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user?.id) setAuthUid(data.user.id);
    });
  }, []);

  const { prefs, loading: prefsLoading, markCreatorGuideSeen } = useUserPreferences(authUid);

  const triggerOnboardingEmail = useCallback(async () => {
    try {
      await supabase.functions.invoke('creator-onboarding-email');
    } catch {
      // Silent — email is best-effort
    }
  }, []);

  const handleGuideComplete = useCallback(async () => {
    setGuideOpen(false);
    await markCreatorGuideSeen();
    triggerOnboardingEmail();
  }, [markCreatorGuideSeen, triggerOnboardingEmail]);

  const handleGuideDismiss = useCallback(async () => {
    setGuideOpen(false);
    await markCreatorGuideSeen();
    triggerOnboardingEmail();
  }, [markCreatorGuideSeen, triggerOnboardingEmail]);

  const [spot, setSpot] = useState<ContentSpot | null>(() => blankSpot(account.id, account.name, portalSlug));
  const [sourceMetadata, setSourceMetadata] = useState<Record<string, string>>({});
  const [pendingEvidence, setPendingEvidence] = useState<PendingEvidence[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openSection, setOpenSection] = useState<Section>('source');
  const [autoDraftCreating, setAutoDraftCreating] = useState(false);
  const [mySpots, setMySpots] = useState<ContentSpot[]>([]);
  const [showList, setShowList] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [showNewConfirm, setShowNewConfirm] = useState(false);
  const [submitDestination, setSubmitDestination] = useState<'draft' | 'library' | 'sell'>('draft');
  const [sellPrice, setSellPrice] = useState(0);
  const [flowStage, setFlowStage] = useState<'creation' | 'destination'>('creation');
  const [showPreview, setShowPreview] = useState(false);
  const [aiUsage, setAIUsage] = useState<AIAssistUsage | null>(null);
  const [aiLoadingField, setAILoadingField] = useState<string | null>(null);
  const [aiSuggestion, setAISuggestion] = useState<{ field: AIFieldType; text: string } | null>(null);
  const [aiError, setAIError] = useState<string | null>(null);
  const userTier = resolveTier(account);
  const perms = PERMISSIONS[userTier];

  const contentRef = useRef<HTMLDivElement>(null);

  const cardInsertion = useCardInsertionTarget();
  const [cardPaletteOpen, setCardPaletteOpen] = useState(false);

  // Stays true for the entire edit session — not just during the fetch —
  // so loadSpots can never clobber an active edit with a blank "new" spot.
  const editSessionRef = useRef<string | null>(null);
  const editFetchInFlightRef = useRef(false);

  const loadSpots = useCallback(async () => {
    // Skip entirely when an edit is pending or in-flight — the edit effect will
    // manage loading state and spot data.  This prevents loadSpots (which fires
    // on mount before the edit effect sets the refs) from clobbering the edit.
    if (editFetchInFlightRef.current || editSessionRef.current) return;
    setLoading(true);
    const spots = await fetchMySpots(account.id);
    // An edit may have started or completed while we were fetching — don't clobber it.
    if (editFetchInFlightRef.current || editSessionRef.current) return;
    setMySpots(spots);
    setSpot(blankSpot(account.id, account.name, portalSlug));
    setSourceMetadata({});
    setCreationMode('new');
    setTypeSelected(false);
    setLoading(false);
  }, [account.id, account.name, portalSlug]);

  useEffect(() => { loadSpots(); }, [loadSpots]);

  // When an editSpot is provided (from My Spots EDIT click), load it directly in edit mode.
  // Keeps loading=true until data arrives so the blank Create page never flashes.
  // The guard uses a per-invoke token (not a shared ref set synchronously) so that
  // React StrictMode's double-invoke in dev cannot permanently poison the refs —
  // the cleanup of the first invoke resets the fetch ref before the second runs.
  useEffect(() => {
    if (!editSpot?.id) return;
    // If we already have this spot loaded and no fetch is in flight, skip.
    if (editSessionRef.current === editSpot.id && !editFetchInFlightRef.current) return;
    // If a fetch for this same spot is already in flight, don't start a duplicate.
    if (editFetchInFlightRef.current && editSessionRef.current === editSpot.id) return;

    const sessionToken = editSpot.id;
    editSessionRef.current = sessionToken;
    editFetchInFlightRef.current = true;
    let mounted = true;
    setLoading(true);
    setEditLoading(true);
    setEditError(null);
    (async () => {
      try {
        const loaded = await fetchSpotById(editSpot.id);
        if (!mounted) return;
        editFetchInFlightRef.current = false;
        if (!loaded) {
          setEditError('Unable to load this Spot for editing.');
          setLoading(false);
          setEditLoading(false);
          return;
        }
        // Safeguard: legacy freeform/work_pack spots are now edited in Document
        // Studio. Redirect them so previously created content stays editable.
        // Spots with content_html but no blocks were the old "structured" case
        // — leave those untouched so the rich-text accordion editor still loads.
        const isLegacyFreeform = loaded.spot_type === 'freeform' || loaded.spot_type === 'work_pack';
        const hasHtmlOnly = !loaded.content_blocks || loaded.content_blocks.length === 0;
        const corrected = isLegacyFreeform
          ? { ...loaded, spot_type: 'document' as const }
          : (loaded.spot_type === 'freeform' && hasHtmlOnly && loaded.content_html && loaded.content_html.replace(/<[^>]*>/g, '').trim().length > 0
            ? { ...loaded, spot_type: 'structured' as const }
            : loaded);
        setSpot(corrected);
        setSourceMetadata(corrected.source_metadata ?? {});
        setPendingEvidence([]);
        setCreationMode('edit');
        setTypeSelected(true);
        setDirty(false);
        setError(null);
        setAIUsage(null);
        setAISuggestion(null);
        setAIError(null);
        setSubmitDestination('draft');
        setSellPrice(0);
        setShowList(false);
        setFlowStage('creation');
        setShowPreview(false);
        setLoading(false);
        setEditLoading(false);
        fetchAIAssistUsage(loaded.id, account.id, resolveTier(account)).then(usage => { if (mounted) setAIUsage(usage); });
        // NOTE: We intentionally do NOT call onEditConsumed() here.
        // Clearing editSpot in the parent (PlayerHub) at this point would mean
        // that if this component remounts (ErrorBoundary recovery, StrictMode,
        // or any re-render cycle), the edit effect can no longer re-fire
        // because editSpot?.id is null. loadSpots would then run unguarded and
        // reset to a blank "new" spot — the exact regression we are fixing.
        // editSpot is cleared instead when the edit session truly ends:
        // resetCreationSession, onExitEditor, or onOpenLibrary.
      } catch (err) {
        if (!mounted) return;
        editFetchInFlightRef.current = false;
        setEditError('Unable to load this Spot for editing.');
        setLoading(false);
        setEditLoading(false);
      }
    })();
    return () => {
      mounted = false;
      // If the fetch hasn't completed yet (StrictMode double-invoke or unmount),
      // reset the in-flight flag so the next invoke can proceed cleanly.
      if (editSessionRef.current === sessionToken && editFetchInFlightRef.current) {
        editFetchInFlightRef.current = false;
        // Also clear the session ref so StrictMode's second invoke can re-run the fetch.
        editSessionRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editSpot?.id, account.id]);

  const refreshAIUsage = useCallback(async () => {
    if (spot?.id) {
      const usage = await fetchAIAssistUsage(spot.id, account.id, resolveTier(account));
      setAIUsage(usage);
    }
  }, [spot?.id, account.id]);

  const updateSpot = useCallback((patch: Partial<ContentSpot>) => {
    setSpot((prev) => prev ? { ...prev, ...patch } : prev);
    setDirty(true);
  }, []);

  const updateSourceMetadata = useCallback((key: string, value: string) => {
    setSourceMetadata((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  }, []);

  const handleInlineAITransform = useCallback(async (selectedText: string, action: string, customInstruction?: string): Promise<string | null> => {
    if (!spot?.id) return null;
    // AI Assist is Coming Soon — disabled for all tiers until flag is enabled
    if (!FEATURE_FLAGS.aiAssistEnabled || !perms.canUseAiAssist) return null;
    const tier = resolveTier(account);
    const entitlements = ENTITLEMENTS[tier];
    if (entitlements.aiAssistsWeekly === 0 && FEATURE_FLAGS.aiAssistEnabled) return null;
    const result = await defaultAITransform(selectedText, action, customInstruction);
    if (result && spot.id) {
      await recordAIAssistUsage(spot.id, account.id, 'content');
      await refreshAIUsage();
    }
    return result;
  }, [spot?.id, account, refreshAIUsage]);

  const handleAIAssist = useCallback(async (fieldType: AIFieldType, currentText: string) => {
    if (!spot?.id) return;
    if (!aiUsage || aiUsage.spotRemaining <= 0 || aiUsage.weekRemaining <= 0) return;

    const ctx: SpotContext = {
      title: spot.title,
      subtitle: spot.subtitle,
      introduction: spot.introduction,
      hand_details: spot.hand_details,
      content_html: spot.content_html,
      tags: spot.tags,
      source: spot.source,
    };

    if (!hasEnoughContext(ctx, fieldType)) {
      setAIError(getMissingContextMessage(fieldType));
      setTimeout(() => setAIError(null), 4000);
      return;
    }

    setAILoadingField(fieldType);
    setAIError(null);

    const { suggestion, error } = await generateAIAssist(fieldType, ctx, currentText);

    if (error || !suggestion) {
      setAIError(error || 'AI Assist couldn\'t generate a response. Try again.');
      setAILoadingField(null);
      setTimeout(() => setAIError(null), 4000);
      return;
    }

    const recorded = await recordAIAssistUsage(spot.id, account.id, fieldType);
    if (recorded) {
      await refreshAIUsage();
    }

    setAISuggestion({ field: fieldType, text: suggestion });
    setAILoadingField(null);
  }, [spot, aiUsage, account.id, refreshAIUsage]);

  const handleAIUseThis = useCallback(() => {
    if (!aiSuggestion || !spot) return;
    const { field, text } = aiSuggestion;
    if (field === 'title') updateSpot({ title: text });
    else if (field === 'subtitle') updateSpot({ subtitle: text });
    else if (field === 'introduction') updateSpot({ introduction: text });
    else if (field === 'hand_details') updateSpot({ hand_details: text });
    else if (field === 'content') updateSpot({ content_html: text.replace(/\n/g, '<br>') });
    setAISuggestion(null);
  }, [aiSuggestion, spot, updateSpot]);

  const handleAITryAgain = useCallback(async () => {
    if (!aiSuggestion || !spot) return;
    if (!aiUsage || aiUsage.spotRemaining <= 0 || aiUsage.weekRemaining <= 0) {
      setAIError('AI limit reached for this Spot.');
      return;
    }
    const currentText = aiSuggestion.text;
    setAISuggestion(null);
    await handleAIAssist(aiSuggestion.field, currentText);
  }, [aiSuggestion, spot, aiUsage, handleAIAssist]);

  const handleAISelectSpot = useCallback(async (s: ContentSpot) => {
    if (dirty) { setShowNewConfirm(true); return; }
    setSpot(s);
    setSourceMetadata(s.source_metadata ?? {});
    setPendingEvidence([]);
    setCreationMode(s.status === 'draft' ? 'draft' : 'edit');
    setTypeSelected(true);
    setShowList(false);
    setDirty(false);
    setError(null);
    setAIUsage(null);
    setAISuggestion(null);
    setAIError(null);
    const usage = await fetchAIAssistUsage(s.id, account.id, resolveTier(account));
    setAIUsage(usage);
  }, [dirty, account.id]);

  const persistEvidence = useCallback(async (spotId: string): Promise<boolean> => {
    if (pendingEvidence.length === 0) return true;
    const result = await persistPendingEvidence(spotId, pendingEvidence);
    setPendingEvidence(result.failed);
    if (result.failed.length > 0) {
      setError(`Evidence upload failed for: ${result.failed.map((item) => item.file.name).join(', ')}. Please retry.`);
      return false;
    }
    return true;
  }, [pendingEvidence]);

  const handleSaveExisting = useCallback(async (opts?: { exitAfter?: boolean }): Promise<boolean> => {
    if (!spot?.id) return false;
    setSaving(true);
    setError(null);
    if (!(await persistEvidence(spot.id))) {
      setSaving(false);
      return false;
    }
    const saved = await updateExistingSpot({ ...spot, source_metadata: sourceMetadata });
    if (saved) {
      setSpot(saved);
      setSourceMetadata(saved.source_metadata ?? {});
      setDirty(false);
      setFlowStage('creation');
      setSavedMsg('Changes saved');
      setTimeout(() => setSavedMsg(null), 2000);
      setSaving(false);
      if (opts?.exitAfter) {
        onExitEditor?.();
      }
      return true;
    } else {
      setError('Failed to save changes. Please try again.');
      setSaving(false);
      return false;
    }
  }, [spot, sourceMetadata, persistEvidence, onExitEditor]);

  const handleSaveDraft = useCallback(async () => {
    if (!spot) return;
    setSaving(true);
    setError(null);
    let toSave = spot;
    if (!spot.id) {
      const created = await createNewSpot(account.id, account.name, portalSlug);
      if (!created) {
        setError('Failed to create draft. Please try again.');
        setSaving(false);
        return;
      }
      toSave = { ...created, ...spot, id: created.id };
      setSpot(toSave);
      setMySpots((prev) => [toSave, ...prev]);
    }
    if (!(await persistEvidence(toSave.id))) {
      setSaving(false);
      return;
    }
    const saved = await saveDraft({ ...toSave, source_metadata: sourceMetadata });
    if (saved) {
      setSpot(saved);
      setDirty(false);
      setSavedMsg('Draft saved');
      setTimeout(() => setSavedMsg(null), 2000);
      await loadSpots();
    } else {
      setError('Failed to save draft. Please try again.');
    }
    setSaving(false);
  }, [spot, sourceMetadata, account.id, account.name, loadSpots, persistEvidence, portalSlug]);

  const resetCreationSession = useCallback(() => {
    editSessionRef.current = null;
    editFetchInFlightRef.current = false;
    setSpot(blankSpot(account.id, account.name, portalSlug));
    setSourceMetadata({});
    setCreationMode('new');
    setTypeSelected(false);
    setOpenSection('source');
    setDirty(false);
    setError(null);
    setAIUsage(null);
    setAISuggestion(null);
    setAIError(null);
    setSubmitDestination('draft');
    setSellPrice(0);
    setShowList(false);
    setFlowStage('creation');
    setShowPreview(false);
    setPendingEvidence([]);
    setEditError(null);
    // Now that the edit session is truly ending, tell the parent to clear
    // editSpot. This is the safe point to do so — the editor is resetting to
    // a blank "new" spot, so a remount after this will correctly show the
    // creation screen rather than re-loading a stale edit target.
    onEditConsumed?.();
  }, [account.id, account.name, portalSlug, onEditConsumed]);

  const handlePublish = useCallback(async () => {
    if (!spot) return;
    const missing: string[] = [];
    if (!spot.title.trim()) missing.push('Spot Title');
    const isFreeformLike = spot.spot_type === 'freeform' || spot.spot_type === 'work_pack';
    const hasFreeformContent = isFreeformLike && ((spot.content_blocks && spot.content_blocks.some((b) => (b.text && b.text.trim()) || (b.items && b.items.some(Boolean)) || b.url)) || (spot.work_pack_stages && spot.work_pack_stages.some((s) => s.title.trim() || s.blocks.some((b) => (b.text && b.text.trim()) || b.url))));
    const hasRichContent = !!spot.content_html && spot.content_html.replace(/<[^>]*>/g, '').trim().length > 0;
    const hasDocumentContent = spot.spot_type === 'document' && (!!spot.document_json || !!((spot.content_blocks && spot.content_blocks.some((b) => (b.text && b.text.trim()) || (b.items && b.items.some(Boolean)) || b.url)) || (spot.work_pack_stages && spot.work_pack_stages.some((s) => s.title.trim() || s.blocks.some((b) => (b.text && b.text.trim()) || b.url)))));
    if (!hasFreeformContent && !hasRichContent && !hasDocumentContent) missing.push('Main Content');
    if (spot.is_monetized && spot.price_credits <= 0) missing.push('Price (required for paid content)');
    if (spot.quiz && spot.quiz.length > 0) {
      spot.quiz.forEach((q, i) => {
        if (!q.question.trim()) missing.push(`Quiz Question ${i + 1}`);
        if (q.options.some((o) => !o.trim())) missing.push(`Quiz Answer Choices (Question ${i + 1})`);
      });
    }
    if (missing.length > 0) {
      setError(`Cannot publish — missing: ${missing.join(', ')}`);
      if (!spot.title.trim()) setOpenSection('details');
      else if (!hasDocumentContent && !spot.content_html?.replace(/<[^>]*>/g, '').trim()) setOpenSection('content');
      else if (spot.is_monetized && spot.price_credits <= 0) setOpenSection('publishing');
      return;
    }
    setSaving(true);
    setError(null);
    let toPublish = spot;
    if (!spot.id) {
      const created = await createNewSpot(account.id, account.name, portalSlug);
      if (!created) {
        setError('Failed to create content. Please try again.');
        setSaving(false);
        return;
      }
      toPublish = { ...created, ...spot, id: created.id, source_metadata: sourceMetadata };
      setSpot(toPublish);
    }
    if (!(await persistEvidence(toPublish.id))) {
      setSaving(false);
      return;
    }
    const published = await publishSpot(toPublish.id, { ...toPublish, source_metadata: sourceMetadata });
    if (published) {
      setSavedMsg('Published successfully');
      setTimeout(() => setSavedMsg(null), 3000);
      resetCreationSession();
      await loadSpots();
    } else {
      setError('Failed to publish. Please try again.');
    }
    setSaving(false);
  }, [spot, sourceMetadata, resetCreationSession, loadSpots, persistEvidence]);

  const handleSubmit = useCallback(async () => {
    if (!spot) return;
    if (!spot.title.trim()) {
      setError('Title is required to submit.');
      setOpenSection('details');
      return;
    }
    setSaving(true);
    setError(null);
    let toSubmit = spot;
    if (!spot.id) {
      const created = await createNewSpot(account.id, account.name, portalSlug);
      if (!created) {
        setError('Failed to create content. Please try again.');
        setSaving(false);
        return;
      }
      toSubmit = { ...created, ...spot, id: created.id, source_metadata: sourceMetadata };
      setSpot(toSubmit);
    }
    if (!(await persistEvidence(toSubmit.id))) {
      setSaving(false);
      return;
    }
    const submitted = await submitSpot(toSubmit.id, { ...toSubmit, source_metadata: sourceMetadata });
    if (submitted) {
      setSavedMsg('Submitted for review');
      setTimeout(() => setSavedMsg(null), 3000);
      resetCreationSession();
      await loadSpots();
    } else {
      setError('Failed to submit. Please try again.');
    }
    setSaving(false);
  }, [spot, sourceMetadata, resetCreationSession, loadSpots, persistEvidence]);

  const handleSubmitDestination = useCallback(async () => {
    if (!spot) return;
    if (!spot.title.trim()) {
      setError('Title is required.');
      setOpenSection('details');
      return;
    }
    const entitlements = ENTITLEMENTS[userTier];
    const isPersonalSave = submitDestination === 'draft' || submitDestination === 'library';
    if (isPersonalSave && !perms.canCreateSpot) {
      setError('Creating and saving Spots requires a Core, Pro, or Elite membership.');
      return;
    }
    if (submitDestination === 'sell') {
      if (!FEATURE_FLAGS.monetizationEnabled) {
        setError('Monetized Spots are coming soon. Save to your library for now.');
        return;
      }
      const canSell = account.role === 'superuser' || account.role === 'staff' || account.role === 'developer_admin' || account.role === 'universal_access' || account.homePortal === 'CREATOR';
      if (!canSell) {
        setError('Selling privileges are required to list content on the marketplace. Visit your account settings to request creator/seller access.');
        return;
      }
      if (sellPrice <= 0) {
        setError('Enter a valid price to sell this spot.');
        return;
      }
    }
    setSaving(true);
    setError(null);
    let toSave = spot;
    if (!spot.id) {
      const created = await createNewSpot(account.id, account.name, portalSlug);
      if (!created) {
        setError('Failed to create content. Please try again.');
        setSaving(false);
        return;
      }
      toSave = { ...created, ...spot, id: created.id };
      setSpot(toSave);
    }
    if (!(await persistEvidence(toSave.id))) {
      setSaving(false);
      return;
    }

    const wasLibraryOrSell = submitDestination === 'library' || submitDestination === 'sell';
    if (submitDestination === 'draft') {
      const saved = await saveDraft({ ...toSave, source_metadata: sourceMetadata });
      if (saved) {
        setSavedMsg('Draft saved');
        setTimeout(() => setSavedMsg(null), 2000);
        resetCreationSession();
        await loadSpots();
      } else {
        setError('Failed to save draft. Please try again.');
      }
    } else if (submitDestination === 'library') {
      const patch = { ...toSave, is_monetized: false, price_credits: 0, status: 'published' as const, source_metadata: sourceMetadata };
      const published = await publishSpot(toSave.id, patch);
      if (published) {
        setSavedMsg('Saved to your library');
        setTimeout(() => setSavedMsg(null), 3000);
        resetCreationSession();
        await loadSpots();
      } else {
        setError('Failed to save to library. Please try again.');
      }
    } else if (submitDestination === 'sell') {
      const patch = { ...toSave, is_monetized: true, price_credits: sellPrice, status: 'published' as const, source_metadata: sourceMetadata };
      const published = await publishSpot(toSave.id, patch);
      if (published) {
        setSavedMsg('Listed on marketplace');
        setTimeout(() => setSavedMsg(null), 3000);
        resetCreationSession();
        await loadSpots();
      } else {
        setError('Failed to list on marketplace. Please try again.');
      }
    }
    void wasLibraryOrSell;
    setSaving(false);
  }, [spot, sourceMetadata, submitDestination, sellPrice, account, loadSpots, resetCreationSession, persistEvidence]);

  const handleNewSpot = useCallback(async () => {
    if (dirty) {
      setShowNewConfirm(true);
      return;
    }
    resetCreationSession();
  }, [dirty, resetCreationSession]);

  const createNew = useCallback(async () => {
    resetCreationSession();
  }, [resetCreationSession]);

  const handleConfirmNew = useCallback(async () => {
    setShowNewConfirm(false);
    await createNew();
  }, [createNew]);

  const handleDelete = useCallback(async (id: string) => {
    const ok = await deleteSpot(id);
    if (ok) {
      const remaining = mySpots.filter((s) => s.id !== id);
      setMySpots(remaining);
      if (spot?.id === id) {
        resetCreationSession();
      }
    }
  }, [mySpots, spot, resetCreationSession]);

  if (loading) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3">
        <Loader2 className="h-6 w-6 animate-spin" style={{ color: GOLD }} strokeWidth={1.5} />
        <p className="text-[11px] font-medium tracking-wide text-white/40">
          {editFetchInFlightRef.current || editSessionRef.current ? 'Loading Spot for editing…' : 'Loading Content Lab…'}
        </p>
      </div>
    );
  }

  // Edit-load error: show a dedicated error state with retry/back buttons.
  // The editor shell stays visible so the user is never left with blank wallpaper.
  if (editError) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 px-6 py-16 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-red-400/20 bg-red-400/5">
          <AlertCircle className="h-6 w-6 text-red-400/70" strokeWidth={1.5} />
        </div>
        <p className="text-[13px] font-semibold text-white/80">{editError}</p>
        <p className="max-w-sm text-[11px] leading-relaxed text-white/40">
          The Spot may have been deleted, or there was a problem loading it from the database.
        </p>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setEditError(null);
              editSessionRef.current = null;
              if (onExitEditor) onExitEditor();
              else onOpenLibrary?.();
            }}
            className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-[11px] font-bold tracking-widest uppercase text-white/50 transition-colors hover:bg-white/10 hover:text-white/80"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to My Spots
          </button>
          <button
            onClick={() => {
              const sid = editSessionRef.current || editSpot?.id;
              if (!sid) {
                onExitEditor?.();
                return;
              }
              setEditError(null);
              editFetchInFlightRef.current = true;
              setLoading(true);
              setEditLoading(true);
              (async () => {
                const loaded = await fetchSpotById(sid);
                editFetchInFlightRef.current = false;
                if (!loaded) {
                  setEditError('Unable to load this Spot for editing.');
                  setLoading(false);
                  setEditLoading(false);
                  return;
                }
                setSpot(loaded);
                setCreationMode('edit');
                setTypeSelected(true);
                setDirty(false);
                setError(null);
                setLoading(false);
                setEditLoading(false);
              })();
            }}
            className="flex items-center gap-1.5 rounded-lg border border-[#c0911e]/40 bg-[#c0911e]/15 px-4 py-2 text-[11px] font-bold tracking-widest uppercase text-[#f5e6b0] transition-colors hover:bg-[#c0911e]/25"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Retry
          </button>
        </div>
      </div>
    );
  }

  const completedCount = [
    !!spot?.source,
    !!spot?.title.trim(),
    (!!spot?.content_html && spot.content_html.replace(/<[^>]*>/g, '').trim().length > 0) || (!!spot?.document_json),
    Object.values(spot?.tags ?? {}).some((v) => typeof v === 'string' && v.length > 0),
    spot?.status === 'published' || spot?.status === 'submitted' || spot?.show_in_courses || spot?.is_monetized,
  ].filter(Boolean).length;

  return (
    <div className="flex items-start justify-center px-3 pb-24 pt-4 md:items-center md:px-6 md:pb-8 md:pt-10" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 6rem)' }}>
      {guideOpen && (
        <CreatorGuide
          onComplete={handleGuideComplete}
          onDismiss={handleGuideDismiss}
        />
      )}
      <div className="flex w-full flex-col overflow-hidden rounded-2xl border backdrop-blur-md md:w-[72%] lg:w-[70%]" style={{ maxWidth: '1100px', height: 'min(85vh, 820px)', borderColor: 'rgba(212,165,44,0.18)', background: 'rgba(6,8,10,0.55)', boxShadow: '0 24px 60px -20px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.03)' }}>
      {/* Header bar */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b px-4 py-3" style={{ borderColor: 'rgba(212,165,44,0.10)', background: 'rgba(4,5,7,0.6)' }}>
        <div className="flex items-center gap-3">
          {(creationMode === 'edit' || creationMode === 'draft') && onExitEditor && (
            <button
              onClick={onExitEditor}
              className="flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2 py-1.5 text-[9px] font-bold uppercase tracking-wide text-white/50 transition-colors hover:text-white/80"
              title="Back to My Spots"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Exit
            </button>
          )}
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border" style={{ borderColor: BORDER, background: 'rgba(212,165,44,0.08)' }}>
            <FileText className="h-4 w-4" style={{ color: GOLD }} strokeWidth={1.5} />
          </div>
          <div>
            <h2 className="text-[13px] font-bold text-white">Content Lab</h2>
            <p className="text-[9px] text-white/30">Build and publish structured poker spots</p>
          </div>
          <button
            onClick={() => setGuideOpen(true)}
            title="Creator Guide"
            className="ml-1 flex items-center gap-1 rounded-md border border-[#c0911e]/30 bg-[#c0911e]/10 px-2.5 py-1.5 text-[9px] font-bold tracking-widest uppercase text-[#f5e6b0] transition-all hover:bg-[#c0911e]/20"
          >
            <HelpCircle className="h-3 w-3" style={{ color: GOLD }} />
            Guide
          </button>
          {/* Card insertion palette */}
          <div className="relative">
            <button
              onClick={() => setCardPaletteOpen(!cardPaletteOpen)}
              title="Insert Playing Card"
              className="flex items-center gap-1 rounded-md border border-[#c0911e]/30 bg-[#c0911e]/10 px-2 py-1.5 text-[9px] font-bold tracking-widest uppercase text-[#f5e6b0] transition-all hover:bg-[#c0911e]/20"
            >
              <SpadeIcon className="h-3 w-3" style={{ color: GOLD }} />
              Cards
            </button>
            <CardInsertionPalette
              open={cardPaletteOpen}
              onClose={() => setCardPaletteOpen(false)}
              onInsert={(cardText) => cardInsertion.insertCardText(cardText)}
              hasActiveField={cardInsertion.hasActiveField}
              getUsedCards={cardInsertion.getUsedCards}
            />
          </div>
          <div className="ml-1 flex items-center gap-1.5 rounded-full border px-2.5 py-1" style={{ borderColor: completedCount === 5 ? 'rgba(212,165,44,0.35)' : 'rgba(255,255,255,0.08)', background: completedCount > 0 ? 'rgba(212,165,44,0.06)' : 'transparent' }}>
            <span className="text-[9px] font-bold tracking-widest uppercase" style={{ color: completedCount === 5 ? GOLD_SOFT : 'rgba(255,255,255,0.35)' }}>
              {completedCount} / 5
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowList(!showList)}
            className="flex items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-2.5 py-1.5 text-[10px] font-medium text-white/60 transition-colors hover:text-white/80"
          >
            <Library className="h-3.5 w-3.5" strokeWidth={1.5} />
            Drafts ({mySpots.length})
          </button>
          {creationMode === 'edit' && (
            <button
              onClick={() => void handleSaveExisting()}
              disabled={saving}
              className="flex items-center gap-1.5 rounded-md border border-[#d4a52c]/40 bg-[#c0911e]/15 px-2.5 py-1.5 text-[10px] font-bold text-[#f5e6b0] transition-colors hover:bg-[#c0911e]/25 disabled:opacity-40"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Save Changes
            </button>
          )}
          <button
            onClick={handleNewSpot}
            className="flex items-center gap-1.5 rounded-md border border-[#c0911e]/30 bg-[#c0911e]/10 px-2.5 py-1.5 text-[10px] font-bold text-[#d4a52c] transition-colors hover:bg-[#c0911e]/20"
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={2} />
            New
          </button>
        </div>
      </div>

      {/* Draft list overlay */}
      {showList && (
        <div className="shrink-0 border-b border-white/[0.06] bg-[#0a0c0e]/90 px-4 py-3 max-h-48 overflow-y-auto">
          <div className="flex flex-col gap-1">
            {mySpots.map((s) => (
              <div
                key={s.id}
                className={`flex items-center gap-3 rounded-md border px-3 py-2 cursor-pointer transition-colors ${
                  spot?.id === s.id ? 'border-[#c0911e]/30 bg-[#c0911e]/8' : 'border-white/5 hover:bg-white/5'
                }`}
                onClick={() => handleAISelectSpot(s)}
              >
                <FileText className="h-3.5 w-3.5 shrink-0 text-white/30" strokeWidth={1.5} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[11px] font-medium text-white/80">{s.title || 'Untitled'}</p>
                  <p className="text-[9px] text-white/30">{s.source || 'No source'} · {s.status}</p>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDelete(s.id); }}
                  className="text-white/20 hover:text-red-400"
                >
                  <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Accordion builder — includes destination/submit at the end of normal flow */}
      <div
        className="flex-1 overflow-y-auto"
        style={{ scrollbarWidth: 'thin' }}
        onFocusCapture={(event) => {
          const target = event.target;
          if (target instanceof HTMLInputElement) cardInsertion.registerField(target, 'input');
          else if (target instanceof HTMLTextAreaElement) cardInsertion.registerField(target, 'textarea');
          else if (target instanceof HTMLDivElement && target.isContentEditable) cardInsertion.registerField(target, 'rich');
        }}
        onSelectCapture={() => cardInsertion.captureSelection()}
      >
        <div className="px-4 py-4 pb-8">
          {spot && !typeSelected && (
            <div className="flex flex-col items-center justify-center py-8">
              <div className="mb-1 flex items-center gap-2">
                <LayoutTemplate className="h-5 w-5" style={{ color: GOLD }} strokeWidth={1.5} />
                <h3 className="text-[14px] font-bold text-white">What are you creating?</h3>
              </div>
              <p className="mb-6 text-[10px] text-white/35">Choose a content type to begin.</p>
              <div className="w-full max-w-md space-y-2">
                {SPOT_TYPE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => updateSpot({ spot_type: opt.value as SpotType })}
                    className="flex w-full items-start gap-3 rounded-lg border p-4 text-left transition-all"
                    style={{
                      borderColor: spot.spot_type === opt.value ? 'rgba(212,165,44,0.4)' : 'rgba(255,255,255,0.08)',
                      background: spot.spot_type === opt.value ? 'rgba(212,165,44,0.08)' : 'transparent',
                    }}
                  >
                    <span
                      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 mt-0.5"
                      style={{
                        borderColor: spot.spot_type === opt.value ? GOLD : 'rgba(255,255,255,0.15)',
                        background: spot.spot_type === opt.value ? GOLD : 'transparent',
                      }}
                    >
                      {spot.spot_type === opt.value && <Check className="h-2.5 w-2.5 text-black" strokeWidth={3} />}
                    </span>
                    <div>
                      <p className="text-[12px] font-bold" style={{ color: spot.spot_type === opt.value ? GOLD_SOFT : 'rgba(255,255,255,0.8)' }}>{opt.label}</p>
                      <p className="mt-0.5 text-[10px] text-white/40">{opt.description}</p>
                    </div>
                  </button>
                ))}
              </div>
              <button
                onClick={() => setTypeSelected(true)}
                className="mt-6 flex items-center gap-2 rounded-lg border border-[#c0911e]/40 bg-[#c0911e]/15 px-6 py-2.5 text-[12px] font-bold tracking-widest uppercase text-[#f5e6b0] transition-all hover:bg-[#c0911e]/25"
              >
                Continue
                <ChevronRight className="h-4 w-4" strokeWidth={2} />
              </button>
            </div>
          )}
          {spot && typeSelected && (
            <>
              {/* Selected type indicator + change button */}
              <div className="mb-3 flex items-center justify-between rounded-lg border px-3 py-2" style={{ borderColor: 'rgba(212,165,44,0.12)', background: 'rgba(212,165,44,0.04)' }}>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold tracking-widest uppercase text-[#f5e6b0]">
                    {SPOT_TYPE_OPTIONS.find(o => o.value === spot.spot_type)?.label ?? 'Document Studio'}
                  </span>
                  <span className="rounded-full border border-white/10 px-2 py-0.5 text-[8px] font-bold uppercase text-white/35">
                    {creationMode === 'new' ? 'New' : creationMode === 'draft' ? 'Draft' : 'Edit'}
                  </span>
                </div>
                <button
                  onClick={() => {
                    if (dirty) {
                      setShowNewConfirm(true);
                    } else {
                      setTypeSelected(false);
                    }
                  }}
                  className="flex items-center gap-1 text-[9px] font-bold uppercase text-white/40 hover:text-white/60 transition"
                >
                  <RefreshCcw className="h-3 w-3" /> Change Type
                </button>
              </div>

              {/* DOCUMENT STUDIO — document-first editor with TipTap.
                  Also handles legacy freeform/work_pack content which now
                  lives here instead of as a separate creation mode. */}
              {spot.spot_type === 'document' && flowStage === 'creation' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <PenLine className="h-4 w-4" style={{ color: GOLD }} strokeWidth={1.5} />
                    <h3 className="text-[14px] font-bold text-white">Document Studio</h3>
                  </div>
                  <p className="text-[10px] text-white/35">Write your article naturally. Insert interactive tools from the Tools menu in the toolbar.</p>
                  <div>
                    <label className="mb-1 block text-[9px] font-semibold tracking-widest text-white/40 uppercase">Title</label>
                    <input
                      value={spot.title}
                      onChange={(e) => updateSpot({ title: e.target.value })}
                      placeholder="Article title..."
                      className="w-full rounded-md border border-[#232a32] bg-[#0a0c0e] px-3 py-2.5 text-[14px] font-bold text-white outline-none focus:border-[#c0911e]/40"
                    />
                  </div>
                  <DocumentEditor
                    documentJson={spot.document_json}
                    onChange={(json) => updateSpot({ document_json: json })}
                    accountId={spot.account_id || account.id}
                  />
                  {/* Legacy content — shown for previously created freeform/work_pack
                      spots so the author can see and edit existing material while
                      transitioning to the document canvas. */}
                  {((spot.content_blocks && spot.content_blocks.length > 0) || (spot.work_pack_stages && spot.work_pack_stages.length > 0)) && (
                    <div className="space-y-2 rounded-lg border border-white/[0.06] bg-white/[0.02] p-4">
                      <div className="flex items-center gap-2">
                        <PenLine className="h-3.5 w-3.5" style={{ color: GOLD }} strokeWidth={1.5} />
                        <span className="text-[10px] font-semibold tracking-widest text-white/40 uppercase">Previous Content</span>
                      </div>
                      <p className="text-[10px] text-white/30">This content was created in the earlier editor. You can edit it below or recreate it in the document above.</p>
                      {spot.work_pack_stages && spot.work_pack_stages.length > 0 ? (
                        <WorkPackEditor
                          stages={spot.work_pack_stages}
                          onChange={(stages) => updateSpot({ work_pack_stages: stages })}
                          onFieldFocus={(el) => cardInsertion.registerField(el, 'rich')}
                          onFieldSelect={() => cardInsertion.captureSelection()}
                        />
                      ) : (
                        <FreeformBlockEditor
                          blocks={spot.content_blocks || []}
                          onChange={(blocks) => updateSpot({ content_blocks: blocks })}
                          onFieldFocus={(el) => cardInsertion.registerField(el, 'rich')}
                          onFieldSelect={() => cardInsertion.captureSelection()}
                        />
                      )}
                    </div>
                  )}
                  <div>
                    <label className="mb-2 block text-[9px] font-semibold tracking-widest text-white/40 uppercase">Evidence</label>
                    {spot.id ? (
                      <EvidenceSection spotId={spot.id} pendingEvidence={pendingEvidence} onPendingChange={setPendingEvidence} />
                    ) : (
                      <EvidenceSection pendingEvidence={pendingEvidence} onPendingChange={setPendingEvidence} />
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowPreview(true)}
                      className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-[10px] font-bold tracking-widest uppercase text-white/60 transition-all hover:bg-white/10"
                    >
                      <Eye className="h-3.5 w-3.5" strokeWidth={1.5} /> Preview
                    </button>
                    <button
                      onClick={() => setFlowStage('destination')}
                      className="flex items-center gap-2 rounded-lg border border-[#c091e]/40 bg-[#c091e]/15 px-6 py-2.5 text-[12px] font-bold tracking-widest uppercase text-[#f5e6b0] transition-all hover:bg-[#c091e]/25"
                    >
                      Continue <ChevronRight className="h-4 w-4" strokeWidth={2} />
                    </button>
                  </div>
                </div>
              )}

              {/* STRUCTURED — guided accordion sections */}
              {spot.spot_type === 'structured' && flowStage === 'creation' && (
                <>
              <AccordionSection
                title="Source"
                icon={Globe}
                helper="Where did this spot come from?"
                isOpen={openSection === 'source'}
                onToggle={() => setOpenSection(openSection === 'source' ? '' : 'source')}
                complete={!!spot.source}
              >
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-1.5">
                    {SOURCE_OPTIONS.map((src) => (
                      <button
                        key={src}
                        onClick={() => updateSpot({ source: src })}
                        className="rounded-full border px-3 py-1.5 text-[10px] font-medium transition-all"
                        style={{
                          borderColor: spot.source === src ? 'rgba(212,165,44,0.4)' : 'rgba(255,255,255,0.08)',
                          background: spot.source === src ? 'rgba(212,165,44,0.12)' : 'transparent',
                          color: spot.source === src ? GOLD_SOFT : 'rgba(255,255,255,0.5)',
                        }}
                      >
                        {src}
                      </button>
                    ))}
                  </div>
                  {/* Contextual source fields — stored independently from Spot Details */}
                  {spot.source === 'Tournament' && (
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                      <input
                        placeholder="Tournament name"
                        className="input-base"
                        value={sourceMetadata.tournamentName || ''}
                        onChange={(e) => updateSourceMetadata('tournamentName', e.target.value)}
                      />
                      <input
                        placeholder="Buy-in"
                        className="input-base"
                        value={sourceMetadata.buyIn || ''}
                        onChange={(e) => updateSourceMetadata('buyIn', e.target.value)}
                      />
                      <input
                        placeholder="Stage (e.g. Final Table)"
                        className="input-base"
                        value={sourceMetadata.stage || ''}
                        onChange={(e) => updateSourceMetadata('stage', e.target.value)}
                      />
                    </div>
                  )}
                  {spot.source === 'Cash Game' && (
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <input
                        placeholder="Stakes (e.g. $2/$5)"
                        className="input-base"
                        value={sourceMetadata.stakes || ''}
                        onChange={(e) => updateSourceMetadata('stakes', e.target.value)}
                      />
                      <input
                        placeholder="Game type (e.g. NLHE)"
                        className="input-base"
                        value={sourceMetadata.gameType || ''}
                        onChange={(e) => updateSourceMetadata('gameType', e.target.value)}
                      />
                    </div>
                  )}
                  {spot.source === 'Hand History' && (
                    <EditableTextField
                      value={sourceMetadata.handHistory || ''}
                      onChange={(v) => updateSourceMetadata('handHistory', v)}
                      placeholder="Paste or describe the hand history..."
                      multiline
                      rows={3}
                      onFieldFocus={(el) => cardInsertion.registerField(el, 'rich')}
                      onFieldSelect={() => cardInsertion.captureSelection()}
                      className="input-base"
                    />
                  )}
                  {spot.source === 'Solver' && (
                    <EditableTextField
                      value={sourceMetadata.solverOutput || ''}
                      onChange={(v) => updateSourceMetadata('solverOutput', v)}
                      placeholder="Describe solver output or upload screenshots below..."
                      multiline
                      rows={2}
                      onFieldFocus={(el) => cardInsertion.registerField(el, 'rich')}
                      onFieldSelect={() => cardInsertion.captureSelection()}
                      className="input-base"
                    />
                  )}
                  {spot.source === 'Video' && (
                    <input
                      placeholder="Video link (YouTube, Vimeo, etc.)"
                      className="input-base"
                      value={sourceMetadata.videoLink || ''}
                      onChange={(e) => updateSourceMetadata('videoLink', e.target.value)}
                    />
                  )}
                  {spot.source === 'Other' && (
                    <EditableTextField
                      value={sourceMetadata.otherDescription || ''}
                      onChange={(v) => updateSourceMetadata('otherDescription', v)}
                      placeholder="Describe the source..."
                      multiline
                      rows={2}
                      onFieldFocus={(el) => cardInsertion.registerField(el, 'rich')}
                      onFieldSelect={() => cardInsertion.captureSelection()}
                      className="input-base"
                    />
                  )}
                </div>
              </AccordionSection>

              <AccordionSection
                title="Spot Details"
                icon={LayoutTemplate}
                helper="Define the poker situation."
                isOpen={openSection === 'details'}
                onToggle={() => setOpenSection(openSection === 'details' ? '' : 'details')}
                complete={!!spot.title.trim()}
              >
                <div className="space-y-4">
                  <div>
                    <label className="mb-1 flex items-center justify-between">
                      <span className="text-[9px] font-semibold tracking-widest text-white/40 uppercase">Spot Title <span className="text-red-400">*</span></span>
                    </label>
                    <EditableTextField
                      value={spot.title}
                      onChange={(v) => updateSpot({ title: v })}
                      placeholder="Enter spot title..."
                      multiline={false}
                      onFieldFocus={(el) => cardInsertion.registerField(el, 'rich')}
                      onFieldSelect={() => cardInsertion.captureSelection()}
                      className="w-full rounded-md border border-[#232a32] bg-[#0a0c0e] px-3 py-2 text-[12px] text-white outline-none focus:border-[#c0911e]/40"
                    />
                  </div>
                  <div>
                    <label className="mb-1 flex items-center justify-between">
                      <span className="text-[9px] font-semibold tracking-widest text-white/40 uppercase">Subtitle</span>
                    </label>
                    <EditableTextField
                      value={spot.subtitle || ''}
                      onChange={(v) => updateSpot({ subtitle: v })}
                      placeholder="Optional subtitle..."
                      multiline={false}
                      onFieldFocus={(el) => cardInsertion.registerField(el, 'rich')}
                      onFieldSelect={() => cardInsertion.captureSelection()}
                      className="w-full rounded-md border border-[#232a32] bg-[#0a0c0e] px-3 py-2 text-[12px] text-white outline-none focus:border-[#c0911e]/40"
                    />
                  </div>
                  <div>
                    <label htmlFor="spot-poker-site" className="mb-1 block text-[9px] font-semibold tracking-widest text-white/40 uppercase">Poker Site / Platform</label>
                    <input
                      id="spot-poker-site"
                      list="spot-poker-site-options"
                      value={spot.poker_site || ''}
                      onChange={(e) => updateSpot({ poker_site: e.target.value || null })}
                      placeholder="Search or select a platform..."
                      className="w-full rounded-md border border-[#232a32] bg-[#0a0c0e] px-3 py-2 text-[12px] text-white outline-none focus:border-[#c0911e]/40 placeholder:text-white/20"
                    />
                    <datalist id="spot-poker-site-options">
                      {POKER_SITE_OPTIONS.map((site) => <option key={site} value={site}>{POKER_SITE_LABELS[site]}</option>)}
                    </datalist>
                    {spot.poker_site && <div className="mt-2 flex items-center gap-2"><PokerSiteLogo site={spot.poker_site} size={28} /><span className="text-[10px] text-white/40">{POKER_SITE_LABELS[spot.poker_site] ?? spot.poker_site}</span></div>}
                  </div>
                  <div>
                    <label className="mb-1 flex items-center justify-between">
                      <span className="text-[9px] font-semibold tracking-widest text-white/40 uppercase">Introduction / Overview</span>
                    </label>
                    <EditableTextField
                      value={spot.introduction || ''}
                      onChange={(v) => updateSpot({ introduction: v })}
                      placeholder="Brief overview of the spot..."
                      multiline
                      rows={3}
                      onFieldFocus={(el) => cardInsertion.registerField(el, 'rich')}
                      onFieldSelect={() => cardInsertion.captureSelection()}
                      className="w-full rounded-md border border-[#232a32] bg-[#0a0c0e] px-3 py-2 text-[12px] text-white outline-none focus:border-[#c0911e]/40"
                    />
                  </div>
                  <div>
                    <label className="mb-1 flex items-center justify-between">
                      <span className="text-[9px] font-semibold tracking-widest text-white/40 uppercase">Hand Details / Scenario</span>
                    </label>
                    <EditableTextField
                      value={spot.hand_details || ''}
                      onChange={(v) => updateSpot({ hand_details: v })}
                      placeholder="Positions, stack depths, action, ranges, ICM pressure, player dynamics, pot size, solver output, relevant context..."
                      multiline
                      rows={6}
                      onFieldFocus={(el) => cardInsertion.registerField(el, 'rich')}
                      onFieldSelect={() => cardInsertion.captureSelection()}
                      className="w-full rounded-md border border-[#232a32] bg-[#0a0c0e] px-3 py-2 text-[12px] leading-relaxed text-white outline-none focus:border-[#c0911e]/40"
                    />
                  </div>
                </div>
              </AccordionSection>

              <AccordionSection
                title="Main Analysis — Written Strategy & Explanation"
                icon={PenLine}
                helper="This is where you write your main poker analysis, strategic explanations, reasoning, and conclusions. This is the primary written content your audience will read."
                isOpen={openSection === 'content'}
                onToggle={() => setOpenSection(openSection === 'content' ? '' : 'content')}
                complete={!!spot.content_html && spot.content_html.replace(/<[^>]*>/g, '').trim().length > 0}
              >
                <div className="space-y-4">
                  <div className="rounded-lg border border-[#c091e]/15 bg-[#c091e]/[0.04] p-3">
                    <p className="text-[10px] leading-relaxed text-white/50">This is where you write your main poker analysis, strategic explanations, reasoning, and conclusions. This is the primary written content your audience will read.</p>
                  </div>
                  <div className="flex items-center justify-between">
                    <label className="text-[9px] font-semibold tracking-widest text-[#c9b07a] uppercase">Main Analysis</label>
                    <AIAssistRichInline targetRef={contentRef} onChange={(html) => updateSpot({ content_html: html })} onTransform={handleInlineAITransform} tier={userTier} weekUsed={aiUsage?.weekUsed ?? 0} />
                  </div>
                  <RichTextEditor
                    html={spot.content_html || ''}
                    onChange={(html) => updateSpot({ content_html: html })}
                    editorRef={contentRef}
                    onFocusField={(el) => cardInsertion.registerField(el, 'rich')}
                  />
                </div>
              </AccordionSection>

              <AccordionSection
                title="Visuals & Evidence"
                icon={ImagePlus}
                helper="Add screenshots, range charts, solver outputs, or diagrams. Supports multiple images with captions, reordering, and optional categorization."
                isOpen={openSection === 'visual'}
                onToggle={() => setOpenSection(openSection === 'visual' ? '' : 'visual')}
                complete={!!(spot.visual_details && spot.visual_details.length > 0) || pendingEvidence.length > 0}
              >
                {spot.id ? (
                  <>
                    <EvidenceSection spotId={spot.id} pendingEvidence={pendingEvidence} onPendingChange={setPendingEvidence} />
                    <div className="mt-4 border-t border-white/[0.06] pt-4">
                      <RecordingAttachments spotId={spot.id} />
                    </div>
                  </>
                ) : autoDraftCreating ? (
                  <div className="flex items-center gap-2 py-4 text-[10px] text-white/40">
                    <Loader2 className="h-4 w-4 animate-spin" /> Preparing upload area...
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-[10px] text-white/40">Upload images now — your spot will be saved as a draft automatically.</p>
                    <button
                      onClick={async () => {
                        setAutoDraftCreating(true);
                        try {
                          const created = await createNewSpot(account.id, account.name, portalSlug);
                          if (created) {
                            setSpot(created);
                            setCreationMode('draft');
                            setDirty(true);
                          }
                        } catch { /* ignore */ }
                        setAutoDraftCreating(false);
                      }}
                      className="hdr-gold-btn flex items-center gap-1.5 rounded-lg px-3 py-2 text-[10px] font-bold uppercase tracking-widest"
                    >
                      <ImagePlus className="hdr-gold-icon h-3.5 w-3.5" strokeWidth={1.5} /> Enable Uploads
                    </button>
                  </div>
                )}
              </AccordionSection>

              <AccordionSection
                title="Hand History"
                icon={PlayCircle}
                helper="Attach a saved hand from HH Workspace to embed an interactive replayer in this spot."
                isOpen={openSection === 'hand'}
                onToggle={() => setOpenSection(openSection === 'hand' ? '' : 'hand')}
                complete={!!spot.hand_id}
              >
                <HandHistorySelector
                  accountId={account.id}
                  selectedHandId={spot.hand_id}
                  onSelect={(handId) => updateSpot({ hand_id: handId })}
                />
              </AccordionSection>

              <AccordionSection
                title="Tags"
                icon={Tags}
                helper="Make this spot easy to organize and discover."
                isOpen={openSection === 'tags'}
                onToggle={() => setOpenSection(openSection === 'tags' ? '' : 'tags')}
                complete={Object.values(spot.tags).some((v) => typeof v === 'string' && v.length > 0)}
              >
                <div className="space-y-4">
                  {/* Content Depth selector */}
                  <div>
                    <label className="mb-1.5 block text-[9px] font-semibold tracking-widest text-white/40 uppercase">Analysis Level</label>
                    <div className="flex flex-wrap gap-1.5">
                      {DIFFICULTY_OPTIONS.map((level) => {
                        const style = getContentDepthStyle(level);
                        const isSelected = normalizeContentDepth(spot.difficulty) === level;
                        return (
                          <button
                            key={level}
                            onClick={() => updateSpot({ difficulty: isSelected ? null : level })}
                            className="rounded-full border px-3 py-1.5 text-[10px] font-medium transition-all"
                            style={{
                              borderColor: isSelected ? style?.border : 'rgba(255,255,255,0.08)',
                              background: isSelected ? style?.bg : 'transparent',
                              color: isSelected ? style?.text : 'rgba(255,255,255,0.5)',
                            }}
                          >
                            {DIFFICULTY_LABELS[level]}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Comprehension Difficulty selector */}
                  <div>
                    <label className="mb-1.5 block text-[9px] font-semibold tracking-widest text-white/40 uppercase">Difficulty</label>
                    <div className="flex flex-wrap gap-1.5">
                      {COMPREHENSION_OPTIONS.map((level) => {
                        const style = getComprehensionStyle(level);
                        const isSelected = normalizeComprehension(spot.comprehension_difficulty) === level;
                        return (
                          <button
                            key={level}
                            onClick={() => updateSpot({ comprehension_difficulty: isSelected ? null : level })}
                            className="rounded-full border px-3 py-1.5 text-[10px] font-medium transition-all"
                            style={{
                              borderColor: isSelected ? style?.border : 'rgba(255,255,255,0.08)',
                              background: isSelected ? style?.bg : 'transparent',
                              color: isSelected ? style?.text : 'rgba(255,255,255,0.5)',
                            }}
                          >
                            {COMPREHENSION_LABELS[level]}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Tournament Stakes selector */}
                  <div>
                    <label className="mb-1.5 block text-[9px] font-semibold tracking-widest text-white/40 uppercase">Tournament Stakes</label>
                    <div className="flex flex-wrap gap-1.5">
                      {STAKES_OPTIONS.map((level) => {
                        const style = getStakesStyle(level);
                        const isSelected = normalizeStakes(spot.tournament_stakes) === level;
                        return (
                          <button
                            key={level}
                            onClick={() => updateSpot({ tournament_stakes: isSelected ? null : level })}
                            className="rounded-full border px-3 py-1.5 text-[10px] font-medium transition-all"
                            style={{
                              borderColor: isSelected ? style?.border : 'rgba(255,255,255,0.08)',
                              background: isSelected ? style?.bg : 'transparent',
                              color: isSelected ? style?.text : 'rgba(255,255,255,0.5)',
                            }}
                          >
                            {STAKES_LABELS[level]}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {spot.difficulty && <DifficultyTag level={spot.difficulty} />}
                    {spot.comprehension_difficulty && <ComprehensionTag level={spot.comprehension_difficulty} />}
                    {spot.tournament_stakes && <StakesTag level={spot.tournament_stakes} />}
                    <ReadingTimeBadge spot={spot} size="small" />
                  </div>

                  <div className="flex items-center justify-between">
                    <label className="text-[9px] font-semibold tracking-widest text-white/40 uppercase">Suggested Tags</label>
                  </div>
                  {(Object.keys(TAG_OPTIONS) as (keyof ContentTags)[]).map((key) => (
                    <TagGroup
                      key={key}
                      label={TAG_LABELS[key]}
                      options={TAG_OPTIONS[key]}
                      selected={spot.tags[key] || ''}
                      onSelect={(val) => updateSpot({ tags: { ...spot.tags, [key]: val || undefined } })}
                    />
                  ))}
                </div>
              </AccordionSection>

              <AccordionSection
                title="Publishing & Quiz"
                icon={Settings2}
                helper="Choose access, pricing, and optional study questions."
                isOpen={openSection === 'publishing'}
                onToggle={() => setOpenSection(openSection === 'publishing' ? '' : 'publishing')}
                complete={spot.status === 'published' || spot.status === 'submitted'}
              >
                <div className="space-y-5">
                  {/* Show in courses */}
                  <ToggleRow
                    label="Show in Courses"
                    description="Allow this spot to be included in course collections"
                    checked={spot.show_in_courses}
                    onChange={(v) => updateSpot({ show_in_courses: v })}
                  />
                  {/* Monetize */}
                  <ToggleRow
                    label="Monetize This Spot"
                    description="Charge credits for access to this content"
                    checked={spot.is_monetized}
                    onChange={(v) => updateSpot({ is_monetized: v })}
                  />
                  {spot.is_monetized && (
                    <div className="ml-4 rounded-md border border-[#c0911e]/20 bg-[#c0911e]/8 p-3">
                      <label className="mb-1 block text-[9px] font-semibold tracking-widest text-white/40 uppercase">Price (Credits)</label>
                      <input
                        type="number"
                        value={spot.price_credits}
                        onChange={(e) => updateSpot({ price_credits: Math.max(0, parseInt(e.target.value) || 0) })}
                        min={0}
                        className="w-32 rounded-md border border-[#232a32] bg-[#0a0c0e] px-3 py-2 text-[12px] text-white outline-none focus:border-[#c0911e]/40"
                      />
                      <p className="mt-1 text-[9px] text-white/30">Platform fee: 20% · Creator earns: {Math.round(spot.price_credits * 0.8)} credits</p>
                    </div>
                  )}
                  {/* Quiz */}
                  <QuizBuilder
                    quiz={spot.quiz || []}
                    onChange={(q) => updateSpot({ quiz: q.length > 0 ? q : null })}
                  />
                </div>
              </AccordionSection>

                  {/* Existing Spots update in place; new content continues to destination. */}
                  <div className="mt-4 flex items-center justify-end gap-2">
                    {spot.id && (creationMode === 'edit' || creationMode === 'draft') ? (
                      <>
                        {onExitEditor && (
                          <button
                            onClick={onExitEditor}
                            disabled={saving}
                            className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-[11px] font-bold tracking-widest uppercase text-white/50 transition-all hover:bg-white/10 disabled:opacity-40"
                          >
                            <ArrowLeft className="h-4 w-4" /> Cancel
                          </button>
                        )}
                        <button
                          onClick={() => void handleSaveExisting()}
                          disabled={saving}
                          className="flex items-center gap-2 rounded-lg border border-[#c091e]/40 bg-[#c091e]/15 px-5 py-2.5 text-[11px] font-bold tracking-widest uppercase text-[#f5e6b0] transition-all hover:bg-[#c091e]/25 disabled:opacity-40"
                        >
                          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                          Save
                        </button>
                        <button
                          onClick={() => void handleSaveExisting({ exitAfter: true })}
                          disabled={saving}
                          className="flex items-center gap-2 rounded-lg border border-[#c091e]/40 bg-[#c091e]/15 px-5 py-2.5 text-[11px] font-bold tracking-widest uppercase text-[#f5e6b0] transition-all hover:bg-[#c091e]/25 disabled:opacity-40"
                        >
                          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
                          Save &amp; View
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => setFlowStage('destination')}
                        className="flex items-center gap-2 rounded-lg border border-[#c091e]/40 bg-[#c091e]/15 px-6 py-2.5 text-[12px] font-bold tracking-widest uppercase text-[#f5e6b0] transition-all hover:bg-[#c091e]/25"
                      >
                        Continue <ChevronRight className="h-4 w-4" strokeWidth={2} />
                      </button>
                    )}
                  </div>
                </>
              )}

              {/* DESTINATION STAGE — shown after content creation for all types */}
              {flowStage === 'destination' && creationMode === 'new' && (
                <div className="mt-4 mb-2 rounded-xl border p-4" style={{ borderColor: 'rgba(212,165,44,0.10)', background: 'rgba(8,10,12,0.55)' }}>
                  <div className="mb-3 flex items-center justify-between">
                    <label className="text-[9px] font-semibold tracking-widest text-white/40 uppercase">Choose Destination</label>
                    <button
                      onClick={() => setFlowStage('creation')}
                      className="flex items-center gap-1 text-[9px] font-bold uppercase text-white/40 hover:text-white/60 transition"
                    >
                      <RefreshCcw className="h-3 w-3" /> Back to Editor
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(['draft', 'library', 'sell'] as const).map((dest) => {
                      const isSelected = submitDestination === dest;
                      const labels = { draft: 'Draft', library: 'My Spots', sell: 'Sell (Coming Soon)' } as const;
                      return (
                        <button
                          key={dest}
                          onClick={() => setSubmitDestination(dest)}
                          className="flex items-center gap-2 rounded-lg border px-4 py-2 text-[11px] font-bold tracking-widest uppercase transition-all"
                          style={{
                            borderColor: isSelected ? 'rgba(212,165,44,0.5)' : 'rgba(255,255,255,0.08)',
                            background: isSelected ? 'rgba(212,165,44,0.12)' : 'rgba(255,255,255,0.02)',
                            color: isSelected ? GOLD_SOFT : 'rgba(255,255,255,0.5)',
                          }}
                        >
                          <span
                            className="flex h-3.5 w-3.5 items-center justify-center rounded-full border-2 transition-all"
                            style={{
                              borderColor: isSelected ? GOLD : 'rgba(255,255,255,0.15)',
                              background: isSelected ? GOLD : 'transparent',
                            }}
                          >
                            {isSelected && <Check className="h-2 w-2 text-black" strokeWidth={3} />}
                          </span>
                          {labels[dest]}
                        </button>
                      );
                    })}
                  </div>

                  {submitDestination === 'sell' && (
                    <div className="mt-3 rounded-lg border border-[#c0911e]/20 bg-[#c0911e]/8 p-3">
                      <div className="flex items-center gap-2">
                        <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[8px] font-bold tracking-widest uppercase text-amber-300/80">Coming Soon</span>
                        <p className="text-[10px] text-white/40">Monetized Spot listings will be available soon. Save to your library for now.</p>
                      </div>
                    </div>
                  )}

                  <div className="mt-3 flex items-center gap-2">
                    <button
                      onClick={handleNewSpot}
                      className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[10px] font-bold tracking-widest text-white/50 uppercase transition-all hover:bg-white/10"
                    >
                      <Plus className="h-3.5 w-3.5" strokeWidth={2} />
                      New
                    </button>
                    <button
                      onClick={() => setShowList(!showList)}
                      className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[10px] font-bold tracking-widest text-white/50 uppercase transition-all hover:bg-white/10"
                    >
                      <Library className="h-3.5 w-3.5" strokeWidth={1.5} />
                      Drafts ({mySpots.length})
                    </button>
                    <div className="flex-1" />
                    <button
                      onClick={handleSubmitDestination}
                      disabled={saving}
                      className="flex items-center gap-1.5 rounded-lg border border-[#c0911e]/40 bg-[#c0911e]/15 px-6 py-2.5 text-[12px] font-bold tracking-widest uppercase transition-all hover:bg-[#c0911e]/25 disabled:opacity-40"
                      style={{ color: GOLD_SOFT }}
                    >
                      {saving ? <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} /> : <Send className="h-4 w-4" strokeWidth={1.5} />}
                      Submit
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* AI Suggestion popover */}
      {aiSuggestion && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 p-4" onClick={() => setAISuggestion(null)}>
          <div className="w-full max-w-lg rounded-xl border p-5" style={{ borderColor: 'rgba(212,165,44,0.25)', background: 'rgba(8,10,12,0.96)' }} onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center gap-2">
              <Sparkles className="h-4 w-4" style={{ color: GOLD }} strokeWidth={1.5} />
              <h3 className="text-[12px] font-bold text-white">AI Suggestion</h3>
            </div>
            <div className="mb-4 max-h-64 overflow-y-auto rounded-lg border border-white/[0.06] bg-black/40 p-3">
              <p className="whitespace-pre-wrap text-[12px] leading-relaxed text-white/80">{aiSuggestion.text}</p>
            </div>
            <div className="flex items-center justify-between">
              <div className="text-[9px] text-white/30">
                {aiUsage && `This Spot: ${aiUsage.spotRemaining}/${AI_ASSIST_PER_SPOT_LIMIT} remaining · This Week: ${formatUsage(aiUsage.weekUsed, aiUsage.weeklyLimit)}`}
              </div>
              <div className="flex gap-2">
                <button onClick={() => setAISuggestion(null)} className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] font-bold tracking-widest text-white/50 uppercase transition-colors hover:text-white/80">Cancel</button>
                <button
                  onClick={handleAITryAgain}
                  disabled={!aiUsage || aiUsage.spotRemaining <= 0 || aiUsage.weekRemaining <= 0}
                  className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] font-bold tracking-widest text-white/60 uppercase transition-colors hover:text-white disabled:opacity-30"
                  title={aiUsage && aiUsage.spotRemaining <= 0 ? '2 AI assists have already been used for this Spot.' : ''}
                >
                  <RefreshCw className="h-3 w-3" /> Try Again
                </button>
                <button onClick={handleAIUseThis} className="rounded-lg border px-4 py-1.5 text-[10px] font-bold tracking-widest uppercase transition-all" style={{ borderColor: 'rgba(212,165,44,0.4)', background: 'rgba(212,165,44,0.12)', color: GOLD_SOFT }}>Use This</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AI error message */}
      {aiError && !aiSuggestion && (
        <div className="px-4 py-1">
          <div className="flex items-center gap-2 rounded-md border border-amber-400/20 bg-amber-400/[0.05] px-3 py-2">
            <AlertCircle className="h-3.5 w-3.5 shrink-0 text-amber-400" strokeWidth={1.5} />
            <p className="text-[10px] text-amber-300/70">{aiError}</p>
          </div>
        </div>
      )}

      {/* Error / saved message */}
      {(error || savedMsg) && (
        <div className="px-4 py-2">
          {error && (
            <div className="flex items-center gap-2 rounded-md border border-red-400/20 bg-red-400/[0.05] px-3 py-2">
              <AlertCircle className="h-3.5 w-3.5 shrink-0 text-red-400" strokeWidth={1.5} />
              <p className="text-[10px] text-red-300/70">{error}</p>
            </div>
          )}
          {savedMsg && !error && (
            <div className="flex items-center gap-2 rounded-md border border-emerald-500/20 bg-emerald-500/[0.05] px-3 py-2">
              <Check className="h-3.5 w-3.5 shrink-0 text-emerald-400" strokeWidth={1.5} />
              <p className="text-[10px] text-emerald-300/70">{savedMsg}</p>
            </div>
          )}
        </div>
      )}

      {/* Document Preview Modal */}
      {showPreview && spot?.spot_type === 'document' && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm" onClick={() => setShowPreview(false)}>
          <div className="w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-xl border p-6" style={{ borderColor: 'rgba(212,165,44,0.25)', background: 'rgba(8,10,12,0.98)' }} onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-[14px] font-bold text-white">{spot.title || 'Untitled'}</h3>
              <button onClick={() => setShowPreview(false)} className="text-white/40 hover:text-white"><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-2">
              {spot.document_json
                ? <DocumentRenderer documentJson={spot.document_json} />
                : null}
              {spot.content_blocks && spot.content_blocks.length > 0
                ? renderFreeformBlocks(spot.content_blocks)
                : null}
              {spot.work_pack_stages && spot.work_pack_stages.length > 0
                ? spot.work_pack_stages.map((stage) => (
                    <div key={stage.id} className="space-y-1">
                      <h4 className="text-[12px] font-bold text-[#f5e6b0]">{stage.title}</h4>
                      {stage.blocks.map((b) => <p key={b.id} className="text-[11px] text-white/60">{b.text}</p>)}
                    </div>
                  ))
                : null}
              {!spot.document_json && !(spot.content_blocks && spot.content_blocks.length > 0) && !(spot.work_pack_stages && spot.work_pack_stages.length > 0)
                ? <p className="text-center text-[12px] text-white/30 py-8">No content yet. Start writing in the document editor.</p>
                : null}
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button onClick={() => setShowPreview(false)} className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-[10px] font-bold tracking-widest text-white/50 uppercase hover:text-white/70">
                Back to Editor
              </button>
              <button
                onClick={() => { setShowPreview(false); setFlowStage('destination'); }}
                className="flex items-center gap-2 rounded-lg border border-[#c0911e]/40 bg-[#c0911e]/15 px-6 py-2.5 text-[12px] font-bold tracking-widest uppercase text-[#f5e6b0] transition-all hover:bg-[#c0911e]/25"
              >
                Continue <ChevronRight className="h-4 w-4" strokeWidth={2} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Freeform Preview Modal */}
      {showPreview && (spot?.spot_type === 'freeform' || spot?.spot_type === 'work_pack') && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm" onClick={() => setShowPreview(false)}>
          <div className="w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-xl border p-6" style={{ borderColor: 'rgba(212,165,44,0.25)', background: 'rgba(8,10,12,0.98)' }} onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-[14px] font-bold text-white">{spot.title || 'Untitled'}</h3>
              <button onClick={() => setShowPreview(false)} className="text-white/40 hover:text-white"><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-2">
              {spot.spot_type === 'work_pack' && spot.work_pack_stages
                ? spot.work_pack_stages.map((stage) => (
                    <div key={stage.id} className="space-y-1">
                      <h4 className="text-[12px] font-bold text-[#f5e6b0]">{stage.title}</h4>
                      {stage.blocks.map((b) => <p key={b.id} className="text-[11px] text-white/60">{b.text}</p>)}
                    </div>
                  ))
                : spot.content_blocks && spot.content_blocks.length > 0
                  ? renderFreeformBlocks(spot.content_blocks)
                  : <p className="text-center text-[12px] text-white/30 py-8">No content yet. Start writing in the editor.</p>}
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button onClick={() => setShowPreview(false)} className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-[10px] font-bold tracking-widest text-white/50 uppercase hover:text-white/70">
                Back to Editor
              </button>
              <button
                onClick={() => { setShowPreview(false); setFlowStage('destination'); }}
                className="flex items-center gap-2 rounded-lg border border-[#c091e]/40 bg-[#c091e]/15 px-6 py-2.5 text-[12px] font-bold tracking-widest uppercase text-[#f5e6b0] transition-all hover:bg-[#c091e]/25"
              >
                Continue <ChevronRight className="h-4 w-4" strokeWidth={2} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New draft confirmation */}
      {showNewConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4" onClick={() => setShowNewConfirm(false)}>
          <div className="max-w-sm rounded-xl border p-5" style={{ borderColor: 'rgba(212,165,44,0.2)', background: 'rgba(8,10,12,0.95)' }} onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-400" strokeWidth={1.5} />
              <h3 className="text-[13px] font-bold text-white">Unsaved Changes</h3>
            </div>
            <p className="mb-4 text-[11px] leading-relaxed text-white/50">
              You have unsaved changes in the current draft. Starting a new draft will discard them. Save first if you want to keep your work.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowNewConfirm(false)}
                className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[10px] font-bold tracking-widest text-white/60 uppercase transition-colors hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmNew}
                className="flex-1 rounded-lg border border-red-400/30 bg-red-400/10 px-3 py-2 text-[10px] font-bold tracking-widest text-red-400 uppercase transition-colors hover:bg-red-400/20"
              >
                Discard & New
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </div>
  );
}
// ============================================================
// HAND HISTORY SELECTOR
// ============================================================
interface SavedHandRef {
  hand_id: string;
  played_at: string;
  blinds: string | null;
  position: string | null;
  net_result: number | null;
  pot_amount: number | null;
  hero_name: string | null;
  showdown: boolean | null;
}

function HandHistorySelector({ accountId, selectedHandId, onSelect }: {
  accountId: string;
  selectedHandId: string | null;
  onSelect: (handId: string | null) => void;
}) {
  const [hands, setHands] = useState<SavedHandRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showList, setShowList] = useState(false);
  const [manualHand, setManualHand] = useState<ManualHandRecord | null>(null);

  const attachHand = async (value: string) => {
    const normalized = value.trim();
    if (!normalized) return;
    const found = await findManualHand(normalized);
    if (found) {
      setManualHand(found);
      onSelect(found.hand_id);
      return;
    }
    setManualHand(null);
    onSelect(normalized);
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data, error } = await supabase
          .from('poker_hand_records')
          .select('hand_id, played_at, blinds, position, net_result, pot_amount, hero_name, showdown')
          .eq('user_id', accountId)
          .order('played_at', { ascending: false })
          .limit(50);
        if (!mounted) return;
        if (!error && data) setHands(data as SavedHandRef[]);
      } catch { /* silent */ }
      setLoading(false);
    })();
    return () => { mounted = false; };
  }, [accountId]);

  const filtered = search.trim()
    ? hands.filter(h =>
        h.hand_id.toLowerCase().includes(search.toLowerCase()) ||
        (h.blinds || '').toLowerCase().includes(search.toLowerCase()) ||
        (h.position || '').toLowerCase().includes(search.toLowerCase()) ||
        (h.hero_name || '').toLowerCase().includes(search.toLowerCase())
      )
    : hands;

  const selectedHand = hands.find(h => h.hand_id === selectedHandId);

  if (selectedHandId && manualHand && manualHand.hand_id === selectedHandId) {
    const hand = manualHand.normalized_hand;
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-3 rounded-lg border border-[#c0911e]/20 bg-[#c0911e]/8 p-3">
          <PlayCircle className="h-4 w-4 shrink-0" style={{ color: GOLD }} strokeWidth={1.5} />
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-bold text-white truncate">Hand Found · {hand.heroName || 'Hero'}</div>
            <div className="text-[9px] text-white/40">{manualHand.hand_id} · {hand.players.length}-max · {hand.stakes}</div>
          </div>
          <button onClick={() => { setManualHand(null); onSelect(null); }} className="flex items-center gap-1 rounded-md border border-white/10 px-2 py-1 text-[9px] font-bold uppercase text-white/40 hover:text-red-400 transition"><X className="h-3 w-3" /> Detach</button>
        </div>
        <p className="text-[9px] text-white/30">This hand will open as the interactive HH Replayer in the published spot.</p>
      </div>
    );
  }

  if (selectedHandId && selectedHand) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-3 rounded-lg border border-[#c0911e]/20 bg-[#c0911e]/8 p-3">
          <PlayCircle className="h-4 w-4 shrink-0" style={{ color: GOLD }} strokeWidth={1.5} />
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-bold text-white truncate">{selectedHand.hero_name || 'Hero'} — {selectedHand.blinds || 'Unknown stakes'}</div>
            <div className="text-[9px] text-white/40">
              {selectedHand.position || '?'} · {selectedHand.net_result !== null ? `${selectedHand.net_result > 0 ? '+' : ''}${selectedHand.net_result}` : '?'} · {new Date(selectedHand.played_at).toLocaleDateString()}
            </div>
          </div>
          <button
            onClick={() => onSelect(null)}
            className="flex items-center gap-1 rounded-md border border-white/10 px-2 py-1 text-[9px] font-bold uppercase text-white/40 hover:text-red-400 transition"
          >
            <X className="h-3 w-3" /> Detach
          </button>
        </div>
        <p className="text-[9px] text-white/30">This hand will be embedded as an interactive replayer in the published spot, between the introduction and hand details.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {selectedHandId && !selectedHand && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-400/20 bg-amber-400/5 px-3 py-2">
          <span className="text-[10px] text-amber-300/70">Hand ID {selectedHandId.substring(0, 16)}... was not found in your saved hands. It may have been deleted.</span>
          <button onClick={() => onSelect(null)} className="ml-auto text-[9px] font-bold uppercase text-white/40 hover:text-white/60">Clear</button>
        </div>
      )}

      {/* Search + browse toggle */}
      <div className="flex gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onFocus={() => setShowList(true)}
          placeholder="Search by hand ID, position, stakes..."
          className="flex-1 rounded-md border border-[#232a32] bg-[#0a0c0e] px-3 py-2 text-[11px] text-white outline-none focus:border-[#c0911e]/40 placeholder:text-white/20"
        />
        <button
          onClick={() => setShowList(!showList)}
          className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-[9px] font-bold uppercase text-white/50 hover:bg-white/10 transition"
        >
          {showList ? 'Hide' : 'Browse'}
        </button>
      </div>

      {/* Manual hand ID entry */}
      <div className="flex gap-2">
        <input
          placeholder="Paste hand ID..."
          className="flex-1 rounded-md border border-[#232a32] bg-[#0a0c0e] px-3 py-2 text-[11px] text-white outline-none focus:border-[#c0911e]/40 placeholder:text-white/20"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              const val = (e.target as HTMLInputElement).value.trim();
              if (val) void attachHand(val);
            }
          }}
        />
        <button
          onClick={(e) => {
            const input = (e.currentTarget.previousSibling as HTMLInputElement);
            const val = input?.value.trim();
            if (val) void attachHand(val);
          }}
          className="rounded-md border border-[#c0911e]/30 bg-[#c0911e]/10 px-3 py-2 text-[9px] font-bold uppercase text-[#f5e6b0] hover:bg-[#c0911e]/20 transition"
        >
          Attach
        </button>
      </div>

      {/* Hand list */}
      {showList && (
        <div className="max-h-64 overflow-y-auto rounded-lg border border-white/[0.06] bg-black/20">
          {loading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-4 w-4 animate-spin" style={{ color: GOLD }} strokeWidth={1.5} />
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-6 text-center text-[10px] text-white/30">
              {hands.length === 0 ? 'No saved hands found. Build and save a hand in HH Workspace first.' : 'No hands match your search.'}
            </div>
          ) : (
            <div className="divide-y divide-white/[0.04]">
              {filtered.map((h) => (
                <button
                  key={h.hand_id}
                  onClick={() => { onSelect(h.hand_id); setShowList(false); }}
                  className="flex w-full items-center gap-3 px-3 py-2 text-left transition hover:bg-white/[0.03]"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-[10px] font-medium text-white/70 truncate">
                      {h.hero_name || 'Hero'} — {h.blinds || '?'} · {h.position || '?'}
                    </div>
                    <div className="text-[8px] text-white/30 font-mono">
                      {h.hand_id.substring(0, 24)}...
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-[10px] font-bold" style={{ color: (h.net_result ?? 0) > 0 ? '#4ade80' : (h.net_result ?? 0) < 0 ? '#e04545' : '#cbd5e1' }}>
                      {h.net_result !== null ? `${h.net_result > 0 ? '+' : ''}${h.net_result}` : '?'}
                    </div>
                    <div className="text-[8px] text-white/30">{new Date(h.played_at).toLocaleDateString()}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================
function AccordionSection({ title, icon: Icon, helper, isOpen, onToggle, complete, children }: {
  title: string;
  icon: typeof Globe;
  helper: string;
  isOpen: boolean;
  onToggle: () => void;
  complete?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className="mb-2.5 overflow-hidden rounded-xl border transition-all"
      style={{
        borderColor: isOpen ? 'rgba(212,165,44,0.28)' : 'rgba(212,165,44,0.10)',
        background: isOpen ? 'rgba(212,165,44,0.03)' : 'rgba(8,10,12,0.55)',
        boxShadow: isOpen ? '0 0 24px -8px rgba(212,165,44,0.15)' : 'none',
      }}
    >
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between px-4 py-2.5 text-left transition-colors hover:bg-white/[0.02]"
      >
        <div className="flex items-center gap-2.5">
          <span
            className="flex h-5 w-5 items-center justify-center rounded-full border text-[8px] transition-all"
            style={{
              borderColor: complete ? 'rgba(212,165,44,0.5)' : 'rgba(255,255,255,0.12)',
              background: complete ? 'rgba(212,165,44,0.12)' : 'transparent',
            }}
          >
            {complete ? (
              <Check className="h-3 w-3" style={{ color: GOLD }} strokeWidth={3} />
            ) : (
              <Icon className="h-2.5 w-2.5 text-white/25" strokeWidth={1.5} />
            )}
          </span>
          <span
            className="text-[12px] font-bold tracking-wide transition-colors"
            style={{ color: isOpen ? '#fff' : 'rgba(255,255,255,0.75)' }}
          >
            {title}
          </span>
        </div>
        <ChevronDown
          className="h-4 w-4 transition-transform duration-200"
          style={{ color: isOpen ? GOLD : 'rgba(255,255,255,0.35)', transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
          strokeWidth={1.5}
        />
      </button>
      {isOpen && (
        <div className="px-4 pb-4 pt-0">
          <p className="mb-3 text-[10px] font-medium tracking-wide text-white/35">{helper}</p>
          {children}
        </div>
      )}
    </div>
  );
}

// ============================================================
// RICH TEXT EDITOR
// ============================================================
function RichTextEditor({ html, onChange, editorRef, onFocusField }: {
  html: string;
  onChange: (html: string) => void;
  editorRef?: React.RefObject<HTMLDivElement | null>;
  onFocusField?: (el: HTMLDivElement) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const el = editorRef;

  useEffect(() => {
    const node = el?.current ?? ref.current;
    if (node && node.innerHTML !== html) {
      node.innerHTML = html;
    }
  }, [html, el]);

  const exec = useCallback((cmd: string, val?: string) => {
    document.execCommand(cmd, false, val);
    const node = el?.current ?? ref.current;
    if (node) onChange(node.innerHTML);
  }, [onChange, el]);

  const handleInput = useCallback(() => {
    const node = el?.current ?? ref.current;
    if (node) onChange(node.innerHTML);
  }, [onChange, el]);

  const handlePaste = useCallback(() => {
    requestAnimationFrame(handleInput);
  }, [handleInput]);

  const tools = [
    { icon: Undo2, cmd: 'undo', title: 'Undo' },
    { icon: Redo2, cmd: 'redo', title: 'Redo' },
    { icon: Heading1, cmd: 'formatBlock', val: '<h2>', title: 'Heading 1' },
    { icon: Heading2, cmd: 'formatBlock', val: '<h3>', title: 'Heading 2' },
    { icon: Heading3, cmd: 'formatBlock', val: '<h4>', title: 'Heading 3' },
    { icon: Bold, cmd: 'bold', title: 'Bold' },
    { icon: Italic, cmd: 'italic', title: 'Italic' },
    { icon: Underline, cmd: 'underline', title: 'Underline' },
    { icon: List, cmd: 'insertUnorderedList', title: 'Bullet List' },
    { icon: ListOrdered, cmd: 'insertOrderedList', title: 'Numbered List' },
    { icon: Quote, cmd: 'formatBlock', val: '<blockquote>', title: 'Quote' },
  ];

  return (
    <div className="overflow-hidden rounded-lg border border-[#232a32]">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 border-b border-[#232a32] bg-[#0a0c0e] px-2 py-1.5">
        {tools.map((t, i) => {
          const Icon = t.icon;
          return (
            <button
              key={i}
              onClick={() => exec(t.cmd, t.val)}
              title={t.title}
              className="flex h-7 w-7 items-center justify-center rounded text-white/40 transition-colors hover:bg-white/10 hover:text-white/70"
            >
              <Icon className="h-3.5 w-3.5" strokeWidth={1.5} />
            </button>
          );
        })}
        <div className="mx-1 h-5 w-px bg-white/10" />
        <button
          onClick={() => {
            const url = prompt('Enter URL:');
            if (url) exec('createLink', url);
          }}
          title="Insert Link"
          className="flex h-7 w-7 items-center justify-center rounded text-white/40 transition-colors hover:bg-white/10 hover:text-white/70"
        >
          <Link2 className="h-3.5 w-3.5" strokeWidth={1.5} />
        </button>
        <button
          onClick={() => {
            const url = prompt('Enter image URL:');
            if (url) exec('insertImage', url);
          }}
          title="Insert Image"
          className="flex h-7 w-7 items-center justify-center rounded text-white/40 transition-colors hover:bg-white/10 hover:text-white/70"
        >
          <ImageIcon className="h-3.5 w-3.5" strokeWidth={1.5} />
        </button>
      </div>
      {/* Editor area */}
      <div
        ref={el ?? ref}
        contentEditable
        onInput={handleInput}
        onPaste={handlePaste}
        onFocus={(e) => onFocusField?.(e.currentTarget)}
        onKeyUp={() => {
          const sel = window.getSelection();
          if (sel && sel.rangeCount > 0) {
            const range = sel.getRangeAt(0);
            const node = el?.current ?? ref.current;
            if (node && node.contains(range.commonAncestorContainer)) {
              // selection is inside editor — capture is handled by registerField
            }
          }
        }}
        suppressContentEditableWarning
        data-placeholder="Teach me something interesting..."
        className="min-h-[200px] px-4 py-3 text-[12px] leading-relaxed text-white/80 outline-none focus:outline-none"
        style={{ background: '#0a0c0e' }}
      />
    </div>
  );
}

// ============================================================
// VISUAL DETAILS EDITOR
// ============================================================
// ============================================================
// IMAGE UPLOADER
// ============================================================
function ImageUploader({ images, onChange, label, hint }: {
  images: string[];
  onChange: (urls: string[]) => void;
  label: string;
  hint: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleFiles = useCallback((files: FileList) => {
    const newUrls: string[] = [];
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          onChange([...images, ...newUrls, reader.result]);
          newUrls.push(reader.result);
        }
      };
      reader.readAsDataURL(file);
    });
  }, [images, onChange]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length > 0) handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  return (
    <div>
      <label className="mb-1.5 block text-[9px] font-semibold tracking-widest text-white/40 uppercase">
        {label}
      </label>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={(e) => e.target.files && handleFiles(e.target.files)}
        className="hidden"
      />
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed py-6 transition-colors"
        style={{
          borderColor: dragging ? 'rgba(212,165,44,0.4)' : 'rgba(255,255,255,0.08)',
          background: dragging ? 'rgba(212,165,44,0.05)' : 'transparent',
        }}
      >
        <Upload className="h-5 w-5 text-white/20" strokeWidth={1.5} />
        <p className="text-[10px] text-white/30">Drag & drop or click to upload</p>
        <p className="text-[8px] text-white/20">{hint}</p>
      </div>
      {images.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {images.map((url, i) => (
            <div key={i} className="group relative h-20 w-20 overflow-hidden rounded-md border border-white/10">
              <img src={url} alt="" className="h-full w-full object-cover" />
              <button
                onClick={(e) => { e.stopPropagation(); onChange(images.filter((_, idx) => idx !== i)); }}
                className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/70 text-white/60 opacity-0 transition-opacity group-hover:opacity-100 hover:text-red-400"
              >
                <X className="h-3 w-3" strokeWidth={2} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
// TAG GROUP
// ============================================================
function TagGroup({ label, options, selected, onSelect }: {
  label: string;
  options: string[];
  selected: string;
  onSelect: (val: string) => void;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-[9px] font-semibold tracking-widest text-white/40 uppercase">{label}</label>
      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={() => onSelect('')}
          className="rounded-full border px-2.5 py-1 text-[10px] font-medium transition-all"
          style={{
            borderColor: selected === '' ? 'rgba(212,165,44,0.3)' : 'rgba(255,255,255,0.06)',
            color: selected === '' ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.25)',
          }}
        >
          Any
        </button>
        {options.map((opt) => (
          <button
            key={opt}
            onClick={() => onSelect(opt === selected ? '' : opt)}
            className="rounded-full border px-2.5 py-1 text-[10px] font-medium transition-all"
            style={{
              borderColor: selected === opt ? 'rgba(212,165,44,0.4)' : 'rgba(255,255,255,0.08)',
              background: selected === opt ? 'rgba(212,165,44,0.12)' : 'transparent',
              color: selected === opt ? GOLD_SOFT : 'rgba(255,255,255,0.5)',
            }}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// TOGGLE ROW
// ============================================================
function ToggleRow({ label, description, checked, onChange }: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-[11px] font-bold text-white/80">{label}</p>
        <p className="text-[9px] text-white/30">{description}</p>
      </div>
      <button
        onClick={() => onChange(!checked)}
        className="relative h-6 w-11 rounded-full transition-colors"
        style={{ background: checked ? 'rgba(212,165,44,0.3)' : 'rgba(255,255,255,0.1)' }}
      >
        <span
          className="absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all"
          style={{ left: checked ? '22px' : '2px' }}
        />
      </button>
    </div>
  );
}

// ============================================================
// QUIZ BUILDER
// ============================================================
function QuizBuilder({ quiz, onChange }: {
  quiz: QuizQuestion[];
  onChange: (quiz: QuizQuestion[]) => void;
}) {
  const [enabled, setEnabled] = useState(quiz.length > 0);

  const handleToggle = (v: boolean) => {
    setEnabled(v);
    if (!v) onChange([]);
    else if (quiz.length === 0) onChange([{ question: '', options: ['', '', '', ''], correct_index: 0, explanation: '' }]);
  };

  const updateQuestion = (idx: number, patch: Partial<QuizQuestion>) => {
    onChange(quiz.map((q, i) => i === idx ? { ...q, ...patch } : q));
  };

  const addQuestion = () => {
    onChange([...quiz, { question: '', options: ['', '', '', ''], correct_index: 0, explanation: '' }]);
  };

  const removeQuestion = (idx: number) => {
    onChange(quiz.filter((_, i) => i !== idx));
  };

  return (
    <div>
      <ToggleRow
        label="Knowledge Check Quiz"
        description="Attach quiz questions to turn this into study material"
        checked={enabled}
        onChange={handleToggle}
      />
      {enabled && (
        <div className="mt-3 space-y-3">
          {quiz.map((q, qi) => (
            <div key={qi} className="rounded-md border border-white/10 bg-[#0a0c0e] p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[9px] font-bold tracking-widest text-white/40 uppercase">Question {qi + 1}</span>
                <button onClick={() => removeQuestion(qi)} className="text-white/20 hover:text-red-400">
                  <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                </button>
              </div>
              <input
                value={q.question}
                onChange={(e) => updateQuestion(qi, { question: e.target.value })}
                placeholder="Question..."
                className="mb-2 w-full rounded-md border border-[#232a32] bg-[#0a0c0e] px-3 py-2 text-[11px] text-white outline-none focus:border-[#c0911e]/40 placeholder:text-white/20"
              />
              <div className="space-y-1.5">
                {q.options.map((opt, oi) => (
                  <div key={oi} className="flex items-center gap-2">
                    <button
                      onClick={() => updateQuestion(qi, { correct_index: oi })}
                      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-all"
                      style={{
                        borderColor: q.correct_index === oi ? GOLD : 'rgba(255,255,255,0.15)',
                        background: q.correct_index === oi ? 'rgba(212,165,44,0.15)' : 'transparent',
                      }}
                    >
                      {q.correct_index === oi && <Check className="h-3 w-3" style={{ color: GOLD }} strokeWidth={2} />}
                    </button>
                    <input
                      value={opt}
                      onChange={(e) => {
                        const newOpts = [...q.options];
                        newOpts[oi] = e.target.value;
                        updateQuestion(qi, { options: newOpts });
                      }}
                      placeholder={`Option ${oi + 1}`}
                      className="flex-1 rounded-md border border-[#232a32] bg-[#0a0c0e] px-3 py-1.5 text-[11px] text-white outline-none focus:border-[#c0911e]/40 placeholder:text-white/20"
                    />
                  </div>
                ))}
              </div>
              <textarea
                value={q.explanation || ''}
                onChange={(e) => updateQuestion(qi, { explanation: e.target.value })}
                rows={2}
                placeholder="Explanation (optional)..."
                className="mt-2 w-full resize-none rounded-md border border-[#232a32] bg-[#0a0c0e] px-3 py-2 text-[11px] text-white outline-none focus:border-[#c0911e]/40 placeholder:text-white/20"
              />
            </div>
          ))}
          <button
            onClick={addQuestion}
            className="flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-white/15 py-2 text-[10px] font-medium text-white/40 transition-colors hover:border-white/25 hover:text-white/60"
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={1.5} />
            Add Question
          </button>
        </div>
      )}
    </div>
  );
}

