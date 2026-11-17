import React from 'react';
import { NavLink } from 'react-router-dom';
import { Home, Compass, Bookmark, LayoutDashboard, User } from 'lucide-react';

export default function BottomNav() {
  const navItems = [
    { label: 'Home', path: '/', icon: Home },
    { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { label: 'Browse', path: '/browse', icon: Compass },
    { label: 'Library', path: '/library', icon: Bookmark },
    { label: 'Profile', path: '/profile', icon: User },
  ];

  return (
    <nav
      aria-label="Primary Navigation"
      className="fixed bottom-0 left-0 right-0 z-40 bg-[#faf7f2]/95 backdrop-blur-md border-t border-[#eae4d9] shadow-[0_-4px_20px_rgba(28,25,23,0.04)]"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="max-w-md md:max-w-2xl mx-auto flex items-center justify-around h-16 px-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center flex-1 h-full py-1.5 transition-all duration-200 relative group ${
                  isActive
                    ? 'text-[#9a3412] font-semibold'
                    : 'text-[#78716c] hover:text-[#1c1917]'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <div
                    className={`p-1 rounded-xl transition-all ${
                      isActive ? 'bg-[#fbeee6] text-[#9a3412]' : 'group-hover:bg-[#f3ece2]'
                    }`}
                  >
                    <Icon
                      className={`w-5 h-5 transition-transform ${
                        isActive ? 'scale-110 stroke-[2.3]' : 'stroke-[1.8]'
                      }`}
                    />
                  </div>
                  <span className="text-[11px] font-sans tracking-tight mt-0.5">
                    {item.label}
                  </span>
                  {isActive && (
                    <span className="absolute top-1.5 w-1 h-1 rounded-full bg-[#9a3412]" />
                  )}
                </>
              )}
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
