import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Radio, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#faf7f2] flex flex-col items-center justify-center p-4">
        <div className="text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-[#1c1917] text-[#faf7f2] flex items-center justify-center mx-auto shadow-md">
            <Radio className="w-7 h-7 text-[#ea580c]" />
          </div>
          <div>
            <h2 className="font-serif font-black text-xl text-[#1c1917]">The Daily Voice</h2>
            <p className="text-xs font-mono text-[#78716c] mt-1 flex items-center justify-center space-x-1.5">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-[#9a3412]" />
              <span>Verifying subscriber session...</span>
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    // Unauthenticated user -> redirect to Login immediately
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <Outlet />;
}
