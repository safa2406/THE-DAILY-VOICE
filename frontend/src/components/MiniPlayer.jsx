import React from 'react';
import { Play, Pause, FastForward, Maximize2, Volume2, X, Loader2, AlertCircle } from 'lucide-react';
import { useAudio } from '../context/AudioContext';

export default function MiniPlayer() {
  const {
    currentArticle,
    listeningMode,
    language,
    isPlaying,
    isLoading,
    audioError,
    isMiniPlayerDismissed,
    progressPercent,
    formattedCurrentTime,
    formattedDuration,
    togglePlayPause,
    forward,
    openFullPlayer,
    dismissMiniPlayer,
  } = useAudio();

  if (!currentArticle || isMiniPlayerDismissed) return null;

  const modeBadge =
    listeningMode === 'headlines'
      ? 'HEADLINES'
      : listeningMode === 'summary'
      ? 'SUMMARY'
      : 'FULL STORY';

  return (
    <aside
      aria-label="Persistent Audio Mini Player"
      className="fixed z-40 left-0 right-0 px-3 sm:px-4 pointer-events-none transition-all duration-300 bottom-[calc(4rem+env(safe-area-inset-bottom,0px)+0.5rem)] md:bottom-20 md:left-auto md:right-8 md:w-[440px] md:px-0"
    >
      <div className="relative pointer-events-auto bg-[#1c1917] text-[#faf7f2] rounded-[20px] shadow-[0_12px_36px_rgba(0,0,0,0.28)] border border-[#2e2a27] overflow-hidden transition-all duration-200 hover:border-[#9a3412]/50">
        {/* Continuous Scrubber Progress Line at Top Edge */}
        <div className="w-full bg-[#292524] h-1 relative overflow-hidden">
          <div
            className={`h-full transition-all duration-300 relative ${
              audioError
                ? 'bg-red-500'
                : 'bg-gradient-to-r from-[#9a3412] to-[#b43a14]'
            }`}
            style={{ width: `${Math.min(100, Math.max(0, progressPercent))}%` }}
          >
            <span className="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-white shadow-xs" />
          </div>
        </div>

        <div className="p-3 sm:p-3.5 flex items-center justify-between gap-2.5 sm:gap-3">
          {/* Article Info & Click to Maximize */}
          <button
            type="button"
            onClick={openFullPlayer}
            className="flex items-center space-x-3 flex-1 min-w-0 text-left cursor-pointer group focus:outline-none"
          >
            {/* Animated Sound Wave / Album Thumbnail */}
            <div className="w-11 h-11 rounded-xl bg-[#292524] border border-[#383330] flex items-center justify-center shrink-0 group-hover:bg-[#342f2b] transition-colors relative overflow-hidden">
              {isLoading ? (
                <Loader2 className="w-5 h-5 text-[#9a3412] animate-spin" />
              ) : isPlaying ? (
                <div className="flex items-end justify-center space-x-1 h-5 w-5">
                  <span className="w-1 bg-[#9a3412] rounded-full animate-soundwave-1" />
                  <span className="w-1 bg-[#9a3412] rounded-full animate-soundwave-2" />
                  <span className="w-1 bg-[#9a3412] rounded-full animate-soundwave-3" />
                </div>
              ) : audioError ? (
                <AlertCircle className="w-5 h-5 text-red-400" />
              ) : (
                <Volume2 className="w-5 h-5 text-[#a8a29e] group-hover:text-[#9a3412] transition-colors" />
              )}
            </div>

            {/* Title, Mode Badge & Timing */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center space-x-1.5 mb-0.5">
                <span className="text-[9px] uppercase font-mono tracking-wider font-bold px-1.5 py-0.2 rounded bg-[#9a3412]/30 text-white border border-[#9a3412]/50">
                  {modeBadge}
                </span>
                {language && language !== 'English' && (
                  <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-[#383330] text-[#fed7aa] uppercase">
                    {language.slice(0, 2)}
                  </span>
                )}
                <span className="text-xs text-[#78716c]">•</span>
                <span className="text-xs font-mono text-[#d6cebf]">
                  {isLoading ? 'Generating...' : `${formattedCurrentTime} / ${formattedDuration}`}
                </span>
              </div>
              <h4 className="text-sm font-serif font-bold text-white line-clamp-2 leading-snug group-hover:text-[#fed7aa] transition-colors">
                {currentArticle.title || currentArticle.headline || currentArticle.name || 'Now Playing'}
              </h4>
            </div>
          </button>

          {/* Quick Playback Controls + Close Action */}
          <div className="flex items-center space-x-1 sm:space-x-1.5 shrink-0">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                forward(15);
              }}
              title="Forward 15 seconds"
              className="p-1.5 sm:p-2 text-[#a8a29e] hover:text-white rounded-xl hover:bg-[#292524] transition-colors cursor-pointer"
            >
              <FastForward className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                togglePlayPause();
              }}
              disabled={isLoading}
              title={isPlaying ? 'Pause' : 'Play'}
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#9a3412] hover:bg-[#7c2d12] text-white flex items-center justify-center transition-all shadow-md active:scale-95 cursor-pointer disabled:opacity-75"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin text-white" />
              ) : isPlaying ? (
                <Pause className="w-4 h-4 fill-current" />
              ) : (
                <Play className="w-4 h-4 fill-current ml-0.5" />
              )}
            </button>

            <button
              type="button"
              onClick={openFullPlayer}
              title="Expand to Full Player"
              className="p-1.5 sm:p-2 text-[#a8a29e] hover:text-white rounded-xl hover:bg-[#292524] transition-colors cursor-pointer hidden sm:block"
            >
              <Maximize2 className="w-4 h-4" />
            </button>

            {/* Dismiss Player Button */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                dismissMiniPlayer();
              }}
              title="Dismiss Player (Stops Audio)"
              aria-label="Dismiss Player and Pause Audio"
              className="p-1.5 sm:p-2 text-[#78716c] hover:text-white hover:bg-[#292524] active:bg-[#342f2b] rounded-xl transition-colors cursor-pointer ml-0.5"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
