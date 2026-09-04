import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import {
  Sparkles,
  Send,
  AlertCircle,
  RefreshCw,
  Tag,
  ShieldCheck,
  BookOpenCheck,
} from 'lucide-react';
import { JournalEntry, LearningSummary } from '../types';
import {
  saveJournalEntry,
  subscribeToUserSummaries,
  saveLearningSummary,
} from '../lib/firestoreService';
import LearningSummaryCard from './LearningSummaryCard';

// Helper to safely parse JSON responses from backend endpoints
async function parseJsonResponse<T = any>(
  response: Response,
  fallbackError: string
): Promise<T> {
  const contentType = response.headers.get('content-type') || '';
  const isJson = contentType.toLowerCase().includes('application/json');

  if (!isJson) {
    const rawText = await response.text().catch(() => '');
    const isHtml =
      rawText.trim().toLowerCase().startsWith('<!doctype') ||
      rawText.trim().toLowerCase().startsWith('<html') ||
      rawText.trim().startsWith('<');

    if (isHtml) {
      throw new Error(
        'Gemini is temporarily busy or the server returned an unexpected response. Please try again in a few moments.'
      );
    }

    throw new Error(
      rawText.trim()
        ? `Server error (${response.status}): ${rawText.slice(0, 150)}`
        : fallbackError
    );
  }

  let data: any;
  try {
    data = await response.json();
  } catch {
    throw new Error('Unable to parse response from server. Please try again.');
  }

  if (!response.ok) {
    const message =
      data?.error ||
      data?.details ||
      data?.message ||
      `Request failed with status ${response.status}`;
    const err: any = new Error(typeof message === 'string' ? message : JSON.stringify(message));
    err.status = response.status;
    err.code = data?.code;
    const retryHeader = response.headers.get('Retry-After');
    err.retryAfter = data?.retryAfter ?? (retryHeader ? parseInt(retryHeader, 10) : undefined);
    throw err;
  }

  return data as T;
}

interface JournalChatProps {
  userId: string;
  entries: JournalEntry[];
  activeTopic?: string;
  onTopicChange?: (topic: string) => void;
}

export default function JournalChat({
  userId,
  entries,
  activeTopic = '',
  onTopicChange,
}: JournalChatProps) {
  const [inputText, setInputText] = useState('');
  const [topicInput, setTopicInput] = useState(activeTopic);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionStage, setSubmissionStage] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [userEntryPersisted, setUserEntryPersisted] = useState(false);
  const [lastPersistedText, setLastPersistedText] = useState('');

  // Summarise My Learning + Next Action State
  const [summaries, setSummaries] = useState<LearningSummary[]>([]);
  const [isSummarising, setIsSummarising] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [pendingSummaryId, setPendingSummaryId] = useState<string | null>(null);
  const [summaryCooldown, setSummaryCooldown] = useState<number>(0);
  const [chatCooldown, setChatCooldown] = useState<number>(0);

  // Timers to countdown retry delay when 429 quota/rate limits occur
  useEffect(() => {
    if (summaryCooldown <= 0) return;
    const timer = setInterval(() => {
      setSummaryCooldown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [summaryCooldown]);

  useEffect(() => {
    if (chatCooldown <= 0) return;
    const timer = setInterval(() => {
      setChatCooldown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [chatCooldown]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Real-time Firestore subscription to user's private summaries
  useEffect(() => {
    if (!userId) return;
    const unsubscribe = subscribeToUserSummaries(
      userId,
      (fetchedSummaries) => {
        setSummaries(fetchedSummaries);
      },
      (err) => {
        console.error('Failed to subscribe to summaries:', err);
      }
    );
    return () => unsubscribe();
  }, [userId]);

  // Sync topic input if external active topic changes
  useEffect(() => {
    if (activeTopic) {
      setTopicInput(activeTopic);
    }
  }, [activeTopic]);

  // Determine active summary matching current topic or latest
  const activeSummary =
    summaries.find((s) => !activeTopic || s.topic === activeTopic) ||
    summaries[0] ||
    null;

  // Reset persisted state if user modifies the text significantly
  const handleInputChange = (val: string) => {
    setInputText(val);
    if (userEntryPersisted && val.trim() !== lastPersistedText) {
      setUserEntryPersisted(false);
    }
  };

  // Scroll to bottom of conversation when new entries appear
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [entries.length, isSubmitting, isSummarising, summaries.length]);

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    const trimmedText = inputText.trim();
    if (!trimmedText || isSubmitting) return;

    setError(null);
    setIsSubmitting(true);

    const draftText = trimmedText;
    const currentTopic = topicInput.trim();
    const alreadyPersisted = userEntryPersisted && lastPersistedText === draftText;

    try {
      // Step 1: Save User's entry to Firestore if not already saved
      if (!alreadyPersisted) {
        setSubmissionStage('Saving your reflection to Firestore...');
        await saveJournalEntry(userId, {
          role: 'user',
          text: draftText,
          topic: currentTopic || undefined,
        });
        setUserEntryPersisted(true);
        setLastPersistedText(draftText);
      }

      // Step 2: Build conversation context for multi-turn Gemini interaction
      setSubmissionStage('Gemini is reviewing your note and generating guidance...');
      const conversationHistory = entries.slice(-10).map((entry) => ({
        role: entry.role,
        text: entry.text,
      }));

      // Ensure the latest message in context matches current user reflection without duplicate
      const lastMsg = conversationHistory[conversationHistory.length - 1];
      if (!lastMsg || lastMsg.role !== 'user' || lastMsg.text !== draftText) {
        conversationHistory.push({
          role: 'user',
          text: draftText,
        });
      }

      // Step 3: Call server-side /api/chat
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: conversationHistory,
          topic: currentTopic || undefined,
        }),
      });

      const data = await parseJsonResponse<{ reply: string }>(
        response,
        'Failed to process your learning journal entry.'
      );

      // Step 4: Save Gemini's response to Firestore
      setSubmissionStage('Persisting Gemini guidance to your journal...');
      await saveJournalEntry(userId, {
        role: 'model',
        text: data.reply,
        topic: currentTopic || undefined,
      });

      // Clear input upon verified persistence
      setInputText('');
      setUserEntryPersisted(false);
      setLastPersistedText('');
      setSubmissionStage('');
      if (onTopicChange && currentTopic) {
        onTopicChange(currentTopic);
      }
    } catch (err: any) {
      console.error('Journal entry / Gemini error:', err);
      const isRateLimit = err?.status === 429 || err?.code === 'RESOURCE_EXHAUSTED';
      let cleanMessage = isRateLimit
        ? 'Gemini request limit reached temporarily. Your learning data is safely saved. Please wait a short time and try again.'
        : err?.message || 'Failed to process your learning journal entry.';

      try {
        const parsed = JSON.parse(cleanMessage);
        if (parsed?.error?.message) {
          cleanMessage = parsed.error.message;
        }
      } catch {
        // Not JSON
      }
      setError(cleanMessage);

      // Honor Retry-After / retryDelay when available
      if (err?.retryAfter && typeof err.retryAfter === 'number' && err.retryAfter > 0) {
        setChatCooldown(Math.min(err.retryAfter, 120));
      } else if (isRateLimit) {
        setChatCooldown(15);
      }
    } finally {
      setIsSubmitting(false);
      setSubmissionStage('');
      textareaRef.current?.focus();
    }
  };

  // Original Ideathon Feature: Summarise My Learning + Next Action
  const handleSummariseLearning = async () => {
    if (isSummarising || summaryCooldown > 0) return;

    if (entries.length === 0) {
      setError('Please write at least one learning reflection before generating a summary.');
      return;
    }

    setIsSummarising(true);
    setSummaryError(null);

    // Reuse existing active summary ID or prior pending retry ID to strictly prevent duplicate records
    const targetSummaryId =
      activeSummary?.id ||
      pendingSummaryId ||
      `summary_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    if (!pendingSummaryId && !activeSummary?.id) {
      setPendingSummaryId(targetSummaryId);
    }

    try {
      const payloadMessages = entries.map((e) => ({
        role: e.role,
        text: e.text,
      }));

      const currentTopic = topicInput.trim() || activeTopic || undefined;

      const response = await fetch('/api/summarize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: payloadMessages,
          topic: currentTopic,
        }),
      });

      const data = await parseJsonResponse<{
        learningSummary: string;
        conceptToRevise: string;
        nextAction: string;
      }>(response, 'Failed to generate learning summary.');

      // Persist privately in Firestore under the authenticated user's UID
      // Passing targetSummaryId ensures retries/updates update the same summary document without duplicates
      await saveLearningSummary(
        userId,
        {
          learningSummary: data.learningSummary,
          conceptToRevise: data.conceptToRevise,
          nextAction: data.nextAction,
          topic: currentTopic,
        },
        targetSummaryId
      );

      setSummaryError(null);
      setPendingSummaryId(null);
      setSummaryCooldown(0);
    } catch (err: any) {
      console.error('Learning summary error:', err);
      const isRateLimit = err?.status === 429 || err?.code === 'RESOURCE_EXHAUSTED';
      let cleanMessage = isRateLimit
        ? 'Gemini request limit reached temporarily. Your learning data is safely saved. Please wait a short time and try again.'
        : err?.message || 'Failed to generate learning summary.';

      try {
        const parsed = JSON.parse(cleanMessage);
        if (parsed?.error?.message) {
          cleanMessage = parsed.error.message;
        }
      } catch {
        // Not JSON
      }
      setSummaryError(cleanMessage);

      // Honor Retry-After / retryDelay when available
      if (err?.retryAfter && typeof err.retryAfter === 'number' && err.retryAfter > 0) {
        setSummaryCooldown(Math.min(err.retryAfter, 120));
      } else if (isRateLimit) {
        setSummaryCooldown(15);
      }
    } finally {
      setIsSummarising(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <main className="flex-1 flex flex-col bg-white relative h-full overflow-hidden">
      {/* Top Status & Topic Bar with Clearly Visible Action Button */}
      <div className="h-14 px-6 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white z-10 gap-3">
        <div className="flex items-center gap-2 flex-1">
          <Tag className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <input
            id="journal-topic-input"
            type="text"
            value={topicInput}
            onChange={(e) => setTopicInput(e.target.value)}
            placeholder="Set topic focus (e.g. Transformers, RAG, React)..."
            maxLength={60}
            className="text-xs px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-md text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 w-48 sm:w-64"
          />
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          {/* Prominent Header Action Button */}
          <button
            id="header-summarise-btn"
            onClick={handleSummariseLearning}
            disabled={isSummarising || entries.length === 0 || summaryCooldown > 0}
            title={
              summaryCooldown > 0
                ? `Retry available in ${summaryCooldown}s`
                : entries.length === 0
                ? 'Write a learning reflection first'
                : 'Synthesize your learning takeaways and next action'
            }
            className="hidden md:flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-semibold border border-indigo-200 shadow-2xs cursor-pointer transition disabled:opacity-40 disabled:pointer-events-none"
          >
            <BookOpenCheck className="w-3.5 h-3.5 text-indigo-600" />
            <span>
              {summaryCooldown > 0
                ? `Retry in ${summaryCooldown}s`
                : 'Summarise My Learning + Next Action'}
            </span>
          </button>

          {/* Gemini Status Badge matching theme */}
          <div className="flex items-center gap-2 px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-[11px] font-bold border border-indigo-100 shadow-2xs">
            <Sparkles className="w-3 h-3 text-indigo-600" />
            <span className="hidden sm:inline">Gemini 3.8 Connected</span>
            <span className="sm:hidden">Gemini 3.8</span>
          </div>
        </div>
      </div>

      {/* Messages Stream & Below-Conversation Summary Card */}
      <div className="flex-1 p-6 md:p-8 overflow-y-auto flex flex-col">
        <div className="flex-1 space-y-6 max-w-3xl mx-auto w-full">
          {entries.length === 0 ? (
            <div className="h-full min-h-[260px] flex flex-col items-center justify-center text-center p-8 text-slate-500">
              <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-3 shadow-2xs">
                <Sparkles className="w-6 h-6" />
              </div>
              <h3 className="font-semibold text-slate-800 text-base">Your learning journal is ready</h3>
              <p className="text-xs text-slate-500 max-w-md mt-1.5 leading-relaxed">
                Reflect on concepts you learned today. Gemini Socratic guidance will validate your understanding, explain deeper nuances, and ask targeted follow-up questions.
              </p>
            </div>
          ) : (
            entries.map((entry) => {
              const isUser = entry.role === 'user';
              const formattedTime = new Date(entry.timestamp).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              });

              if (isUser) {
                // User message block (avatar on left, slate bubble)
                return (
                  <div key={entry.id} className="flex gap-4">
                    <div className="w-8 h-8 rounded bg-slate-800 flex-shrink-0 flex items-center justify-center text-white text-xs font-bold shadow-xs">
                      You
                    </div>
                    <div className="bg-slate-100 p-4 sm:p-5 rounded-2xl rounded-tl-none shadow-xs text-sm leading-relaxed text-slate-800 max-w-2xl border border-slate-200/60">
                      <div className="flex items-center justify-between gap-4 text-xs text-slate-500 mb-1.5 pb-1 border-b border-slate-200/60">
                        <span className="font-semibold text-slate-700">Learning Entry</span>
                        <div className="flex items-center gap-2">
                          {entry.topic && (
                            <span className="px-1.5 py-0.5 rounded bg-white text-slate-600 text-[10px] font-medium border border-slate-200">
                              {entry.topic}
                            </span>
                          )}
                          <span className="text-[11px] text-slate-400">{formattedTime}</span>
                        </div>
                      </div>
                      <p className="whitespace-pre-wrap font-sans text-slate-800">{entry.text}</p>
                    </div>
                  </div>
                );
              } else {
                // Gemini message block (avatar on right, indigo bubble)
                return (
                  <div key={entry.id} className="flex gap-4 flex-row-reverse">
                    <div className="w-8 h-8 rounded bg-indigo-600 flex-shrink-0 flex items-center justify-center text-white shadow-md">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div className="bg-indigo-50 p-5 rounded-2xl rounded-tr-none border border-indigo-100 shadow-xs text-sm leading-relaxed text-slate-800 max-w-2xl">
                      <div className="flex items-center justify-between gap-4 text-xs text-indigo-700 mb-2 pb-1.5 border-b border-indigo-100">
                        <span className="font-bold text-indigo-800 flex items-center gap-1.5">
                          <Sparkles className="w-3 h-3 text-indigo-600" />
                          Gemini Learning Guidance
                        </span>
                        <span className="text-[11px] text-indigo-400 font-normal">{formattedTime}</span>
                      </div>
                      <div className="prose prose-slate max-w-none text-slate-800 space-y-2 text-sm leading-relaxed">
                        <ReactMarkdown>{entry.text}</ReactMarkdown>
                      </div>
                    </div>
                  </div>
                );
              }
            })
          )}

          {/* Submitting indicator */}
          {isSubmitting && (
            <div className="flex gap-4 flex-row-reverse">
              <div className="w-8 h-8 rounded bg-indigo-600 flex-shrink-0 flex items-center justify-center text-white shadow-md animate-pulse">
                <Sparkles className="w-4 h-4" />
              </div>
              <div className="bg-indigo-50/70 p-4 rounded-2xl rounded-tr-none border border-indigo-100 shadow-xs text-sm text-slate-700 flex items-center gap-3">
                <RefreshCw className="w-4 h-4 text-indigo-600 animate-spin" />
                <span className="text-xs font-medium text-indigo-900">
                  {submissionStage || 'Gemini is evaluating your entry...'}
                </span>
              </div>
            </div>
          )}

          {/* Dedicated Learning Summary Card rendered cleanly BELOW the conversation */}
          <LearningSummaryCard
            summary={activeSummary}
            isLoading={isSummarising}
            error={summaryError}
            onRetry={handleSummariseLearning}
            userId={userId}
            cooldownSeconds={summaryCooldown}
          />

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Error alert with preservation guarantee and clear retry action */}
      {error && (
        <div
          id="chat-error-alert"
          className="mx-6 mb-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-xs flex items-start gap-2.5 shadow-xs"
        >
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold text-amber-950">
              {userEntryPersisted ? 'Note Saved • Gemini Guidance Pending' : 'Unable to complete request'}
            </p>
            <p className="mt-0.5 text-amber-800 leading-relaxed">
              {userEntryPersisted
                ? `${error} Your learning note has been safely stored in your journal. Click retry to generate AI guidance.`
                : `${error} Your draft has been preserved below.`}
            </p>
          </div>
          <button
            onClick={() => handleSendMessage()}
            disabled={chatCooldown > 0}
            className="text-xs font-semibold px-3 py-1.5 bg-amber-600 text-white rounded-md hover:bg-amber-700 transition shrink-0 cursor-pointer shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {chatCooldown > 0
              ? `Retry in ${chatCooldown}s`
              : userEntryPersisted
              ? 'Retry AI Guidance'
              : 'Retry'}
          </button>
        </div>
      )}

      {/* Clearly Visible Action Bar for "Summarise My Learning + Next Action" */}
      <div className="bg-gradient-to-r from-indigo-50/70 via-slate-50 to-indigo-50/70 border-t border-slate-200 px-4 sm:px-6 py-2.5 flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2 text-xs text-slate-700 font-medium">
          <BookOpenCheck className="w-4 h-4 text-indigo-600 shrink-0" />
          <span className="hidden sm:inline">Wrap up your reflections with structured cognitive takeaways:</span>
          <span className="sm:hidden">Ready to review?</span>
        </div>
        <button
          id="summarise-learning-action-btn"
          onClick={handleSummariseLearning}
          disabled={isSummarising || entries.length === 0 || summaryCooldown > 0}
          className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 active:scale-98 text-white rounded-lg text-xs font-bold shadow-xs flex items-center gap-2 cursor-pointer transition disabled:opacity-40 disabled:pointer-events-none shrink-0"
        >
          {isSummarising ? (
            <>
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>Summarising...</span>
            </>
          ) : summaryCooldown > 0 ? (
            <>
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>Retry in {summaryCooldown}s</span>
            </>
          ) : (
            <>
              <Sparkles className="w-3.5 h-3.5" />
              <span>Summarise My Learning + Next Action</span>
            </>
          )}
        </button>
      </div>

      {/* Input Area matching theme */}
      <div className="border-t border-slate-200 p-4 sm:p-5 bg-slate-50/50 flex flex-col justify-center shrink-0">
        <div className="max-w-3xl mx-auto w-full flex flex-col gap-2">
          <div className="flex gap-3 items-end">
            <textarea
              id="journal-entry-textarea"
              ref={textareaRef}
              rows={2}
              value={inputText}
              onChange={(e) => handleInputChange(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isSubmitting}
              placeholder="Reflect on your learning... (e.g. What did you study today? What feels unclear?)"
              className="flex-1 bg-white border border-slate-300 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none shadow-xs resize-none leading-relaxed transition"
            />
            <button
              id="send-entry-btn"
              onClick={() => handleSendMessage()}
              disabled={!inputText.trim() || isSubmitting}
              className="bg-indigo-600 text-white px-6 py-3 rounded-lg font-semibold text-sm shadow-xs hover:bg-indigo-700 active:scale-98 transition flex items-center justify-center gap-2 shrink-0 cursor-pointer disabled:opacity-40 disabled:pointer-events-none"
            >
              <span>{isSubmitting ? 'Sending...' : 'Send'}</span>
              <Send className="w-4 h-4" />
            </button>
          </div>

          <p className="text-[10px] text-center mt-1 text-slate-400 font-medium">
            Your reflections are encrypted and stored securely in your private Firestore silo.
          </p>
        </div>
      </div>
    </main>
  );
}

