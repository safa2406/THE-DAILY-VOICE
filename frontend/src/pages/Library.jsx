import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bookmark, Clock, Compass, BookOpen, Trash2, ArrowRight } from 'lucide-react';
import { useLibrary } from '../context/LibraryContext';
import ArticleCard from '../components/ArticleCard';
import ListeningProgressCard from '../components/ListeningProgressCard';

export default function Library() {
  const navigate = useNavigate();
  const { savedArticles, listeningHistory } = useLibrary();
  const [activeTab, setActiveTab] = useState('saved'); // 'saved' or 'history'

  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-300">
      {/* Editorial Library Header */}
      <section className="bg-white rounded-[20px] border border-[#eae4d9] p-6 sm:p-8 shadow-[0_4px_20px_rgba(28,25,23,0.04)]">
        <h1 className="font-serif font-black text-3xl sm:text-4xl text-[#1c1917] tracking-tight">
          Your Library
        </h1>

        {/* Tab Switcher: Saved vs History */}
        <div className="flex border-b border-[#eae4d9] mt-6 gap-6 text-sm">
          <button
            type="button"
            onClick={() => setActiveTab('saved')}
            className={`pb-3 font-serif font-bold text-base transition-colors relative cursor-pointer ${
              activeTab === 'saved'
                ? 'text-[#9a3412] border-b-2 border-[#9a3412]'
                : 'text-[#5c534a] hover:text-[#1c1917]'
            }`}
          >
            <span>Saved Stories ({savedArticles.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`pb-3 font-serif font-bold text-base transition-colors relative cursor-pointer ${
              activeTab === 'history'
                ? 'text-[#9a3412] border-b-2 border-[#9a3412]'
                : 'text-[#5c534a] hover:text-[#1c1917]'
            }`}
          >
            <span>Listening History ({listeningHistory.length})</span>
          </button>
        </div>
      </section>

      {/* TAB 1: SAVED ARTICLES */}
      {activeTab === 'saved' && (
        <section className="space-y-4">
          {savedArticles.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
              {savedArticles.map((article) => (
                <ArticleCard key={article.id} article={article} />
              ))}
            </div>
          ) : (
            /* Clean Editorial Empty State */
            <div className="p-12 sm:p-16 bg-white rounded-[20px] border border-[#eae4d9] text-center max-w-md mx-auto space-y-4 shadow-[0_4px_20px_rgba(28,25,23,0.04)]">
              <div className="w-16 h-16 rounded-2xl bg-[#fbeee6] text-[#9a3412] flex items-center justify-center mx-auto shadow-inner">
                <Bookmark className="w-8 h-8" />
              </div>
              <h3 className="font-serif font-black text-2xl text-[#1c1917]">
                No Saved Stories
              </h3>
              <p className="text-xs sm:text-sm text-[#5c534a] font-serif leading-relaxed">
                Bookmark articles to listen to or read later.
              </p>
              <button
                type="button"
                onClick={() => navigate('/browse')}
                className="inline-flex items-center space-x-2 px-6 py-3 bg-[#9a3412] hover:bg-[#7c2d12] text-white rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer"
              >
                <Compass className="w-4 h-4" />
                <span>Browse Stories</span>
              </button>
            </div>
          )}
        </section>
      )}

      {/* TAB 2: LISTENING HISTORY */}
      {activeTab === 'history' && (
        <section className="space-y-4">
          {listeningHistory.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
              {listeningHistory.map((item) => (
                <ListeningProgressCard key={item.id || item.articleId || `digest-${item.editionId}`} item={item} />
              ))}
            </div>
          ) : (
            <div className="p-12 sm:p-16 bg-white rounded-[20px] border border-[#eae4d9] text-center max-w-md mx-auto space-y-3 shadow-[0_4px_20px_rgba(28,25,23,0.04)]">
              <Clock className="w-12 h-12 text-[#5c534a] mx-auto opacity-50" />
              <h3 className="font-serif font-black text-xl text-[#1c1917]">
                No Listening History
              </h3>
              <p className="text-xs text-[#5c534a] font-serif">
                Articles you listen to will appear here.
              </p>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
