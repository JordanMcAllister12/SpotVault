// ===== HELP HUB — DEMO DATA =====
// All providers, appointments, and resources here are DEMO data.
// Real licensed providers and regional gambling-support organizations
// will be connected later. Nothing here implies real licensure.

export type HelpSection = 'lobby' | 'therapy' | 'performance' | 'gambling' | 'my-support';

// ===== THERAPY PROVIDERS =====

export interface TherapyProvider {
  id: string;
  name: string;
  credentials: string;
  specialties: string[];
  bio: string;
  standardRate: number;
  memberRate: number;
  nextAvailable: string;
  sessionLength: number;
  modality: string;
  demo: boolean;
}

export const THERAPY_PROVIDERS: TherapyProvider[] = [
  {
    id: 'tp-1',
    name: 'Dr. Sarah Whitfield',
    credentials: 'Licensed Clinical Psychologist',
    specialties: ['Anxiety', 'Stress', 'Performance Pressure'],
    bio: 'Specializes in cognitive-behavioral therapy for high-performing individuals. Experience with athletes, poker players, and professionals facing high-pressure environments.',
    standardRate: 180,
    memberRate: 140,
    nextAvailable: 'Tomorrow — 3:30 PM',
    sessionLength: 50,
    modality: 'Video / In-Person',
    demo: true,
  },
  {
    id: 'tp-2',
    name: 'Dr. Marcus Brennan',
    credentials: 'Licensed Marriage & Family Therapist',
    specialties: ['Depression', 'Relationships', 'Life Transitions'],
    bio: 'Works with individuals navigating major life transitions, including career changes and the unique lifestyle demands of professional poker.',
    standardRate: 150,
    memberRate: 120,
    nextAvailable: 'Thursday — 11:00 AM',
    sessionLength: 50,
    modality: 'Video',
    demo: true,
  },
  {
    id: 'tp-3',
    name: 'Dr. Lisa Chen',
    credentials: 'Licensed Clinical Social Worker',
    specialties: ['Anxiety', 'Sleep', 'Burnout'],
    bio: 'Focuses on stress management, sleep hygiene, and burnout prevention for professionals in high-variance, high-pressure fields.',
    standardRate: 160,
    memberRate: 125,
    nextAvailable: 'Friday — 9:00 AM',
    sessionLength: 45,
    modality: 'Video / Phone',
    demo: true,
  },
  {
    id: 'tp-4',
    name: 'Dr. James Okonkwo',
    credentials: 'Licensed Psychologist',
    specialties: ['Trauma', 'Emotional Regulation', 'Stress'],
    bio: 'Trauma-informed therapy with a focus on emotional regulation and resilience building. EMDR-certified.',
    standardRate: 200,
    memberRate: 160,
    nextAvailable: 'Next Monday — 2:00 PM',
    sessionLength: 60,
    modality: 'In-Person / Video',
    demo: true,
  },
];

// ===== PERFORMANCE COACHES =====

export interface PerformanceCoach {
  id: string;
  name: string;
  title: string;
  specialties: string[];
  bio: string;
  standardRate: number;
  memberRate: number;
  rating: number;
  reviewCount: number;
  nextAvailable: string;
  sessionLength: number;
  demo: boolean;
}

export const PERFORMANCE_COACHES: PerformanceCoach[] = [
  {
    id: 'pc-1',
    name: 'Jared Tendler',
    title: 'Mental Game & High Performance',
    specialties: ['Tilt Management', 'Mental Game', 'Performance Under Pressure'],
    bio: 'Leading mental game coach for poker players. Author and creator of the Mental Game of Poker system. Has worked with thousands of players from micro-stakes to high-roller levels.',
    standardRate: 175,
    memberRate: 125,
    rating: 5,
    reviewCount: 312,
    nextAvailable: 'Friday — 1:00 PM',
    sessionLength: 60,
    demo: true,
  },
  {
    id: 'pc-2',
    name: 'Elliot Roe',
    title: 'Mindset & Performance Coach',
    specialties: ['Confidence', 'Focus', 'Tournament Preparation'],
    bio: 'Hypnotherapist and mindset coach specializing in poker performance. Works with tournament players on preparation routines, focus, and confidence under pressure.',
    standardRate: 200,
    memberRate: 150,
    rating: 5,
    reviewCount: 198,
    nextAvailable: 'Saturday — 10:00 AM',
    sessionLength: 45,
    demo: true,
  },
  {
    id: 'pc-3',
    name: 'Tricia Cardner',
    title: 'Performance Psychology',
    specialties: ['Resilience', 'Goal Setting', 'Recovery'],
    bio: 'Psychology professor and poker performance researcher. Focuses on evidence-based performance techniques, goal setting, and recovery after downswings.',
    standardRate: 150,
    memberRate: 110,
    rating: 5,
    reviewCount: 87,
    nextAvailable: 'Wednesday — 4:00 PM',
    sessionLength: 60,
    demo: true,
  },
];

// ===== APPOINTMENTS =====

export interface HelpAppointment {
  id: string;
  type: 'therapy' | 'performance';
  providerName: string;
  dayLabel: string;
  timeLabel: string;
  durationMinutes: number;
  memberRate: number;
  standardRate: number;
  status: 'upcoming' | 'completed';
  modality: string;
}

export const DEMO_APPOINTMENTS: HelpAppointment[] = [
  {
    id: 'apt-1',
    type: 'therapy',
    providerName: 'Dr. Sarah Whitfield',
    dayLabel: 'Thursday',
    timeLabel: '3:30 PM',
    durationMinutes: 50,
    memberRate: 140,
    standardRate: 180,
    status: 'upcoming',
    modality: 'Video Session',
  },
  {
    id: 'apt-2',
    type: 'performance',
    providerName: 'Jared Tendler',
    dayLabel: 'Friday',
    timeLabel: '1:00 PM',
    durationMinutes: 60,
    memberRate: 125,
    standardRate: 175,
    status: 'upcoming',
    modality: 'Video Session',
  },
  {
    id: 'apt-3',
    type: 'therapy',
    providerName: 'Dr. Marcus Brennan',
    dayLabel: 'Last Tuesday',
    timeLabel: '11:00 AM',
    durationMinutes: 50,
    memberRate: 120,
    standardRate: 150,
    status: 'completed',
    modality: 'Video Session',
  },
];

// ===== PERFORMANCE CONTENT =====

export interface PerformanceContent {
  id: string;
  title: string;
  description: string;
  category: 'routine' | 'video' | 'series' | 'article' | 'exercise';
  duration: string;
  access: 'free' | 'member' | 'paid';
  ctaLabel: string;
}

export const PERFORMANCE_CONTENT: PerformanceContent[] = [
  {
    id: 'pc-content-1',
    title: 'Before You Play — 10-Minute Tournament Preparation',
    description: 'A guided routine to center yourself before a session. Breathing, focus cues, and intention setting.',
    category: 'routine',
    duration: '10 min',
    access: 'free',
    ctaLabel: 'Start',
  },
  {
    id: 'pc-content-2',
    title: 'After a Bad Session — Mental Reset Routine',
    description: 'A 5-minute reset protocol for processing losses and preventing emotional carryover into your next session.',
    category: 'routine',
    duration: '5 min',
    access: 'free',
    ctaLabel: 'Start',
  },
  {
    id: 'pc-content-3',
    title: 'Dealing With a Downswing — Performance Coach Series',
    description: 'A 4-part video series on navigating downswings. Emotional regulation, process focus, and variance acceptance.',
    category: 'series',
    duration: '4 videos',
    access: 'member',
    ctaLabel: 'Watch',
  },
  {
    id: 'pc-content-4',
    title: 'Tilt Identification & Interruption',
    description: 'Learn to identify tilt early and use proven interruption techniques before it costs you your stack.',
    category: 'video',
    duration: '22 min',
    access: 'member',
    ctaLabel: 'Watch',
  },
  {
    id: 'pc-content-5',
    title: 'Sleep & Recovery for Poker Players',
    description: 'How sleep affects decision quality. Practical sleep hygiene for tournament and cash players with irregular schedules.',
    category: 'article',
    duration: '8 min read',
    access: 'free',
    ctaLabel: 'Read',
  },
  {
    id: 'pc-content-6',
    title: 'Goal Setting Framework for Tournament Players',
    description: 'Process-based goal setting exercise. Move beyond results-oriented thinking and build a system that supports long-term improvement.',
    category: 'exercise',
    duration: '15 min',
    access: 'member',
    ctaLabel: 'Start',
  },
];

// ===== GAMBLING SUPPORT — AWARENESS BOARD =====

export interface AwarenessSection {
  id: string;
  title: string;
  description: string;
  icon: 'info' | 'alert' | 'check' | 'limits' | 'break' | 'talk';
}

export const AWARENESS_SECTIONS: AwarenessSection[] = [
  {
    id: 'aw-1',
    title: 'Understanding Your Play',
    description: 'Learn about how gambling works, the role of variance, and why understanding your own patterns matters.',
    icon: 'info',
  },
  {
    id: 'aw-2',
    title: 'Warning Signs',
    description: 'Recognize common signs that gambling may be affecting your wellbeing — chasing losses, neglecting responsibilities, or playing beyond your means.',
    icon: 'alert',
  },
  {
    id: 'aw-3',
    title: 'Take a Self-Check',
    description: 'A confidential self-assessment tool to help you reflect on your gambling habits. Your results are private to you.',
    icon: 'check',
  },
  {
    id: 'aw-4',
    title: 'Setting Limits',
    description: 'Practical guidance on setting deposit, time, and loss limits across the platforms you use.',
    icon: 'limits',
  },
  {
    id: 'aw-5',
    title: 'Taking a Break',
    description: 'Information about self-exclusion programs, cooling-off periods, and how to step away when you need to.',
    icon: 'break',
  },
  {
    id: 'aw-6',
    title: 'Talking to Someone',
    description: 'How to start a conversation about gambling concerns — with a professional, a trusted person, or a support line.',
    icon: 'talk',
  },
];

// ===== SAVED RESOURCES (My Support) =====

export interface SavedResource {
  id: string;
  title: string;
  type: 'article' | 'routine' | 'video' | 'exercise';
  source: string;
}

export const SAVED_RESOURCES: SavedResource[] = [
  { id: 'sr-1', title: 'Before You Play — 10-Minute Tournament Preparation', type: 'routine', source: 'Performance Center' },
  { id: 'sr-2', title: 'Sleep & Recovery for Poker Players', type: 'article', source: 'Performance Center' },
  { id: 'sr-3', title: 'Tilt Identification & Interruption', type: 'video', source: 'Performance Center' },
];

// ===== MEMBER BENEFITS =====

export interface MemberBenefit {
  id: string;
  label: string;
  description: string;
  savings: string;
}

export const MEMBER_BENEFITS: MemberBenefit[] = [
  { id: 'mb-1', label: 'Therapy Session Discount', description: 'Save $40 on your next therapy session with Dr. Sarah Whitfield.', savings: '$40' },
  { id: 'mb-2', label: 'Performance Coaching Discount', description: 'Save $50 on your next performance coaching session with Jared Tendler.', savings: '$50' },
  { id: 'mb-3', label: 'Free Performance Content', description: 'Access to member-only performance routines and video series at no extra cost.', savings: 'Included' },
];
