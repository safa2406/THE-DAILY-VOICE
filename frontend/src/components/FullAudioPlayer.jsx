import React, { useState } from 'react';
import {
  ChevronDown,
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Bookmark,
  Sparkles,
  Languages,
  Gauge,
  BookOpen,
  Volume2,
  Check,
  Headphones,
  Loader2,
  AlertCircle,
  RefreshCw,
  FileText,
} from 'lucide-react';
import { useAudio, SUPPORTED_LANGUAGES } from '../context/AudioContext';
import { useLibrary } from '../context/LibraryContext';
import AskAiModal from './AskAiModal';
import AudioProgressBar from './AudioProgressBar';

export default function FullAudioPlayer() {
  const {
    currentArticle,
    listeningMode,
    language,
    isPlaying,
    isLoading,
    audioError,
    currentTime,
    duration,
    playbackSpeed,
    narratedText,
    isFullPlayerOpen,
    progressPercent,
    formattedCurrentTime,
    formattedDuration,
    togglePlayPause,
    seek,
    rewind,
    forward,
    setPlaybackSpeed,
    setLanguage,
    setListeningMode,
    retryAudioGeneration,
    closeFullPlayer,
  } = useAudio();

  const { isBookmarked, toggleBookmark } = useLibrary();

  const [activeTab, setActiveTab] = useState('player'); // 'player' or 'read'
  const [showAiModal, setShowAiModal] = useState(false);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [showLangMenu, setShowLangMenu] = useState(false);

  if (!isFullPlayerOpen || !currentArticle) return null;

  const bookmarked = isBookmarked(currentArticle.id);
  const speedOptions = [0.75, 1.0, 1.25, 1.5, 2.0];

  const remainingSeconds = Math.max(0, duration - currentTime);
  const formatRemaining = (secs) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `-${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleSliderChange = (e) => {
    const newPercent = parseFloat(e.target.value);
    const newSeconds = (newPercent / 100) * duration;
    seek(newSeconds);
  };

  const isHeadlines = listeningMode === 'headlines' || Boolean(currentArticle.isEdition);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Full Article Listening Interface"
      className="fixed inset-0 z-50 bg-[#1c1917]/75 backdrop-blur-md flex flex-col justify-end sm:justify-center items-center p-0 sm:p-4 transition-all duration-300"
    >
      <div className="bg-[#faf7f2] w-full max-w-xl max-h-[94vh] sm:rounded-3xl shadow-[0_24px_60px_rgba(0,0,0,0.35)] border border-[#eae4d9] flex flex-col overflow-hidden animate-in slide-in-from-bottom-8 duration-300">
        {/* Top Masthead Bar */}
        <div className="px-5 py-4 border-b border-[#eae4d9] flex items-center justify-between bg-white/60">
          <button
            type="button"
            onClick={closeFullPlayer}
            className="p-2 -ml-2 text-[#5c534a] hover:text-[#1c1917] rounded-full hover:bg-[#f3ece2] transition-colors cursor-pointer"
            title="Minimize Player"
          >
            <ChevronDown className="w-5 h-5" />
          </button>

          <div className="text-center px-2">
            <span className="text-xs uppercase font-mono tracking-widest text-[#9a3412] font-semibold block">
              Now Playing
            </span>
            <span className="text-xs font-serif font-bold text-[#1c1917] truncate max-w-[240px] inline-block">
              {currentArticle.newspaperName || currentArticle.publisher || 'The Daily Voice'}
            </span>
          </div>

          <button
            type="button"
            onClick={() => toggleBookmark(currentArticle)}
            className={`p-2 rounded-xl transition-all cursor-pointer ${
              bookmarked
                ? 'text-[#9a3412] bg-[#fbeee6]'
                : 'text-[#5c534a] hover:text-[#1c1917] hover:bg-[#f3ece2]'
            }`}
            title={bookmarked ? 'Saved in Library' : 'Save to Library'}
          >
            <Bookmark className={`w-5 h-5 ${bookmarked ? 'fill-current' : ''}`} />
          </button>
        </div>

        {/* Tab Toggle: Audio Player vs Read Article */}
        <div className="flex border-b border-[#eae4d9] text-xs font-medium bg-[#f3ece2]/40">
          <button
            type="button"
            onClick={() => setActiveTab('player')}
            className={`flex-1 py-3 flex items-center justify-center space-x-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'player'
                ? 'border-[#9a3412] text-[#9a3412] font-semibold bg-white'
                : 'border-transparent text-[#5c534a] hover:text-[#1c1917]'
            }`}
          >
            <Volume2 className="w-4 h-4" />
            <span>Audio</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('read')}
            className={`flex-1 py-3 flex items-center justify-center space-x-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'read'
                ? 'border-[#9a3412] text-[#9a3412] font-semibold bg-white'
                : 'border-transparent text-[#5c534a] hover:text-[#1c1917]'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>Text</span>
          </button>
        </div>

        {/* Listening Mode Segmented Controls (Only for articles) */}
        {!isHeadlines && (
          <div className="px-6 pt-4 pb-2 bg-white/40 border-b border-[#eae4d9]">
            <div className="flex items-center justify-center p-1 bg-[#f3ece2] rounded-xl max-w-sm mx-auto">
              <button
                type="button"
                onClick={() => setListeningMode('summary')}
                disabled={isLoading}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center justify-center space-x-1.5 ${
                  listeningMode === 'summary'
                    ? 'bg-white text-[#9a3412] shadow-xs font-bold'
                    : 'text-[#5c534a] hover:text-[#1c1917]'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>AI Summary (30–45s)</span>
              </button>
              <button
                type="button"
                onClick={() => setListeningMode('full')}
                disabled={isLoading}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center justify-center space-x-1.5 ${
                  listeningMode === 'full'
                    ? 'bg-white text-[#9a3412] shadow-xs font-bold'
                    : 'text-[#5c534a] hover:text-[#1c1917]'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Full Article</span>
              </button>
            </div>
          </div>
        )}

        {/* Error Banner with Retry */}
        {audioError && (
          <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-center justify-between text-xs text-red-700 animate-in fade-in">
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{audioError}</span>
            </div>
            <button
              type="button"
              onClick={retryAudioGeneration}
              className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg font-mono font-medium flex items-center space-x-1 cursor-pointer ml-2"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Retry</span>
            </button>
          </div>
        )}

        {/* Content Body */}
        <div className="p-6 sm:p-8 overflow-y-auto flex-1">
          {activeTab === 'player' ? (
            <div className="flex flex-col items-center text-center max-w-md mx-auto">
              {/* Category Pill */}
              <div className="flex items-center space-x-2 mb-3">
                <span className="text-[11px] font-mono tracking-wider uppercase px-3 py-1 rounded-full bg-[#fbeee6] text-[#9a3412] font-semibold">
                  {currentArticle.category || 'Broadsheet'}
                </span>
                {isHeadlines && (
                  <span className="text-[10px] font-mono tracking-wider uppercase px-2.5 py-0.5 rounded-full bg-[#9a3412] text-white font-bold">
                    Headlines Digest
                  </span>
                )}
              </div>

              {/* Title & Author */}
              <h2 className="text-2xl sm:text-3xl font-serif font-black text-[#1c1917] leading-tight mb-2">
                {currentArticle.title || currentArticle.headline || currentArticle.name}
              </h2>
              <p className="text-xs text-[#5c534a] mb-5 font-mono">
                {currentArticle.publisher || currentArticle.newspaperName} {currentArticle.publishDate ? `• ${currentArticle.publishDate}` : ''}
              </p>

              {/* Narrated Summary / Text Snippet */}
              <div className="w-full p-4 sm:p-5 bg-white rounded-2xl border border-[#eae4d9] text-left text-xs sm:text-sm text-[#44403c] font-serif leading-relaxed mb-6 italic shadow-xs">
                {narratedText ? (
                  <div>
                    <span className="block text-[10px] uppercase font-mono not-italic font-bold text-[#9a3412] mb-1.5">
                      {listeningMode === 'summary' ? 'AI Summary' : listeningMode === 'headlines' ? 'Headlines Digest' : 'Narrated Article'} ({language})
                    </span>
                    <p className="line-clamp-4">"{narratedText}"</p>
                  </div>
                ) : currentArticle.summary ? (
                  <p>"{currentArticle.summary}"</p>
                ) : (
                  <p>Listening to {currentArticle.title} in {language}...</p>
                )}
              </div>

              {/* Spotify-inspired Audio Progress Bar */}
              <div className="w-full mb-6">
                <AudioProgressBar
                  currentTime={currentTime}
                  duration={duration}
                  onSeek={seek}
                  disabled={isLoading}
                />
              </div>

              {/* Tactile Audio Transport Controls */}
              <div className="flex items-center justify-center space-x-6 sm:space-x-8 mb-6">
                {/* -15s Skip */}
                <button
                  type="button"
                  onClick={() => rewind(15)}
                  className="w-12 h-12 rounded-2xl bg-white border border-[#eae4d9] hover:bg-[#f3ece2] hover:border-[#d6cebf] text-[#44403c] hover:text-[#1c1917] flex flex-col items-center justify-center transition-all shadow-xs active:scale-95 cursor-pointer"
                  title="Rewind 15 seconds"
                >
                  <RotateCcw className="w-5 h-5 text-[#9a3412]" />
                  <span className="text-[9px] font-mono font-semibold mt-0.5">-15s</span>
                </button>

                {/* Primary Large Play/Pause */}
                <button
                  type="button"
                  onClick={togglePlayPause}
                  disabled={isLoading}
                  className="w-20 h-20 rounded-full bg-[#9a3412] hover:bg-[#7c2d12] text-white flex items-center justify-center shadow-[0_8px_25px_rgba(154,52,18,0.35)] transition-all active:scale-95 cursor-pointer disabled:opacity-75"
                  title={isPlaying ? 'Pause' : 'Play'}
                >
                  {isLoading ? (
                    <Loader2 className="w-8 h-8 animate-spin" />
                  ) : isPlaying ? (
                    <Pause className="w-8 h-8 fill-current" />
                  ) : (
                    <Play className="w-8 h-8 fill-current ml-1" />
                  )}
                </button>

                {/* +15s Skip */}
                <button
                  type="button"
                  onClick={() => forward(15)}
                  className="w-12 h-12 rounded-2xl bg-white border border-[#eae4d9] hover:bg-[#f3ece2] hover:border-[#d6cebf] text-[#44403c] hover:text-[#1c1917] flex flex-col items-center justify-center transition-all shadow-xs active:scale-95 cursor-pointer"
                  title="Forward 15 seconds"
                >
                  <RotateCw className="w-5 h-5 text-[#9a3412]" />
                  <span className="text-[9px] font-mono font-semibold mt-0.5">+15s</span>
                </button>
              </div>

              {/* Loading Status Indicator */}
              {isLoading && (
                <div className="flex items-center space-x-2 text-xs font-mono text-[#9a3412] mb-4 animate-pulse">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>
                    {language !== 'English'
                      ? `Translating to ${language} & generating speech...`
                      : 'Generating audio narration...'}
                  </span>
                </div>
              )}

              {/* Speed & 5-Language Controls */}
              <div className="grid grid-cols-2 gap-3 w-full mb-5">
                {/* Speed Dropdown */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowSpeedMenu(!showSpeedMenu)}
                    className="w-full py-2.5 px-3 bg-white hover:bg-[#fbf9f5] border border-[#eae4d9] rounded-xl text-xs font-mono flex items-center justify-between text-[#1c1917] shadow-xs transition-colors cursor-pointer"
                  >
                    <span className="flex items-center space-x-2">
                      <Gauge className="w-3.5 h-3.5 text-[#9a3412]" />
                      <span>{playbackSpeed}x Speed</span>
                    </span>
                    <ChevronDown className="w-3.5 h-3.5 text-[#5c534a]" />
                  </button>

                  {showSpeedMenu && (
                    <div className="absolute bottom-full mb-2 left-0 right-0 bg-white border border-[#eae4d9] rounded-xl shadow-xl z-20 py-1">
                      {speedOptions.map((spd) => (
                        <button
                          key={spd}
                          type="button"
                          onClick={() => {
                            setPlaybackSpeed(spd);
                            setShowSpeedMenu(false);
                          }}
                          className={`w-full text-left px-3 py-2 text-xs font-mono hover:bg-[#f3ece2] flex items-center justify-between cursor-pointer ${
                            playbackSpeed === spd ? 'font-bold text-[#9a3412] bg-[#fbeee6]' : 'text-[#1c1917]'
                          }`}
                        >
                          <span>{spd}x Speed</span>
                          {playbackSpeed === spd && <Check className="w-3.5 h-3.5 text-[#9a3412]" />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* 5 Supported Languages Dropdown */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowLangMenu(!showLangMenu)}
                    className="w-full py-2.5 px-3 bg-white hover:bg-[#fbf9f5] border border-[#eae4d9] rounded-xl text-xs font-mono flex items-center justify-between text-[#1c1917] shadow-xs transition-colors cursor-pointer"
                  >
                    <span className="flex items-center space-x-2">
                      <Languages className="w-3.5 h-3.5 text-[#9a3412]" />
                      <span className="truncate">{language}</span>
                    </span>
                    <ChevronDown className="w-3.5 h-3.5 text-[#5c534a]" />
                  </button>

                  {showLangMenu && (
                    <div className="absolute bottom-full mb-2 left-0 right-0 bg-white border border-[#eae4d9] rounded-xl shadow-xl z-20 py-1">
                      {SUPPORTED_LANGUAGES.map((lang) => (
                        <button
                          key={lang.id}
                          type="button"
                          onClick={() => {
                            setLanguage(lang.id, currentArticle);
                            setShowLangMenu(false);
                          }}
                          className={`w-full text-left px-3 py-2 text-xs font-mono hover:bg-[#f3ece2] flex items-center justify-between cursor-pointer ${
                            language === lang.id ? 'font-bold text-[#9a3412] bg-[#fbeee6]' : 'text-[#1c1917]'
                          }`}
                        >
                          <div>
                            <span className="font-semibold">{lang.name}</span>
                            <span className="text-xs text-[#5c534a] ml-1.5 font-sans">({lang.label})</span>
                          </div>
                          {language === lang.id && <Check className="w-3.5 h-3.5 text-[#9a3412]" />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Redesigned Ask AI Button */}
              <button
                type="button"
                onClick={() => setShowAiModal(true)}
                className="w-full py-2.5 px-4 rounded-xl border border-[#e7dfd1] bg-[#fbf8f3] hover:bg-[#f3ece0] hover:border-[#d6cebf] text-[#1c1917] hover:text-[#9a3412] text-xs font-medium flex items-center justify-center space-x-2 transition-all cursor-pointer shadow-xs active:scale-[0.99] group"
              >
                <Sparkles className="w-4 h-4 text-[#9a3412] transition-transform group-hover:scale-110" />
                <span className="font-serif font-semibold tracking-wide">Ask AI</span>
              </button>
            </div>
          ) : (
            /* Full Article Text Read-Along */
            <div className="space-y-6 text-left max-w-prose mx-auto">
              <div className="border-b border-[#eae4d9] pb-4">
                <span className="text-xs font-mono tracking-wider uppercase text-[#9a3412] font-semibold">
                  {currentArticle.category || 'Broadsheet'}
                </span>
                <h3 className="text-2xl sm:text-3xl font-serif font-black text-[#1c1917] mt-1 leading-tight">
                  {currentArticle.title || currentArticle.headline}
                </h3>
                <p className="text-xs text-[#5c534a] font-mono mt-1">
                  Reported by {currentArticle.publisher || currentArticle.newspaperName} {currentArticle.publishDate ? `• ${currentArticle.publishDate}` : ''}
                </p>
              </div>

              {/* If translated audio is active, show translated text preview */}
              {narratedText && language !== 'English' && (
                <div className="p-4 bg-[#fbeee6] border border-[#fed7aa] rounded-2xl">
                  <span className="text-[10px] uppercase font-mono font-bold text-[#9a3412] block mb-1">
                    Translated {language} Narration Text:
                  </span>
                  <p className="text-sm font-serif text-[#1c1917] leading-relaxed">
                    {narratedText}
                  </p>
                </div>
              )}

              <div className="font-serif text-[#292524] text-base sm:text-lg leading-relaxed space-y-5">
                {(currentArticle.content || narratedText || 'Article text unavailable.')
                  .split('\n\n')
                  .map((para, i) => (
                    <p key={i} className="first-of-type:first-letter:text-4xl first-of-type:first-letter:font-bold first-of-type:first-letter:mr-1 first-of-type:first-letter:float-left first-of-type:first-letter:text-[#9a3412]">
                      {para}
                    </p>
                  ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Ask AI Chat Interface Dialog */}
      <AskAiModal
        isOpen={showAiModal}
        onClose={() => setShowAiModal(false)}
        article={currentArticle}
        currentLanguage={language}
      />
    </div>
  );
}
