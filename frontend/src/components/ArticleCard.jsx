import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, Pause, Bookmark, Clock, Sparkles } from 'lucide-react';
import { useAudio } from '../context/AudioContext';
import { useLibrary } from '../context/LibraryContext';

export default function ArticleCard({ article }) {
  const navigate = useNavigate();
  const { currentArticle, isPlaying, playArticle, togglePlayPause } = useAudio();
  const { isBookmarked, toggleBookmark } = useLibrary();

  const isCurrent = currentArticle?.id === article.id;
  const isThisPlaying = isCurrent && isPlaying;
  const bookmarked = isBookmarked(article.id);

  const handlePlayClick = (e) => {
    e.stopPropagation();
    if (isCurrent) {
      togglePlayPause();
    } else {
      playArticle(article, 'summary');
    }
  };

  const handleBookmarkClick = (e) => {
    e.stopPropagation();
    toggleBookmark(article);
  };

  return (
    <article
      onClick={() => navigate(`/listen/${article.id}`)}
      className={`group p-5 sm:p-6 bg-white rounded-2xl border transition-all duration-200 cursor-pointer relative hover:shadow-[0_8px_24px_rgba(28,25,23,0.06)] hover:-translate-y-0.5 ${
        isCurrent
          ? 'border-[#9a3412] bg-gradient-to-b from-white to-[#fffaf5] ring-2 ring-[#9a3412]/15 shadow-sm'
          : 'border-[#eae4d9] hover:border-[#d6cebf]'
      }`}
    >
      {/* Category Kicker & Duration Header */}
      <div className="flex items-center justify-between gap-3 mb-2.5">
        <span className="text-[10px] font-mono tracking-wider uppercase px-2.5 py-0.5 rounded-full bg-[#f3ece2] text-[#9a3412] font-semibold">
          {article.category}
        </span>
        <div className="flex items-center space-x-1.5">
          <span className="flex items-center space-x-1 text-[11px] font-mono text-[#78716c]">
            <Clock className="w-3 h-3 text-[#a8a29e]" />
            <span>{article.durationFormatted || '3 min'}</span>
          </span>
          <button
            type="button"
            onClick={handleBookmarkClick}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
              bookmarked
                ? 'text-[#9a3412] bg-[#fbeee6]'
                : 'text-[#a8a29e] hover:text-[#1c1917] hover:bg-[#f3ece2]'
            }`}
            title={bookmarked ? 'Saved in library' : 'Save article'}
          >
            <Bookmark className={`w-3.5 h-3.5 ${bookmarked ? 'fill-current' : ''}`} />
          </button>
        </div>
      </div>

      {/* Main Headline */}
      <h3 className="font-serif font-bold text-lg sm:text-xl text-[#1c1917] leading-snug group-hover:text-[#9a3412] transition-colors mb-2">
        {article.title}
      </h3>

      {/* Editorial Summary Snippet */}
      <p className="text-xs sm:text-sm text-[#57534e] line-clamp-2 leading-relaxed mb-4 font-serif">
        {article.summary}
      </p>

      {/* Bottom Byline and Play Action Bar */}
      <div className="flex items-center justify-between pt-3 border-t border-[#f3ece2] text-xs">
        <span className="text-[11px] font-mono text-[#78716c] truncate max-w-[200px]">
          {article.publisher || article.newspaperName}
        </span>

        <button
          type="button"
          onClick={handlePlayClick}
          className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shadow-xs cursor-pointer ${
            isThisPlaying
              ? 'bg-[#9a3412] text-white hover:bg-[#7c2d12]'
              : 'bg-[#f3ece2] text-[#1c1917] hover:bg-[#9a3412] hover:text-white'
          }`}
          title={isThisPlaying ? 'Pause narration' : 'Listen to AI summary'}
        >
          {isThisPlaying ? (
            <>
              <Pause className="w-3.5 h-3.5 fill-current" />
              <span>Pause</span>
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
              <span>Listen</span>
            </>
          )}
        </button>
      </div>
    </article>
  );
}
