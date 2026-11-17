import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Bookmark,
  Gauge,
  ChevronDown,
  Languages,
  BookOpen,
  Volume2,
  Check,
  Headphones,
  Sparkles,
  Loader2,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { useAudio, SUPPORTED_LANGUAGES } from '../context/AudioContext';
import { useLibrary } from '../context/LibraryContext';
import { useEdition } from '../context/EditionContext';
import { SAMPLE_ARTICLES } from '../utils/sampleData';

export default function ArticleListen() {
  const { articleId } = useParams();
  const navigate = useNavigate();
  const { currentEditionArticles, selectedEdition } = useEdition();
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
    progressPercent,
    formattedCurrentTime,
    formattedDuration,
    playArticle,
    playHeadlines,
    setListeningMode,
    setLanguage,
    changeLanguageOnly,
    setPlaybackSpeed,
    togglePlayPause,
    seek,
    rewind,
    forward,
    retryAudioGeneration,
  } = useAudio();

  const { isBookmarked, toggleBookmark } = useLibrary();

  const [activeTab, setActiveTab] = useState('player');
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [showLangMenu, setShowLangMenu] = useState(false);

  // Find target article from edition or sample dataset without autoplaying
  const targetArticle =
    (currentEditionArticles && currentEditionArticles.find((a) => a.id === articleId)) ||
    SAMPLE_ARTICLES.find((a) => a.id === articleId) ||
    currentArticle;

  const isCurrentActive = Boolean(currentArticle && targetArticle && currentArticle.id === targetArticle.id);
  const article = isCurrentActive ? currentArticle : targetArticle;

  if (!article) {
    return (
      <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in duration-300">
        <div className="p-8 sm:p-12 text-center bg-white rounded-3xl border border-[#eae4d9] shadow-xs">
          <div className="w-12 h-12 rounded-2xl bg-[#fbeee6] text-[#9a3412] flex items-center justify-center mx-auto mb-3">
            <Volume2 className="w-6 h-6" />
          </div>
          <h2 className="font-serif font-bold text-xl text-[#1c1917] mb-1">
            No Article Selected
          </h2>
          <p className="text-xs sm:text-sm text-[#78716c] font-serif max-w-md mx-auto mb-5 leading-relaxed">
            Select an article from today's newspaper or browse front-page headlines to start listening.
          </p>
          <button
            type="button"
            onClick={() => navigate('/edition')}
            className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-[#1c1917] hover:bg-[#9a3412] text-white text-xs font-mono font-medium transition-colors cursor-pointer"
          >
            <span>Browse Today's Articles</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  }

  const bookmarked = isBookmarked(article.id);
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

  const handleStartListening = (mode) => {
    playArticle(article, mode, language);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in duration-300">
      {/* Editorial Navigation Top Bar */}
      <div className="flex items-center justify-between pb-4 border-b border-[#eae4d9]">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex items-center space-x-1.5 text-xs font-mono text-[#78716c] hover:text-[#1c1917] transition-colors cursor-pointer group"
        >
          <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
          <span>Back to Articles</span>
        </button>

        <span className="text-xs font-serif font-bold text-[#1c1917]">
          {article.newspaperName || selectedEdition?.name || 'The Daily Voice'}
        </span>

        <button
          type="button"
          onClick={() => toggleBookmark(article)}
          className={`p-2 rounded-xl transition-all cursor-pointer ${
            bookmarked
              ? 'text-[#9a3412] bg-[#fbeee6]'
              : 'text-[#78716c] hover:text-[#1c1917] hover:bg-[#f3ece2]'
          }`}
          title={bookmarked ? 'Saved in Library' : 'Save to Library'}
        >
          <Bookmark className={`w-4 h-4 ${bookmarked ? 'fill-current' : ''}`} />
        </button>
      </div>

      {/* Main Listening Card */}
      <div className="bg-white rounded-3xl border border-[#eae4d9] shadow-[0_8px_30px_rgba(28,25,23,0.06)] overflow-hidden">
        {/* Tab Toggle: Audio Player vs Full Text */}
        <div className="flex border-b border-[#eae4d9] text-xs font-medium bg-[#f3ece2]/40">
          <button
            type="button"
            onClick={() => setActiveTab('player')}
            className={`flex-1 py-3.5 flex items-center justify-center space-x-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'player'
                ? 'border-[#9a3412] text-[#9a3412] font-semibold bg-white'
                : 'border-transparent text-[#78716c] hover:text-[#1c1917]'
            }`}
          >
            <Volume2 className="w-4 h-4" />
            <span>Audio Narration</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('read')}
            className={`flex-1 py-3.5 flex items-center justify-center space-x-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'read'
                ? 'border-[#9a3412] text-[#9a3412] font-semibold bg-white'
                : 'border-transparent text-[#78716c] hover:text-[#1c1917]'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>Full Story Text</span>
          </button>
        </div>

        {activeTab === 'player' ? (
          <div className="p-6 sm:p-10 flex flex-col items-center text-center max-w-lg mx-auto">
            {/* Category Badge & Listening Mode Pill */}
            <div className="flex items-center space-x-2 mb-3">
              <span className="text-[11px] font-mono tracking-wider uppercase px-3 py-1 rounded-full bg-[#fbeee6] text-[#9a3412] font-semibold">
                {article.category}
              </span>
              {isCurrentActive && (
                <span className="text-[10px] font-mono tracking-widest uppercase px-2.5 py-0.5 rounded-full bg-[#1c1917] text-white font-bold">
                  {listeningMode === 'summary' ? 'AI Summary' : (listeningMode === 'full' ? 'Full Story' : 'Headlines')}
                </span>
              )}
            </div>

            {/* Headline */}
            <h1 className="font-serif font-black text-2xl sm:text-3xl text-[#1c1917] leading-tight mb-2">
              {article.title || article.headline}
            </h1>

            {/* Publisher & Date */}
            <p className="text-xs text-[#78716c] font-mono mb-6">
              {article.publisher || article.byline || 'Broadsheet Correspondent'} • Page {article.pageNumber || article.page_number || 1}
            </p>

            {/* If player has not yet been initiated by the user, display the Three Listening Options prompt */}
            {!isCurrentActive ? (
              <div className="w-full space-y-4 my-2">
                <div className="p-5 bg-[#faf7f2] rounded-2xl border border-[#eae4d9] text-left text-xs sm:text-sm text-[#44403c] font-serif leading-relaxed italic shadow-xs">
                  "{article.summary}"
                </div>

                {/* Pre-listening Language Selector */}
                <div className="flex items-center justify-between p-3 bg-[#faf7f2] rounded-2xl border border-[#eae4d9]">
                  <span className="text-xs font-mono font-medium text-[#78716c]">Narration Language:</span>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowLangMenu(!showLangMenu)}
                      className="py-1.5 px-3 bg-white border border-[#eae4d9] hover:border-[#9a3412] rounded-xl text-xs font-mono flex items-center space-x-2 text-[#1c1917] shadow-xs cursor-pointer transition-colors"
                    >
                      <Languages className="w-3.5 h-3.5 text-[#9a3412]" />
                      <span className="font-semibold">{language}</span>
                      <ChevronDown className="w-3.5 h-3.5 text-[#78716c]" />
                    </button>
                    {showLangMenu && (
                      <div className="absolute right-0 top-full mt-1.5 w-48 bg-white border border-[#eae4d9] rounded-xl shadow-xl z-30 py-1">
                        {SUPPORTED_LANGUAGES.map((l) => (
                          <button
                            key={l.id}
                            type="button"
                            onClick={() => {
                              changeLanguageOnly(l.name);
                              setShowLangMenu(false);
                            }}
                            className={`w-full text-left px-3 py-2 text-xs font-mono hover:bg-[#f3ece2] flex items-center justify-between cursor-pointer ${
                              language === l.name ? 'font-bold text-[#9a3412] bg-[#fbeee6]' : 'text-[#1c1917]'
                            }`}
                          >
                            <div>
                              <span>{l.name}</span>
                              <span className="text-[10px] text-[#78716c] ml-1.5 font-sans">({l.label})</span>
                            </div>
                            {language === l.name && <Check className="w-3.5 h-3.5 text-[#9a3412]" />}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="text-xs font-mono font-semibold text-[#78716c] pt-1">
                  Choose a listening option to begin narration:
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
                  {/* Option B: Listen to Article Summary */}
                  <button
                    type="button"
                    onClick={() => handleStartListening('summary')}
                    className="p-4 rounded-2xl bg-gradient-to-br from-[#ea580c] to-[#9a3412] hover:from-[#f97316] hover:to-[#ea580c] text-white shadow-md hover:shadow-lg transition-all text-left flex flex-col justify-between cursor-pointer group active:scale-95"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <Sparkles className="w-4 h-4 text-orange-200" />
                        <span className="text-[10px] font-mono uppercase bg-white/20 px-2 py-0.5 rounded-full font-bold">
                          30–45s
                        </span>
                      </div>
                      <div className="font-serif font-bold text-base leading-snug mb-1">
                        Listen to Summary
                      </div>
                      <div className="text-[11px] text-white/80 font-serif leading-tight">
                        Concise AI summary preserving key facts and figures.
                      </div>
                    </div>
                    <div className="mt-4 pt-2 border-t border-white/20 flex items-center justify-between text-xs font-mono font-bold">
                      <span>Start Summary</span>
                      <Play className="w-3.5 h-3.5 fill-current" />
                    </div>
                  </button>

                  {/* Option C: Listen to Full Article */}
                  <button
                    type="button"
                    onClick={() => handleStartListening('full')}
                    className="p-4 rounded-2xl bg-[#faf7f2] hover:bg-[#f3ece2] border border-[#eae4d9] hover:border-[#d6cebf] text-[#1c1917] shadow-xs hover:shadow-sm transition-all text-left flex flex-col justify-between cursor-pointer group active:scale-95"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <BookOpen className="w-4 h-4 text-[#9a3412]" />
                        <span className="text-[10px] font-mono uppercase bg-[#eae4d9] text-[#78716c] px-2 py-0.5 rounded-full font-bold">
                          Unabridged
                        </span>
                      </div>
                      <div className="font-serif font-bold text-base leading-snug mb-1">
                        Listen to Full Article
                      </div>
                      <div className="text-[11px] text-[#78716c] font-serif leading-tight">
                        Complete unabridged report with original context.
                      </div>
                    </div>
                    <div className="mt-4 pt-2 border-t border-[#eae4d9] flex items-center justify-between text-xs font-mono font-bold text-[#9a3412]">
                      <span>Play Full Story</span>
                      <Play className="w-3.5 h-3.5 fill-current" />
                    </div>
                  </button>
                </div>

                {/* Option A Link: Listen to Edition Headlines */}
                {selectedEdition && (
                  <button
                    type="button"
                    onClick={() => playHeadlines(selectedEdition)}
                    className="text-xs font-mono text-[#78716c] hover:text-[#9a3412] flex items-center justify-center space-x-1.5 mx-auto pt-2 transition-colors cursor-pointer"
                  >
                    <Headphones className="w-3.5 h-3.5 text-[#9a3412]" />
                    <span>Or stream today's front-page headlines digest</span>
                  </button>
                )}
              </div>
            ) : (
              /* ACTIVE TACTILE AUDIO PLAYER */
              <div className="w-full flex flex-col items-center">
                {/* Listening Mode Toggle Pills */}
                <div className="inline-flex p-1 bg-[#f3ece2] rounded-xl mb-5 text-xs font-mono">
                  <button
                    type="button"
                    onClick={() => setListeningMode('summary')}
                    className={`px-3 py-1.5 rounded-lg transition-all flex items-center space-x-1.5 cursor-pointer ${
                      listeningMode === 'summary'
                        ? 'bg-white text-[#9a3412] font-bold shadow-xs'
                        : 'text-[#78716c] hover:text-[#1c1917]'
                    }`}
                  >
                    <Sparkles className="w-3 h-3 text-[#ea580c]" />
                    <span>Article Summary</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setListeningMode('full')}
                    className={`px-3 py-1.5 rounded-lg transition-all flex items-center space-x-1.5 cursor-pointer ${
                      listeningMode === 'full'
                        ? 'bg-white text-[#9a3412] font-bold shadow-xs'
                        : 'text-[#78716c] hover:text-[#1c1917]'
                    }`}
                  >
                    <BookOpen className="w-3 h-3 text-[#ea580c]" />
                    <span>Full Article</span>
                  </button>
                </div>

                {/* Narrated Spoken Text or Loading Banner */}
                {isLoading ? (
                  <div className="w-full p-6 bg-[#fbeee6]/70 rounded-2xl border border-[#ea580c]/30 text-center mb-6 animate-pulse">
                    <Loader2 className="w-6 h-6 animate-spin text-[#ea580c] mx-auto mb-2" />
                    <p className="font-serif font-bold text-sm text-[#9a3412]">
                      {language === 'English'
                        ? (listeningMode === 'summary' ? 'Generating AI summary...' : 'Synthesizing article audio...')
                        : `Translating & generating speech in ${language}...`}
                    </p>
                    <p className="text-[11px] font-mono text-[#78716c] mt-1">
                      Generating speech audio with native neural voice
                    </p>
                  </div>
                ) : audioError ? (
                  <div className="w-full p-5 bg-red-50 rounded-2xl border border-red-200 text-left mb-6">
                    <div className="flex items-start space-x-2.5">
                      <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                      <div>
                        <h4 className="font-serif font-bold text-sm text-red-900">Audio Narration Notice</h4>
                        <p className="text-xs text-red-700 font-sans mt-0.5 leading-relaxed">{audioError}</p>
                        <button
                          type="button"
                          onClick={retryAudioGeneration}
                          className="mt-3 inline-flex items-center space-x-1.5 px-3 py-1 bg-red-700 text-white rounded-lg text-xs font-mono font-medium hover:bg-red-800 transition-colors cursor-pointer"
                        >
                          <RefreshCw className="w-3 h-3" />
                          <span>Retry Generation</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="w-full p-5 bg-[#faf7f2] rounded-2xl border border-[#eae4d9] text-left text-xs sm:text-sm text-[#44403c] font-serif leading-relaxed mb-6 italic shadow-xs max-h-48 overflow-y-auto">
                    "{narratedText || article.summary}"
                  </div>
                )}

                {/* Progress Scrubber Bar */}
                <div className="w-full mb-6">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={progressPercent || 0}
                    onChange={handleSliderChange}
                    disabled={isLoading}
                    className="w-full h-2.5 bg-[#eae4d9] rounded-lg appearance-none cursor-pointer accent-[#9a3412]"
                  />
                  <div className="flex justify-between text-xs font-mono text-[#78716c] mt-2 font-medium">
                    <span>{formattedCurrentTime}</span>
                    <span className="text-[#a8a29e]">{formatRemaining(remainingSeconds)}</span>
                    <span>{formattedDuration}</span>
                  </div>
                </div>

                {/* Tactile Audio Transport Controls */}
                <div className="flex items-center justify-center space-x-6 sm:space-x-8 mb-8">
                  <button
                    type="button"
                    onClick={() => rewind(15)}
                    disabled={isLoading}
                    className="w-12 h-12 rounded-2xl bg-[#faf7f2] border border-[#eae4d9] hover:bg-[#f3ece2] hover:border-[#d6cebf] text-[#44403c] hover:text-[#1c1917] flex flex-col items-center justify-center transition-all shadow-xs active:scale-95 cursor-pointer disabled:opacity-50"
                    title="Rewind 15 seconds"
                  >
                    <RotateCcw className="w-5 h-5 text-[#9a3412]" />
                    <span className="text-[9px] font-mono font-semibold mt-0.5">-15s</span>
                  </button>

                  <button
                    type="button"
                    onClick={togglePlayPause}
                    disabled={isLoading}
                    className="w-20 h-20 rounded-full bg-gradient-to-br from-[#ea580c] to-[#9a3412] hover:from-[#f97316] hover:to-[#ea580c] text-white flex items-center justify-center shadow-[0_8px_25px_rgba(234,88,12,0.35)] transition-all active:scale-95 cursor-pointer disabled:opacity-50"
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

                  <button
                    type="button"
                    onClick={() => forward(15)}
                    disabled={isLoading}
                    className="w-12 h-12 rounded-2xl bg-[#faf7f2] border border-[#eae4d9] hover:bg-[#f3ece2] hover:border-[#d6cebf] text-[#44403c] hover:text-[#1c1917] flex flex-col items-center justify-center transition-all shadow-xs active:scale-95 cursor-pointer disabled:opacity-50"
                    title="Forward 15 seconds"
                  >
                    <RotateCw className="w-5 h-5 text-[#9a3412]" />
                    <span className="text-[9px] font-mono font-semibold mt-0.5">+15s</span>
                  </button>
                </div>

                {/* Speed & Five-Language Pickers */}
                <div className="grid grid-cols-2 gap-3 w-full mb-5">
                  {/* Speed Selector */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowSpeedMenu(!showSpeedMenu)}
                      className="w-full py-2.5 px-3 bg-[#faf7f2] hover:bg-[#f3ece2] border border-[#eae4d9] rounded-xl text-xs font-mono flex items-center justify-between text-[#1c1917] shadow-xs transition-colors cursor-pointer"
                    >
                      <span className="flex items-center space-x-2">
                        <Gauge className="w-3.5 h-3.5 text-[#9a3412]" />
                        <span>{playbackSpeed}x Speed</span>
                      </span>
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

                  {/* 5-Language Selector */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowLangMenu(!showLangMenu)}
                      className="w-full py-2.5 px-3 bg-[#faf7f2] hover:bg-[#f3ece2] border border-[#eae4d9] rounded-xl text-xs font-mono flex items-center justify-between text-[#1c1917] shadow-xs transition-colors cursor-pointer"
                    >
                      <span className="flex items-center space-x-2">
                        <Languages className="w-3.5 h-3.5 text-[#9a3412]" />
                        <span className="truncate">{language}</span>
                      </span>
                    </button>
                    {showLangMenu && (
                      <div className="absolute bottom-full mb-2 left-0 right-0 bg-white border border-[#eae4d9] rounded-xl shadow-xl z-20 py-1">
                        {SUPPORTED_LANGUAGES.map((l) => (
                          <button
                            key={l.id}
                            type="button"
                            onClick={() => {
                              setLanguage(l.name, article);
                              setShowLangMenu(false);
                            }}
                            className={`w-full text-left px-3 py-2 text-xs font-mono hover:bg-[#f3ece2] flex items-center justify-between cursor-pointer ${
                              language === l.name ? 'font-bold text-[#9a3412] bg-[#fbeee6]' : 'text-[#1c1917]'
                            }`}
                          >
                            <div>
                              <span>{l.name}</span>
                              <span className="text-[10px] text-[#78716c] ml-1.5">({l.label})</span>
                            </div>
                            {language === l.name && <Check className="w-3.5 h-3.5 text-[#9a3412]" />}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Full Article Content Read-Along */
          <div className="p-6 sm:p-10 space-y-6 max-w-prose mx-auto">
            <div className="border-b border-[#eae4d9] pb-4">
              <span className="text-[11px] font-mono tracking-wider uppercase text-[#9a3412] font-semibold">
                {article.category}
              </span>
              <h2 className="text-2xl sm:text-3xl font-serif font-black text-[#1c1917] mt-1 leading-tight">
                {article.title || article.headline}
              </h2>
              <p className="text-xs text-[#78716c] font-mono mt-1">
                Reported by {article.publisher || article.byline || 'Broadsheet Staff'} • Page {article.pageNumber || article.page_number || 1}
              </p>
            </div>

            <div className="font-serif text-[#292524] text-base sm:text-lg leading-relaxed space-y-5">
              {(article.content || '').split('\n\n').map((para, index) => (
                <p key={index} className="first-of-type:first-letter:text-4xl first-of-type:first-letter:font-bold first-of-type:first-letter:mr-1 first-of-type:first-letter:float-left first-of-type:first-letter:text-[#9a3412]">
                  {para}
                </p>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
