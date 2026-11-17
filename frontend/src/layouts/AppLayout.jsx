import React from 'react';
import { Outlet } from 'react-router-dom';
import Header from '../components/Header';
import BottomNav from '../components/BottomNav';
import MiniPlayer from '../components/MiniPlayer';
import FullAudioPlayer from '../components/FullAudioPlayer';

export default function AppLayout() {
  return (
    <div className="min-h-screen bg-[#faf7f2] text-[#1c1917] flex flex-col selection:bg-[#fed7aa] selection:text-[#9a3412]">
      {/* Editorial Broadsheet Masthead Header */}
      <Header />

      {/* Main Viewport Container with Generous Bottom Padding to Guarantee Zero Obstruction */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-6 pb-52 md:pb-44 transition-all">
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
