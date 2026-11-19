import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Radio, Mail, Lock, User, ArrowRight, AlertCircle, CheckCircle2, Sparkles, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function LoginSignup() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, signup } = useAuth();

  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const targetPath = location.state?.from?.pathname || '/';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (!email || !email.includes('@')) {
      setError('Please enter a valid broadsheet subscriber email.');
      return;
    }

    if (!password || password.length < 6) {
      setError('Password must contain at least 6 characters.');
      return;
    }

    if (isSignUp && !fullName.trim()) {
      setError('Please enter your full reader name.');
      return;
    }

    setLoading(true);

    try {
      if (isSignUp) {
        const { error: signUpError } = await signup(email, password, fullName);
        if (signUpError) {
          setError(signUpError.message || 'Subscription creation failed. Please try again.');
          return;
        }
        setSuccessMsg('Account created! Opening edition...');
      } else {
        const { error: signInError } = await login(email, password);
        if (signInError) {
          setError(signInError.message || 'Authentication failed. Please check credentials.');
          return;
        }
        setSuccessMsg('Authenticated! Opening edition...');
      }

      setTimeout(() => {
        navigate(targetPath, { replace: true });
      }, 500);
    } catch (err) {
      setError(err.message || 'An unexpected error occurred during authentication.');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setError('');
    setLoading(true);
    try {
      const demoEmail = 'reader@dailyvoice.com';
      const demoPassword = 'Subscriber2026!';
      const { error: demoError } = await login(demoEmail, demoPassword);
      if (demoError) {
        setError(demoError.message || 'Unable to log into demo account.');
        return;
      }
      setSuccessMsg('Demo session active! Opening edition...');
      setTimeout(() => {
        navigate(targetPath, { replace: true });
      }, 400);
    } catch (err) {
      setError('Failed to initiate demo session.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#faf7f2] flex flex-col justify-center items-center p-4">
      {/* Brand Header */}
      <div className="text-center mb-8">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#1c1917] to-[#2e2a27] text-[#faf7f2] flex items-center justify-center mx-auto mb-3.5 shadow-lg">
          <Radio className="w-7 h-7 text-[#9a3412]" />
        </div>
        <h1 className="font-serif font-black text-3xl sm:text-4xl tracking-tight text-[#1c1917]">
          The Daily Voice
        </h1>
        <p className="text-xs sm:text-sm text-[#78716c] font-serif mt-1 italic">
          The Audio Broadsheet
        </p>
      </div>

      {/* Main Authentication Card */}
      <div className="bg-white w-full max-w-md rounded-3xl border border-[#eae4d9] shadow-[0_16px_40px_rgba(28,25,23,0.06)] p-7 sm:p-9">
        <div className="text-center mb-6">
          <h2 className="font-serif font-bold text-2xl text-[#1c1917]">
            {isSignUp ? 'Create Account' : 'Sign In'}
          </h2>
        </div>

        {error && (
          <div className="mb-4 p-3.5 bg-rose-50 border border-rose-200 rounded-2xl flex items-start space-x-2.5 text-rose-800 text-xs animate-in fade-in">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="mb-4 p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center space-x-2.5 text-emerald-800 text-xs animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {isSignUp && (
            <div>
              <label className="block text-xs font-mono font-medium text-[#44403c] mb-1">
                Full Reader Name
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-[#a8a29e] absolute left-3.5 top-3.5" />
                <input
                  type="text"
                  placeholder="e.g. Sarah Jenkins"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full pl-10 pr-3.5 py-3 bg-[#faf7f2] border border-[#eae4d9] rounded-2xl text-xs sm:text-sm text-[#1c1917] placeholder-[#a8a29e] focus:outline-none focus:border-[#9a3412]"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-mono font-medium text-[#44403c] mb-1">
              Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-[#a8a29e] absolute left-3.5 top-3.5" />
              <input
                type="email"
                placeholder="reader@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-3.5 py-3 bg-[#faf7f2] border border-[#eae4d9] rounded-2xl text-xs sm:text-sm text-[#1c1917] placeholder-[#a8a29e] focus:outline-none focus:border-[#9a3412]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-mono font-medium text-[#44403c] mb-1">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-[#a8a29e] absolute left-3.5 top-3.5" />
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-3.5 py-3 bg-[#faf7f2] border border-[#eae4d9] rounded-2xl text-xs sm:text-sm text-[#1c1917] placeholder-[#a8a29e] focus:outline-none focus:border-[#9a3412]"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-gradient-to-r from-[#9a3412] to-[#c2410c] hover:from-[#7c2d12] hover:to-[#9a3412] disabled:opacity-50 text-white rounded-2xl text-xs sm:text-sm font-semibold shadow-md transition-all flex items-center justify-center space-x-2 cursor-pointer mt-2 active:scale-95"
          >
            <span>{loading ? 'Authenticating...' : isSignUp ? 'Create Subscription' : 'Sign In'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {/* Quick Demo Login Option */}
        <div className="mt-5 pt-5 border-t border-[#f3ece2] text-center">
          <button
            type="button"
            onClick={handleDemoLogin}
            className="text-xs font-mono font-semibold text-[#9a3412] hover:underline cursor-pointer"
          >
            Demo Reader Login
          </button>
        </div>

        {/* Toggle Sign Up / Sign In */}
        <div className="mt-6 text-center text-xs text-[#78716c]">
          <span>{isSignUp ? 'Already have an account?' : "New broadsheet subscriber?"} </span>
          <button
            type="button"
            onClick={() => {
              setIsSignUp(!isSignUp);
              setError('');
            }}
            className="font-bold text-[#1c1917] hover:text-[#9a3412] underline ml-1 cursor-pointer"
          >
            {isSignUp ? 'Sign in' : 'Create an account'}
          </button>
        </div>
      </div>
    </div>
  );
}
