import type { HelpSection } from '@/data/helpHubData';

export interface HelpEnvironmentConfig {
  image: string;
  overlay: string;
  glassOpacity: number;
  accent: string;
  accentDim: string;
  position: string;
}

export const HELP_ENVIRONMENTS: Record<HelpSection, HelpEnvironmentConfig> = {
  lobby: {
    image: '/help-env-overview.webp',
    overlay: 'linear-gradient(180deg, rgba(6,10,8,0.35) 0%, rgba(6,10,8,0.55) 100%)',
    glassOpacity: 0.72,
    accent: '#a8c4b8',
    accentDim: 'rgba(168,196,184,0.15)',
    position: 'center center',
  },
  therapy: {
    image: '/help-env-therapy.webp',
    overlay: 'linear-gradient(180deg, rgba(12,8,4,0.4) 0%, rgba(12,8,4,0.6) 100%)',
    glassOpacity: 0.72,
    accent: '#c9a44c',
    accentDim: 'rgba(201,164,76,0.15)',
    position: 'center center',
  },
  performance: {
    image: '/help-env-performance.webp',
    overlay: 'linear-gradient(180deg, rgba(6,8,12,0.4) 0%, rgba(6,8,12,0.6) 100%)',
    glassOpacity: 0.72,
    accent: '#7a9b8e',
    accentDim: 'rgba(122,155,142,0.15)',
    position: 'center center',
  },
  gambling: {
    image: '/help-env-gambling.webp',
    overlay: 'linear-gradient(180deg, rgba(6,10,14,0.35) 0%, rgba(6,10,14,0.55) 100%)',
    glassOpacity: 0.72,
    accent: '#8a9ab5',
    accentDim: 'rgba(138,154,181,0.15)',
    position: 'center center',
  },
  'my-support': {
    image: '/help-env-mysupport.webp',
    overlay: 'linear-gradient(180deg, rgba(6,10,8,0.35) 0%, rgba(6,10,8,0.55) 100%)',
    glassOpacity: 0.72,
    accent: '#a8c4b8',
    accentDim: 'rgba(168,196,184,0.15)',
    position: 'center center',
  },
};
