import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Radio, Newspaper, Activity, ChevronDown, Check, Sparkles } from 'lucide-react';
import { useEdition } from '../context/EditionContext';
import { useAuth } from '../context/AuthContext';
import { getUserDisplayName } from '../utils/greeting';

export default function Header() {
  const { selectedEdition, setSelectedEdition, setEditionById, allEditions } = useEdition();
  const { user } = useAuth();
  const location = useLocation();

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Derive dynamic user initials and display name
  const displayName = getUserDisplayName(user);
  const initials = displayName
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'RD';

  // Close dropdown on click outside or escape key
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setIsDropdownOpen(false);
      }
    }

    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isDropdownOpen]);

  const handleSelectEdition = (edition) => {
    if (setEditionById) {
      setEditionById(edition.id);
    } else {
      setSelectedEdition(edition);
    }
    setIsDropdownOpen(false);
  };

  return (
    <header className="sticky top-0 z-30 bg-[#faf7f2]/92 backdrop-blur-md border-b border-[#eae4d9] transition-all">
      {/* Top Thin Issue Dateline Strip */}
      <div className="hidden sm:block border-b border-[#f0eae0] py-1 bg-[#f7f2e8]/60 text-[10px] font-mono text-[#78716c]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 flex justify-between items-center">
          <span>THE DAILY VOICE • THE NEWSPAPER AUDIOBOOK PLATFORM</span>
          <span>ESTABLISHED 2026 • AUDIO ACCESSIBILITY INITIATIVE</span>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-2">
        {/* Brand Masthead */}
        <Link to="/" className="flex items-center space-x-2.5 sm:space-x-3 group shrink-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#1c1917] to-[#292524] text-[#faf7f2] flex items-center justify-center shadow-md group-hover:from-[#9a3412] group-hover:to-[#7c2d12] transition-all duration-300">
            <Radio className="w-5 h-5 text-[#ea580c] group-hover:text-white transition-colors" />
          </div>
          <div className="flex flex-col">
            <span className="font-serif font-black text-lg sm:text-2xl tracking-tight text-[#1c1917] leading-tight">
              The Daily Voice
            </span>
            <span className="text-[9px] sm:text-[10px] uppercase font-mono tracking-wider text-[#9a3412] -mt-0.5 font-semibold">
              Newspaper to Audiobook
            </span>
          </div>
        </Link>

        {/* Interactive Header Edition Selector Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setIsDropdownOpen((prev) => !prev)}
            aria-expanded={isDropdownOpen}
            aria-haspopup="listbox"
            aria-label="Select newspaper edition"
            className={`flex items-center space-x-1.5 sm:space-x-2 text-xs py-1.5 px-2.5 sm:px-3.5 rounded-full border transition-all duration-200 cursor-pointer ${
              isDropdownOpen
                ? 'bg-[#fbeee6] border-[#9a3412] text-[#9a3412] shadow-sm'
                : 'bg-white/90 border-[#eae4d9] text-[#78716c] hover:border-[#c5bdaf] hover:text-[#1c1917] shadow-xs'
            }`}
          >
            <Newspaper className="w-3.5 h-3.5 text-[#9a3412] shrink-0" />
            <div className="flex flex-col text-left">
              <span className="font-serif font-bold text-[#1c1917] text-xs leading-none truncate max-w-[130px] sm:max-w-[180px]">
                {selectedEdition?.name || 'No Newspaper Loaded'}
              </span>
              <span className="font-mono text-[10px] text-[#8c827a] leading-tight hidden sm:inline">
                {selectedEdition?.editionFormatted || (selectedEdition ? `${selectedEdition.editionCode || 'ED001'} — ${selectedEdition.date}` : 'Scan QR or upload PDF')}
              </span>
            </div>
            <ChevronDown
              className={`w-3.5 h-3.5 text-[#78716c] transition-transform duration-200 ${
                isDropdownOpen ? 'rotate-180 text-[#9a3412]' : ''
              }`}
            />
          </button>

          {/* Dropdown Menu Panel */}
          {isDropdownOpen && (
            <div
              role="listbox"
              aria-label="Available newspaper editions"
              className="absolute left-1/2 -translate-x-1/2 sm:left-auto sm:right-0 sm:translate-x-0 mt-2 w-72 sm:w-84 bg-white rounded-2xl shadow-xl border border-[#eae4d9] p-2 z-50 animate-in fade-in zoom-in-95 duration-150"
            >
              <div className="px-3 py-2 border-b border-[#f3ece2] mb-1">
                <span className="text-[10px] font-mono uppercase tracking-wider font-bold text-[#9a3412]">
                  Newspaper Editions
                </span>
                <p className="text-[11px] text-[#78716c] font-serif">
                  Select an issue to update headlines and articles across the application.
                </p>
              </div>

              <div className="space-y-1">
                {allEditions.length === 0 ? (
                  <div className="p-4 text-center">
                    <div className="w-10 h-10 rounded-full bg-[#f3ece2] text-[#9a3412] flex items-center justify-center mx-auto mb-2">
                      <Newspaper className="w-5 h-5" />
                    </div>
                    <p className="font-serif font-semibold text-sm text-[#1c1917]">No Newspapers Added Yet</p>
                    <p className="font-sans text-xs text-[#78716c] mt-1 leading-relaxed">
                      Scan a newspaper QR code or upload a broadsheet PDF to add an edition.
                    </p>
                  </div>
                ) : (
                  allEditions.map((edition) => {
                  const isSelected = selectedEdition?.id === edition.id;
                  const formattedIdentifier =
                    edition.editionFormatted ||
                    `${edition.editionCode || 'ED001'} — ${edition.shortDate || edition.date}`;

                  return (
                    <button
                      key={edition.id}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => handleSelectEdition(edition)}
                      className={`w-full text-left p-2.5 rounded-xl transition-all duration-150 flex items-start justify-between cursor-pointer group ${
                        isSelected
                          ? 'bg-[#fbeee6] text-[#9a3412] font-semibold border border-[#ea580c]/20'
                          : 'hover:bg-[#faf7f2] text-[#44403c] border border-transparent'
                      }`}
                    >
                      <div className="flex items-start space-x-2.5 min-w-0 flex-1">
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 text-xs transition-colors ${
                            isSelected
                              ? 'bg-[#ea580c] text-white'
                              : 'bg-[#f3ece2] text-[#78716c] group-hover:text-[#1c1917]'
                          }`}
                        >
                          <Newspaper className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className={`font-serif text-sm leading-snug truncate ${isSelected ? 'text-[#9a3412] font-bold' : 'text-[#1c1917]'}`}>
                            {edition.name}
                          </p>
                          <p className="font-mono text-[11px] text-[#78716c] mt-0.5">
                            {formattedIdentifier}
                          </p>
                          <span className="inline-block mt-1 text-[10px] font-mono text-[#a8a29e]">
                            {edition.articleCount} articles • {edition.location || 'Broadsheet'}
                          </span>
                        </div>
                      </div>

                      {isSelected && (
                        <div className="shrink-0 ml-2 mt-1 w-5 h-5 rounded-full bg-[#9a3412] text-white flex items-center justify-center shadow-xs">
                          <Check className="w-3 h-3 stroke-[3]" />
                        </div>
                      )}
                    </button>
                  );
                })
                )}
              </div>
            </div>
          )}
        </div>

        {/* Quick Actions (Diagnostics & Profile) */}
        <div className="flex items-center space-x-1.5 sm:space-x-2 shrink-0">
          <Link
            to="/diagnostics"
            title="Phase 1 Backend API Monitor"
            className="p-2 text-[#78716c] hover:text-[#9a3412] rounded-xl hover:bg-[#f3ece2] transition-colors"
          >
            <Activity className="w-4 h-4" />
          </Link>
          <Link
            to="/profile"
            className={`flex items-center space-x-2 p-1.5 sm:px-3 sm:py-1.5 rounded-xl text-xs font-medium transition-all ${
              location.pathname === '/profile'
                ? 'bg-[#1c1917] text-white shadow-xs'
                : 'text-[#1c1917] hover:bg-[#f3ece2]'
            }`}
          >
            <div className="w-6 h-6 rounded-full bg-[#f3ece2] text-[#9a3412] flex items-center justify-center text-xs font-serif font-bold">
              {initials}
            </div>
            <span className="hidden sm:inline font-sans font-semibold truncate max-w-[100px]">
              {displayName.split(' ')[0]}
            </span>
          </Link>
        </div>
      </div>
    </header>
  );
}
