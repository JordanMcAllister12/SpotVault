// Coach Portal data types and demo data

export type StudentTrend = 'improving' | 'stable' | 'declining';
export type StudentStatus = 'active' | 'paused' | 'inactive';

export interface AnalyticsSnapshot {
  date: string;
  abi: number;
  roi: number;
  spi: number;
  bb100: number;
  evBb100: number;
  profit: number;
  bankroll: number;
  stakes: string;
  volume: number;
  riverAggression: number;
  preflopAggression: number;
  tournamentResults: number;
  cashResults: number;
}

export interface JourneyCheckpoint {
  id: string;
  date: string;
  label: string;
  type: 'baseline' | 'checkpoint' | 'milestone';
  snapshot: AnalyticsSnapshot;
  coachNotes: string;
  studentNotes: string;
  strengths: string[];
  leaks: string[];
  goals: string[];
  nextObjectives: string[];
  attachments: StudentAttachment[];
}

export interface StudentAttachment {
  id: string;
  name: string;
  type: 'image' | 'pdf' | 'csv' | 'graph';
  url?: string;
  uploadedAt: string;
}

export interface CoachNote {
  id: string;
  studentId: string;
  text: string;
  createdAt: string;
  visibility: 'private' | 'shared';
}

export type StudyAssignmentType =
  | 'spotvault_spot' | 'hand_history' | 'hh_bundle' | 'course'
  | 'quiz' | 'video' | 'custom_task' | 'analytics_review';

export type AssignmentStatus = 'assigned' | 'in_progress' | 'completed' | 'overdue';

export interface StudyAssignment {
  id: string;
  studentId: string;
  title: string;
  type: StudyAssignmentType;
  status: AssignmentStatus;
  progress: number;
  total: number;
  dueDate: string;
  priority: 'low' | 'medium' | 'high';
  instructions: string;
  weekLabel: string;
}

export type SessionStatus = 'upcoming' | 'completed' | 'cancelled';

export interface CoachingSession {
  id: string;
  studentId: string;
  date: string;
  timeStart: string;
  durationMinutes: number;
  topic: string;
  status: SessionStatus;
  notes: string;
  handsReviewed: number;
  assignmentsCreated: number;
  videoLink?: string;
  summary?: string;
  homework?: string;
}

export interface StudentHand {
  id: string;
  studentId: string;
  title: string;
  stakes: string;
  position: string;
  markedAs: 'needs_review' | 'saved' | 'reviewed' | 'complete';
  uploadedAt: string;
  tournamentId?: string;
  notes?: string;
}

export interface PokerUsername {
  site: string;
  username: string;
}

export interface CoachStudent {
  id: string;
  name: string;
  email: string;
  spotvaultUsername?: string;
  avatarInitials: string;
  pokerUsernames: PokerUsername[];
  primarySite: string;
  gameType: string;
  stakes: string;
  abi: number;
  roi: number;
  spi: number;
  bb100: number;
  evBb100: number;
  profit: number;
  bankroll: number;
  trend: StudentTrend;
  status: StudentStatus;
  coachingSince: string;
  lastSession: string;
  lastHhUpload: string;
  nextSession?: string;
  handsWaitingReview: number;
  assignmentsOverdue: number;
  daysSinceLastSession: number;
  analyticsPermission: boolean;
  currentSnapshot: AnalyticsSnapshot;
  journey: JourneyCheckpoint[];
  notes: CoachNote[];
  assignments: StudyAssignment[];
  sessions: CoachingSession[];
  hands: StudentHand[];
}

export const COACH_STUDENTS: CoachStudent[] = [
  {
    id: 'stu-jordan',
    name: 'Jordan McAllister',
    email: 'jordan@spotvault.com',
    spotvaultUsername: 'JordanMcAllister',
    avatarInitials: 'JM',
    pokerUsernames: [
      { site: 'GG', username: 'Ho_Lee_Fuk' },
      { site: 'PokerStars', username: 'JMacPoker' },
    ],
    primarySite: 'GG',
    gameType: 'NLHE MTT',
    stakes: '$150 ABI',
    abi: 150,
    roi: 22.4,
    spi: 81,
    bb100: 8.2,
    evBb100: 7.8,
    profit: 71600,
    bankroll: 85000,
    trend: 'improving',
    status: 'active',
    coachingSince: '2027-01-10',
    lastSession: '2027-08-08',
    lastHhUpload: '2027-08-10',
    nextSession: '2027-08-15',
    handsWaitingReview: 18,
    assignmentsOverdue: 0,
    daysSinceLastSession: 4,
    analyticsPermission: true,
    currentSnapshot: {
      date: '2027-08-10',
      abi: 150,
      roi: 22.4,
      spi: 81,
      bb100: 8.2,
      evBb100: 7.8,
      profit: 71600,
      bankroll: 85000,
      stakes: '$100-$215',
      volume: 420,
      riverAggression: 34,
      preflopAggression: 28,
      tournamentResults: 71600,
      cashResults: 0,
    },
    journey: [
      {
        id: 'j1',
        date: '2027-01-10',
        label: 'Coaching Began',
        type: 'baseline',
        snapshot: {
          date: '2027-01-10',
          abi: 18,
          roi: 6,
          spi: 61,
          bb100: 3.8,
          evBb100: 3.2,
          profit: 4200,
          bankroll: 5000,
          stakes: '$5-$25',
          volume: 180,
          riverAggression: 22,
          preflopAggression: 18,
          tournamentResults: 4200,
          cashResults: 0,
        },
        coachNotes: 'Strengths: Good preflop fundamentals. Primary leaks: Over-folding rivers, low turn aggression. Goal: Move from $18 ABI to $50 ABI.',
        studentNotes: 'Excited to start. Want to move up in stakes.',
        strengths: ['Good preflop fundamentals', 'Disciplinary bankroll management'],
        leaks: ['Over-folding rivers', 'Low turn aggression', 'Passive 3-bet range'],
        goals: ['Move from $18 ABI to $50 ABI', 'Improve river call frequency'],
        nextObjectives: ['Review 50 BTN vs BB hands', 'Study turn aggression spots'],
        attachments: [],
      },
      {
        id: 'j2',
        date: '2027-04-10',
        label: '90 Days',
        type: 'checkpoint',
        snapshot: {
          date: '2027-04-10',
          abi: 35,
          roi: 12,
          spi: 68,
          bb100: 5.1,
          evBb100: 4.8,
          profit: 18500,
          bankroll: 22000,
          stakes: '$25-$75',
          volume: 280,
          riverAggression: 28,
          preflopAggression: 23,
          tournamentResults: 18500,
          cashResults: 0,
        },
        coachNotes: 'Significant improvement in river aggression. Still over-folding paired turns. ABI climbing nicely.',
        studentNotes: 'Feeling more confident in river spots. Starting to move up.',
        strengths: ['Improved river aggression', 'Better turn play'],
        leaks: ['Paired turn over-folding', 'ICM pressure spots'],
        goals: ['Reach $50 ABI', 'Master ICM final table play'],
        nextObjectives: ['ICM course completion', 'Review 20 final table hands'],
        attachments: [],
      },
      {
        id: 'j3',
        date: '2027-08-10',
        label: 'Moving Up Stakes',
        type: 'milestone',
        snapshot: {
          date: '2027-08-10',
          abi: 150,
          roi: 22.4,
          spi: 81,
          bb100: 8.2,
          evBb100: 7.8,
          profit: 71600,
          bankroll: 85000,
          stakes: '$100-$215',
          volume: 420,
          riverAggression: 34,
          preflopAggression: 28,
          tournamentResults: 71600,
          cashResults: 0,
        },
        coachNotes: 'Excellent progress. River aggression now above average. Turn aggression improved significantly. Ready for $215+ ABI.',
        studentNotes: 'Best stretch of my career. The ICM work paid off massively.',
        strengths: ['River aggression', 'ICM execution', 'Turn aggression'],
        leaks: ['Deep final table 3-bet pots', 'Blind vs blind defense'],
        goals: ['Reach $215 ABI', 'Win a major tournament'],
        nextObjectives: ['Review deep runs', 'Study blind vs blind ranges'],
        attachments: [],
      },
    ],
    notes: [
      { id: 'n1', studentId: 'stu-jordan', text: 'Jordan is progressing rapidly. Consider introducing advanced ICM concepts next session.', createdAt: '2027-08-09', visibility: 'private' },
      { id: 'n2', studentId: 'stu-jordan', text: 'Great work on the river aggression drills. Keep applying that in your next sessions.', createdAt: '2027-08-05', visibility: 'shared' },
    ],
    assignments: [
      { id: 'a1', studentId: 'stu-jordan', title: 'Review 20 BTN vs BB hands', type: 'hand_history', status: 'in_progress', progress: 12, total: 20, dueDate: '2027-08-14', priority: 'high', instructions: 'Focus on 3-bet pots. Mark any hands where you over-fold the turn.', weekLabel: 'This Week' },
      { id: 'a2', studentId: 'stu-jordan', title: 'Final Table ICM Course', type: 'course', status: 'in_progress', progress: 4, total: 8, dueDate: '2027-08-20', priority: 'medium', instructions: 'Complete lessons 5-8. Take notes on push/fold charts.', weekLabel: 'This Week' },
      { id: 'a3', studentId: 'stu-jordan', title: 'Review River Bluff Spot', type: 'spotvault_spot', status: 'assigned', progress: 0, total: 1, dueDate: '2027-08-16', priority: 'high', instructions: 'Analyze the river bluff spot in the shared collection. Write your range analysis.', weekLabel: 'This Week' },
    ],
    sessions: [
      { id: 's1', studentId: 'stu-jordan', date: '2027-08-15', timeStart: '14:00', durationMinutes: 60, topic: 'Deep Final Table Review', status: 'upcoming', notes: '', handsReviewed: 0, assignmentsCreated: 0 },
      { id: 's2', studentId: 'stu-jordan', date: '2027-08-08', timeStart: '14:00', durationMinutes: 60, topic: 'River Aggression + ICM', status: 'completed', notes: 'Reviewed 20 BB defense hands. Main leak: over-folding paired turns. Homework: Review assigned SpotVault collection.', handsReviewed: 20, assignmentsCreated: 3, summary: 'Reviewed 20 BB defense hands. Main leak: over-folding paired turns.', homework: 'Review assigned SpotVault collection' },
      { id: 's3', studentId: 'stu-jordan', date: '2027-07-25', timeStart: '14:00', durationMinutes: 90, topic: 'Turn Aggression Deep Dive', status: 'completed', notes: 'Deep dive on turn aggression. Assigned ICM course.', handsReviewed: 15, assignmentsCreated: 2, summary: 'Turn aggression deep dive. Assigned ICM course.', homework: 'Complete ICM course lessons 1-4' },
    ],
    hands: [
      { id: 'h1', studentId: 'stu-jordan', title: 'BTN vs BB 3-bet pot, paired turn', stakes: '$215', position: 'BTN', markedAs: 'needs_review', uploadedAt: '2027-08-10', tournamentId: 'GG #12345' },
      { id: 'h2', studentId: 'stu-jordan', title: 'SB vs BB river bluff spot', stakes: '$150', position: 'SB', markedAs: 'needs_review', uploadedAt: '2027-08-09' },
      { id: 'h3', studentId: 'stu-jordan', title: 'Final table ICM fold', stakes: '$215', position: 'CO', markedAs: 'reviewed', uploadedAt: '2027-08-05', notes: 'Correct fold. ICM pressure justified.' },
      { id: 'h4', studentId: 'stu-jordan', title: 'UTG open, BB defense', stakes: '$100', position: 'UTG', markedAs: 'saved', uploadedAt: '2027-08-03' },
    ],
  },
  {
    id: 'stu-kevin',
    name: 'Kevin Martin',
    email: 'kevin@spotvault.com',
    spotvaultUsername: 'KevinMartin',
    avatarInitials: 'KM',
    pokerUsernames: [
      { site: 'GG', username: 'KevinMartin' },
      { site: 'PokerStars', username: 'KMartinPro' },
    ],
    primarySite: 'GG',
    gameType: 'NLHE MTT',
    stakes: '$50 ABI',
    abi: 50,
    roi: 14.2,
    spi: 74,
    bb100: 6.1,
    evBb100: 5.8,
    profit: 28400,
    bankroll: 35000,
    trend: 'stable',
    status: 'active',
    coachingSince: '2027-03-15',
    lastSession: '2027-07-28',
    lastHhUpload: '2027-08-01',
    nextSession: '2027-08-18',
    handsWaitingReview: 5,
    assignmentsOverdue: 2,
    daysSinceLastSession: 15,
    analyticsPermission: true,
    currentSnapshot: {
      date: '2027-08-01',
      abi: 50,
      roi: 14.2,
      spi: 74,
      bb100: 6.1,
      evBb100: 5.8,
      profit: 28400,
      bankroll: 35000,
      stakes: '$25-$100',
      volume: 320,
      riverAggression: 26,
      preflopAggression: 22,
      tournamentResults: 28400,
      cashResults: 0,
    },
    journey: [
      {
        id: 'k1',
        date: '2027-03-15',
        label: 'Coaching Began',
        type: 'baseline',
        snapshot: {
          date: '2027-03-15',
          abi: 12,
          roi: 3,
          spi: 58,
          bb100: 2.1,
          evBb100: 1.9,
          profit: 1200,
          bankroll: 3000,
          stakes: '$5-$25',
          volume: 150,
          riverAggression: 18,
          preflopAggression: 15,
          tournamentResults: 1200,
          cashResults: 0,
        },
        coachNotes: 'Beginner fundamentals. Needs work on preflop ranges and postflop aggression.',
        studentNotes: 'Want to move up from micros.',
        strengths: ['Willingness to learn', 'Good study habits'],
        leaks: ['Preflop range gaps', 'Postflop passivity', 'Stack-off decisions'],
        goals: ['Reach $25 ABI', 'Build solid preflop foundation'],
        nextObjectives: ['Memorize opening ranges', 'Review 30 preflop spots'],
        attachments: [],
      },
      {
        id: 'k2',
        date: '2027-08-01',
        label: '5 Months',
        type: 'checkpoint',
        snapshot: {
          date: '2027-08-01',
          abi: 50,
          roi: 14.2,
          spi: 74,
          bb100: 6.1,
          evBb100: 5.8,
          profit: 28400,
          bankroll: 35000,
          stakes: '$25-$100',
          volume: 320,
          riverAggression: 26,
          preflopAggression: 22,
          tournamentResults: 28400,
          cashResults: 0,
        },
        coachNotes: 'Good progress on preflop. Still passive postflop. Study plan overdue - needs a push.',
        studentNotes: 'Feeling stuck at $50 ABI. Want to break through.',
        strengths: ['Preflop ranges improved', 'Better stack-off decisions'],
        leaks: ['Postflop passivity', 'River over-folds'],
        goals: ['Reach $100 ABI', 'Improve postflop aggression'],
        nextObjectives: ['Complete overdue study plan', 'Review 20 postflop spots'],
        attachments: [],
      },
    ],
    notes: [
      { id: 'n3', studentId: 'stu-kevin', text: 'Kevin is plateauing. Need to push him on postflop aggression. Study plan is overdue.', createdAt: '2027-08-10', visibility: 'private' },
    ],
    assignments: [
      { id: 'a4', studentId: 'stu-kevin', title: 'Postflop Aggression Course', type: 'course', status: 'overdue', progress: 2, total: 10, dueDate: '2027-08-01', priority: 'high', instructions: 'Complete all 10 lessons. This is overdue.' , weekLabel: 'Overdue'},
      { id: 'a5', studentId: 'stu-kevin', title: 'Review 15 3-bet pot hands', type: 'hand_history', status: 'overdue', progress: 5, total: 15, dueDate: '2027-08-05', priority: 'high', instructions: 'Focus on c-bet decisions in 3-bet pots.', weekLabel: 'Overdue' },
      { id: 'a6', studentId: 'stu-kevin', title: 'Preflop Range Quiz', type: 'quiz', status: 'completed', progress: 20, total: 20, dueDate: '2027-07-20', priority: 'medium', instructions: 'Complete the preflop range quiz.', weekLabel: 'Last Week' },
    ],
    sessions: [
      { id: 's4', studentId: 'stu-kevin', date: '2027-08-18', timeStart: '10:00', durationMinutes: 60, topic: 'Postflop Aggression Review', status: 'upcoming', notes: '', handsReviewed: 0, assignmentsCreated: 0 },
      { id: 's5', studentId: 'stu-kevin', date: '2027-07-28', timeStart: '10:00', durationMinutes: 60, topic: 'Preflop + Stack-off Review', status: 'completed', notes: 'Reviewed stack-off decisions. Assigned postflop course.', handsReviewed: 12, assignmentsCreated: 2, summary: 'Reviewed stack-off decisions. Assigned postflop course.', homework: 'Complete postflop aggression course' },
    ],
    hands: [
      { id: 'h5', studentId: 'stu-kevin', title: 'CO vs BTN 3-bet, missed c-bet', stakes: '$50', position: 'CO', markedAs: 'needs_review', uploadedAt: '2027-08-01' },
      { id: 'h6', studentId: 'stu-kevin', title: 'River over-fold vs river bet', stakes: '$50', position: 'BB', markedAs: 'saved', uploadedAt: '2027-07-30' },
    ],
  },
  {
    id: 'stu-sarah',
    name: 'Sarah Chen',
    email: 'sarah@spotvault.com',
    spotvaultUsername: 'SarahChen',
    avatarInitials: 'SC',
    pokerUsernames: [
      { site: 'GG', username: 'SarahChen' },
      { site: 'PokerStars', username: 'SCpoker' },
    ],
    primarySite: 'PokerStars',
    gameType: 'NLHE MTT',
    stakes: '$25 ABI',
    abi: 25,
    roi: 8.5,
    spi: 67,
    bb100: 4.2,
    evBb100: 4.0,
    profit: 8200,
    bankroll: 12000,
    trend: 'improving',
    status: 'active',
    coachingSince: '2027-06-01',
    lastSession: '2027-07-22',
    lastHhUpload: '2027-07-25',
    nextSession: undefined,
    handsWaitingReview: 4,
    assignmentsOverdue: 0,
    daysSinceLastSession: 21,
    analyticsPermission: false,
    currentSnapshot: {
      date: '2027-07-25',
      abi: 25,
      roi: 8.5,
      spi: 67,
      bb100: 4.2,
      evBb100: 4.0,
      profit: 8200,
      bankroll: 12000,
      stakes: '$10-$50',
      volume: 240,
      riverAggression: 24,
      preflopAggression: 20,
      tournamentResults: 8200,
      cashResults: 0,
    },
    journey: [
      {
        id: 'sc1',
        date: '2027-06-01',
        label: 'Coaching Began',
        type: 'baseline',
        snapshot: {
          date: '2027-06-01',
          abi: 8,
          roi: 2,
          spi: 55,
          bb100: 1.5,
          evBb100: 1.2,
          profit: 600,
          bankroll: 2000,
          stakes: '$2-$11',
          volume: 100,
          riverAggression: 15,
          preflopAggression: 12,
          tournamentResults: 600,
          cashResults: 0,
        },
        coachNotes: 'New to coaching. Basic understanding. Needs foundational work.',
        studentNotes: 'Ready to learn and put in the work.',
        strengths: ['Eager to learn', 'Good at following instructions'],
        leaks: ['Preflop understanding', 'Position awareness', 'Bet sizing'],
        goals: ['Reach $25 ABI', 'Understand position'],
        nextObjectives: ['Study opening charts', 'Review 20 hands'],
        attachments: [],
      },
      {
        id: 'sc2',
        date: '2027-07-25',
        label: '6 Weeks',
        type: 'checkpoint',
        snapshot: {
          date: '2027-07-25',
          abi: 25,
          roi: 8.5,
          spi: 67,
          bb100: 4.2,
          evBb100: 4.0,
          profit: 8200,
          bankroll: 12000,
          stakes: '$10-$50',
          volume: 240,
          riverAggression: 24,
          preflopAggression: 20,
          tournamentResults: 8200,
          cashResults: 0,
        },
        coachNotes: 'Good improvement. Position awareness much better. Needs a session - 21 days since last.',
        studentNotes: 'Feeling good about progress. Ready for more.',
        strengths: ['Position awareness improved', 'Better bet sizing'],
        leaks: ['River decisions', '3-bet defense'],
        goals: ['Reach $50 ABI', 'Improve 3-bet defense'],
        nextObjectives: ['Schedule next session', 'Review 3-bet defense hands'],
        attachments: [],
      },
    ],
    notes: [
      { id: 'n4', studentId: 'stu-sarah', text: 'Sarah has not had a session in 21 days. Need to reach out and schedule one.', createdAt: '2027-08-12', visibility: 'private' },
    ],
    assignments: [
      { id: 'a7', studentId: 'stu-sarah', title: 'Position Awareness Video', type: 'video', status: 'completed', progress: 1, total: 1, dueDate: '2027-07-15', priority: 'low', instructions: 'Watch the position awareness video.', weekLabel: 'Last Week' },
      { id: 'a8', studentId: 'stu-sarah', title: 'Review 10 BTN hands', type: 'hand_history', status: 'in_progress', progress: 6, total: 10, dueDate: '2027-08-15', priority: 'medium', instructions: 'Review your BTN decisions. Mark any you are unsure about.', weekLabel: 'This Week' },
    ],
    sessions: [
      { id: 's6', studentId: 'stu-sarah', date: '2027-07-22', timeStart: '15:00', durationMinutes: 45, topic: 'Position + Bet Sizing', status: 'completed', notes: 'Reviewed position plays and bet sizing. Good progress.', handsReviewed: 8, assignmentsCreated: 1, summary: 'Reviewed position plays and bet sizing.', homework: 'Review 10 BTN hands' },
    ],
    hands: [
      { id: 'h7', studentId: 'stu-sarah', title: 'BTN open, BB 3-bet defense', stakes: '$25', position: 'BTN', markedAs: 'needs_review', uploadedAt: '2027-07-25' },
      { id: 'h8', studentId: 'stu-sarah', title: 'CO open, BTN call, river spot', stakes: '$25', position: 'CO', markedAs: 'saved', uploadedAt: '2027-07-20' },
    ],
  },
  {
    id: 'stu-alex',
    name: 'Alex Rivera',
    email: 'alex@spotvault.com',
    spotvaultUsername: 'AlexRivera',
    avatarInitials: 'AR',
    pokerUsernames: [
      { site: 'GG', username: 'AlexRivers' },
    ],
    primarySite: 'GG',
    gameType: 'NLHE MTT',
    stakes: '$75 ABI',
    abi: 75,
    roi: 18.1,
    spi: 78,
    bb100: 7.2,
    evBb100: 6.9,
    profit: 42500,
    bankroll: 55000,
    trend: 'improving',
    status: 'active',
    coachingSince: '2026-11-01',
    lastSession: '2027-08-11',
    lastHhUpload: '2027-08-12',
    nextSession: '2027-08-22',
    handsWaitingReview: 0,
    assignmentsOverdue: 0,
    daysSinceLastSession: 1,
    analyticsPermission: true,
    currentSnapshot: {
      date: '2027-08-12',
      abi: 75,
      roi: 18.1,
      spi: 78,
      bb100: 7.2,
      evBb100: 6.9,
      profit: 42500,
      bankroll: 55000,
      stakes: '$50-$150',
      volume: 360,
      riverAggression: 31,
      preflopAggression: 26,
      tournamentResults: 42500,
      cashResults: 0,
    },
    journey: [
      {
        id: 'ar1',
        date: '2026-11-01',
        label: 'Coaching Began',
        type: 'baseline',
        snapshot: {
          date: '2026-11-01',
          abi: 20,
          roi: 5,
          spi: 60,
          bb100: 3.0,
          evBb100: 2.7,
          profit: 2000,
          bankroll: 4000,
          stakes: '$5-$44',
          volume: 200,
          riverAggression: 20,
          preflopAggression: 16,
          tournamentResults: 2000,
          cashResults: 0,
        },
        coachNotes: 'Intermediate player. Good fundamentals but needs refinement.',
        studentNotes: 'Want to take my game to the next level.',
        strengths: ['Solid fundamentals', 'Good hand reading'],
        leaks: ['ICM pressure', 'Final table play'],
        goals: ['Reach $50 ABI', 'Improve final table play'],
        nextObjectives: ['Study ICM', 'Review final table hands'],
        attachments: [],
      },
      {
        id: 'ar2',
        date: '2027-08-12',
        label: '9 Months',
        type: 'milestone',
        snapshot: {
          date: '2027-08-12',
          abi: 75,
          roi: 18.1,
          spi: 78,
          bb100: 7.2,
          evBb100: 6.9,
          profit: 42500,
          bankroll: 55000,
          stakes: '$50-$150',
          volume: 360,
          riverAggression: 31,
          preflopAggression: 26,
          tournamentResults: 42500,
          cashResults: 0,
        },
        coachNotes: 'Excellent progress. ICM much improved. Ready for $100+ ABI.',
        studentNotes: 'Best decision I made was getting a coach.',
        strengths: ['ICM execution', 'Final table play', 'Hand reading'],
        leaks: ['Blind vs blind', 'Deep 3-bet pots'],
        goals: ['Reach $150 ABI', 'Win a major'],
        nextObjectives: ['Study blind vs blind', 'Review deep 3-bet pots'],
        attachments: [],
      },
    ],
    notes: [
      { id: 'n5', studentId: 'stu-alex', text: 'Alex is ready for higher stakes. Consider introducing advanced concepts.', createdAt: '2027-08-11', visibility: 'private' },
    ],
    assignments: [
      { id: 'a9', studentId: 'stu-alex', title: 'Blind vs Blind Range Study', type: 'analytics_review', status: 'in_progress', progress: 3, total: 5, dueDate: '2027-08-20', priority: 'medium', instructions: 'Review your blind vs blind stats. Identify patterns.', weekLabel: 'This Week' },
    ],
    sessions: [
      { id: 's7', studentId: 'stu-alex', date: '2027-08-22', timeStart: '16:00', durationMinutes: 60, topic: 'Blind vs Blind Review', status: 'upcoming', notes: '', handsReviewed: 0, assignmentsCreated: 0 },
      { id: 's8', studentId: 'stu-alex', date: '2027-08-11', timeStart: '16:00', durationMinutes: 60, topic: 'ICM + Final Table', status: 'completed', notes: 'Reviewed final table hands. ICM execution much improved.', handsReviewed: 18, assignmentsCreated: 1, summary: 'Reviewed final table hands. ICM execution much improved.', homework: 'Blind vs blind range study' },
    ],
    hands: [
      { id: 'h9', studentId: 'stu-alex', title: 'SB vs BB deep run, river decision', stakes: '$75', position: 'SB', markedAs: 'reviewed', uploadedAt: '2027-08-11', notes: 'Good river call. Well analyzed.' },
      { id: 'h10', studentId: 'stu-alex', title: 'Final table 3-bet pot', stakes: '$150', position: 'CO', markedAs: 'complete', uploadedAt: '2027-08-05', notes: 'Reviewed and complete. Good line.' },
    ],
  },
];

export function getCoachStats() {
  const activeStudents = COACH_STUDENTS.filter((s) => s.status === 'active').length;
  const upcomingSessions = COACH_STUDENTS.reduce((sum, s) => sum + s.sessions.filter((sess) => sess.status === 'upcoming').length, 0);
  const handsWaiting = COACH_STUDENTS.reduce((sum, s) => sum + s.handsWaitingReview, 0);
  const studentsImproving = COACH_STUDENTS.filter((s) => s.trend === 'improving').length;
  return { activeStudents, upcomingSessions, handsWaiting, studentsImproving };
}

export function getStudentsNeedingAttention() {
  return COACH_STUDENTS.filter((s) =>
    s.handsWaitingReview > 0 ||
    s.assignmentsOverdue > 0 ||
    s.daysSinceLastSession > 14
  );
}

export function searchStudents(query: string): CoachStudent[] {
  if (!query.trim()) return COACH_STUDENTS;
  const q = query.toLowerCase();
  return COACH_STUDENTS.filter((s) =>
    s.name.toLowerCase().includes(q) ||
    s.spotvaultUsername?.toLowerCase().includes(q) ||
    s.email.toLowerCase().includes(q) ||
    s.pokerUsernames.some((u) => u.username.toLowerCase().includes(q) || u.site.toLowerCase().includes(q))
  );
}

export const ASSIGNMENT_TYPE_LABELS: Record<StudyAssignmentType, string> = {
  spotvault_spot: 'SpotVault Spot',
  hand_history: 'Hand History',
  hh_bundle: 'HH Bundle',
  course: 'Course',
  quiz: 'Quiz',
  video: 'Video',
  custom_task: 'Custom Task',
  analytics_review: 'Analytics Review',
};
