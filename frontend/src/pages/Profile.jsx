import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  User,
  Settings,
  Volume2,
  Sliders,
  Languages,
  Activity,
  LogOut,
  Shield,
  HelpCircle,
  CheckCircle2,
  Gauge,
  Sparkles,
} from 'lucide-react';
import { useAudio } from '../context/AudioContext';
import { useAuth } from '../context/AuthContext';
import { getUserDisplayName } from '../utils/greeting';

export default function Profile() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { playbackSpeed, setPlaybackSpeed, language, setLanguage } = useAudio();

  const [autoPlayNext, setAutoPlayNext] = useState(true);
  const [voiceModel, setVoiceModel] = useState('natural-editorial');
  const [savedNotice, setSavedNotice] = useState('');

  const displayName = getUserDisplayName(user);
  const initials = displayName
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'RD';

  const handleSavePreferences = () => {
    setSavedNotice('Reader preferences updated successfully.');
    setTimeout(() => setSavedNotice(''), 2500);
  };

  const handleSignOut = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <section className="bg-white rounded-[20px] border border-[#eae4d9] p-6 sm:p-8 shadow-[0_4px_20px_rgba(28,25,23,0.04)]">
        <h1 className="font-serif font-black text-3xl sm:text-4xl text-[#1c1917] tracking-tight">
          Settings
        </h1>
      </section>

      {/* User Profile Summary Card */}
      <section className="p-6 sm:p-7 bg-white rounded-[20px] border border-[#eae4d9] shadow-[0_4px_20px_rgba(28,25,23,0.04)] flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#f3ece2] to-[#e7dfd1] border border-[#eae4d9] text-[#9a3412] flex items-center justify-center font-serif text-2xl font-bold shadow-xs">
            {initials}
          </div>
          <div>
            <h2 className="font-serif font-black text-xl text-[#1c1917]">
              {displayName}
            </h2>
            <p className="text-xs font-mono text-[#5c534a]">
              {user?.email || 'subscriber@dailyvoice.com'}
            </p>
            <span className="inline-block mt-1.5 text-xs font-mono uppercase px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold">
              Verified Subscriber • Digital Broadside
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleSignOut}
          className="flex items-center space-x-1.5 px-3 py-2 text-xs font-mono font-medium text-[#5c534a] hover:text-rose-700 hover:bg-rose-50 rounded-2xl transition-all border border-transparent hover:border-rose-200 cursor-pointer"
          title="Sign Out of The Daily Voice"
        >
          <LogOut className="w-4 h-4" />
          <span className="hidden sm:inline">Sign Out</span>
        </button>
      </section>

      {savedNotice && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-[20px] text-xs font-medium flex items-center space-x-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{savedNotice}</span>
        </div>
      )}

      {/* Audio Narration Preferences */}
      <section className="bg-white rounded-[20px] border border-[#eae4d9] p-6 sm:p-8 space-y-6 shadow-[0_4px_20px_rgba(28,25,23,0.04)]">
        <div className="border-b border-[#eae4d9] pb-4">
          <h3 className="font-serif font-bold text-lg text-[#1c1917]">
            Audio Narration Engine
          </h3>
          <p className="text-xs text-[#5c534a] font-mono mt-0.5">
            Default voice, speed, and prosody parameters across broadsheet editions
          </p>
        </div>

        <div className="space-y-5">
          {/* Default Playback Speed */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <span className="text-sm font-semibold text-[#1c1917] block font-serif">
                Default Playback Speed
              </span>
              <span className="text-xs text-[#5c534a] font-mono">
                Selected default: {playbackSpeed}x normal speed
              </span>
            </div>
            <select
              value={String(Number(playbackSpeed))}
              onChange={(e) => setPlaybackSpeed(parseFloat(e.target.value))}
              className="py-2 px-3.5 bg-[#faf7f2] border border-[#eae4d9] rounded-xl text-xs font-mono text-[#1c1917] focus:outline-none focus:border-[#9a3412] cursor-pointer"
            >
              <option value="0.75">0.75x (Relaxed)</option>
              <option value="1">1.0x (Standard)</option>
              <option value="1.25">1.25x (Recommended)</option>
              <option value="1.5">1.5x (Brisk)</option>
              <option value="2">2.0x (Rapid)</option>
            </select>
          </div>

          {/* Default Language */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-4 border-t border-[#f3ece2]">
            <div>
              <span className="text-sm font-semibold text-[#1c1917] block font-serif">
                Narration Language
              </span>
              <span className="text-xs text-[#5c534a] font-mono">
                Voice synthesis locale and translation
              </span>
            </div>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="py-2 px-3.5 bg-[#faf7f2] border border-[#eae4d9] rounded-xl text-xs font-mono text-[#1c1917] focus:outline-none focus:border-[#9a3412] cursor-pointer"
            >
              <option value="English">English (Original Broadsheet)</option>
              <option value="Spanish">Spanish (Español)</option>
              <option value="French">French (Français)</option>
              <option value="Hindi">Hindi (हिंदी)</option>
              <option value="German">German (Deutsch)</option>
            </select>
          </div>

          {/* Voice Model Style */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-4 border-t border-[#f3ece2]">
            <div>
              <span className="text-sm font-semibold text-[#1c1917] block font-serif">
                Editorial Voice Model
              </span>
              <span className="text-xs text-[#5c534a] font-mono">
                TTS vocal timbre and inflection style
              </span>
            </div>
            <select
              value={voiceModel}
              onChange={(e) => setVoiceModel(e.target.value)}
              className="py-2 px-3.5 bg-[#faf7f2] border border-[#eae4d9] rounded-xl text-xs font-serif text-[#1c1917] focus:outline-none focus:border-[#9a3412] cursor-pointer"
            >
              <option value="natural-editorial">Natural Broadsheet Editorial (Default)</option>
              <option value="warm-evening">Warm Evening Radio</option>
              <option value="documentary-crisp">Documentary Formal</option>
            </select>
          </div>

          {/* Auto-Play Toggle */}
          <div className="flex items-center justify-between pt-4 border-t border-[#f3ece2]">
            <div>
              <span className="text-sm font-semibold text-[#1c1917] block font-serif">
                Continuous Section Narration
              </span>
              <span className="text-xs text-[#5c534a] font-mono">
                Automatically proceed to the next story in the section
              </span>
            </div>
            <input
              type="checkbox"
              checked={autoPlayNext}
              onChange={(e) => setAutoPlayNext(e.target.checked)}
              className="w-4 h-4 text-[#9a3412] accent-[#9a3412] rounded cursor-pointer"
            />
          </div>
        </div>

        <button
          type="button"
          onClick={handleSavePreferences}
          className="w-full py-3 bg-[#9a3412] hover:bg-[#7c2d12] text-white rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer"
        >
          Save Narration Preferences
        </button>
      </section>

      {/* Account Session Actions */}
      <section className="p-6 bg-white rounded-[20px] border border-[#eae4d9] flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-[0_4px_20px_rgba(28,25,23,0.04)]">
        <div>
          <h4 className="font-serif font-bold text-base text-[#1c1917]">
            Subscriber Session
          </h4>
          <p className="text-xs font-mono text-[#5c534a] mt-0.5">
            Signed in as <span className="font-semibold text-[#1c1917]">{user?.email || 'subscriber@dailyvoice.com'}</span>
          </p>
        </div>
        <button
          type="button"
          onClick={handleSignOut}
          className="px-4 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 text-xs font-mono font-semibold rounded-xl transition-colors flex items-center justify-center space-x-2 cursor-pointer"
        >
          <LogOut className="w-4 h-4 text-rose-600" />
          <span>Sign Out / End Session</span>
        </button>
      </section>

      {/* Backend Diagnostics Link Card */}
      <section className="p-6 bg-white rounded-[20px] border border-[#eae4d9] flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-[0_4px_20px_rgba(28,25,23,0.04)]">
        <div className="flex items-center space-x-3.5">
          <div className="p-3 bg-[#fbeee6] rounded-2xl text-[#9a3412]">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-serif font-bold text-base text-[#1c1917]">
              Backend API Diagnostics
            </h4>
            <p className="text-xs font-mono text-[#5c534a]">
              Check Flask server connectivity, database health, and JWT verification
            </p>
          </div>
        </div>
        <Link
          to="/diagnostics"
          className="px-4 py-2 bg-[#1c1917] hover:bg-[#2e2a27] text-white text-xs font-semibold rounded-xl transition-colors text-center"
        >
          Open Diagnostics
        </Link>
      </section>

      {/* Editorial Footer Info */}
      <div className="text-center text-xs font-mono text-[#5c534a] pb-6 space-y-1">
        <p>The Daily Voice — Broadsheet Audio Platform</p>
        <p>Built for thoughtful newspaper listening</p>
      </div>
    </div>
  );
}
