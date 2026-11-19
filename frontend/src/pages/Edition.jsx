import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Newspaper, Headphones, BookOpen, Play, Calendar, MapPin, CloudSun, ArrowRight, Volume2 } from 'lucide-react';
import { useEdition } from '../context/EditionContext';
import { useAudio } from '../context/AudioContext';
import ArticleCard from '../components/ArticleCard';

export default function Edition() {
  const navigate = useNavigate();
  const { selectedEdition, setEditionById, allEditions, currentEditionArticles } = useEdition();
  const { playArticle, playHeadlines, openFullPlayer } = useAudio();

  const headlineArticles = currentEditionArticles.filter((art) => art.isHeadline);

  const handlePlayHeadlines = () => {
    if (selectedEdition) {
      playHeadlines(selectedEdition);
      openFullPlayer();
    } else if (headlineArticles.length > 0) {
      playArticle(headlineArticles[0], 'headlines');
      openFullPlayer();
    }
  };

  if (!selectedEdition) {
    return (
      <div className="bg-white rounded-[20px] border border-[#eae4d9] p-8 sm:p-12 text-center max-w-xl mx-auto my-12 shadow-[0_4px_20px_rgba(28,25,23,0.04)] animate-in fade-in duration-300">
        <div className="w-16 h-16 rounded-2xl bg-[#fbeee6] text-[#9a3412] flex items-center justify-center mx-auto mb-4">
          <Newspaper className="w-8 h-8" />
        </div>
        <h2 className="font-serif font-black text-2xl sm:text-3xl text-[#1c1917] mb-2">
          No Newspaper Edition Loaded
        </h2>
        <p className="text-sm font-serif text-[#5c534a] mb-6 leading-relaxed">
          Scan a broadsheet QR code or upload a newspaper PDF to unlock today's audio edition, articles, and audio chapters.
        </p>
        <button
          type="button"
          onClick={() => navigate('/')}
          className="inline-flex items-center space-x-2 px-6 py-3 rounded-full bg-[#1c1917] hover:bg-[#9a3412] text-white text-xs font-mono font-medium transition-colors shadow-sm cursor-pointer"
        >
          <span>Return to Dashboard</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-300">
      {/* Authentic Broadsheet Masthead Header */}
      <section className="bg-white rounded-[20px] border border-[#eae4d9] p-6 sm:p-10 shadow-[0_4px_20px_rgba(28,25,23,0.04)]">
        {/* Top Dateline & Weather Strip */}
        <div className="flex flex-wrap items-center justify-between pb-4 mb-4 border-b border-[#eae4d9] text-xs font-mono text-[#5c534a] gap-2">
          <div className="flex items-center space-x-2">
            <span className="flex items-center space-x-1.5 font-semibold text-[#1c1917]">
              <Calendar className="w-3.5 h-3.5 text-[#9a3412]" />
              <span>{selectedEdition.date}</span>
            </span>
            <span>•</span>
            <span className="flex items-center space-x-1">
              <MapPin className="w-3.5 h-3.5" />
              <span>{selectedEdition.location}</span>
            </span>
          </div>

          <div className="flex items-center space-x-3">
            <span className="flex items-center space-x-1 text-[#9a3412] font-semibold">
              <CloudSun className="w-3.5 h-3.5" />
              <span>{selectedEdition.weather}</span>
            </span>
            <span className="hidden sm:inline text-[#d6cebf]">•</span>
            {/* Quick Edition Switcher dropdown */}
            <div className="flex items-center space-x-1.5">
              <span className="text-xs text-[#5c534a] hidden sm:inline">Edition:</span>
              <select
                value={selectedEdition.id}
                onChange={(e) => setEditionById(e.target.value)}
                className="py-1 px-2.5 bg-[#faf7f2] border border-[#eae4d9] rounded-lg text-xs font-serif text-[#1c1917] focus:outline-none focus:border-[#9a3412] cursor-pointer"
              >
                {!allEditions.some((ed) => ed.id === selectedEdition.id) && (
                  <option value={selectedEdition.id}>
                    {selectedEdition.name} ({selectedEdition.coverTag})
                  </option>
                )}
                {allEditions.map((ed) => (
                  <option key={ed.id} value={ed.id}>
                    {ed.name} ({ed.coverTag})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Newspaper Title & Subtitle */}
        <div className="text-center py-4 sm:py-6">
          <p className="text-xs uppercase font-mono tracking-widest text-[#9a3412] font-bold mb-2">
            The Journal of Record Since 1884
          </p>
          <h1 className="font-serif font-black text-4xl sm:text-6xl text-[#1c1917] tracking-tight leading-none mb-3">
            {selectedEdition.name}
          </h1>
          <p className="text-xs sm:text-sm text-[#5c534a] font-serif italic max-w-lg mx-auto">
            "{selectedEdition.tagline}" • Issue {selectedEdition.editionId} • {selectedEdition.articleCount} Broadsheet Articles
          </p>
        </div>

        {/* TWO PROMINENT LISTENING CHOICES: HEADLINES vs FULL ARTICLES */}
        <div className="pt-6 border-t border-[#eae4d9] grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
          {/* Choice 1: HEADLINES AUDIO DIGEST */}
          <button
            type="button"
            onClick={handlePlayHeadlines}
            className="p-6 rounded-[20px] bg-gradient-to-br from-[#9a3412] via-[#b43a14] to-[#7c2d12] text-white shadow-lg transition-all duration-200 hover:shadow-[0_12px_28px_rgba(154,52,18,0.25)] hover:-translate-y-0.5 text-left flex flex-col justify-between group cursor-pointer"
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center">
                  <Headphones className="w-6 h-6 text-white" />
                </div>
                <span className="text-xs uppercase font-mono tracking-wider bg-white/20 px-2.5 py-1 rounded-full text-white font-bold">
                  Audio Digest
                </span>
              </div>
              <h3 className="font-serif font-black text-2xl mb-1.5 leading-snug">
                Headline Digest
              </h3>
              <p className="text-xs sm:text-sm text-white/85 font-serif leading-relaxed">
                Curated front-page audio digest covering today's lead stories.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-white/20 flex items-center justify-between text-xs font-mono font-bold">
              <span>Play Headlines ({selectedEdition.headlineAudioDuration})</span>
              <div className="w-8 h-8 rounded-full bg-white text-[#9a3412] flex items-center justify-center transition-transform group-hover:scale-110 shadow-xs">
                <Play className="w-4 h-4 fill-current ml-0.5" />
              </div>
            </div>
          </button>

          {/* Choice 2: FULL ARTICLES DIRECTORY */}
          <button
            type="button"
            onClick={() => navigate('/browse')}
            className="p-6 rounded-[20px] bg-[#faf7f2] hover:bg-[#fffaf5] border border-[#eae4d9] hover:border-[#9a3412] text-[#1c1917] shadow-xs transition-all duration-200 hover:shadow-[0_12px_28px_rgba(28,25,23,0.06)] hover:-translate-y-0.5 text-left flex flex-col justify-between group cursor-pointer"
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="w-12 h-12 rounded-xl bg-[#f3ece2] text-[#9a3412] flex items-center justify-center">
                  <BookOpen className="w-6 h-6" />
                </div>
                <span className="text-xs uppercase font-mono tracking-wider bg-[#f3ece2] text-[#5c534a] px-2.5 py-1 rounded-full font-bold">
                  Sections
                </span>
              </div>
              <h3 className="font-serif font-black text-2xl mb-1.5 leading-snug group-hover:text-[#9a3412] transition-colors">
                Browse Stories
              </h3>
              <p className="text-xs sm:text-sm text-[#5c534a] font-serif leading-relaxed">
                Explore all desks across the complete broadsheet issue.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-[#eae4d9] flex items-center justify-between text-xs font-mono font-bold text-[#9a3412]">
              <span>Browse All ({selectedEdition.articleCount})</span>
              <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
            </div>
          </button>
        </div>
      </section>

      {/* Front-Page Headline Articles Section */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-serif font-black text-2xl text-[#1c1917]">
              Top Stories
            </h2>
          </div>
          <span className="text-xs font-mono text-[#5c534a]">
            {headlineArticles.length} Stories
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          {headlineArticles.map((article) => (
            <ArticleCard key={article.id} article={article} />
          ))}
        </div>
      </section>
    </div>
  );
}
