import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { auth, testFirestoreConnection } from './lib/firebase';
import { syncUserProfile, subscribeToUserEntries } from './lib/firestoreService';
import { JournalEntry, UserProfile } from './types';
import LandingPage from './components/LandingPage';
import DashboardHeader from './components/DashboardHeader';
import JournalChat from './components/JournalChat';
import JournalHistory from './components/JournalHistory';
import { MessageSquare, Clock, AlertTriangle } from 'lucide-react';

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [firestoreReady, setFirestoreReady] = useState(true);
  const [activeTopic, setActiveTopic] = useState<string>('');
  const [activeMobileTab, setActiveMobileTab] = useState<'chat' | 'history'>('chat');
  const [historyError, setHistoryError] = useState<string | null>(null);

  // Initialize and verify Firestore on boot
  useEffect(() => {
    let isMounted = true;
    testFirestoreConnection().then((connected) => {
      if (isMounted) {
        setFirestoreReady(connected);
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  // Listen to Firebase Authentication state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          const synced = await syncUserProfile(currentUser);
          setProfile(synced);
        } catch (err) {
          console.error('Failed to sync user profile:', err);
        }
      } else {
        setProfile(null);
        setEntries([]);
      }
      setLoadingAuth(false);
    });

    return () => unsubscribe();
  }, []);

  // Real-time Firestore subscription for authenticated user's entries
  useEffect(() => {
    if (!user) {
      setEntries([]);
      return;
    }

    setHistoryError(null);
    const unsubscribe = subscribeToUserEntries(
      user.uid,
      (fetchedEntries) => {
        setEntries(fetchedEntries);
        setFirestoreReady(true);
        setHistoryError(null);
      },
      (error) => {
        console.error('Firestore subscription error:', error);
        // Only set error if not recovering offline
        if (!error.message.includes('offline')) {
          setHistoryError('Could not sync with Firestore backend.');
        }
      }
    );

    return () => unsubscribe();
  }, [user]);

  // Initial loading view
  if (loadingAuth) {
    return (
      <div className="h-screen w-full bg-slate-50 flex flex-col items-center justify-center p-6 text-slate-900 font-sans">
        <div className="w-10 h-10 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
          Loading secure session...
        </p>
      </div>
    );
  }

  // Not signed in: Show Landing Page
  if (!user) {
    return <LandingPage />;
  }

  // Private Dashboard with Professional Polish Theme
  return (
    <div className="flex flex-col h-screen w-full bg-slate-50 font-sans text-slate-900 overflow-hidden">
      {/* Top Navbar */}
      <DashboardHeader user={user} profile={profile} entryCount={entries.length} />

      {/* Connectivity or Subscription Warning Banner if any */}
      {(!firestoreReady || historyError) && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-xs text-amber-900 flex items-center justify-center gap-2 shrink-0">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
          <span>{historyError || 'Firestore is connecting or running with restricted offline cache.'}</span>
        </div>
      )}

      {/* Mobile Tab Switcher */}
      <div className="md:hidden flex items-center bg-white border-b border-slate-200 px-3 py-2 shrink-0">
        <button
          onClick={() => setActiveMobileTab('history')}
          className={`flex-1 py-1.5 text-xs font-semibold rounded-md flex items-center justify-center gap-1.5 transition ${
            activeMobileTab === 'history'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>History ({entries.length})</span>
        </button>
        <button
          onClick={() => setActiveMobileTab('chat')}
          className={`flex-1 py-1.5 text-xs font-semibold rounded-md flex items-center justify-center gap-1.5 transition ${
            activeMobileTab === 'chat'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5" />
          <span>Active Journal</span>
        </button>
      </div>

      {/* Main Container: Aside + Chat */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Left Aside: History */}
        <div
          className={`h-full ${
            activeMobileTab === 'history' ? 'w-full block' : 'hidden md:block md:w-80'
          }`}
        >
          <JournalHistory
            userId={user.uid}
            entries={entries}
            onNewEntry={() => {
              setActiveTopic('');
              setActiveMobileTab('chat');
            }}
            onSelectTopic={(topic) => {
              setActiveTopic(topic);
              setActiveMobileTab('chat');
            }}
          />
        </div>

        {/* Right Main: Active Journal & Gemini Dialogue */}
        <div
          className={`flex-1 h-full ${
            activeMobileTab === 'chat' ? 'flex flex-col' : 'hidden md:flex md:flex-col'
          }`}
        >
          <JournalChat
            userId={user.uid}
            entries={entries}
            activeTopic={activeTopic}
            onTopicChange={(newTopic) => setActiveTopic(newTopic)}
          />
        </div>
      </div>
    </div>
  );
}
