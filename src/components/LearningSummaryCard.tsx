import React from 'react';
import ReactMarkdown from 'react-markdown';
import {
  BookOpen,
  RotateCcw,
  CalendarCheck,
  Sparkles,
  ShieldCheck,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import { LearningSummary } from '../types';

interface LearningSummaryCardProps {
  summary: LearningSummary | null;
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
  userId: string;
  cooldownSeconds?: number;
}

export default function LearningSummaryCard({
  summary,
  isLoading,
  error,
  onRetry,
  userId,
  cooldownSeconds = 0,
}: LearningSummaryCardProps) {
  if (isLoading) {
    return (
      <div
        id="learning-summary-loading"
        className="w-full bg-white border border-indigo-200/80 rounded-2xl p-6 sm:p-7 shadow-xs mt-4 relative overflow-hidden"
      >
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-indigo-600 to-indigo-700 animate-pulse" />
        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-2xs">
            <RefreshCw className="w-4 h-4 animate-spin text-indigo-600" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              Synthesizing Learning Takeaways & Next Action
            </h4>
            <p className="text-xs text-slate-500 mt-0.5">
              Gemini 3.8 is analyzing your journal entries and reflections...
            </p>
          </div>
        </div>

        <div className="space-y-4 animate-pulse">
          <div className="h-16 bg-slate-100 rounded-xl" />
          <div className="h-14 bg-amber-50/70 border border-amber-100/60 rounded-xl" />
          <div className="h-14 bg-emerald-50/70 border border-emerald-100/60 rounded-xl" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        id="learning-summary-error"
        className="w-full bg-amber-50/90 border border-amber-200 rounded-2xl p-5 sm:p-6 shadow-xs mt-4"
      >
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="text-sm font-bold text-amber-950">
              Unable to generate learning summary
            </h4>
            <p className="text-xs text-amber-800 mt-1 leading-relaxed">
              {error}
            </p>
            <div className="mt-3 flex items-center gap-2">
              <button
                id="retry-summary-btn"
                onClick={onRetry}
                disabled={Boolean(cooldownSeconds && cooldownSeconds > 0)}
                className="text-xs font-semibold px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 active:scale-98 transition flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${cooldownSeconds > 0 ? 'animate-spin' : ''}`} />
                <span>
                  {cooldownSeconds > 0
                    ? `Retry available in ${cooldownSeconds}s`
                    : 'Retry Summary Generation'}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!summary) {
    return null;
  }

  const formattedDate = new Date(summary.timestamp).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div
      id="learning-summary-card"
      className="w-full bg-white border border-indigo-100 rounded-2xl shadow-xs overflow-hidden mt-6 transition-all"
    >
      {/* Top Accent Strip */}
      <div className="h-1 bg-gradient-to-r from-indigo-500 via-indigo-600 to-indigo-700" />

      {/* Card Header */}
      <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/60 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-xs">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900 tracking-tight">
                Summarised Learning & Next Action
              </h3>
              {summary.topic && (
                <span className="px-2 py-0.5 rounded-full bg-white border border-slate-200 text-slate-600 text-[10px] font-semibold">
                  {summary.topic}
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Synthesized from your recent reflections • {formattedDate}
            </p>
          </div>
        </div>

        <button
          id="regenerate-summary-btn"
          onClick={onRetry}
          title="Re-run summary with updated notes"
          className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg border border-indigo-200/70 flex items-center gap-1.5 transition cursor-pointer"
        >
          <RefreshCw className="w-3 h-3" />
          <span>Update Summary</span>
        </button>
      </div>

      {/* Card Content with the Exactly 3 Required Sections */}
      <div className="p-6 sm:p-7 space-y-6">
        {/* Section 1: Learning Summary */}
        <div id="section-learning-summary" className="space-y-2">
          <div className="flex items-center gap-2 text-indigo-900 font-bold text-xs uppercase tracking-wider">
            <div className="w-6 h-6 rounded-md bg-indigo-50 flex items-center justify-center text-indigo-600 border border-indigo-100">
              <BookOpen className="w-3.5 h-3.5" />
            </div>
            <span>Learning Summary</span>
          </div>
          <div className="bg-slate-50/70 border border-slate-200/80 rounded-xl p-4 sm:p-5 text-sm text-slate-800 leading-relaxed prose prose-slate max-w-none">
            <ReactMarkdown>{summary.learningSummary}</ReactMarkdown>
          </div>
        </div>

        {/* Section 2: Concept to Revise */}
        <div id="section-concept-to-revise" className="space-y-2">
          <div className="flex items-center gap-2 text-amber-900 font-bold text-xs uppercase tracking-wider">
            <div className="w-6 h-6 rounded-md bg-amber-50 flex items-center justify-center text-amber-600 border border-amber-100">
              <RotateCcw className="w-3.5 h-3.5" />
            </div>
            <span>Concept to Revise</span>
          </div>
          <div className="bg-amber-50/50 border border-amber-200/70 rounded-xl p-4 sm:p-5 text-sm text-slate-800 leading-relaxed prose prose-slate max-w-none">
            <ReactMarkdown>{summary.conceptToRevise}</ReactMarkdown>
          </div>
        </div>

        {/* Section 3: Next Action for Tomorrow */}
        <div id="section-next-action-tomorrow" className="space-y-2">
          <div className="flex items-center gap-2 text-emerald-900 font-bold text-xs uppercase tracking-wider">
            <div className="w-6 h-6 rounded-md bg-emerald-50 flex items-center justify-center text-emerald-600 border border-emerald-100">
              <CalendarCheck className="w-3.5 h-3.5" />
            </div>
            <span>Next Action for Tomorrow</span>
          </div>
          <div className="bg-emerald-50/50 border border-emerald-200/70 rounded-xl p-4 sm:p-5 text-sm text-slate-800 leading-relaxed prose prose-slate max-w-none">
            <ReactMarkdown>{summary.nextAction}</ReactMarkdown>
          </div>
        </div>
      </div>

      {/* Security and Privacy Card Footer */}
      <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
        <div className="flex items-center gap-1.5 text-slate-600 font-medium">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          <span>Privately stored in Firestore silo</span>
        </div>
        <span className="font-mono text-[10px] text-slate-400">UID: {userId.substring(0, 8)}...</span>
      </div>
    </div>
  );
}
