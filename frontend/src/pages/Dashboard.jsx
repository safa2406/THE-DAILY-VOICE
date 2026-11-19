import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Headphones,
  Clock,
  CheckCircle2,
  Play,
  Pause,
  Flame,
  Volume2,
  Sparkles,
} from 'lucide-react';
import { useAudio } from '../context/AudioContext';
import { useLibrary } from '../context/LibraryContext';
import ListeningProgressCard from '../components/ListeningProgressCard';

export default function Dashboard() {
  const navigate = useNavigate();
  const {
    currentArticle,
    isPlaying,
    progressPercent,
    formattedCurrentTime,
    formattedDuration,
    togglePlayPause,
    openFullPlayer,
  } = useAudio();
  const { listeningHistory, userStats } = useLibrary();

  const inProgressList = listeningHistory.filter((item) => !item.isCompleted);
  const completedList = listeningHistory.filter((item) => item.isCompleted);
  const completedCount =
    typeof userStats?.total_completed === 'number' ? userStats.total_completed : completedList.length;
  const inProgressCount =
    typeof userStats?.total_in_progress === 'number' ? userStats.total_in_progress : inProgressList.length;

  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-300">
      {/* Editorial Dashboard Header */}
      <section className="bg-white rounded-[20px] border border-[#eae4d9] p-6 sm:p-8 shadow-[0_4px_20px_rgba(28,25,23,0.04)] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-serif font-black text-3xl sm:text-4xl text-[#1c1917] tracking-tight">
            Listening Dashboard
          </h1>
          <p className="text-xs font-mono text-[#5c534a] mt-1">
            {userStats?.time_today_display || '0m'} listened today • {completedCount} completed {completedCount === 1 ? 'story' : 'stories'}
          </p>
        </div>

        {isPlaying && currentArticle ? (
          <button
            type="button"
            onClick={openFullPlayer}
            className="self-start sm:self-auto inline-flex items-center space-x-2 px-3.5 py-2 rounded-2xl bg-[#fbeee6] hover:bg-[#f3ece2] border border-[#f0d8cc] text-[#9a3412] transition-colors cursor-pointer group"
            title="Open active story player"
          >
            <span className="w-2 h-2 rounded-full bg-[#9a3412] animate-pulse" />
            <span className="text-xs font-mono font-bold">Now Playing:</span>
            <span className="text-xs font-sans font-medium text-[#1c1917] truncate max-w-[160px] sm:max-w-[220px]">
              {currentArticle.title}
            </span>
          </button>
        ) : inProgressCount > 0 ? (
          <div className="self-start sm:self-auto inline-flex items-center space-x-2 px-3 py-1.5 rounded-full bg-[#f3ece2] text-[#5c534a] text-xs font-mono">
            <span className="w-2 h-2 rounded-full bg-[#9a3412]" />
            <span>{inProgressCount} in progress</span>
          </div>
        ) : null}
      </section>

      {/* Elevated Statistic Cards */}
      <section className="grid grid-cols-2 sm:grid-cols-3 gap-4 sm:gap-6">
        <div className="p-5 sm:p-6 bg-white rounded-[20px] border border-[#eae4d9] shadow-[0_4px_20px_rgba(28,25,23,0.04)] hover:border-[#d6cebf] transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-mono text-[#5c534a] font-semibold uppercase">Time Today</span>
            <div className="w-9 h-9 rounded-xl bg-[#fbeee6] text-[#9a3412] flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <p className="text-3xl sm:text-4xl font-serif font-black text-[#1c1917]">
            {userStats?.time_today_display || '0m'}
          </p>
          <span className="text-xs font-mono text-[#5c534a] mt-1 block">
            {userStats?.editions_display || 'Today'}
          </span>
        </div>

        <div className="p-5 sm:p-6 bg-white rounded-[20px] border border-[#eae4d9] shadow-[0_4px_20px_rgba(28,25,23,0.04)] hover:border-[#d6cebf] transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-mono text-[#5c534a] font-semibold uppercase">Completed</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <p className="text-3xl sm:text-4xl font-serif font-black text-[#1c1917]">
            {completedCount}
          </p>
          <span className="text-xs font-mono text-[#5c534a] mt-1 block">Stories</span>
        </div>

        <div className="p-5 sm:p-6 bg-white rounded-[20px] border border-[#eae4d9] shadow-[0_4px_20px_rgba(28,25,23,0.04)] hover:border-[#d6cebf] transition-all col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-mono text-[#5c534a] font-semibold uppercase">In Progress</span>
            <div className="w-9 h-9 rounded-xl bg-[#fbeee6] text-[#9a3412] flex items-center justify-center">
              <Flame className="w-4 h-4" />
            </div>
          </div>
          <p className="text-3xl sm:text-4xl font-serif font-black text-[#1c1917]">
            {inProgressCount}
          </p>
          <span className="text-xs font-mono text-[#5c534a] mt-1 block">In progress</span>
        </div>
      </section>

      {/* SECTION: CURRENTLY LISTENING HERO */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-serif font-black text-2xl text-[#1c1917] flex items-center space-x-2">
            <Headphones className="w-6 h-6 text-[#9a3412]" />
            <span>Currently Listening</span>
          </h2>
          {currentArticle && (
            <span className="text-xs font-mono font-semibold text-[#9a3412] bg-[#fbeee6] px-3 py-1 rounded-full border border-[#f0d8cc]">
              {isPlaying ? 'Active Session' : 'Paused Session'}
            </span>
          )}
        </div>

        {currentArticle ? (
          <div
            onClick={openFullPlayer}
            className="p-6 sm:p-8 bg-gradient-to-br from-white via-white to-[#fffaf5] rounded-[20px] border border-[#9a3412]/30 shadow-[0_4px_20px_rgba(28,25,23,0.04)] transition-all duration-200 cursor-pointer group hover:shadow-lg"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
              <div>
                <span className="text-xs font-mono tracking-widest uppercase px-3 py-1 rounded-full bg-[#fbeee6] text-[#9a3412] font-bold">
                  {currentArticle.category} • {currentArticle.newspaperName}
                </span>
                <h3 className="font-serif font-black text-2xl sm:text-3xl text-[#1c1917] group-hover:text-[#9a3412] transition-colors mt-2 leading-tight line-clamp-2">
                  {currentArticle.title}
                </h3>
                <p className="text-xs text-[#5c534a] font-mono mt-1">
                  Reported by {currentArticle.publisher}
                </p>
              </div>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  togglePlayPause();
                }}
                className="w-14 h-14 rounded-2xl bg-[#9a3412] hover:bg-[#7c2d12] text-white flex items-center justify-center shrink-0 shadow-md transition-transform active:scale-95 cursor-pointer"
              >
                {isPlaying ? (
                  <Pause className="w-6 h-6 fill-current" />
                ) : (
                  <Play className="w-6 h-6 fill-current ml-0.5" />
                )}
              </button>
            </div>

            {/* Live Progress Bar */}
            <div className="space-y-2">
              <div className="w-full bg-[#eae4d9] h-2.5 rounded-full overflow-hidden">
                <div
                  className="bg-[#9a3412] h-full transition-all duration-300 rounded-full"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <div className="flex justify-between text-xs font-mono text-[#5c534a] font-medium">
                <span>{formattedCurrentTime} elapsed</span>
                <span>{Math.round(progressPercent)}% • {formattedDuration} total</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-10 bg-white rounded-[20px] border border-[#eae4d9] text-center space-y-3 shadow-[0_4px_20px_rgba(28,25,23,0.04)]">
            <Headphones className="w-10 h-10 text-[#5c534a] mx-auto opacity-40" />
            <p className="font-serif font-bold text-lg text-[#1c1917]">No story playing.</p>
            <p className="text-xs text-[#5c534a] font-serif">
              Select an article from today's edition to begin listening.
            </p>
            <button
              type="button"
              onClick={() => navigate('/browse')}
              className="mt-2 px-5 py-2.5 bg-[#9a3412] hover:bg-[#7c2d12] text-white text-xs font-semibold rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              Browse Stories
            </button>
          </div>
        )}
      </section>

      {/* SECTION: RECENT LISTENING TIMELINE */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-serif font-black text-2xl text-[#1c1917]">
            Recent Listening
          </h2>
          <span className="text-xs font-mono text-[#5c534a]">
            {listeningHistory.length} {listeningHistory.length === 1 ? 'Story' : 'Stories'}
          </span>
        </div>

        {listeningHistory.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            {listeningHistory.map((item) => (
              <ListeningProgressCard key={item.id || item.articleId || `digest-${item.editionId}`} item={item} />
            ))}
          </div>
        ) : (
          <div className="p-10 bg-white rounded-[20px] border border-[#eae4d9] text-center text-xs text-[#5c534a] font-serif shadow-[0_4px_20px_rgba(28,25,23,0.04)]">
            No past listening sessions recorded yet.
          </div>
        )}
      </section>
    </div>
  );
}
