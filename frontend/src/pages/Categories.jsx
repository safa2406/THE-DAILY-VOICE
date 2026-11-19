import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Newspaper, ArrowLeft, ArrowRight, Filter, Layers, BookOpen } from 'lucide-react';
import { useEdition } from '../context/EditionContext';
import { CATEGORIES } from '../utils/sampleData';
import CategoryCard from '../components/CategoryCard';
import ArticleCard from '../components/ArticleCard';

export default function Categories() {
  const navigate = useNavigate();
  const { selectedEdition, currentEditionArticles } = useEdition();
  const [selectedCategoryId, setSelectedCategoryId] = useState(CATEGORIES[0].id);

  const activeCategory = CATEGORIES.find((cat) => cat.id === selectedCategoryId) || CATEGORIES[0];

  const filteredArticles = currentEditionArticles.filter((art) => {
    if (art.categoryId && art.categoryId === selectedCategoryId) return true;
    if (art.category && activeCategory?.name) {
      return art.category.toLowerCase().trim() === activeCategory.name.toLowerCase().trim();
    }
    return false;
  });

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
          Scan a broadsheet QR code or upload a newspaper PDF to explore articles by editorial desk.
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
      {/* Header */}
      <section className="bg-white rounded-[20px] border border-[#eae4d9] p-6 sm:p-8 shadow-[0_4px_20px_rgba(28,25,23,0.04)]">
        <div className="flex items-center space-x-2 text-xs font-mono text-[#5c534a] pb-4 mb-4 border-b border-[#eae4d9]">
          <Newspaper className="w-4 h-4 text-[#9a3412]" />
          <span className="font-serif font-bold text-[#1c1917] text-sm">{selectedEdition.name}</span>
          <span>•</span>
          <span>{selectedEdition.date}</span>
        </div>

        <div>
          <h1 className="font-serif font-black text-3xl sm:text-4xl text-[#1c1917] tracking-tight">
            Browse Sections
          </h1>
        </div>
      </section>

      {/* The 6 Broadside Desks / Categories Grid */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-mono uppercase tracking-wider text-[#5c534a] font-bold flex items-center space-x-2">
            <Layers className="w-4 h-4 text-[#9a3412]" />
            <span>Sections</span>
          </h2>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
          {CATEGORIES.map((category) => {
            const count = currentEditionArticles.filter((a) => {
              if (a.categoryId && a.categoryId === category.id) return true;
              if (a.category && category.name) {
                return a.category.toLowerCase().trim() === category.name.toLowerCase().trim();
              }
              return false;
            }).length;
            return (
              <CategoryCard
                key={category.id}
                category={category}
                articleCount={count}
                isSelected={selectedCategoryId === category.id}
                onSelect={(id) => setSelectedCategoryId(id)}
              />
            );
          })}
        </div>
      </section>

      {/* Active Section Stories */}
      <section className="space-y-4">
        <div className="flex items-center justify-between pt-4 border-t border-[#eae4d9]">
          <h2 className="font-serif font-black text-2xl sm:text-3xl text-[#1c1917]">
            {activeCategory.name}
          </h2>
          <span className="text-xs font-mono text-[#5c534a] bg-white px-3 py-1 rounded-full border border-[#eae4d9]">
            {filteredArticles.length} {filteredArticles.length === 1 ? 'Article' : 'Articles'}
          </span>
        </div>

        {filteredArticles.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            {filteredArticles.map((article) => (
              <ArticleCard key={article.id} article={article} />
            ))}
          </div>
        ) : (
          <div className="p-10 bg-white rounded-[20px] border border-[#eae4d9] text-center space-y-3 shadow-[0_4px_20px_rgba(28,25,23,0.04)]">
            <BookOpen className="w-10 h-10 text-[#5c534a] mx-auto opacity-50" />
            <p className="font-serif font-bold text-lg text-[#1c1917]">
              No articles currently filed under {activeCategory.name} for this issue.
            </p>
            <p className="text-xs text-[#5c534a] font-mono">
              Try selecting another newspaper section or switch to the Weekend Edition.
            </p>
            <button
              type="button"
              onClick={() => setSelectedCategoryId(CATEGORIES[0].id)}
              className="mt-2 px-4 py-2 bg-[#f3ece2] hover:bg-[#e7dfd1] text-[#1c1917] rounded-xl text-xs font-semibold transition-colors cursor-pointer"
            >
              View Current Affairs
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
