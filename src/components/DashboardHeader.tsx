import React from 'react';
import { signOut, User as FirebaseUser } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { BookOpen, LogOut, ShieldCheck } from 'lucide-react';
import { UserProfile } from '../types';

interface DashboardHeaderProps {
  user: FirebaseUser;
  profile: UserProfile | null;
  entryCount: number;
}

export default function DashboardHeader({ user, profile, entryCount }: DashboardHeaderProps) {
  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error('Sign-out error:', err);
    }
  };

  const displayName = profile?.displayName || user.displayName || 'Learner';
  const email = profile?.email || user.email || '';
  const photoURL = profile?.photoURL || user.photoURL;
  const initials = (displayName || 'User')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  return (
    <nav className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 sm:px-8 shrink-0 shadow-xs z-20">
      {/* Brand */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-xs">
          <BookOpen className="w-5 h-5 text-white" />
        </div>
        <span className="font-bold text-lg tracking-tight text-slate-900">
          GenAI Learning Journal
        </span>
      </div>

      {/* User Info & Actions */}
      <div className="flex items-center gap-3 sm:gap-4">
        <div className="text-right hidden sm:block">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            Authenticated User
          </p>
          <p className="text-sm font-medium text-slate-800 leading-tight">
            {email || displayName}
          </p>
        </div>

        {photoURL ? (
          <img
            src={photoURL}
            alt={displayName}
            referrerPolicy="no-referrer"
            className="w-10 h-10 rounded-full object-cover border-2 border-indigo-200 shadow-xs"
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-indigo-100 border-2 border-indigo-200 flex items-center justify-center text-indigo-700 font-bold text-sm shadow-xs">
            {initials}
          </div>
        )}

        <button
          id="signout-btn"
          onClick={handleSignOut}
          title="Sign out of your account"
          className="ml-1 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </div>
    </nav>
  );
}
