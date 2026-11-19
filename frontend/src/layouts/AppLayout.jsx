import React from 'react';
import { Outlet } from 'react-router-dom';
import Header from '../components/Header';
import BottomNav from '../components/BottomNav';
import MiniPlayer from '../components/MiniPlayer';
import FullAudioPlayer from '../components/FullAudioPlayer';
import { useAudio } from '../context/AudioContext';

export default function AppLayout() {
  const { currentArticle, isMiniPlayerDismissed } = useAudio();
  const isMiniPlayerActive = Boolean(currentArticle && !isMiniPlayerDismissed);

  return (
    <div className="min-h-screen bg-[#faf7f2] text-[#1c1917] flex flex-col selection:bg-[#fed7aa] selection:text-[#9a3412]">
      {/* Editorial Broadsheet Masthead Header */}
      <Header />

      {/* Main Viewport Container with Dynamic Bottom Padding Based on Player Visibility */}
      <main
        className={`flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-6 transition-all duration-300 ${
          isMiniPlayerActive ? 'pb-48 md:pb-36' : 'pb-24 md:pb-12'
        }`}
      >
        <Outlet />
      </main>

      {/* Persistent Audio Mini-Player (Positioned cleanly ABOVE BottomNav with no overlap) */}
      <MiniPlayer />

      {/* Full Listening Interface (Modal / Sheet) */}
      <FullAudioPlayer />

      {/* Primary Bottom Navigation Bar */}
      <BottomNav />
    </div>
  );
}
