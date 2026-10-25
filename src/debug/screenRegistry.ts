export interface ScreenDefinition {
  id: string;
  label: string;
  view: string;
  component: string;
  parent: string;
  status: 'built' | 'not-built';
}

export const SCREEN_REGISTRY = {
  LOGIN: { id: 'LOGIN', label: 'Login', view: 'LOGIN', component: 'AccessScreen', parent: 'App', status: 'built' },
  PLAYER_ROOM: { id: 'PLAYER_ROOM', label: 'Player Room', view: 'ROOM', component: 'PlayerHub', parent: 'App', status: 'built' },
  PLAYER_COMMUNITY: { id: 'PLAYER_COMMUNITY', label: 'Player Community', view: 'COMMUNITY', component: 'CommunityHub', parent: 'App', status: 'built' },
  PLAYER_CHAT: { id: 'PLAYER_CHAT', label: 'Player Chat', view: 'CHAT', component: 'PlayerNetwork', parent: 'App', status: 'built' },
  BUSINESS_ROOM: { id: 'BUSINESS_ROOM', label: 'Business Room', view: 'ROOM', component: 'BusinessHub', parent: 'App', status: 'built' },
  BUSINESS_COMMUNITY: { id: 'BUSINESS_COMMUNITY', label: 'Business Community', view: 'COMMUNITY', component: 'CommunityHub', parent: 'App', status: 'built' },
  BUSINESS_CHAT: { id: 'BUSINESS_CHAT', label: 'Business Chat', view: 'CHAT', component: 'not built', parent: 'canonical navigation', status: 'not-built' },
  INVESTOR_ROOM: { id: 'INVESTOR_ROOM', label: 'Investor Room', view: 'ROOM', component: 'InvestorHub', parent: 'App', status: 'built' },
  INVESTOR_COMMUNITY: { id: 'INVESTOR_COMMUNITY', label: 'Investor Community', view: 'COMMUNITY', component: 'CommunityHub', parent: 'App', status: 'built' },
  INVESTOR_CHAT: { id: 'INVESTOR_CHAT', label: 'Investor Chat', view: 'CHAT', component: 'not built', parent: 'canonical navigation', status: 'not-built' },
  MEDIA_ROOM: { id: 'MEDIA_ROOM', label: 'Media Room', view: 'ROOM', component: 'MediaHub', parent: 'App', status: 'built' },
  MEDIA_COMMUNITY: { id: 'MEDIA_COMMUNITY', label: 'Media Community', view: 'COMMUNITY', component: 'CommunityHub', parent: 'App', status: 'built' },
  MEDIA_CHAT: { id: 'MEDIA_CHAT', label: 'Media Chat', view: 'CHAT', component: 'not built', parent: 'canonical navigation', status: 'not-built' },
  COACH_ROOM: { id: 'COACH_ROOM', label: 'Coach Room', view: 'ROOM', component: 'CoachHub', parent: 'App', status: 'built' },
  COACH_COMMUNITY: { id: 'COACH_COMMUNITY', label: 'Coach Community', view: 'COMMUNITY', component: 'CommunityHub', parent: 'App', status: 'built' },
  COACH_CHAT: { id: 'COACH_CHAT', label: 'Coach Chat', view: 'CHAT', component: 'not built', parent: 'canonical navigation', status: 'not-built' },
  STABLE_ROOM: { id: 'STABLE_ROOM', label: 'Stable Room', view: 'ROOM', component: 'CanonicalPortalRoom', parent: 'App', status: 'built' },
  STABLE_COMMUNITY: { id: 'STABLE_COMMUNITY', label: 'Stable Community', view: 'COMMUNITY', component: 'CommunityHub', parent: 'App', status: 'built' },
  STABLE_SECOND_FLOOR: { id: 'STABLE_SECOND_FLOOR', label: 'Stable Second Floor', view: 'ROOM', component: 'CanonicalPortalRoom', parent: 'App', status: 'built' },
  CREATOR_ROOM: { id: 'CREATOR_ROOM', label: 'Creator Room', view: 'ROOM', component: 'ProTalentHub', parent: 'App', status: 'built' },
  CREATOR_COMMUNITY: { id: 'CREATOR_COMMUNITY', label: 'Creator Community', view: 'COMMUNITY', component: 'CommunityHub', parent: 'App', status: 'built' },
  CREATOR_CHAT: { id: 'CREATOR_CHAT', label: 'Creator Chat', view: 'CHAT', component: 'not built', parent: 'canonical navigation', status: 'not-built' },
  JOBS_ROOM: { id: 'JOBS_ROOM', label: 'Jobs Room', view: 'ROOM', component: 'JobsPage', parent: 'App', status: 'built' },
  JOBS_COMMUNITY: { id: 'JOBS_COMMUNITY', label: 'Jobs Community', view: 'COMMUNITY', component: 'CommunityHub', parent: 'App', status: 'built' },
  JOBS_CHAT: { id: 'JOBS_CHAT', label: 'Jobs Chat', view: 'CHAT', component: 'not built', parent: 'canonical navigation', status: 'not-built' },
  PARTNERSHIPS_ROOM: { id: 'PARTNERSHIPS_ROOM', label: 'Partnerships Room', view: 'ROOM', component: 'HubPreview', parent: 'App', status: 'built' },
  PARTNERSHIPS_COMMUNITY: { id: 'PARTNERSHIPS_COMMUNITY', label: 'Partnerships Community', view: 'COMMUNITY', component: 'CommunityHub', parent: 'App', status: 'built' },
  PARTNERSHIPS_CHAT: { id: 'PARTNERSHIPS_CHAT', label: 'Partnerships Chat', view: 'CHAT', component: 'not built', parent: 'canonical navigation', status: 'not-built' },
  PRO_ROOM: { id: 'PRO_ROOM', label: 'Pro Room', view: 'ROOM', component: 'ProTalentHub', parent: 'App', status: 'built' },
  PRO_COMMUNITY: { id: 'PRO_COMMUNITY', label: 'Pro Community', view: 'COMMUNITY', component: 'CommunityHub', parent: 'App', status: 'built' },
  PRO_CHAT: { id: 'PRO_CHAT', label: 'Pro Chat', view: 'CHAT', component: 'not built', parent: 'canonical navigation', status: 'not-built' },
} as const satisfies Record<string, ScreenDefinition>;

export type ScreenKey = keyof typeof SCREEN_REGISTRY;

export function screenText(screen: ScreenDefinition): string {
  return `SCREEN ${screen.id} — ${screen.label.toUpperCase()} — ${screen.view} — ${screen.component}`;
}
