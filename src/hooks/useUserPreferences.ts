import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { PortalThemeId } from '@/lib/portalTheme';

export interface WidgetLayout {
  x: number;
  y: number;
  width: number;
  height: number;
  open: boolean;
  minimized: boolean;
  maximized: boolean;
  collapsed?: boolean;
  pinned?: boolean;
}

export type CoachWidgetLayouts = Record<string, WidgetLayout>;
export type PlayerRoomLayout = Record<string, WidgetLayout>;

export interface HomeWidgetConfig {
  enabled: string[];
  order: string[];
}

export type BgType = 'default' | 'preset' | 'custom';
export type BgFit = 'cover' | 'contain';
export type BgPosition = 'top' | 'center' | 'bottom';
export type BgOverlay = 'none' | 'light' | 'medium' | 'dark';
export type LandingMode = 'portal' | 'lounge' | 'last_visited';

export interface UserPreferences {
  backgrounds: Record<string, string>;
  homeWidgets: HomeWidgetConfig;
  coachWidgetLayouts: CoachWidgetLayouts;
  rememberPortal: boolean;
  playerRoomLayout: PlayerRoomLayout | null;
  stakekingsTheme: PortalThemeId;
  creatorGuideSeen: boolean;
  creatorGuideSeenAt: string | null;
  creatorGuideAutoShow: boolean;
  siteBgType: BgType;
  siteBgValue: string | null;
  siteBgFit: BgFit;
  siteBgPosition: BgPosition;
  siteBgOverlay: BgOverlay;
  defaultLanding: LandingMode;
  defaultLoungeSlug: string | null;
  loungeAccent: string | null;
  defaultHomeWidget: string | null;
  mediaSplitRatio: number | null;
  messagingSplitRatio: number | null;
}

const DEFAULT_WIDGETS: HomeWidgetConfig = { enabled: [], order: [] };

const DEFAULT_PREFS: UserPreferences = {
  backgrounds: {},
  homeWidgets: DEFAULT_WIDGETS,
  coachWidgetLayouts: {},
  rememberPortal: false,
  playerRoomLayout: null,
  stakekingsTheme: 'default',
  creatorGuideSeen: false,
  creatorGuideSeenAt: null,
  creatorGuideAutoShow: true,
  siteBgType: 'default',
  siteBgValue: null,
  siteBgFit: 'cover',
  siteBgPosition: 'center',
  siteBgOverlay: 'medium',
  defaultLanding: 'portal',
  defaultLoungeSlug: null,
  loungeAccent: null,
  defaultHomeWidget: null,
  mediaSplitRatio: null,
  messagingSplitRatio: null,
}

export type PrefError = 'backgrounds' | 'widgets' | null;

function parseHomeWidgets(raw: unknown, portalKey: string): HomeWidgetConfig {
  if (!raw || typeof raw !== 'object') return DEFAULT_WIDGETS;
  const obj = raw as Record<string, unknown>;
  if (obj[portalKey] && typeof obj[portalKey] === 'object') {
    const portal = obj[portalKey] as Record<string, unknown>;
    return {
      enabled: Array.isArray(portal.enabled) ? portal.enabled as string[] : [],
      order: Array.isArray(portal.order) ? portal.order as string[] : [],
    };
  }
  if (portalKey === 'player' && Array.isArray(obj.enabled)) {
    return {
      enabled: obj.enabled as string[],
      order: Array.isArray(obj.order) ? obj.order as string[] : [],
    };
  }
  return DEFAULT_WIDGETS;
}

function parseRoomLayout(raw: unknown, portalKey: string): PlayerRoomLayout | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  if (obj[portalKey] && typeof obj[portalKey] === 'object') {
    return obj[portalKey] as PlayerRoomLayout;
  }
  if (portalKey === 'player' && (obj.media || obj.locker || obj.analytics || obj.notes || obj.schedule || obj.chat)) {
    return obj as PlayerRoomLayout;
  }
  return null;
}

export function useUserPreferences(userId: string | null | undefined, portalKey: string = 'player') {
  const [prefs, setPrefs] = useState<UserPreferences>(DEFAULT_PREFS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<PrefError>(null);

  const load = useCallback(async () => {
    if (!userId) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const { data, error: loadErr } = await supabase
        .from('user_preferences')
        .select('backgrounds, home_widgets, coach_widget_layouts, remember_portal, player_room_layout, stakekings_theme, creator_guide_seen, creator_guide_seen_at, creator_guide_auto_show, site_bg_type, site_bg_value, site_bg_fit, site_bg_position, site_bg_overlay, default_landing, default_lounge_slug, lounge_accent, default_home_widget, media_split_ratio, messaging_split_ratio')
        .eq('user_id', userId)
        .maybeSingle();
      if (loadErr) throw loadErr;
      if (data) {
        setPrefs({
          backgrounds: (data.backgrounds as Record<string, string>) ?? {},
          homeWidgets: parseHomeWidgets(data.home_widgets, portalKey),
          coachWidgetLayouts: (data.coach_widget_layouts as CoachWidgetLayouts) ?? {},
          rememberPortal: (data.remember_portal as boolean) ?? false,
          playerRoomLayout: parseRoomLayout(data.player_room_layout, portalKey),
          stakekingsTheme: (data.stakekings_theme as PortalThemeId) ?? 'default',
          creatorGuideSeen: (data.creator_guide_seen as boolean) ?? false,
          creatorGuideSeenAt: (data.creator_guide_seen_at as string | null) ?? null,
          creatorGuideAutoShow: (data.creator_guide_auto_show as boolean) ?? true,
          siteBgType: (data.site_bg_type as BgType) ?? 'default',
          siteBgValue: (data.site_bg_value as string | null) ?? null,
          siteBgFit: (data.site_bg_fit as BgFit) ?? 'cover',
          siteBgPosition: (data.site_bg_position as BgPosition) ?? 'center',
          siteBgOverlay: (data.site_bg_overlay as BgOverlay) ?? 'medium',
          defaultLanding: (data.default_landing as LandingMode) ?? 'portal',
          defaultLoungeSlug: (data.default_lounge_slug as string | null) ?? null,
          loungeAccent: (data.lounge_accent as string | null) ?? null,
          defaultHomeWidget: (data.default_home_widget as string | null) ?? null,
          mediaSplitRatio: (data.media_split_ratio as number | null) ?? null,
          messagingSplitRatio: (data.messaging_split_ratio as number | null) ?? null,
        });
      } else {
        setPrefs(DEFAULT_PREFS);
      }
    } catch (err) {
      console.error('[useUserPreferences] Failed to load preferences:', err);
      setPrefs(DEFAULT_PREFS);
    } finally {
      setLoading(false);
    }
  }, [userId, portalKey]);

  useEffect(() => { load(); }, [load]);

  const save = useCallback(async (partial: Partial<UserPreferences>) => {
    if (!userId) return false;
    setSaving(true);
    const errCat: PrefError = partial.backgrounds !== undefined ? 'backgrounds' : 'widgets';
    try {
      const merged: UserPreferences = {
        ...prefs,
        ...partial,
        backgrounds: { ...prefs.backgrounds, ...(partial.backgrounds ?? {}) },
        homeWidgets: partial.homeWidgets
          ? { ...prefs.homeWidgets, ...partial.homeWidgets }
          : prefs.homeWidgets,
        coachWidgetLayouts: partial.coachWidgetLayouts
          ? { ...prefs.coachWidgetLayouts, ...partial.coachWidgetLayouts }
          : prefs.coachWidgetLayouts,
        rememberPortal: partial.rememberPortal ?? prefs.rememberPortal,
        playerRoomLayout: partial.playerRoomLayout !== undefined ? partial.playerRoomLayout : prefs.playerRoomLayout,
        stakekingsTheme: partial.stakekingsTheme ?? prefs.stakekingsTheme,
        creatorGuideSeen: partial.creatorGuideSeen ?? prefs.creatorGuideSeen,
        creatorGuideSeenAt: partial.creatorGuideSeenAt !== undefined ? partial.creatorGuideSeenAt : prefs.creatorGuideSeenAt,
        creatorGuideAutoShow: partial.creatorGuideAutoShow ?? prefs.creatorGuideAutoShow,
        siteBgType: partial.siteBgType ?? prefs.siteBgType,
        siteBgValue: partial.siteBgValue !== undefined ? partial.siteBgValue : prefs.siteBgValue,
        siteBgFit: partial.siteBgFit ?? prefs.siteBgFit,
        siteBgPosition: partial.siteBgPosition ?? prefs.siteBgPosition,
        siteBgOverlay: partial.siteBgOverlay ?? prefs.siteBgOverlay,
        defaultLanding: partial.defaultLanding ?? prefs.defaultLanding,
        defaultLoungeSlug: partial.defaultLoungeSlug !== undefined ? partial.defaultLoungeSlug : prefs.defaultLoungeSlug,
        loungeAccent: partial.loungeAccent !== undefined ? partial.loungeAccent : prefs.loungeAccent,
        defaultHomeWidget: partial.defaultHomeWidget !== undefined ? partial.defaultHomeWidget : prefs.defaultHomeWidget,
        mediaSplitRatio: partial.mediaSplitRatio !== undefined ? partial.mediaSplitRatio : prefs.mediaSplitRatio,
        messagingSplitRatio: partial.messagingSplitRatio !== undefined ? partial.messagingSplitRatio : prefs.messagingSplitRatio,
      };

      let homeWidgetsToSave: unknown = merged.homeWidgets;
      let roomLayoutToSave: unknown = merged.playerRoomLayout;

      if (partial.homeWidgets) {
        const { data: existing } = await supabase
          .from('user_preferences')
          .select('home_widgets')
          .eq('user_id', userId)
          .maybeSingle();
        const raw = (existing?.home_widgets as Record<string, unknown> | null) ?? {};
        const base = (raw.enabled && typeof raw.enabled === 'object') ? {} : raw;
        homeWidgetsToSave = { ...base, [portalKey]: merged.homeWidgets };
      }

      if (partial.playerRoomLayout !== undefined) {
        const { data: existing } = await supabase
          .from('user_preferences')
          .select('player_room_layout')
          .eq('user_id', userId)
          .maybeSingle();
        const raw = (existing?.player_room_layout as Record<string, unknown> | null) ?? {};
        const base = (raw.media && typeof raw.media === 'object') ? {} : raw;
        if (merged.playerRoomLayout === null) {
          const { [portalKey]: _, ...rest } = base as Record<string, unknown>;
          roomLayoutToSave = rest;
        } else {
          roomLayoutToSave = { ...base, [portalKey]: merged.playerRoomLayout };
        }
      }

      const { error: upsertErr } = await supabase
        .from('user_preferences')
        .upsert({
          user_id: userId,
          backgrounds: merged.backgrounds,
          home_widgets: homeWidgetsToSave,
          coach_widget_layouts: merged.coachWidgetLayouts,
          remember_portal: merged.rememberPortal,
          player_room_layout: roomLayoutToSave,
          stakekings_theme: merged.stakekingsTheme,
          creator_guide_seen: merged.creatorGuideSeen,
          creator_guide_seen_at: merged.creatorGuideSeenAt,
          creator_guide_auto_show: merged.creatorGuideAutoShow,
          site_bg_type: merged.siteBgType,
          site_bg_value: merged.siteBgValue,
          site_bg_fit: merged.siteBgFit,
          site_bg_position: merged.siteBgPosition,
          site_bg_overlay: merged.siteBgOverlay,
          default_landing: merged.defaultLanding,
          default_lounge_slug: merged.defaultLoungeSlug,
          lounge_accent: merged.loungeAccent,
          default_home_widget: merged.defaultHomeWidget,
          media_split_ratio: merged.mediaSplitRatio,
          messaging_split_ratio: merged.messagingSplitRatio,
          updated_at: new Date().toISOString(),
        });
      if (upsertErr) throw upsertErr;
      setPrefs(merged);
      setError(null);
      return true;
    } catch (err) {
      console.error('[useUserPreferences] Failed to save preferences:', err, 'partial:', partial);
      setError(errCat);
      return false;
    } finally {
      setSaving(false);
    }
  }, [userId, portalKey, prefs]);

  const setBackground = useCallback(async (screen: string, assetId: string | null) => {
    const next = { ...prefs.backgrounds };
    if (assetId === null) delete next[screen];
    else next[screen] = assetId;
    return save({ backgrounds: next });
  }, [prefs.backgrounds, save]);

  const setHomeWidgets = useCallback(async (widgets: HomeWidgetConfig) => {
    return save({ homeWidgets: widgets });
  }, [save]);

  const setCoachWidgetLayout = useCallback(async (widgetId: string, layout: WidgetLayout) => {
    return save({ coachWidgetLayouts: { [widgetId]: layout } });
  }, [save]);

  const setRememberPortal = useCallback(async (enabled: boolean) => {
    return save({ rememberPortal: enabled });
  }, [save]);

  const setPlayerRoomLayout = useCallback(async (layout: PlayerRoomLayout | null) => {
    return save({ playerRoomLayout: layout });
  }, [save]);

  const setStakekingsTheme = useCallback(async (theme: PortalThemeId) => {
    return save({ stakekingsTheme: theme });
  }, [save]);

  const markCreatorGuideSeen = useCallback(async () => {
    const now = new Date().toISOString();
    return save({ creatorGuideSeen: true, creatorGuideSeenAt: now });
  }, [save]);

  const disableCreatorGuideAutoShow = useCallback(async () => {
    const now = new Date().toISOString();
    return save({ creatorGuideSeen: true, creatorGuideSeenAt: now, creatorGuideAutoShow: false });
  }, [save]);

  const resetBackgrounds = useCallback(async () => {
    return save({ backgrounds: {} });
  }, [save]);

  const resetHomeWidgets = useCallback(async () => {
    return save({ homeWidgets: DEFAULT_WIDGETS });
  }, [save]);

  const setSiteBackground = useCallback(async (bgType: BgType, bgValue: string | null, fit?: BgFit, position?: BgPosition, overlay?: BgOverlay) => {
    return save({
      siteBgType: bgType,
      siteBgValue: bgValue,
      ...(fit !== undefined ? { siteBgFit: fit } : {}),
      ...(position !== undefined ? { siteBgPosition: position } : {}),
      ...(overlay !== undefined ? { siteBgOverlay: overlay } : {}),
    });
  }, [save]);

  const resetSiteBackground = useCallback(async () => {
    return save({ siteBgType: 'default', siteBgValue: null, siteBgFit: 'cover', siteBgPosition: 'center', siteBgOverlay: 'medium' });
  }, [save]);

  const setDefaultLanding = useCallback(async (mode: LandingMode, loungeSlug?: string | null) => {
    return save({ defaultLanding: mode, ...(loungeSlug !== undefined ? { defaultLoungeSlug: loungeSlug } : {}) });
  }, [save]);

  const setLoungeAccent = useCallback(async (accent: string | null) => {
    return save({ loungeAccent: accent });
  }, [save]);

  const setDefaultHomeWidget = useCallback(async (widget: string | null) => {
    return save({ defaultHomeWidget: widget });
  }, [save]);

  const setMediaSplitRatio = useCallback(async (ratio: number | null) => {
    return save({ mediaSplitRatio: ratio });
  }, [save]);

  const setMessagingSplitRatio = useCallback(async (ratio: number | null) => {
    return save({ messagingSplitRatio: ratio });
  }, [save]);

  return {
    prefs, loading, saving, error,
    setBackground, setHomeWidgets, setCoachWidgetLayout, setRememberPortal, setPlayerRoomLayout, setStakekingsTheme, markCreatorGuideSeen, disableCreatorGuideAutoShow, resetBackgrounds, resetHomeWidgets,
    setSiteBackground, resetSiteBackground, setDefaultLanding, setLoungeAccent, setDefaultHomeWidget,
    setMediaSplitRatio, setMessagingSplitRatio,
    reload: load,
  };
}
