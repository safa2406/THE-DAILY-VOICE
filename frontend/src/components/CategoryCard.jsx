import React from 'react';
import { Newspaper, Trophy, Globe, TrendingUp, Cpu, Landmark, ChevronRight } from 'lucide-react';

const iconMap = {
  Newspaper,
  Trophy,
  Globe,
  TrendingUp,
  Cpu,
  Landmark,
};

export default function CategoryCard({ category, articleCount = 0, isSelected = false, onSelect }) {
  const IconComponent = iconMap[category.iconName] || Newspaper;

  return (
    <button
      type="button"
      onClick={() => onSelect(category.id)}
      className={`p-4 sm:p-5 rounded-[20px] text-left border transition-all duration-200 flex flex-col justify-between w-full group cursor-pointer relative overflow-hidden ${
        isSelected
          ? 'bg-[#1c1917] text-white border-[#1c1917] shadow-lg ring-2 ring-[#9a3412]/40 -translate-y-0.5'
          : 'bg-white text-[#1c1917] border-[#eae4d9] hover:border-[#d6cebf] shadow-[0_4px_20px_rgba(28,25,23,0.04)] hover:shadow-[0_8px_24px_rgba(28,25,23,0.08)] hover:-translate-y-0.5'
      }`}
    >
      {/* Top Icon & Count Header */}
      <div className="flex items-start justify-between w-full mb-3">
        <div
          className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-200 ${
            isSelected
              ? 'bg-[#9a3412] text-white shadow-xs'
              : 'bg-[#f3ece2] text-[#9a3412] group-hover:bg-[#9a3412] group-hover:text-white'
          }`}
        >
          <IconComponent className="w-5 h-5" />
        </div>
        <span
          className={`text-xs font-mono px-2.5 py-0.5 rounded-full font-semibold ${
            isSelected
              ? 'bg-[#2e2a27] text-[#d6cebf]'
              : 'bg-[#f3ece2] text-[#5c534a] group-hover:bg-[#e7dfd1]'
          }`}
        >
          {articleCount}
        </span>
      </div>

      {/* Category Name & Short Pitch */}
      <div>
        <div className="flex items-center justify-between">
          <h4
            className={`font-serif font-bold text-base transition-colors ${
              isSelected ? 'text-white' : 'text-[#1c1917] group-hover:text-[#9a3412]'
            }`}
          >
            {category.name}
          </h4>
          <ChevronRight
            className={`w-4 h-4 transition-transform group-hover:translate-x-1 ${
              isSelected ? 'text-[#9a3412]' : 'text-[#5c534a]'
            }`}
          />
        </div>
        <p
          className={`text-xs mt-1 line-clamp-2 leading-snug font-serif ${
            isSelected ? 'text-[#d6cebf]' : 'text-[#5c534a]'
          }`}
        >
          {category.description}
        </p>
      </div>

      {/* Active Selection Glow Dot */}
      {isSelected && (
        <span className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#9a3412]" />
      )}
    </button>
  );
}
