import React from 'react';
import { Play, Pause, CheckCircle2, RotateCcw } from 'lucide-react';
import { useAudio } from '../context/AudioContext';

export default function ListeningProgressCard({ item }) {
  if (!item) return null;
  const { progressSeconds = 0, durationSeconds = 0, lastPlayedAt = 'Recently', isCompleted = false } = item;
  const article = item.article || {};
  const isHeadlineDigest =
    item.listeningMode === 'headlines' ||
    item.listening_mode === 'headlines' ||
    Boolean(article.isEdition);

  const { currentArticle, isPlaying, playArticle, playHeadlines, togglePlayPause, openFullPlayer } = useAudio();

  const artId = isHeadlineDigest
    ? (item.editionId || item.edition_id || article.editionId || article.edition_id || article.id)
    : (article.id || article.article_id || item.articleId || item.article_id);

  const currentId = currentArticle?.isEdition
    ? (currentArticle.id || currentArticle.editionId || currentArticle.edition_id)
    : (currentArticle?.id || currentArticle?.article_id);

  const isCurrent = Boolean(artId && currentId && String(currentId) === String(artId));
  const isThisPlaying = isCurrent && isPlaying;

  const percent = durationSeconds > 0 ? Math.min(100, Math.round((progressSeconds / durationSeconds) * 100)) : 0;

  const formatMins = (secs) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleListen = () => {
    const resumePos = isCompleted || (durationSeconds > 0 && progressSeconds >= durationSeconds) ? 0 : progressSeconds;
    if (isHeadlineDigest) {
      const rawId = item.editionId || item.edition_id || article.editionId || article.edition_id || article.id;
      const cleanId = rawId ? String(rawId).replace('-headlines', '').split('•')[0].trim() : null;
      const paperName =
        article.newspaperName ||
        article.publisher ||
        (article.title ? article.title.replace(' - Headline Digest', '') : 'Broadsheet');
      const editionObj = {
        id: cleanId,
        editionId: cleanId,
        edition_id: cleanId,
        name: paperName,
        newspaper_name: paperName,
        edition_code: article.edition_code || article.editionCode,
      };
      playHeadlines(editionObj, item.language || 'English', resumePos);
    } else {
      playArticle(article, resumePos, item.language || 'English');
    }
    openFullPlayer();
  };

  const handleResume = (e) => {
    e.stopPropagation();
    if (isCurrent) {
      togglePlayPause();
    } else {
      handleListen();
    }
  };

  return (
    <div
      onClick={handleListen}
      className={`p-5 sm:p-6 bg-white rounded-[20px] border shadow-[0_4px_20px_rgba(28,25,23,0.04)] transition-all duration-200 cursor-pointer group hover:shadow-[0_8px_24px_rgba(28,25,23,0.08)] hover:-translate-y-0.5 ${
        isCurrent
          ? 'border-[#9a3412] ring-1 ring-[#9a3412]/20 bg-gradient-to-b from-white to-[#fffaf5]'
          : 'border-[#eae4d9] hover:border-[#d6cebf]'
      }`}
    >
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="flex items-center space-x-2">
          <span className="text-xs font-mono tracking-wider uppercase px-2.5 py-0.5 rounded-full bg-[#f3ece2] text-[#9a3412] font-semibold">
            {isHeadlineDigest ? 'Headline Digest' : (article.category || 'Broadsheet')}
          </span>
          {isCompleted && (
            <span className="flex items-center space-x-1 text-xs font-mono text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              <span>Finished</span>
            </span>
          )}
        </div>
        <span className="text-xs font-mono text-[#5c534a]">{lastPlayedAt}</span>
      </div>

      <h4 className="font-serif font-bold text-base sm:text-lg text-[#1c1917] group-hover:text-[#9a3412] transition-colors line-clamp-2 leading-snug mb-3">
        {article.title || article.headline || (isHeadlineDigest ? 'Headline Digest' : 'Narrated Article')}
      </h4>

      {/* Progress Bar & Timing Indicators */}
      <div className="space-y-1.5 mb-3.5">
        <div className="flex justify-between text-xs font-mono text-[#5c534a]">
          <span>{formatMins(progressSeconds)}{durationSeconds > 0 ? ` / ${formatMins(durationSeconds)}` : ''}</span>
          <span className="font-semibold text-[#1c1917]">{percent}%</span>
        </div>
        <div className="w-full bg-[#f3ece2] h-2 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              isCompleted
                ? 'bg-emerald-600'
                : 'bg-[#9a3412]'
            }`}
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      <div className="flex items-center justify-between pt-2.5 border-t border-[#f3ece2] text-xs">
        <span className="text-xs font-mono text-[#5c534a] truncate max-w-[200px]">
          {article.newspaperName || article.publisher || 'Daily Broadsheet'}
        </span>
        <button
          type="button"
          onClick={handleResume}
          className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shadow-xs cursor-pointer ${
            isThisPlaying
              ? 'bg-[#9a3412] text-white hover:bg-[#7c2d12]'
              : 'bg-[#f3ece2] text-[#1c1917] hover:bg-[#9a3412] hover:text-white'
          }`}
        >
          {isThisPlaying ? (
            <>
              <Pause className="w-3.5 h-3.5 fill-current" />
              <span>Pause</span>
            </>
          ) : isCompleted ? (
            <>
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Listen Again</span>
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
              <span>Resume</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
