import React, { useState, useEffect } from "react";
import { ArrowLeft, RotateCcw, Archive, Sparkles, TrendingUp, Activity, CheckCircle2, ArrowUp, ArrowDown, Trash2, X, Check } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { dbService } from "./lib/dbService";

interface Task {
  id: string;
  userId: string;
  title: string;
  description: string;
  status: 'active' | 'completed' | 'dismissed';
  category: 'life' | 'household';
  createdAt: string;
  completedAt?: string;
  tag?: string;
  isRecurring?: boolean;
  recurrenceInterval?: 'daily' | 'weekly' | 'monthly' | 'yearly';
  isPaused?: boolean;
  streakCount?: number;
  currentStreak?: number;
  completionHistory?: string[];
  lastCompletedDate?: string | null;
}

const TaskDescription = ({ description, isCompleting }: { description: string, isCompleting: boolean }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  if (!description) return null;
  const isLong = description.length > 80 || description.includes('\n');
  return (
    <div className="relative block mt-0.5 w-full">
      <p 
        className={`text-sm transition-colors duration-500 ${isExpanded ? 'whitespace-pre-wrap' : 'line-clamp-2'} ${isCompleting ? 'text-muted/60' : 'text-muted'}`}
      >
        {description}
      </p>
      {isLong && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIsExpanded(!isExpanded);
          }}
          className="text-[11px] text-muted hover:text-content mt-1 font-medium transition-colors focus:outline-none flex items-center gap-0.5"
        >
          {isExpanded ? <><ArrowUp size={12}/> Show less</> : <><ArrowDown size={12}/> Show more</>}
        </button>
      )}
    </div>
  );
};

function groupTasksByDate(tasks: Task[]) {
  const groups: Record<string, Task[]> = {};
  
  tasks.forEach(task => {
    const dateObj = new Date(task.completedAt || task.createdAt);
    let groupName = dateObj.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    
    // Quick 'Today' / 'Yesterday' helper
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (dateObj.toDateString() === today.toDateString()) {
      groupName = "Today";
    } else if (dateObj.toDateString() === yesterday.toDateString()) {
      groupName = "Yesterday";
    }

    if (!groups[groupName]) groups[groupName] = [];
    groups[groupName].push(task);
  });

  return groups;
}

export function HistoryView({ goBack, doUndo, bio }: { goBack: () => void, doUndo: (id: string) => Promise<void>, bio: string }) {
  const user = { uid: "local-user" };
  const [historyTasks, setHistoryTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const limit = 30;

  const [analytics, setAnalytics] = useState<any>(null);
  const [reflection, setReflection] = useState<string | null>(null);
  const [loadingReflection, setLoadingReflection] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [clearAllConfirm, setClearAllConfirm] = useState(false);
  const [totalCount, setTotalCount] = useState(0);

  const fetchHistory = async (offset = 0) => {
    if (!user) return;
    if (offset === 0) setLoading(true);
    else setLoadingMore(true);

    try {
      // Note: For simplicity and offline support, we fetch all completed tasks and slice locally.
      // Offset pagination relies on backend, but we've migrated to client dbService for offline support.
      const data = await dbService.getTasks(user.uid, 'completed');
      setTotalCount(data.length);
      const slicedData = data.slice(offset, offset + limit);
      if (offset === 0) {
        setHistoryTasks(slicedData);
      } else {
        setHistoryTasks(prev => [...prev, ...slicedData]);
      }
      setHasMore(slicedData.length === limit);
    } catch (e) {
      console.error(e);
      // Graceful degraded UI: user won't see raw errors if offline or fetch fails
    } finally {
      if (offset === 0) setLoading(false);
      else setLoadingMore(false);
    }
  };

  const fetchAnalyticsAndReflect = async () => {
    if (!user) return;
    if (!navigator.onLine) {
       // Graceful fallback for offline reflection
       setReflection("Offline mode. Your reflection will be generated when you reconnect!");
       setAnalytics({
           currentStreak: "-", days7: "-", mostProductiveDay: "N/A", chartData: []
       });
       return;
    }
    setLoadingReflection(true);
    try {
      const analRes = await fetch('/api/analytics', {
        headers: { 'x-user-id': user.uid }
      });
      if (!analRes.ok) throw new Error("Failed to fetch analytics");
      const analData = await analRes.json();
      setAnalytics(analData);

      const refRes = await fetch('/api/reflect', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-user-id': user.uid
        },
        body: JSON.stringify({ bio, recentTasks: analData.recentTasks })
      });
      if (!refRes.ok) throw new Error("Failed to fetch reflection");
      const refData = await refRes.json();
      if (refData.message) {
        setReflection(refData.message);
      }
    } catch (e) {
      console.error(e);
      // Graceful fallback
      setReflection("Momentum analysis is currently unavailable. Keep going!");
      setAnalytics({
           currentStreak: "-", days7: "-", mostProductiveDay: "N/A", chartData: []
      });
    } finally {
      setLoadingReflection(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const handleUndo = async (id: string) => {
    await doUndo(id);
    fetchHistory(0);
  };

  const handleDelete = async (id: string) => {
    try {
      await dbService.deleteTask(id);
      setHistoryTasks(prev => prev.filter(t => t.id !== id));
      setTotalCount(prev => Math.max(0, prev - 1));
    } catch (e) {
      console.error("Failed to delete task from archive:", e);
    }
  };

  const handleClearAll = async () => {
    if (!user) return;
    
    try {
      const allCompleted = await dbService.getTasks(user.uid, 'completed');
      const taskIds = allCompleted.map(t => t.id);
      await dbService.clearTasks(taskIds);
      setHistoryTasks([]);
      setTotalCount(0);
      setClearAllConfirm(false);
    } catch (e) {
      console.error("Failed to clear archive:", e);
    }
  };

  const totalCompleted = totalCount;
  
  const grouped = groupTasksByDate(historyTasks);

  return (
    <div className="distraction-free min-h-screen pb-20">
      <header className="flex justify-between items-center mb-6 pt-4">
        <button onClick={goBack} className="flex items-center gap-2 text-muted hover:text-content transition-colors">
          <ArrowLeft size={18} />
          Back
        </button>
        <div className="text-right">
          <p className="text-xs text-muted uppercase tracking-wider font-semibold">Total Completed</p>
          <p className="font-medium text-lg leading-none mt-1">{totalCompleted}</p>
        </div>
      </header>

      <div className="flex items-center justify-between mb-8">
        <h2 className="text-3xl font-light flex items-center gap-3">
          <Archive size={28} className="text-muted/50" />
          Archive
        </h2>
        <div className="flex items-center gap-2">
          {historyTasks.length > 0 && (
            clearAllConfirm ? (
              <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-red-500 bg-red-500/10 px-1 py-1 rounded-full border border-red-500/20">
                <span className="px-2">Clear All?</span>
                <button onClick={handleClearAll} className="p-1 px-2 rounded-full hover:bg-red-500/20 transition-colors" title="Confirm"><Check size={14} /></button>
                <div className="w-[1px] h-3 bg-red-500/30"></div>
                <button onClick={() => setClearAllConfirm(false)} className="p-1 px-2 text-muted hover:text-content hover:bg-outline/20 rounded-full transition-colors" title="Cancel"><X size={14} /></button>
              </div>
            ) : (
              <button 
                onClick={() => setClearAllConfirm(true)}
                className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted hover:text-red-400 transition-colors px-3 py-1.5 rounded-full border border-outline hover:border-red-400/50"
              >
                <Trash2 size={14} /> Clear All
              </button>
            )
          )}
          {!analytics && !loadingReflection && (
            <button 
              onClick={fetchAnalyticsAndReflect}
              className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary bg-primary/10 hover:bg-primary/20 transition-colors px-3 py-1.5 rounded-full"
            >
              <Sparkles size={14} /> Reflect & Celebrate
            </button>
          )}
        </div>
      </div>

      {loadingReflection && (
        <div className="mb-10 card-minimal bg-surface/50 animate-pulse flex flex-col items-center py-8">
          <Sparkles className="text-primary/50 mb-3 animate-spin-slow" size={24} />
          <p className="text-sm font-light text-muted">Analyzing your momentum...</p>
        </div>
      )}

      {analytics && reflection && !loadingReflection && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-10 space-y-4"
        >
          {/* AI Encouragement Card */}
          <div className="bg-success/10 border border-success/20 rounded-2xl p-5 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <Sparkles size={64} className="text-success" />
            </div>
            <div className="relative z-10">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-success mb-2 flex items-center gap-2">
                <CheckCircle2 size={16} /> Progress Reflection
              </h3>
              <p className="text-success/90 font-light leading-relaxed">
                {reflection}
              </p>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-surface border border-outline rounded-xl p-4 flex flex-col items-center justify-center text-center">
              <p className="text-xs text-muted uppercase tracking-wider font-semibold mb-1">Current Streak</p>
              <p className="text-2xl font-light text-content flex items-center gap-1">
                {analytics.currentStreak} <Activity size={16} className="text-primary/70" />
              </p>
              <p className="text-[10px] text-muted/60 uppercase mt-1">Days</p>
            </div>
            <div className="bg-surface border border-outline rounded-xl p-4 flex flex-col items-center justify-center text-center">
              <p className="text-xs text-muted uppercase tracking-wider font-semibold mb-1">7-Day Total</p>
              <p className="text-2xl font-light text-content flex items-center gap-1">
                {analytics.days7} <TrendingUp size={16} className="text-success/70" />
              </p>
              <p className="text-[10px] text-muted/60 uppercase mt-1">Completed</p>
            </div>
            <div className="bg-surface border border-outline rounded-xl p-4 flex flex-col items-center justify-center text-center">
              <p className="text-xs text-muted uppercase tracking-wider font-semibold mb-1">Best Day</p>
              <p className="text-lg font-light text-content capitalize">
                {analytics.mostProductiveDay.substring(0, 3)}
              </p>
              <p className="text-[10px] text-muted/60 uppercase mt-1">Most Active</p>
            </div>
          </div>

          {/* 7-Day Mini Chart */}
          <div className="bg-surface border border-outline rounded-xl p-5">
            <h3 className="text-xs text-muted uppercase tracking-wider font-semibold mb-4">Last 7 Days Output</h3>
            <div className="flex items-end justify-between h-20 gap-2">
              {analytics.chartData.map((d: any, idx: number) => {
                const maxCount = Math.max(...analytics.chartData.map((data: any) => data.count), 1);
                const heightPercent = `${(d.count / maxCount) * 100}%`;
                return (
                  <div key={idx} className="flex flex-col items-center gap-2 flex-1 group relative">
                    <div className="w-full bg-outline/30 rounded-sm flex items-end justify-center min-h-[4px] relative" style={{ height: '100%' }}>
                      <motion.div 
                        initial={{ height: 0 }}
                        animate={{ height: heightPercent }}
                        transition={{ delay: idx * 0.1, duration: 0.5, ease: 'easeOut' }}
                        className="w-full bg-primary/70 rounded-sm group-hover:bg-primary transition-colors min-h-[4px]"
                      />
                    </div>
                    <span className="text-[10px] text-muted/70 group-hover:text-content transition-colors font-medium">
                      {d.shortDate.substring(0, 1)}
                    </span>
                    {/* Tooltip */}
                    <div className="absolute -top-8 bg-black/80 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-20">
                      {d.count} tasks
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </motion.div>
      )}

      {loading ? (
        <div className="text-center py-10"><p className="text-muted font-light text-sm italic">Loading history...</p></div>
      ) : (
        <div className="space-y-8">
          {Object.entries(grouped).map(([groupName, tasks]) => (
            <div key={groupName} className="space-y-3">
              <h3 className="text-xs font-semibold tracking-wide text-muted uppercase ml-1 px-1">{groupName}</h3>
              <AnimatePresence mode="popLayout">
                {tasks.map(task => (
                  <motion.div
                    key={task.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="card-minimal flex items-center justify-between group overflow-hidden bg-surface opacity-80"
                  >
                    <div className="flex-1 pr-4">
                      <h4 className="font-medium text-[15px] text-muted line-through flex items-center gap-2">
                        {task.isRecurring && <CheckCircle2 size={14} className="opacity-50" />}
                        {task.title}
                        {task.tag && (
                          <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 no-underline inline-block">
                            {task.tag}
                          </span>
                        )}
                        {task.isRecurring && (task.currentStreak || task.streakCount) ? (
                          <span className="text-[10px] tracking-wider font-bold px-2 py-0.5 rounded-full bg-orange-900/30 text-orange-400 no-underline inline-block shrink-0">
                            🔥 {task.currentStreak || task.streakCount}
                          </span>
                        ) : null}
                      </h4>
                      {task.description && (
                        <div className="mt-0.5 opacity-60">
                          <TaskDescription description={task.description} isCompleting={false} />
                        </div>
                      )}
                      <p className="text-[10px] text-muted/40 mt-1 uppercase tracking-wide">
                         {new Date(task.completedAt || task.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button 
                        onClick={() => handleUndo(task.id)}
                        className="p-2 rounded-full border border-outline text-muted hover:border-primary hover:text-primary transition-colors duration-300"
                        title="Undo"
                      >
                        <RotateCcw size={16} />
                      </button>
                      {deleteConfirmId === task.id ? (
                        <div className="flex items-center gap-1 border border-red-500/20 bg-red-500/5 rounded-full px-1">
                          <button
                            onClick={() => handleDelete(task.id)}
                            className="p-1.5 text-red-400 hover:bg-red-500/20 rounded-full transition-colors"
                            title="Confirm Delete"
                          >
                            <Check size={14} />
                          </button>
                          <button
                            onClick={() => setDeleteConfirmId(null)}
                            className="p-1.5 text-muted hover:bg-outline/20 rounded-full transition-colors"
                            title="Cancel"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ) : (
                        <button 
                          onClick={() => setDeleteConfirmId(task.id)}
                          className="p-2 rounded-full border border-outline text-muted hover:border-red-400 hover:text-red-400 transition-colors duration-300"
                          title="Delete from Archive"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          ))}
          {historyTasks.length === 0 && (
            <div className="text-center py-10">
              <p className="text-muted font-light text-sm italic">No completed tasks yet.</p>
            </div>
          )}
          {historyTasks.length > 0 && hasMore && (
            <div className="pt-6 pb-10 text-center">
              <button 
                onClick={() => fetchHistory(historyTasks.length)}
                disabled={loadingMore}
                className="text-xs font-semibold uppercase tracking-widest text-muted hover:text-content transition-colors px-6 py-2 border border-outline rounded-full hover:bg-outline/20 disabled:opacity-50"
              >
                {loadingMore ? "Loading..." : "Load More"}
              </button>
            </div>
          )}
        </div>
      )}
      
      {/* Confirm Modal removed */}
    </div>
  );
}
