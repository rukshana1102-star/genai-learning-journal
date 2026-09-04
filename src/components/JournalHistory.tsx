import React, { useState, useMemo } from 'react';
import { JournalEntry } from '../types';
import { Search, Trash2, Plus, Calendar, Tag } from 'lucide-react';
import { deleteJournalEntry } from '../lib/firestoreService';

interface JournalHistoryProps {
  userId: string;
  entries: JournalEntry[];
  onSelectTopic?: (topic: string) => void;
  onNewEntry?: () => void;
}

export default function JournalHistory({
  userId,
  entries,
  onSelectTopic,
  onNewEntry,
}: JournalHistoryProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTopic, setSelectedTopic] = useState<string>('all');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Extract unique topics
  const topics = useMemo(() => {
    const set = new Set<string>();
    entries.forEach((e) => {
      if (e.topic) set.add(e.topic);
    });
    return Array.from(set);
  }, [entries]);

  // Filter entries
  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      const matchesSearch =
        searchQuery.trim() === '' ||
        entry.text.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (entry.topic && entry.topic.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesTopic =
        selectedTopic === 'all' || entry.topic === selectedTopic;

      return matchesSearch && matchesTopic;
    });
  }, [entries, searchQuery, selectedTopic]);

  // Sort newest first
  const sortedEntries = useMemo(() => {
    return [...filteredEntries].sort((a, b) => b.timestamp - a.timestamp);
  }, [filteredEntries]);

  const handleDelete = async (e: React.MouseEvent, entryId: string) => {
    e.stopPropagation();
    if (!window.confirm('Delete this journal record?')) {
      return;
    }
    try {
      setDeletingId(entryId);
      setDeleteError(null);
      await deleteJournalEntry(userId, entryId);
    } catch (err: any) {
      console.error('Delete error:', err);
      setDeleteError(err?.message || 'Failed to delete record.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <aside className="w-full md:w-80 bg-slate-100 border-r border-slate-200 flex flex-col h-full shrink-0 select-none">
      {/* Top Action: New Entry */}
      <div className="p-4 sm:p-5 border-b border-slate-200">
        <button
          id="new-entry-btn"
          onClick={() => {
            if (onNewEntry) onNewEntry();
          }}
          className="w-full bg-white border border-slate-300 py-2.5 px-4 rounded-md text-sm font-semibold text-slate-700 shadow-xs flex items-center justify-center gap-2 hover:bg-slate-50 active:scale-98 transition cursor-pointer"
        >
          <Plus className="w-4 h-4 text-slate-500" />
          <span>New Entry</span>
        </button>
      </div>

      {/* Search & Topic Filters */}
      <div className="px-4 pt-3 pb-2 space-y-2 border-b border-slate-200/80">
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
          <input
            id="search-history-input"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search entries..."
            className="w-full text-xs pl-8 pr-3 py-1.5 bg-white border border-slate-300 rounded-md text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>

        {topics.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            <button
              onClick={() => setSelectedTopic('all')}
              className={`px-2 py-0.5 rounded text-[11px] font-medium shrink-0 transition ${
                selectedTopic === 'all'
                  ? 'bg-slate-800 text-white'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All
            </button>
            {topics.map((t) => (
              <button
                key={t}
                onClick={() => {
                  setSelectedTopic(t);
                  if (onSelectTopic) onSelectTopic(t);
                }}
                className={`px-2 py-0.5 rounded text-[11px] font-medium shrink-0 transition flex items-center gap-1 ${
                  selectedTopic === t
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <Tag className="w-2.5 h-2.5" />
                <span>{t}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {deleteError && (
        <div className="p-2.5 bg-rose-50 border-b border-rose-200 text-rose-700 text-xs">
          {deleteError}
        </div>
      )}

      {/* Recents List Header */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-2 mb-2">
          Recent Journals ({filteredEntries.length})
        </h3>

        {sortedEntries.length === 0 ? (
          <div className="h-44 flex flex-col items-center justify-center text-center p-4 text-slate-400">
            <Calendar className="w-6 h-6 mb-2 text-slate-300" />
            <p className="text-xs font-medium text-slate-500">
              {searchQuery ? 'No matching journals' : 'No journal history yet'}
            </p>
            <p className="text-[11px] text-slate-400 mt-1 max-w-[180px]">
              {searchQuery
                ? 'Try a different search term.'
                : 'Your notes and Gemini discussions will appear here.'}
            </p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {sortedEntries.map((item) => {
              const isUser = item.role === 'user';
              const dateStr = new Date(item.timestamp).toLocaleDateString([], {
                month: 'short',
                day: 'numeric',
              });
              const timeStr = new Date(item.timestamp).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              });

              return (
                <div
                  key={item.id}
                  onClick={() => {
                    if (item.topic && onSelectTopic) {
                      onSelectTopic(item.topic);
                    }
                  }}
                  className="bg-white p-3 rounded-lg border border-slate-200 shadow-2xs hover:border-slate-300 hover:shadow-xs cursor-pointer transition group relative"
                >
                  <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider ${
                        isUser ? 'text-slate-500' : 'text-indigo-600'
                      }`}
                    >
                      {isUser ? 'Your Entry' : 'Gemini Guidance'}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-slate-400">
                        {dateStr}, {timeStr}
                      </span>
                      <button
                        onClick={(e) => handleDelete(e, item.id)}
                        disabled={deletingId === item.id}
                        title="Delete journal item"
                        className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-rose-600 transition p-0.5 ml-1"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  <p className="text-sm font-semibold text-slate-800 line-clamp-1">
                    {item.topic || item.text}
                  </p>
                  <p className="text-xs text-slate-500 line-clamp-2 mt-0.5 leading-relaxed font-normal">
                    {item.text}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Sidebar Footer: Firestore Sync */}
      <div className="p-4 bg-slate-200/50 border-t border-slate-200 shrink-0">
        <div className="flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
            <span className="font-medium text-slate-600">Firestore Sync Active</span>
          </div>
          <span className="font-mono text-[10px] text-slate-400">
            UID: {userId.substring(0, 6)}...
          </span>
        </div>
      </div>
    </aside>
  );
}
