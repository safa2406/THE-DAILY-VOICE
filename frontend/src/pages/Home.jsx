import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  QrCode,
  FileUp,
  Newspaper,
  Headphones,
  ArrowRight,
  Play,
  CloudSun,
  Calendar,
  Sparkles,
  BookOpen,
  Volume2,
} from 'lucide-react';
import { useEdition } from '../context/EditionContext';
import { useAudio } from '../context/AudioContext';
import { useAuth } from '../context/AuthContext';
import { useLibrary } from '../context/LibraryContext';
import { getTimeOfDayGreeting, getUserDisplayName, getUserFirstName } from '../utils/greeting';
import QRScannerModal from '../components/QRScannerModal';
import PDFUploaderModal from '../components/PDFUploaderModal';
import ArticleCard from '../components/ArticleCard';

export default function Home() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { selectedEdition, currentEditionArticles } = useEdition();
  const { playArticle, playHeadlines, openFullPlayer } = useAudio();
  const { listeningHistory } = useLibrary();

  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);

  // Dynamic greeting state based on browser local time
  const [greetingText, setGreetingText] = useState(getTimeOfDayGreeting());

  useEffect(() => {
    // Re-evaluate greeting periodically so shifts across 5 AM, 12 PM, and 5 PM reflect without a page refresh
    const timer = setInterval(() => {
      setGreetingText(getTimeOfDayGreeting());
    }, 30000);

    return () => clearInterval(timer);
  }, []);

  const userName = getUserFirstName(user) || (user ? getUserDisplayName(user) : '');

  // Today's headline articles
  const headlineArticles = currentEditionArticles.filter((art) => art.isHeadline).slice(0, 3);

  // Find recent unfinished listening session if one exists
  const unfinishedItem = listeningHistory?.find(
    (item) => !item.isCompleted && ((item.progressSeconds || item.progress_seconds || 0) > 0)
  );

  const handleListenHeadlines = () => {
    if (selectedEdition) {
      playHeadlines(selectedEdition);
      openFullPlayer();
    } else if (headlineArticles.length > 0) {
      playArticle(headlineArticles[0], 'headlines');
      openFullPlayer();
    }
  };

  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-300">
      {/* Editorial Hero Header */}
      <section className="relative overflow-hidden rounded-[20px] bg-gradient-to-b from-white via-white to-[#fffaf5] p-6 sm:p-8 border border-[#eae4d9] shadow-[0_4px_20px_rgba(28,25,23,0.04)]">
        {/* Subtle broadsheet watermarked ribbon */}
        <div className="flex flex-wrap items-center justify-between gap-2 pb-4 mb-4 border-b border-[#eae4d9] text-xs font-mono text-[#5c534a]">
          <span className="flex items-center space-x-1.5 font-semibold text-[#1c1917]">
            <Calendar className="w-3.5 h-3.5 text-[#9a3412]" />
            <span>{selectedEdition?.date || 'Saturday, November 14, 2026'}</span>
          </span>
          <span className="hidden sm:inline-block text-[#d6cebf]">•</span>
          <span className="flex items-center space-x-1.5 text-[#9a3412] font-semibold">
            <CloudSun className="w-3.5 h-3.5" />
            <span>{selectedEdition?.weather || '18°C Mild & Clear'}</span>
          </span>
          <span className="hidden sm:inline-block text-[#d6cebf]">•</span>
          <span className="uppercase tracking-wider">{selectedEdition?.location || 'National Morning Broadsheet'}</span>
        </div>

        <div className="max-w-2xl">
          <h1 className="font-serif font-black text-3xl sm:text-4xl lg:text-5xl text-[#1c1917] tracking-tight leading-tight">
            {greetingText}{userName && userName !== 'Reader' ? `, ${userName}` : (userName ? `, ${userName}` : '')}
          </h1>
        </div>

        {/* Real Context Strip (Unfinished story or Edition summary) */}
        {(selectedEdition || unfinishedItem?.article) && (
          <div className="mt-4 pt-4 border-t border-[#f3ece2] flex flex-wrap items-center gap-2.5">
            {selectedEdition && (
              <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-[#f3ece2] text-[#5c534a] text-xs font-mono">
                <Newspaper className="w-3.5 h-3.5 text-[#9a3412]" />
                <span className="font-semibold text-[#1c1917]">{selectedEdition.name}</span>
                <span>•</span>
                <span>{currentEditionArticles.length} {currentEditionArticles.length === 1 ? 'story' : 'stories'}</span>
              </div>
            )}

            {unfinishedItem?.article && (
              <button
                type="button"
                onClick={() => {
                  const art = unfinishedItem.article;
                  const mode = unfinishedItem.listeningMode || unfinishedItem.listening_mode || 'summary';
                  const pos = unfinishedItem.progressSeconds || unfinishedItem.progress_seconds || 0;
                  playArticle(art, mode, pos);
                  openFullPlayer();
                }}
                className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-[#fbeee6] hover:bg-[#f3ece2] border border-[#f0d8cc] text-[#9a3412] text-xs font-mono transition-colors cursor-pointer group"
                title="Continue listening to story"
              >
                <Play className="w-3 h-3 fill-current group-hover:scale-110 transition-transform" />
                <span className="font-bold">Continue:</span>
                <span className="font-sans font-medium text-[#1c1917] truncate max-w-[160px] sm:max-w-[260px]">
                  {unfinishedItem.article.title}
                </span>
              </button>
            )}
          </div>
        )}
      </section>

      {/* Two Prominent Action Cards: Scan QR & Upload PDF */}
      <section className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
        {/* ACTION 1: SCAN QR */}
        <div
          onClick={() => setIsQrModalOpen(true)}
          className="p-6 sm:p-8 bg-white rounded-[20px] border border-[#eae4d9] hover:border-[#9a3412] shadow-[0_4px_20px_rgba(28,25,23,0.04)] hover:shadow-[0_12px_30px_rgba(154,52,18,0.08)] hover:-translate-y-1 transition-all duration-300 cursor-pointer group flex flex-col justify-between"
        >
          <div>
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#fbeee6] to-[#f3ece2] border border-[#fbeee6] text-[#9a3412] flex items-center justify-center mb-5 group-hover:scale-105 transition-transform duration-200 shadow-xs">
              <QrCode className="w-7 h-7" />
            </div>
            <h2 className="font-serif font-bold text-xl sm:text-2xl text-[#1c1917] group-hover:text-[#9a3412] transition-colors mb-1.5">
              Scan Broadsheet
            </h2>
            <p className="text-xs sm:text-sm text-[#5c534a] font-serif leading-relaxed">
              Unlock audio chapters from today's printed newspaper.
            </p>
          </div>
          <div className="mt-6 pt-4 border-t border-[#f3ece2] flex items-center justify-between text-xs font-mono font-semibold text-[#9a3412]">
            <span>Scan QR Code</span>
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1.5" />
          </div>
        </div>

        {/* ACTION 2: UPLOAD PDF */}
        <div
          onClick={() => setIsPdfModalOpen(true)}
          className="p-6 sm:p-8 bg-white rounded-[20px] border border-[#eae4d9] hover:border-[#1c1917] shadow-[0_4px_20px_rgba(28,25,23,0.04)] hover:shadow-[0_12px_30px_rgba(28,25,23,0.08)] hover:-translate-y-1 transition-all duration-300 cursor-pointer group flex flex-col justify-between"
        >
          <div>
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#f3ece2] to-[#e7dfd1] border border-[#eae4d9] text-[#1c1917] flex items-center justify-center mb-5 group-hover:scale-105 transition-transform duration-200 shadow-xs">
              <FileUp className="w-7 h-7" />
            </div>
            <h2 className="font-serif font-bold text-xl sm:text-2xl text-[#1c1917] group-hover:text-[#9a3412] transition-colors mb-1.5">
              Import PDF Edition
            </h2>
            <p className="text-xs sm:text-sm text-[#5c534a] font-serif leading-relaxed">
              Extract columns and listen from a broadsheet PDF.
            </p>
          </div>
          <div className="mt-6 pt-4 border-t border-[#f3ece2] flex items-center justify-between text-xs font-mono font-semibold text-[#1c1917] group-hover:text-[#9a3412] transition-colors">
            <span>Import PDF</span>
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1.5" />
          </div>
        </div>
      </section>

      {/* Featured Newspaper Edition Broadsheet Fold */}
      {selectedEdition && (
        <section className="bg-white rounded-[20px] border border-[#eae4d9] p-6 sm:p-8 shadow-[0_4px_20px_rgba(28,25,23,0.04)] relative overflow-hidden">
          {/* Subtle decorative masthead line */}
          <div className="w-full h-1 bg-gradient-to-r from-[#9a3412] via-[#b43a14] to-[#9a3412] rounded-t-3xl absolute top-0 left-0 right-0" />

          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pt-2">
            <div className="space-y-2 max-w-xl">
              <div className="flex items-center space-x-2">
                <span className="text-xs font-mono tracking-widest uppercase px-3 py-1 rounded-full bg-[#fbeee6] text-[#9a3412] font-bold">
                  {selectedEdition.coverTag}
                </span>
                <span className="text-xs font-mono text-[#5c534a]">{selectedEdition.editionId}</span>
              </div>
              <h3 className="font-serif font-black text-3xl sm:text-4xl text-[#1c1917] tracking-tight">
                {selectedEdition.name}
              </h3>
              <p className="text-xs sm:text-sm text-[#5c534a] font-serif italic">
                "{selectedEdition.tagline}" • {selectedEdition.articleCount} Broadsheet Articles
              </p>
            </div>

            {/* Prominent Listening Choices */}
            <div className="flex flex-col sm:flex-row gap-3 shrink-0">
              <button
                type="button"
                onClick={handleListenHeadlines}
                className="py-3.5 px-6 bg-gradient-to-r from-[#9a3412] to-[#c2410c] hover:from-[#7c2d12] hover:to-[#9a3412] text-white rounded-2xl text-xs sm:text-sm font-semibold shadow-md transition-all flex items-center justify-center space-x-2.5 cursor-pointer active:scale-95"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>Play Headlines ({selectedEdition.headlineAudioDuration})</span>
              </button>

              <button
                type="button"
                onClick={() => navigate('/edition')}
                className="py-3.5 px-5 bg-[#faf7f2] hover:bg-[#f3ece2] border border-[#eae4d9] text-[#1c1917] rounded-2xl text-xs sm:text-sm font-semibold transition-all flex items-center justify-center space-x-2 cursor-pointer"
              >
                <BookOpen className="w-4 h-4" />
                <span>Explore Edition</span>
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Top Stories */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-serif font-black text-2xl text-[#1c1917]">
              Top Stories
            </h2>
          </div>
          {currentEditionArticles.length > 0 && (
            <button
              type="button"
              onClick={() => navigate('/browse')}
              className="text-xs font-mono font-semibold text-[#9a3412] hover:underline flex items-center space-x-1 cursor-pointer"
            >
              <span>All Stories</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {headlineArticles.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
            {headlineArticles.map((article) => (
              <ArticleCard key={article.id} article={article} />
            ))}
          </div>
        ) : (
          <div className="p-8 sm:p-12 text-center bg-white rounded-[20px] border border-[#eae4d9] shadow-[0_4px_20px_rgba(28,25,23,0.04)]">
            <div className="w-12 h-12 rounded-2xl bg-[#fbeee6] text-[#9a3412] flex items-center justify-center mx-auto mb-3">
              <Newspaper className="w-6 h-6" />
            </div>
            <h3 className="font-serif font-bold text-lg text-[#1c1917] mb-1">
              No Edition Active
            </h3>
            <p className="text-xs sm:text-sm text-[#5c534a] font-serif max-w-md mx-auto mb-5 leading-relaxed">
              Scan a broadsheet QR code or upload a PDF to begin.
            </p>
            <button
              type="button"
              onClick={() => setIsQrModalOpen(true)}
              className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-full bg-[#1c1917] hover:bg-[#9a3412] text-white text-xs font-mono font-medium transition-colors shadow-xs cursor-pointer"
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>Scan QR Code</span>
            </button>
          </div>
        )}
      </section>

      {/* Modals */}
      <QRScannerModal isOpen={isQrModalOpen} onClose={() => setIsQrModalOpen(false)} />
      <PDFUploaderModal isOpen={isPdfModalOpen} onClose={() => setIsPdfModalOpen(false)} />
    </div>
  );
}
