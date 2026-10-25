import { useState, useEffect } from 'react';
import {
  LayoutDashboard, Users, Calendar, DollarSign, Star, Eye, MessageSquare,
  TrendingUp, GraduationCap, BookOpen, BarChart3, Zap,
} from 'lucide-react';
import { COACH_STUDENTS, getCoachStats } from '@/data/coach';

interface Props {
  account: { id: string; name: string };
  onNavigate: (view: string) => void;
}

export function CoachDashboardView({ account, onNavigate }: Props) {
  const stats = getCoachStats();
  const allSessions = COACH_STUDENTS.flatMap((s) => s.sessions);
  const upcomingSessions = allSessions.filter((s) => s.status === 'upcoming');
  const completedSessions = allSessions.filter((s) => s.status === 'completed');
  const hoursCoached = completedSessions.reduce((sum, s) => sum + s.durationMinutes, 0) / 60;
  const monthlyRevenue = completedSessions.length * 150;
  const profileViews = 1284;
  const bookingRequests = 17;
  const avgRating = 4.9;

  const quickActions = [
    { label: 'Edit Coaching Profile', icon: GraduationCap, view: 'coach-profile' },
    { label: 'View Students', icon: Users, view: 'coach-center' },
    { label: 'View Bookings', icon: Calendar, view: 'bookings' },
    { label: 'View Performance', icon: BarChart3, view: 'coach-impact' },
    { label: 'View Reviews', icon: Star, view: 'coach-reviews' },
  ];

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <LayoutDashboard className="h-5 w-5 text-[#d4a52c]" strokeWidth={1.5} />
          <div>
            <h2 className="text-sm font-bold tracking-wide text-white uppercase">Coaching Business</h2>
            <p className="text-[10px] text-[#5f6e7c]">Your coaching business at a glance</p>
          </div>
        </div>

        {/* Business Stats */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          <BusinessStatCard label="Active Students" value={`${stats.activeStudents}`} icon={Users} />
          <BusinessStatCard label="Upcoming Sessions" value={`${upcomingSessions.length}`} icon={Calendar} />
          <BusinessStatCard label="Hours Coached" value={hoursCoached.toFixed(1)} icon={Zap} />
          <BusinessStatCard label="Monthly Revenue" value={`$${monthlyRevenue.toLocaleString()}`} icon={DollarSign} gold />
          <BusinessStatCard label="Avg Rating" value={`${avgRating}★`} icon={Star} />
          <BusinessStatCard label="Profile Views" value={profileViews.toLocaleString()} icon={Eye} />
        </div>

        {/* Booking Requests Banner */}
        {bookingRequests > 0 && (
          <div className="flex items-center justify-between rounded-xl border border-[#c0911e]/30 bg-gradient-to-r from-[#c0911e]/10 to-transparent p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#c0911e]/40 bg-[#c0911e]/15">
                <MessageSquare className="h-5 w-5 text-[#d4a52c]" strokeWidth={1.5} />
              </div>
              <div>
                <div className="text-sm font-semibold text-white">{bookingRequests} New Booking Requests</div>
                <div className="text-[10px] text-[#5f6e7c]">Review and respond to pending requests from players</div>
              </div>
            </div>
            <button
              onClick={() => onNavigate('bookings')}
              className="rounded-lg border border-[#c0911e]/40 bg-gradient-to-b from-[#c0911e]/15 to-[#835e17]/15 px-4 py-2 text-[10px] font-semibold tracking-widest text-[#f5e6b0] uppercase transition-all hover:gold-glow"
            >
              View Requests
            </button>
          </div>
        )}

        {/* Quick Actions */}
        <div>
          <h3 className="mb-3 text-[11px] font-semibold tracking-[0.25em] text-[#aab6c2] uppercase">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
            {quickActions.map((action) => (
              <button
                key={action.view}
                onClick={() => onNavigate(action.view)}
                className="metal-panel group flex flex-col items-center gap-2 rounded-xl p-4 transition-all hover:border-[#c0911e]/30"
              >
                <action.icon className="h-6 w-6 text-[#5f6e7c] transition-colors group-hover:text-[#d4a52c]" strokeWidth={1.5} />
                <span className="text-[10px] font-semibold tracking-widest text-[#84929f] uppercase transition-colors group-hover:text-[#d4a52c]">{action.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Upcoming Sessions */}
        <div className="metal-panel rounded-xl p-5">
          <h3 className="mb-3 text-[11px] font-semibold tracking-[0.25em] text-[#aab6c2] uppercase">Upcoming Sessions</h3>
          <div className="space-y-2">
            {upcomingSessions.length === 0 ? (
              <p className="text-sm text-[#5f6e7c]">No upcoming sessions scheduled.</p>
            ) : (
              upcomingSessions.slice(0, 5).map((sess) => {
                const student = COACH_STUDENTS.find((s) => s.id === sess.studentId);
                return (
                  <div key={sess.id} className="flex items-center justify-between rounded-lg border border-[#1a1f25] bg-[#11151a]/40 p-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#c0911e]/30 bg-gradient-to-b from-[#2a2010] to-[#1a1408] text-xs font-bold text-[#d4a52c]">
                        {student?.avatarInitials ?? '?'}
                      </div>
                      <div>
                        <div className="text-sm text-white">{sess.topic}</div>
                        <div className="text-xs text-[#5f6e7c]">{student?.name} · {sess.date} · {sess.timeStart} · {sess.durationMinutes}min</div>
                      </div>
                    </div>
                    <span className="rounded-full bg-[#d4a52c]/15 px-2.5 py-1 text-[9px] font-bold tracking-widest text-[#d4a52c] uppercase">{sess.durationMinutes} min</span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Students Needing Attention */}
        <div className="metal-panel rounded-xl p-5">
          <h3 className="mb-3 text-[11px] font-semibold tracking-[0.25em] text-[#aab6c2] uppercase">Students Needing Attention</h3>
          <div className="space-y-2">
            {stats.studentsImproving > 0 ? (
              <div className="flex items-center gap-2 text-sm text-emerald-400">
                <TrendingUp className="h-4 w-4" strokeWidth={1.5} />
                {stats.studentsImproving} students showing improvement
              </div>
            ) : null}
            {COACH_STUDENTS.filter((s) => s.handsWaitingReview > 0).map((s) => (
              <div key={s.id} className="flex items-center justify-between rounded-lg border border-[#1a1f25] bg-[#11151a]/40 p-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#c0911e]/30 bg-gradient-to-b from-[#2a2010] to-[#1a1408] text-xs font-bold text-[#d4a52c]">
                    {s.avatarInitials}
                  </div>
                  <div>
                    <div className="text-sm text-white">{s.name}</div>
                    <div className="text-xs text-[#5f6e7c]">{s.handsWaitingReview} hands waiting review</div>
                  </div>
                </div>
                <button
                  onClick={() => onNavigate('coach-center')}
                  className="rounded-lg border border-[#232a32] bg-[#161b21] px-3 py-1.5 text-[10px] font-semibold tracking-widest text-[#84929f] uppercase transition-all hover:border-[#c0911e]/40 hover:text-[#d4a52c]"
                >
                  Review
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function BusinessStatCard({ label, value, icon: Icon, gold }: { label: string; value: string; icon: typeof Users; gold?: boolean }) {
  return (
    <div className="rounded-xl border border-[#1a1f25] bg-[#11151a]/50 p-4">
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-mono tracking-widest text-[#5f6e7c] uppercase">{label}</div>
        <Icon className="h-4 w-4 text-[#38424e]" strokeWidth={1.5} />
      </div>
      <div className={`mt-2 text-2xl font-bold ${gold ? 'text-[#d4a52c]' : 'text-white'}`}>{value}</div>
    </div>
  );
}
