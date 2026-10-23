import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { BookOpen, Sparkles, LayoutDashboard, Target, LogOut, User } from 'lucide-react';

export default function Navbar() {
  const { user, isAuthenticated, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isActive = (path) => location.pathname === path;

  return (
    <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand Logo */}
        <Link to={isAuthenticated ? '/dashboard' : '/'} className="flex items-center gap-2.5 group">
          <div className="w-9 h-9 rounded-xl bg-linear-to-tr from-indigo-600 to-blue-500 flex items-center justify-center text-white shadow-sm shadow-indigo-200 group-hover:scale-105 transition-transform">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-lg text-slate-900 tracking-tight">QuizCraft</span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-sm bg-indigo-50 text-indigo-700 border border-indigo-200/60">
                AI
              </span>
            </div>
            <p className="text-[10px] text-slate-500 font-medium hidden sm:block">Notes-to-Question Practice</p>
          </div>
        </Link>

        {/* Center Navigation Links (Only for Authenticated Users) */}
        {isAuthenticated && (
          <nav className="hidden md:flex items-center gap-1 bg-slate-100/80 p-1 rounded-xl border border-slate-200/80 text-sm font-semibold">
            <Link
              to="/dashboard"
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg transition-colors ${
                isActive('/dashboard')
                  ? 'bg-white text-indigo-700 shadow-xs border border-slate-200/50'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              <span>Dashboard</span>
            </Link>

            <Link
              to="/create-quiz"
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg transition-colors ${
                isActive('/create-quiz')
                  ? 'bg-white text-indigo-700 shadow-xs border border-slate-200/50'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Sparkles className="w-4 h-4 text-indigo-500" />
              <span>Generate Quiz</span>
            </Link>

            <Link
              to="/weak-areas"
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg transition-colors ${
                isActive('/weak-areas')
                  ? 'bg-white text-indigo-700 shadow-xs border border-slate-200/50'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Target className="w-4 h-4 text-rose-500" />
              <span>Weak Areas</span>
            </Link>
          </nav>
        )}

        {/* Right Section: User Info or Auth Buttons */}
        <div className="flex items-center gap-3">
          {isAuthenticated ? (
            <div className="flex items-center gap-3">
              <Link
                to="/profile"
                className={`flex items-center gap-2.5 px-3 py-1.5 rounded-xl border transition-all cursor-pointer ${
                  isActive('/profile')
                    ? 'bg-indigo-50/80 border-indigo-200 text-indigo-900'
                    : 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-800'
                }`}
                title="Manage Student Profile"
              >
                <div className="w-7 h-7 rounded-lg overflow-hidden bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center justify-center shrink-0">
                  {user?.avatar_url ? (
                    <img src={user.avatar_url} alt="User Avatar" className="w-full h-full object-cover" />
                  ) : user?.name ? (
                    user.name.charAt(0).toUpperCase()
                  ) : (
                    <User className="w-4 h-4" />
                  )}
                </div>
                <div className="text-left hidden sm:block">
                  <div className="text-xs font-bold leading-tight">{user?.name}</div>
                  <div className="text-[10px] text-slate-500 max-w-[110px] truncate">Profile & Settings</div>
                </div>
              </Link>

              <button
                onClick={handleLogout}
                title="Log Out"
                className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-rose-600 bg-white hover:bg-rose-50 border border-slate-200 hover:border-rose-200 px-3 py-2 rounded-xl transition-all cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                to="/login"
                className="text-sm font-semibold text-slate-700 hover:text-indigo-600 px-3 py-2 rounded-lg transition-colors"
              >
                Sign In
              </Link>
              <Link
                to="/register"
                className="text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded-xl shadow-xs shadow-indigo-200 transition-colors"
              >
                Get Started
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
