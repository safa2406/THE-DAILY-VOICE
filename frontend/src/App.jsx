import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { EditionProvider } from './context/EditionContext';
import { AudioProvider } from './context/AudioContext';
import { LibraryProvider } from './context/LibraryContext';
import ProtectedRoute from './components/ProtectedRoute';
import PublicRoute from './components/PublicRoute';
import ScrollToTop from './components/ScrollToTop';
import AppLayout from './layouts/AppLayout';

// Screen Pages
import LoginSignup from './pages/LoginSignup';
import Home from './pages/Home';
import Edition from './pages/Edition';
import Categories from './pages/Categories';
import ArticleListen from './pages/ArticleListen';
import Dashboard from './pages/Dashboard';
import Library from './pages/Library';
import Profile from './pages/Profile';
import Phase1Health from './pages/Phase1Health';

function App() {
  return (
    <AuthProvider>
      <EditionProvider>
        <LibraryProvider>
          <AudioProvider>
            <Router>
              <ScrollToTop />
              <Routes>
                {/* Public Authentication Screen (redirects to Home if already authenticated) */}
                <Route element={<PublicRoute />}>
                  <Route path="/login" element={<LoginSignup />} />
                  <Route path="/signup" element={<LoginSignup />} />
                </Route>

                {/* Protected Application Routes (redirects unauthenticated visitors to /login) */}
                <Route element={<ProtectedRoute />}>
                  <Route element={<AppLayout />}>
                    <Route path="/" element={<Home />} />
                    <Route path="/edition" element={<Edition />} />
                    <Route path="/browse" element={<Categories />} />
                    <Route path="/categories" element={<Navigate to="/browse" replace />} />
                    <Route path="/listen" element={<ArticleListen />} />
                    <Route path="/listen/:articleId" element={<ArticleListen />} />
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/library" element={<Library />} />
                    <Route path="/profile" element={<Profile />} />
                    <Route path="/diagnostics" element={<Phase1Health />} />
                  </Route>
                </Route>

                {/* Fallback */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Router>
          </AudioProvider>
        </LibraryProvider>
      </EditionProvider>
    </AuthProvider>
  );
}

export default App;
