import React, { useState, useEffect, useRef, useMemo } from "react";
import { AuthProvider, useAuth } from "./components/AuthProvider";
import { auth, googleProvider, signInWithPopup } from "./lib/firebase";
import { GoogleAuth } from '@codetrix-studio/capacitor-google-auth';
import { GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import { dbService } from "./lib/dbService";
import { LogIn, User as UserIcon, Plus, Check, X, Sparkles, LogOut, Settings as SettingsIcon, ArrowLeft, Home, User as UserTab, ArrowDown, ArrowUp, Repeat, RotateCcw, Archive, Trash2, Inbox, Play, Trophy, Activity, AlertTriangle, CornerUpLeft, Coffee, Wind, Leaf, Moon, Cloud, Feather, Sun, Mountain, Compass, Waves, Download, UploadCloud } from "lucide-react";
import { motion, AnimatePresence, useMotionValue, useTransform } from "motion/react";
import { HistoryView } from "./HistoryView";
import { FocusIsland } from "./components/FocusIsland";
import { WeeklyWinsDashboard } from "./components/WeeklyWinsDashboard";
import { BottomSheet } from "./components/BottomSheet";
import { useCircadian } from "./hooks/useCircadian";
import { useNetworkStatus } from "./hooks/useNetworkStatus";
import { SyncIndicator } from "./components/SyncIndicator";

import { Capacitor } from '@capacitor/core';
// Initialize the plugin
try {
  if (Capacitor.isNativePlatform()) {
    GoogleAuth.initialize({
      clientId: 'PASTE_YOUR_WEB_CLIENT_ID_HERE',
      scopes: ['profile', 'email'],
      grantOfflineAccess: true,
    });
  }
} catch (e) {
  console.error("Failed to initialize GoogleAuth", e);
}

interface Task {
  id: string;
  userId: string;
  title: string;
  description: string;
  status: 'active' | 'completed' | 'dismissed';
  category: 'life' | 'household' | 'inbox';
  createdAt: string;
  completedAt?: string;
  tag?: string;
  isRecurring?: boolean;
  recurrenceInterval?: 'daily' | 'weekly' | 'monthly' | 'yearly';
  isPaused?: boolean;
  priority?: 'low' | 'medium' | 'high';
  streakCount?: number;
  currentStreak?: number;
  completionHistory?: string[];
  lastCompletedDate?: string | null;
  subtasks?: { id: string, text: string, isCompleted: boolean }[];
  effortLevel?: 'low' | 'medium' | 'high';
}

interface Suggestion {
  title: string;
  description: string;
  tag?: string;
  isRecurring?: boolean;
  recurrenceInterval?: 'daily' | 'weekly' | 'monthly' | 'yearly';
  subtasks?: { text: string, isCompleted: boolean }[];
  effortLevel?: 'low' | 'medium' | 'high';
}

const Login = () => {
  const { offlineLogin } = useAuth();
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'household');
  }, []);

  const handleLogin = async () => {
    try {
      if (Capacitor.isNativePlatform()) {
        // 1. Trigger the native Android Google login prompt
        const googleUser = await GoogleAuth.signIn();
        
        // Save the Google user locally in case Firebase fails due to being offline
        offlineLogin(googleUser);

        // 2. Take the secure token Android gives us and hand it to Firebase
        const credential = GoogleAuthProvider.credential(googleUser.authentication.idToken);

        // 3. Log into Firebase securely!
        await signInWithCredential(auth, credential);
        
        console.log("Successfully logged in on mobile!");
      } else {
        await signInWithPopup();
      }
    } catch (error) {
      console.error("Login failed:", error);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-base px-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center w-full max-w-sm"
      >
        <h1 className="text-4xl font-light tracking-tight mb-8">Forget-Me-Not</h1>
        <p className="text-muted mb-8 font-light">Your proactive digital assistant.</p>
        <div className="flex flex-col gap-4">
          <button onClick={handleLogin} className="btn-primary">
            <LogIn size={18} />
            Continue with Google
          </button>
          <button onClick={() => offlineLogin({uid: 'offline-user', email: 'guest@offline', displayName: 'Guest (Offline)', photoURL: ''})} className="btn-secondary py-3 px-4 flex items-center justify-center gap-2 rounded-xl bg-surface hover:bg-surface-active transition-colors text-muted hover:text-default">
            <Cloud size={18} className="opacity-70" />
            Continue Offline
          </button>
        </div>
      </motion.div>
    </div>
  );
};

const TaskDetails = ({ task, isCompleting, onUpdateSubtask, onStartFocus }: { task: Partial<Task>, isCompleting: boolean, onUpdateSubtask?: (subtasks: any[]) => void, onStartFocus?: (taskId: string, subtaskId: string, text: string) => void }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isSubtasksExpanded, setIsSubtasksExpanded] = useState(false);
  const [backupSubtasks, setBackupSubtasks] = useState<any[] | null>(null);
  const [isDecomposing, setIsDecomposing] = useState(false);
  
  const hasDescription = !!task.description;
  const hasSubtasks = !!(task.subtasks && task.subtasks.length > 0);
  
  const isLongDescription = hasDescription && (task.description!.length > 80 || task.description!.includes('\n'));
  const canDecompose = !!onUpdateSubtask;
  const requiresExpansion = isLongDescription || canDecompose;

  const completedCount = task.subtasks ? task.subtasks.filter(st => st.isCompleted).length : 0;
  const nextAction = task.subtasks ? task.subtasks.find(st => !st.isCompleted) : undefined;
  const subtasksProgress = task.subtasks && task.subtasks.length > 0 ? (completedCount / task.subtasks.length) * 100 : 0;

  useEffect(() => {
    if (isSubtasksExpanded && nextAction === undefined && hasSubtasks) {
      const timer = setTimeout(() => {
        setIsSubtasksExpanded(false);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [isSubtasksExpanded, nextAction, hasSubtasks]);

  if (!hasDescription && !hasSubtasks && !canDecompose) return null;

  const handleDecompose = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onUpdateSubtask) return;
    
    setBackupSubtasks(task.subtasks || []);
    setIsDecomposing(true);
    
    try {
      const res = await fetch("/api/decompose-task", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: task.title, description: task.description })
      });
      if (!res.ok) throw new Error("Failed to decompose task");
      const data = await res.json();
      
      const newSubtasks = (data.steps || []).map((step: any) => ({
        id: 'sub-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
        text: step.text,
        isCompleted: false
      }));
      
      onUpdateSubtask(newSubtasks);
      setIsSubtasksExpanded(true);
    } catch (error) {
      console.error("Decomposition error:", error);
    } finally {
      setIsDecomposing(false);
    }
  };

  const handleRevert = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onUpdateSubtask || !backupSubtasks) return;
    onUpdateSubtask(backupSubtasks);
    setBackupSubtasks(null);
  };

  return (
    <div className="relative block mt-0.5 w-full">
      {hasDescription && (
        <p 
          className={`text-sm transition-colors duration-500 ${isExpanded ? 'whitespace-pre-wrap' : 'line-clamp-2'} ${isCompleting ? 'text-muted/60' : 'text-muted'}`}
        >
          {task.description}
        </p>
      )}
      
      {isExpanded && canDecompose && (
        <div className="mt-2 flex gap-2 items-center">
          <button
            type="button"
            onClick={handleDecompose}
            disabled={isDecomposing}
            className={`flex items-center gap-1 text-[10px] uppercase font-bold tracking-wider px-2 py-1 rounded-md transition-colors ${isDecomposing ? 'bg-primary/20 text-primary opacity-70 cursor-not-allowed' : 'bg-primary/10 text-primary hover:bg-primary/20'}`}
          >
            {isDecomposing ? "Decomposing..." : "✨ Break it down"}
          </button>
          {backupSubtasks && (
            <button
              type="button"
              onClick={handleRevert}
              className="flex items-center gap-1 text-[10px] uppercase font-bold tracking-wider px-2 py-1 rounded-md bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors"
            >
              ↩️ Revert
            </button>
          )}
        </div>
      )}

      {requiresExpansion && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIsExpanded(!isExpanded);
          }}
          className="text-[11px] text-muted hover:text-content mt-1 mb-2 font-medium transition-colors focus:outline-none flex items-center gap-0.5"
        >
          {isExpanded ? <><ArrowUp size={12}/> Show less</> : <><ArrowDown size={12}/> Show more</>}
        </button>
      )}

      {hasSubtasks && (
        <div className="mt-3 bg-[var(--nav-bg)] rounded-xl border border-outline overflow-hidden shadow-sm">
          {/* Progress Bar */}
          <div className="h-1 bg-outline/30 w-full">
            <motion.div 
              className="h-full bg-primary" 
              initial={{ width: 0 }}
              animate={{ width: `${subtasksProgress}%` }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            />
          </div>
          
          <div className="p-3">
            {!isSubtasksExpanded && nextAction && (
              <div className="flex items-start gap-2 group mb-3">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onUpdateSubtask) {
                      onUpdateSubtask(task.subtasks!.map((s, sIdx) => (s.id || sIdx) === (nextAction.id || task.subtasks!.indexOf(nextAction)) ? { ...s, isCompleted: true } : s));
                    }
                  }}
                  className="mt-0.5 w-4 h-4 shrink-0 rounded-sm border border-outline hover:border-primary text-transparent flex items-center justify-center transition-colors"
                  disabled={!onUpdateSubtask}
                >
                  <Check size={12} />
                </button>
                <span className="text-sm text-content flex-1 font-medium">{nextAction.text}</span>
                {onStartFocus && task.id && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onStartFocus(task.id!, nextAction.id || task.subtasks!.indexOf(nextAction).toString(), nextAction.text);
                    }}
                    className="ml-auto text-muted hover:text-primary transition-colors focus:outline-none"
                    title="Focus mode (Pomodoro)"
                  >
                    <Play size={14} fill="currentColor" />
                  </button>
                )}
              </div>
            )}
            {!isSubtasksExpanded && !nextAction && (
              <p className="text-sm text-muted italic mb-3">All sub-tasks completed! 🎉</p>
            )}

            <AnimatePresence initial={false}>
              {isSubtasksExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className={`space-y-2.5 mb-4 transition-opacity duration-300 ${isCompleting ? 'opacity-40' : 'opacity-100'}`}>
                    {task.subtasks!.map((subtask, idx) => (
                      <div key={subtask.id || idx} className="flex items-start gap-2 group">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onUpdateSubtask) {
                              onUpdateSubtask(task.subtasks!.map((s, sIdx) => (s.id || sIdx) === (subtask.id || idx) ? { ...s, isCompleted: !s.isCompleted } : s));
                            }
                          }}
                          className={`mt-0.5 w-4 h-4 shrink-0 rounded-sm border flex items-center justify-center transition-colors ${subtask.isCompleted ? 'bg-primary border-primary text-background' : 'border-outline hover:border-primary text-transparent'}`}
                          disabled={!onUpdateSubtask}
                        >
                          <Check size={12} />
                        </button>
                        <span className={`text-sm flex-1 ${subtask.isCompleted ? 'line-through text-muted' : 'text-content'}`}>{subtask.text}</span>
                        
                        {!subtask.isCompleted && onStartFocus && task.id && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onStartFocus(task.id!, subtask.id || idx.toString(), subtask.text);
                            }}
                            className="ml-auto text-muted hover:text-primary transition-colors focus:outline-none"
                            title="Focus mode (Pomodoro)"
                          >
                            <Play size={14} fill="currentColor" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex justify-center border-t border-outline/30 pt-2">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsSubtasksExpanded(!isSubtasksExpanded);
                }}
                className="text-[11px] text-muted hover:text-content font-medium transition-colors focus:outline-none flex items-center gap-1 uppercase tracking-wider"
              >
                {isSubtasksExpanded ? (
                  <>Collapse <ArrowUp size={12}/></>
                ) : (
                  <>See all {task.subtasks!.length} steps <ArrowDown size={12}/></>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {isCompleting && (
        <motion.div className="absolute left-0 top-1/2 h-[1px] bg-muted/50 w-full -translate-y-1/2 rounded-full" initial={{ scaleX: 0, originX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 0.3, ease: "easeOut", delay: 0.1 }} />
      )}
    </div>
  );
};


const calculateStreakStatus = (lastCompletedDate?: string | null) => {
  if (!lastCompletedDate) return 'broken';
  const now = new Date();
  const lastCompleted = new Date(lastCompletedDate);
  const nowDateOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const lastCompletedDateOnly = new Date(lastCompleted.getFullYear(), lastCompleted.getMonth(), lastCompleted.getDate());
  
  const diffDays = Math.floor((nowDateOnly.getTime() - lastCompletedDateOnly.getTime()) / (1000 * 60 * 60 * 24));
  
  if (diffDays <= 1) return 'active';
  if (diffDays === 2) return 'frozen';
  return 'broken';
};

const calculateConsistency = (completionHistory?: string[]) => {
  if (!completionHistory || completionHistory.length === 0) return 0;
  
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  
  const recentCompletions = completionHistory.filter(dateStr => {
    const d = new Date(dateStr);
    return d >= thirtyDaysAgo && d <= now; // allow today as well
  });
  
  return Math.round((recentCompletions.length / 30) * 100);
};

const CircularProgressIcon = ({ 
  icon: Icon, 
  percentage, 
  isActive, 
  hasIndicator 
}: { 
  icon: any, 
  percentage?: number, 
  isActive: boolean, 
  hasIndicator?: boolean 
}) => {
  const radius = 22;
  const circumference = 2 * Math.PI * radius;
  const safePercentage = isNaN(percentage as number) ? 0 : Math.max(0, Math.min(100, percentage || 0));
  const strokeDashoffset = circumference - (safePercentage / 100) * circumference;

  return (
    <div className="relative flex items-center justify-center w-[48px] h-[48px] mb-1">
      {percentage !== undefined && percentage > 0 && (
        <svg className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none" viewBox="0 0 48 48">
          {/* Background track */}
          <circle
            cx="24"
            cy="24"
            r={radius}
            className="stroke-outline/30"
            strokeWidth={2}
            fill="transparent"
          />
          {/* Progress fill */}
          <circle
            cx="24"
            cy="24"
            r={radius}
            className="stroke-primary"
            strokeWidth={2}
            fill="transparent"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 0.5s ease-in-out' }}
          />
        </svg>
      )}
      <Icon size={20} className={isActive ? 'stroke-2 text-primary' : 'stroke-[1.5] text-muted'} />
      {hasIndicator && (
        <div className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-[var(--nav-bg)] shadow-[0_0_0_1px_rgba(255,0,0,0.2)]" />
      )}
    </div>
  );
};

const Dashboard = () => {
  const { user, offlineLogout } = useAuth();
  const phase = useCircadian();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [completedTasksCount, setCompletedTasksCount] = useState({ life: 0, household: 0, routines: 0 });
  const [activeTab, setActiveTab] = useState<'inbox' | 'life' | 'household' | 'routines'>('life');
  
  // Pull-to-Capture state mapping
  const [isPullCapturing, setIsPullCapturing] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const pullRef = useRef<HTMLInputElement>(null);
  const [pullInput, setPullInput] = useState("");
  const dragY = useMotionValue(0);
  const [canDrag, setCanDrag] = useState(true);
  
  useEffect(() => {
    const handleScroll = () => {
      setCanDrag(window.scrollY === 0);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);
  const [suggestionCache, setSuggestionCache] = useState<Record<string, Suggestion[]>>({ inbox: [], life: [], household: [], routines: [] });
  const currentSuggestions = suggestionCache[activeTab] || [];
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [isTakingLong, setIsTakingLong] = useState(false);
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const [activeFocusTask, setActiveFocusTask] = useState<{taskId: string, subtaskId: string, title: string} | null>(null);

  const inboxActiveCount = tasks.filter(t => !t.isRecurring && (t.category === 'inbox' || !t.category)).length;
  
  const lifeActiveCount = tasks.filter(t => !t.isRecurring && t.category === 'life').length;
  const lifeTotal = lifeActiveCount + completedTasksCount.life;
  const lifePercentage = lifeTotal > 0 ? (completedTasksCount.life / lifeTotal) * 100 : 0;
  
  const householdActiveCount = tasks.filter(t => !t.isRecurring && t.category === 'household').length;
  const householdTotal = householdActiveCount + completedTasksCount.household;
  const householdPercentage = householdTotal > 0 ? (completedTasksCount.household / householdTotal) * 100 : 0;

  const todayStr = new Date().toISOString().split('T')[0];
  const allRoutines = tasks.filter(t => t.isRecurring);
  const routinesCompletedTodayNumber = allRoutines.filter(r => r.completionHistory?.includes(todayStr)).length;
  const routinesTotal = allRoutines.length;
  const routinesPercentage = routinesTotal > 0 ? (routinesCompletedTodayNumber / routinesTotal) * 100 : 0;

  const [showProfile, setShowProfile] = useState(false);
  const [bio, setBio] = useState("");
  const [rawProfileText, setRawProfileText] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  
  // Backup / local data
  const [showImportWarning, setShowImportWarning] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Sync Data
  const [hasUnsyncedChanges, setHasUnsyncedChanges] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);

  useEffect(() => {
    // Initial load
    setHasUnsyncedChanges(localStorage.getItem('has_unsynced_changes') === 'true');
    setLastSyncedAt(localStorage.getItem(`fmn_last_synced_${user?.uid}`) || null);
    
    const handleLocalTasksUpdate = () => {
      setHasUnsyncedChanges(localStorage.getItem('has_unsynced_changes') === 'true');
      setLastSyncedAt(localStorage.getItem(`fmn_last_synced_${user?.uid}`) || null);
    };
    
    window.addEventListener('local_tasks_updated', handleLocalTasksUpdate);
    return () => window.removeEventListener('local_tasks_updated', handleLocalTasksUpdate);
  }, [user]);

  const handleManualSync = async () => {
    if (!user) return;
    setIsSyncing(true);
    try {
      await dbService.syncWithCloud(user.uid);
      setToastError("Sync successful!"); // This will show a standard toast text
    } catch (error) {
      console.error(error);
      setToastError("Sync failed. Check connection.");
    } finally {
      setIsSyncing(false);
    }
  };

  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDescription, setNewTaskDescription] = useState("");
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [newTaskTag, setNewTaskTag] = useState("");
  const [newTaskCategory, setNewTaskCategory] = useState<'life' | 'household'>('life');
  const [showQuickCapture, setShowQuickCapture] = useState(false);
  const [quickCaptureInput, setQuickCaptureInput] = useState("");
  const quickInputRef = useRef<HTMLInputElement>(null);
  const [newTaskEffortLevel, setNewTaskEffortLevel] = useState<'low' | 'medium' | 'high'>('medium');
  const [newSubtasks, setNewSubtasks] = useState<{ id: string, text: string, isCompleted: boolean }[]>([]);
  const [newSubtaskInput, setNewSubtaskInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [showWeeklyWins, setShowWeeklyWins] = useState(false);
  const [confirmResetApp, setConfirmResetApp] = useState(false);
  const [resetChallengeInput, setResetChallengeInput] = useState("");
  const [isResetting, setIsResetting] = useState(false);
  const [isSorting, setIsSorting] = useState(false);
  const [rouletteSelectedTaskId, setRouletteSelectedTaskId] = useState<string | null>(null);
  const [completingIds, setCompletingIds] = useState<string[]>([]);
  const [toastError, setToastError] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [isLowEnergyMode, setIsLowEnergyMode] = useState(false);
  const [recurrenceInterval, setRecurrenceInterval] = useState<'none' | 'daily' | 'weekly' | 'monthly' | 'yearly'>('none');
  const [newTaskPriority, setNewTaskPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [sortOption, setSortOption] = useState<'date' | 'priority' | 'effort'>('date');
  const [sortAnticipatedByEffort, setSortAnticipatedByEffort] = useState(false);

  const [showEditTaskModal, setShowEditTaskModal] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editCategory, setEditCategory] = useState<'life' | 'household' | 'inbox'>('life');
  const [editPriority, setEditPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [editEffortLevel, setEditEffortLevel] = useState<'low' | 'medium' | 'high'>('medium');
  const [editSubtasks, setEditSubtasks] = useState<{ id: string, text: string, isCompleted: boolean }[]>([]);
  const [editSubtaskInput, setEditSubtaskInput] = useState("");
  const [isDecomposingEdit, setIsDecomposingEdit] = useState(false);
  const [backupSubtasksEdit, setBackupSubtasksEdit] = useState<{ id: string, text: string, isCompleted: boolean }[] | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);

  const [showRoutineModal, setShowRoutineModal] = useState(false);
  const [routineTitle, setRoutineTitle] = useState("");
  const [routineDescription, setRoutineDescription] = useState("");
  const [routineTag, setRoutineTag] = useState("");
  const [routineInterval, setRoutineInterval] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('daily');
  const [routineCategory, setRoutineCategory] = useState<'life' | 'household'>('life');
  const [routinePriority, setRoutinePriority] = useState<'low' | 'medium' | 'high'>('medium');
  const isOnline = useNetworkStatus();
  const isOffline = !isOnline;
  const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing' | 'offline_saved'>('synced');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [subtaskDeleteConfirmId, setSubtaskDeleteConfirmId] = useState<string | null>(null);
  const [clearAllConfirm, setClearAllConfirm] = useState(false);

  const deleteTaskDirectly = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const taskToDelete = tasks.find(t => t.id === id);
    setTasks(prev => prev.filter(t => t.id !== id));
    
    if (isOffline) {
      setSyncStatus('offline_saved');
    } else {
      setSyncStatus('syncing');
      try {
        if (!String(id).startsWith('temp-')) {
          await dbService.deleteTask(id);
        }
        setSyncStatus('synced');
      } catch (error) {
        if (taskToDelete) {
          setTasks(prev => [...prev, taskToDelete]);
        }
        setToastError("Failed to delete task.");
        console.error("Failed to delete task:", error);
      }
    }
    setDeleteConfirmId(null);
  };

  const executeClearAllTasks = async () => {
    if (!user) return;
    
    // 1. Identify the tasks currently showing on the screen for this tab
    const currentTasks = tasks.filter(t => 
        activeTab === 'routines' ? t.isRecurring : (!t.isRecurring && t.category === activeTab)
    );
    
    if (currentTasks.length === 0) return;

    setIsClearing(true);
    // 4. Instantly wipe ALL of them (both real and temp) from the UI state
    const previousTasks = [...tasks];
    setTasks(prev => prev.filter(t => 
        !(activeTab === 'routines' ? t.isRecurring : (!t.isRecurring && t.category === activeTab))
    ));
    
    if (isOffline) {
        setSyncStatus('offline_saved');
    } else {
        setSyncStatus('syncing');
        try {
            // 2. SAFETY CHECK: Only send REAL Firebase IDs to the database
            const realTaskIds = currentTasks
                .map(t => t.id)
                .filter(id => !String(id).startsWith('temp-'));

            // 3. Only fire the database call if there are actual database documents to delete
            if (realTaskIds.length > 0) {
                await dbService.clearTasks(realTaskIds);
            }
            setSyncStatus('synced');
        } catch (error) {
            setTasks(previousTasks); // Rollback
            setToastError("Failed to clear tasks.");
            console.error("Failed to clear tasks:", error);
        }
    }
    
    setIsClearing(false);
    setClearAllConfirm(false);
  };

  const openEditModal = (task: Task) => {
    setEditingTask(task);
    setEditTitle(task.title);
    setEditDescription(task.description || "");
    setEditCategory(task.category);
    setEditPriority(task.priority || 'medium');
    setEditEffortLevel(task.effortLevel || 'medium');
    setEditSubtasks(task.subtasks || []);
    setEditSubtaskInput("");
    setBackupSubtasksEdit(null);
    setConfirmDelete(false);
    setShowEditTaskModal(true);
  };

  const handleDecomposeEdit = async () => {
    if (!editTitle.trim()) return;
    setBackupSubtasksEdit(editSubtasks);
    setIsDecomposingEdit(true);
    try {
      const res = await fetch("/api/decompose-task", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: editTitle, description: editDescription })
      });
      if (!res.ok) throw new Error("Failed to decompose task");
      const data = await res.json();
      const newSubtasks = (data.steps || []).map((step: any) => ({
        id: 'sub-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
        text: step.text,
        isCompleted: false
      }));
      setEditSubtasks(newSubtasks);
    } catch (error) {
      console.error("Decomposition error:", error);
    } finally {
      setIsDecomposingEdit(false);
    }
  };

  const handleRevertEdit = () => {
    if (backupSubtasksEdit) {
      setEditSubtasks(backupSubtasksEdit);
      setBackupSubtasksEdit(null);
    }
  };

  const saveEditTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTask || !editTitle.trim() || !user || isSubmitting) return;
    
    setIsSubmitting(true);
    // Optimistic UI update
    setTasks(prev => prev.map(t => t.id === editingTask.id ? {
      ...t,
      title: editTitle,
      description: editDescription,
      category: editCategory,
      priority: editPriority,
      subtasks: editSubtasks
    } : t));
    
    setShowEditTaskModal(false);
    setIsSubmitting(false);

    dbService.updateTask(editingTask.id, {
      title: editTitle,
      description: editDescription,
      category: editCategory,
      priority: editPriority,
      subtasks: editSubtasks
    }).catch(error => {
      console.error("Failed to background sync updated task", error);
    });
  };

  const deleteExistingTask = async () => {
    if (!editingTask || !user || isSubmitting) return;
    
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }

    setIsSubmitting(true);
    try {
      await dbService.deleteTask(editingTask.id);
      
      setTasks(prev => prev.filter(t => t.id !== editingTask.id));
      setShowEditTaskModal(false);
      fetchTasks();
    } catch (error) {
      if (isOffline) setToastError("Saved locally. Syncing when online.");
      else setToastError("Failed to delete task.");
      console.error("Failed to delete task", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const addRoutine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!routineTitle.trim() || !user || isSubmitting) return;
    
    setIsSubmitting(true);
    // Optimistic UI update for routine with pre-generated ID
    const firestoreId = dbService.getNewTaskId();
    const newRoutineData: Omit<Task, 'id' | 'createdAt'> = {
      userId: user.uid,
      title: routineTitle,
      description: routineDescription,
      status: 'active',
      category: routineCategory,
      tag: routineTag || undefined,
      isRecurring: true,
      recurrenceInterval: routineInterval,
      priority: routinePriority,
      subtasks: newSubtasks
    };

    setTasks(prev => [{ id: firestoreId, ...newRoutineData, createdAt: new Date().toISOString() } as Task, ...prev]);
    setRoutineTitle("");
    setRoutineDescription("");
    setRoutineTag("");
    setNewSubtasks([]);
    setNewSubtaskInput("");
    setShowRoutineModal(false);
    setRoutinePriority("medium");
    setIsSubmitting(false);

    try {
      await dbService.saveTask(firestoreId, newRoutineData);
    } catch (error) {
      console.error("Failed to background sync routine", error);
    }
  };

  const fetchTasks = async (status: 'active' | 'completed' = 'active') => {
    if (!user) return;
    try {
      const data = await dbService.getTasks(user.uid, status, status === 'completed' ? 50 : undefined);
      setTasks(data);
    } catch (error) {
      if (!navigator.onLine) {
        setToastError("You appear to be offline. Data may not be fully synced.");
      } else {
        setToastError("Failed to fetch tasks.");
      }
      console.error("Failed to fetch tasks", error);
    }
  };

  const fetchCompletedTasksCount = async () => {
    if (!user) return;
    try {
      const counts = await dbService.getCompletedTasksToday(user.uid);
      setCompletedTasksCount(counts);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (phase === 'night') {
      document.documentElement.setAttribute("data-theme", "night");
    } else {
      document.documentElement.setAttribute("data-theme", activeTab);
    }
  }, [activeTab, phase]);

  useEffect(() => {
    if (!user) return;

    const fetchProfile = async () => {
      try {
        const data = await dbService.getProfile(user.uid);
        setBio(data.bio || "{}");
      } catch (error) {
        console.error("Failed to fetch profile", error);
      }
    };
    
    fetchProfile();
    fetchTasks();
    fetchCompletedTasksCount();
  }, [user]);

  useEffect(() => {
    if (!showHistory) {
      fetchTasks('active');
    }
  }, [activeTab, showHistory]);

  useEffect(() => {
    if (showTaskModal && inputRef.current) {
      inputRef.current.focus();
    }
  }, [showTaskModal]);

  useEffect(() => {
    if (showQuickCapture && quickInputRef.current) {
      quickInputRef.current.focus();
    }
  }, [showQuickCapture]);

  const handleQuickCapture = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickCaptureInput.trim() || !user || isSubmitting) return;

    setIsSubmitting(true);
    const title = quickCaptureInput.trim();

    const firestoreId = dbService.getNewTaskId();
    const newTaskData: Omit<Task, 'id' | 'createdAt'> = {
      userId: user.uid,
      title,
      description: '',
      status: 'active',
      category: 'inbox',
      isRecurring: false,
      priority: 'medium',
      subtasks: [],
      effortLevel: 'medium'
    };

    setTasks(prev => [{ id: firestoreId, ...newTaskData, createdAt: new Date().toISOString() } as Task, ...prev]);
    setQuickCaptureInput("");
    setShowQuickCapture(false);
    setIsSubmitting(false);

    if (isOffline) {
      setSyncStatus('offline_saved');
    } else {
      setSyncStatus('syncing');
      try {
        await dbService.saveTask(firestoreId, newTaskData);
        setSyncStatus('synced');
      } catch (error) {
        console.error("Failed to background sync quick capture task", error);
      }
    }
  };

  const addTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim() || !user || isSubmitting) return;
    
    setIsSubmitting(true);
    let title = newTaskTitle;
    let tag = newTaskTag || undefined;
    const match = title.match(/#(\w+)/);
    if (match && !tag) {
        tag = match[1];
        title = title.replace(`#${tag}`, '').trim();
    }
    
    const taskCategory = newTaskCategory;

    // Optimistic UI update for task with pre-generated ID
    const firestoreId = dbService.getNewTaskId();
    const newTaskData: Omit<Task, 'id' | 'createdAt'> = {
      userId: user.uid,
      title,
      description: newTaskDescription,
      status: 'active',
      category: taskCategory,
      tag,
      isRecurring: false,
      priority: newTaskPriority,
      subtasks: newSubtasks,
      effortLevel: newTaskEffortLevel
    };

    setTasks(prev => [{ id: firestoreId, ...newTaskData, createdAt: new Date().toISOString() } as Task, ...prev]);
    setNewTaskTitle("");
    setNewTaskDescription("");
    setNewTaskTag("");
    setNewTaskPriority("medium");
    setNewTaskEffortLevel("medium");
    setNewSubtasks([]);
    setNewSubtaskInput("");
    setShowTaskModal(false);
    setIsSubmitting(false);

    if (isOffline) {
      setSyncStatus('offline_saved');
    } else {
      setSyncStatus('syncing');
      try {
        await dbService.saveTask(firestoreId, newTaskData);
        setSyncStatus('synced');
      } catch (error) {
        console.error("Failed to background sync added task", error);
      }
    }
  };

  useEffect(() => {
    setRouletteSelectedTaskId(null);
  }, [activeTab, activeTag]);

  const handleSpinRoulette = () => {
    // Collect all valid visible tasks for the roulette
    let visibleTasks = tasks.filter(t => {
      if (isLowEnergyMode && t.effortLevel !== 'low') return false;
      if (activeTab === 'routines') return t.isRecurring;
      if (activeTab === 'inbox') return t.category === 'inbox' || !t.category;
      return t.category === activeTab && !t.isRecurring;
    });
    if (activeTag) {
      visibleTasks = visibleTasks.filter(t => t.tag === activeTag);
    }
    
    if (visibleTasks.length === 0) return;
    const randomIndex = Math.floor(Math.random() * visibleTasks.length);
    setRouletteSelectedTaskId(visibleTasks[randomIndex].id);
  };

  const completeTask = async (id: string) => {
    if (rouletteSelectedTaskId === id) setRouletteSelectedTaskId(null);
    // Optimistic UI for completing state
    setCompletingIds(prev => [...prev, id]);
    
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(50);
    }
    
    setTimeout(async () => {
      // Fully optimistic removal from local state
      setTasks(prev => prev.filter(t => t.id !== id));
      
      if (isOffline) {
        setSyncStatus('offline_saved');
        setCompletingIds(prev => prev.filter(compId => compId !== id));
      } else {
        setSyncStatus('syncing');
        try {
          await dbService.completeTask(id);
          setSyncStatus('synced');
          fetchCompletedTasksCount();
        } catch (error) {
          console.error("Failed to complete task", error);
        } finally {
          setCompletingIds(prev => prev.filter(compId => compId !== id));
        }
      }
    }, 500); // Wait for the visual strike-through animation
  };

  const undoTask = async (id: string) => {
    try {
      await dbService.undoTask(id);
      fetchTasks();
      fetchCompletedTasksCount();
    } catch (error) {
      if (isOffline) setToastError("Saved locally. Syncing when online.");
      else setToastError("Failed to undo task.");
      console.error("Failed to undo task", error);
    }
  };

  const handleSortForMe = async () => {
    const unsortedTasks = tasks.filter(t => t.category === 'inbox' || !t.category);
    if (unsortedTasks.length === 0 || isOffline) return;

    setIsSorting(true);
    setToastError(null);

    try {
      const payload = unsortedTasks.map(t => ({
        id: t.id,
        title: t.title,
        description: t.description || ""
      }));

      const res = await fetch("/api/sort-inbox", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tasks: payload }),
      });

      if (!res.ok) throw new Error("Failed to sort inbox");
      const data = await res.json();
      
      const sortedResults = data.sortedResults || [];
      if (sortedResults.length > 0) {
        // Update database
        await dbService.updateTasksBatch(sortedResults);
        
        // Update local state instantly
        setTasks(prev => prev.map(task => {
          const update = sortedResults.find((r: any) => r.id === task.id);
          if (update) {
            return {
              ...task,
              category: update.category as any,
              effortLevel: update.effortLevel as any,
              priority: update.priority as any
            };
          }
          return task;
        }));
      }
    } catch (error) {
      console.error("Sort For Me Error:", error);
      setToastError("Failed to automatically sort tasks. Please try again.");
    } finally {
      setIsSorting(false);
    }
  };

  const generateSuggestions = async () => {
    if (!user || !bio || bio === "{}" || isOffline) return;
    setLoadingSuggestions(true);
    setIsTakingLong(false);
    
    const controller = new AbortController();
    setAbortController(controller);
    
    setSuggestionCache(prev => ({ ...prev, [activeTab]: [] })); // Clear previous
    
    const timeoutId = setTimeout(() => setIsTakingLong(true), 30000);
    
    try {
      const allTasks = await dbService.getTasks(user.uid, 'completed');
      const completedTitles = allTasks
        .filter((t: Task) => t.category === activeTab)
        .slice(0, 8)
        .map((t: Task) => t.title);

      const existingTaskTitles = tasks
        .filter(t => activeTab === 'routines' ? t.isRecurring && t.status !== 'completed' && t.status !== 'dismissed' : (!t.isRecurring && t.category === activeTab && t.status !== 'completed' && t.status !== 'dismissed'))
        .map(t => t.title);

      const response = await fetch("/api/anticipate", {
        method: "POST",
        signal: controller.signal,
        headers: { 
          "Content-Type": "application/json",
          'x-user-id': user.uid
        },
        body: JSON.stringify({
          bio,
          completedTasks: completedTitles,
          existingTasks: existingTaskTitles,
          currentTime: new Date().toLocaleString(),
          category: activeTab
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to connect to the assistant.");
      }

      const data = await response.json();
      if (data.suggestions) {
        setSuggestionCache(prev => ({ ...prev, [activeTab]: data.suggestions }));
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log('Request cancelled');
        return;
      }
      console.error("Failed to generate suggestions", error);
      setToastError(error.message || "Failed to connect to the assistant. Please try again later.");
      setTimeout(() => setToastError(null), 5000);
    } finally {
      clearTimeout(timeoutId);
      setIsTakingLong(false);
      setAbortController(null);
      setLoadingSuggestions(false);
    }
  };

  const acceptSuggestion = async (suggestion: Suggestion) => {
    if (!user) return;
    const firestoreId = dbService.getNewTaskId();
    try {
      const parsedSubtasks = suggestion.subtasks?.map((st, idx) => ({
        id: `ai-st-${Date.now()}-${idx}`,
        text: st.text,
        isCompleted: st.isCompleted || false
      })) || [];
      
      const taskCategory = activeTab === 'routines' ? 'household' : (activeTab as 'life' | 'household' | 'inbox');
      const isRecurring = activeTab === 'routines';
      
      // Optimistic UI update
      const newTaskData: Omit<Task, 'id' | 'createdAt'> = {
        userId: user.uid,
        title: suggestion.title,
        description: suggestion.description,
        status: 'active',
        category: taskCategory,
        tag: suggestion.tag,
        isRecurring,
        recurrenceInterval: isRecurring ? suggestion.recurrenceInterval : undefined,
        priority: 'medium',
        subtasks: parsedSubtasks,
        effortLevel: suggestion.effortLevel || 'medium'
      };

      setTasks(prev => [{ id: firestoreId, ...newTaskData, createdAt: new Date().toISOString() } as Task, ...prev]);
      setSuggestionCache(prev => ({
        ...prev,
        [activeTab]: prev[activeTab].filter(s => s.title !== suggestion.title)
      }));

      await dbService.saveTask(firestoreId, newTaskData);
    } catch (error) {
      if (isOffline) setToastError("Saved locally. Syncing when online.");
      else {
        setToastError("Failed to accept suggestion.");
        // Rollback optimistic update if not offline failure
        setTasks(prev => prev.filter(t => t.id !== firestoreId));
      }
      console.error("Failed to accept suggestion", error);
    }
  };

  const dismissSuggestion = (title: string) => {
    setSuggestionCache(prev => ({
      ...prev,
      [activeTab]: prev[activeTab].filter(s => s.title !== title)
    }));
  };

  const exportData = async () => {
    if (!user) return;
    try {
      const allTasks = await dbService.getTasks(user.uid);
      const backup = {
        version: 1,
        exportedAt: new Date().toISOString(),
        tasks: allTasks,
        bio: bio
      };
      const dataStr = JSON.stringify(backup, null, 2);
      const blob = new Blob([dataStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const dateStr = new Date().toISOString().split('T')[0];
      a.download = `forget-me-not-backup-${dateStr}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setToastError("Backup downloaded successfully!");
      setTimeout(() => setToastError(null), 3000);
    } catch (e) {
      console.error("Backup failed", e);
      setToastError("Failed to export backup.");
    }
  };

  const handleImportFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setImportFile(e.target.files[0]);
      setShowImportWarning(true);
    }
  };

  const executeImport = () => {
    if (!importFile || !user) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const content = event.target?.result as string;
        const backup = JSON.parse(content);
        if (!backup.tasks) throw new Error("Invalid backup file: Missing tasks array");
        
        const currentTasks = await dbService.getTasks(user.uid);
        if (currentTasks.length > 0) {
          await dbService.clearTasks(currentTasks.map(t => t.id));
        }
        
        const importedTasks = backup.tasks.map((t: any) => ({
          ...t,
          userId: user.uid
        }));
        
        await dbService.importTasksBatch(importedTasks);
        
        if (backup.bio && typeof backup.bio === 'string') {
          await dbService.saveProfile(user.uid, backup.bio);
          setBio(backup.bio);
        }
        
        setTasks(importedTasks.filter((t: Task) => !t.completedAt || new Date(t.completedAt).getTime() > Date.now() - 24 * 60 * 60 * 1000));
        
        setToastError("Restore complete!");
        setTimeout(() => setToastError(null), 3000);
      } catch (err) {
        console.error("Import failed", err);
        setToastError("Import failed. Invalid file.");
      } finally {
        setShowImportWarning(false);
        setImportFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };
    reader.readAsText(importFile);
  };

  const processAndSaveProfile = async () => {
    if (!user || !rawProfileText.trim()) return;
    if (isOffline) {
       setToastError("You appear to be offline. Please connect to internet to parse profile.");
       setTimeout(() => setToastError(null), 3000);
       return;
    }
    setSavingProfile(true);
    try {
      const res = await fetch('/api/profile/parse', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-user-id': user.uid
        },
        body: JSON.stringify({ rawText: rawProfileText })
      });
      if (!res.ok) {
        throw new Error("Failed to parse");
      }
      const data = await res.json();
      if (data.success) {
        setBio(data.bio);
        setShowProfile(false);
      } else {
        setToastError("Failed to parse profile. Please try again.");
        setTimeout(() => setToastError(null), 3000);
      }
    } catch (error) {
      console.error("Failed to save profile", error);
      setToastError("An error occurred while parsing. Please check your connection.");
      setTimeout(() => setToastError(null), 3000);
    } finally {
      setSavingProfile(false);
    }
  };

  const displayedAnticipatedTasks = useMemo(() => {
    if (!sortAnticipatedByEffort) return currentSuggestions;
    const effortWeight: Record<string, number> = { low: 1, medium: 2, high: 3 };
    return [...currentSuggestions].sort((a, b) => {
      const weightA = effortWeight[a.effortLevel || 'medium'] || 2; 
      const weightB = effortWeight[b.effortLevel || 'medium'] || 2;
      return weightA - weightB;
    });
  }, [currentSuggestions, sortAnticipatedByEffort]);

  if (showProfile) {
    return (
      <div className="distraction-free">
        <button onClick={() => setShowProfile(false)} className="mb-8 flex items-center gap-2 text-muted hover:text-content transition-colors">
          <ArrowLeft size={18} />
          Back to Assistant
        </button>
        <h2 className="text-3xl font-light mb-6">Setup Context</h2>
        <p className="text-muted mb-8 font-light text-sm">
          Tell the AI about your life—your schedule, hobbies, goals, and pets—so it can personalize your routines.
        </p>
        <textarea
          value={rawProfileText}
          onChange={(e) => setRawProfileText(e.target.value)}
          className="input-minimal w-full min-h-[300px] mb-8 text-sm leading-relaxed resize-none p-4 rounded-xl"
          placeholder="I'm a cardiology resident and I have a 24-hour ICU shift on Tuesdays. I play electric guitar and have a cockatiel named Ziko. I need to prep for my board exam..."
        />
        <button 
          onClick={processAndSaveProfile} 
          disabled={savingProfile || !rawProfileText.trim()}
          className="btn-primary w-full disabled:opacity-50 flex justify-center items-center gap-2"
        >
          {savingProfile && <Sparkles size={16} className="animate-pulse" />}
          {savingProfile ? "Thinking..." : "Process & Save Profile"}
        </button>
        
        <div className="mt-12 pt-8 border-t border-outline/10">
          <h3 className="font-medium mb-2">Data Ownership</h3>
          <p className="text-muted text-sm mb-6 font-light">
            Fully back up your entire app state, or securely restore an existing backup.
          </p>
          <div className="flex flex-col gap-3">
            <button onClick={exportData} className="flex justify-center items-center gap-2 w-full p-4 rounded-xl border border-outline/20 bg-surface hover:bg-surface-active transition-colors text-sm font-medium">
              <Download size={18} className="text-primary" />
              Download Local Backup
            </button>
            <button onClick={() => fileInputRef.current?.click()} className="flex justify-center items-center gap-2 w-full p-4 rounded-xl text-muted hover:text-content transition-colors text-sm font-medium">
              <UploadCloud size={18} />
              Restore from Backup
            </button>
            <input 
              type="file" 
              accept=".json" 
              ref={fileInputRef} 
              onChange={handleImportFileChange}
              className="hidden" 
            />
          </div>
        </div>

        <AnimatePresence>
          {showImportWarning && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-base/80 backdrop-blur-sm"
            >
              <div className="bg-surface border border-outline/20 p-6 rounded-2xl w-full max-w-sm">
                <h3 className="text-xl font-light mb-2">Restore Backup?</h3>
                <p className="text-muted mb-6 text-sm">
                  This will completely overwrite your current dashboard data with the contents of the backup file. This action cannot be undone.
                </p>
                <div className="flex flex-col gap-3">
                  <button onClick={executeImport} className="btn-primary w-full text-center">
                    Yes, Restore Backup
                  </button>
                  <button onClick={() => { setShowImportWarning(false); setImportFile(null); if(fileInputRef.current) fileInputRef.current.value = ""; }} className="p-3 w-full rounded-xl text-muted hover:text-content text-center font-medium transition-colors">
                    Cancel
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="mt-16 pt-8 border-t border-red-500/10">
          <h3 className="text-red-500 font-medium mb-4 flex items-center gap-2">
            <AlertTriangle size={18} /> Danger Zone
          </h3>
          <p className="text-muted text-sm mb-4 font-light">
            Testing utilities. These actions are destructive and cannot be undone.
          </p>
          <button 
            onClick={() => setConfirmResetApp(true)}
            className="flex justify-center items-center gap-2 w-full p-4 rounded-xl border border-red-500/20 text-red-500 hover:bg-red-500/10 transition-colors bg-surface text-sm font-medium uppercase tracking-wider"
          >
            Reset All Data (Testing Only)
          </button>
        </div>
      </div>
    );
  }

  if (showHistory) {
    return <HistoryView goBack={() => setShowHistory(false)} doUndo={undoTask} bio={bio} />;
  }

  if (showWeeklyWins) {
    return <WeeklyWinsDashboard onClose={() => setShowWeeklyWins(false)} />;
  }

  const currentTasks = tasks.filter(t => {
    if (isLowEnergyMode && t.effortLevel !== 'low') return false;
    if (activeTab === 'routines') return t.isRecurring;
    return t.category === activeTab && !t.isRecurring && (!activeTag || t.tag === activeTag);
  });
  const uniqueTags = Array.from(new Set(tasks.filter(t => t.category === activeTab && !t.isRecurring && t.tag).map(t => t.tag as string)));
  const sortedTasks = [...currentTasks].sort((a, b) => {
    if (sortOption === 'effort') {
      const effortWeight: Record<string, number> = { low: 1, medium: 2, high: 3 };
      const weightA = effortWeight[a.effortLevel || ''] || 2; 
      const weightB = effortWeight[b.effortLevel || ''] || 2;
      if (weightA !== weightB) {
        return sortOrder === 'desc' ? weightB - weightA : weightA - weightB;
      }
    } else if (sortOption === 'priority') {
      const getWeight = (p?: string) => {
        if (p === 'high') return 3;
        if (p === 'medium') return 2;
        if (p === 'low') return 1;
        return 0; // backward compatibility
      };
      const weightA = getWeight(a.priority);
      const weightB = getWeight(b.priority);
      if (weightA !== weightB) {
        return sortOrder === 'desc' ? weightB - weightA : weightA - weightB; // High to Low or Low to High
      }
    }
    const dateA = new Date(a.createdAt).getTime();
    const dateB = new Date(b.createdAt).getTime();
    return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
  });

  const togglePauseTask = async (id: string, currentPaused: boolean) => {
    if (!user) return;
    try {
      await dbService.updateTask(id, { isPaused: !currentPaused });
      fetchTasks();
    } catch (error) {
      if (isOffline) setToastError("Saved locally. Syncing when online.");
      else setToastError("Failed to pause task.");
      console.error("Failed to pause task", error);
    }
  };

  const cycleEffort = async (e: React.MouseEvent, taskId: string, currentEffort: string = 'medium') => {
    e.stopPropagation();
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(20);
    
    const map: Record<string, 'low'|'medium'|'high'> = {
      'low': 'medium',
      'medium': 'high',
      'high': 'low'
    };
    const nextValue = map[currentEffort] || 'medium';
    
    // Optimistic UI update
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, effortLevel: nextValue } : t));
    
    try {
      await dbService.updateTask(taskId, { effortLevel: nextValue });
    } catch (err) {
      console.error(err);
    }
  };

  const cyclePriority = async (e: React.MouseEvent, taskId: string, currentPriority: string = 'medium') => {
    e.stopPropagation();
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(20);
    
    const map: Record<string, 'low'|'medium'|'high'> = {
      'low': 'medium',
      'medium': 'high',
      'high': 'low'
    };
    const nextValue = map[currentPriority] || 'medium';
    
    // Optimistic UI update
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, priority: nextValue } : t));
    
    try {
      await dbService.updateTask(taskId, { priority: nextValue });
    } catch (err) {
      console.error(err);
    }
  };

  const renderTask = (task: Task) => {
    const isCompleting = completingIds.includes(task.id);
    const isPaused = task.isPaused;
    const isRouletteWinner = rouletteSelectedTaskId === task.id;
    const isRouletteLoser = rouletteSelectedTaskId !== null && !isRouletteWinner;
    
    return (
      <motion.div
        key={task.id}
        layout
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: isCompleting ? 0.4 : 1, y: 0 }}
        exit={{ opacity: 0, height: 0, marginBottom: 0, transition: { duration: 0.3 } }}
        className="relative w-full overflow-hidden rounded-[20px] mb-3"
      >
        {/* Background Action Layers */}
        <div className="absolute inset-y-0 left-0 w-full flex items-center pl-6 bg-green-500/20 text-green-400 z-0">
          <Check size={24} />
        </div>
        <div className="absolute inset-y-0 right-0 w-full flex items-center justify-end pr-6 bg-red-500/20 text-red-400 z-0">
          <Trash2 size={24} />
        </div>

        {/* Foreground Draggable Card */}
        <motion.div
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.7}
          onDragEnd={(_, info) => {
            if (info.offset.x > 100) {
              if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(50);
              completeTask(task.id);
            } else if (info.offset.x < -100) {
              if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(50);
              deleteTaskDirectly(task.id);
            }
          }}
          onClick={() => openEditModal(task)}
          className={`relative z-10 card-minimal w-full flex items-start justify-between gap-3 group bg-surface transition-all duration-300 cursor-pointer ${isPaused ? 'opacity-60' : ''} ${isRouletteWinner ? 'ring-2 ring-primary shadow-lg shadow-primary/20 scale-[1.02] z-10' : 'hover:bg-[var(--card-bg)]'} ${isRouletteLoser ? 'opacity-30 grayscale pointer-events-none' : ''}`}
          style={{ filter: isCompleting ? 'grayscale(50%)' : 'none', margin: 0 }}
        >
          <div className="flex-1 min-w-0 pr-1 relative">
          {isRouletteWinner && (
            <div className="absolute -top-5 left-0">
              <span className="bg-primary text-white text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-t-lg rounded-br-lg shadow-md flex items-center gap-1 cursor-pointer"
                    onClick={(e) => { e.stopPropagation(); setRouletteSelectedTaskId(null); }}
                    title="Clear selection">
                🎲 Start Here! <X size={10} className="ml-1 opacity-70 hover:opacity-100" />
              </span>
            </div>
          )}
          <div className={`relative inline-block overflow-hidden min-w-0 max-w-full ${isRouletteWinner ? 'mt-1' : ''}`}>
            <h4 className={`font-medium text-[15px] transition-all duration-300 ease-out flex flex-wrap items-center gap-2 ${isCompleting ? 'text-gray-500 line-through' : 'text-content'} break-words whitespace-normal`}>
              {task.isRecurring && <Repeat size={14} className={`flex-shrink-0 ${isCompleting ? 'text-muted/40' : 'text-muted/60'} ${isPaused ? 'opacity-50' : ''}`} title={`Repeats ${task.recurrenceInterval}`} />}
              <span className="break-words break-all">{task.title}</span>
              {task.tag && (
                <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                  {task.tag}
                </span>
              )}
              {(() => {
                const e = task.effortLevel || 'medium';
                let content = '';
                let bgStyle = '';
                if (e === 'low') { content = '⚡'; bgStyle = 'bg-green-900/40 text-green-400'; }
                else if (e === 'medium') { content = '⚡⚡'; bgStyle = 'bg-yellow-900/40 text-yellow-400'; }
                else { content = '⚡⚡⚡'; bgStyle = 'bg-red-900/40 text-red-500'; }
                return (
                 <motion.button 
                   whileTap={{ scale: 0.9 }}
                   onClick={(ev) => cycleEffort(ev, task.id, e)}
                   className={`shrink-0 text-xs px-2 py-0.5 rounded-full transition-colors ${bgStyle}`}
                 >
                   {content}
                 </motion.button>
                );
              })()}
              {(() => {
                const p = task.priority || 'medium';
                let colors = '';
                if (p === 'low') colors = 'bg-green-900/40 text-green-400';
                else if (p === 'medium') colors = 'bg-yellow-900/40 text-yellow-400';
                else colors = 'bg-red-900/40 text-red-500';
                return (
                  <motion.button 
                    whileTap={{ scale: 0.9 }}
                    onClick={(ev) => cyclePriority(ev, task.id, p)}
                    className={`text-[10px] tracking-wider uppercase font-semibold px-2 py-0.5 rounded-full transition-colors ${colors}`}
                  >
                    {p}
                  </motion.button>
                );
              })()}
              {task.isRecurring && (task.currentStreak || task.streakCount) ? (
                <>
                  {(() => {
                    const streak = task.currentStreak || task.streakCount || 0;
                    if (streak === 0) return null;
                    const status = calculateStreakStatus(task.lastCompletedDate);
                    if (status === 'broken') return null; // streak is visually 0
                    
                    const isValidStreak = streak > 0;
                    const icon = status === 'frozen' ? '🧊' : '🔥';
                    const colors = status === 'frozen' 
                      ? 'bg-blue-900/30 text-blue-400' 
                      : 'bg-orange-900/30 text-orange-400';
                      
                    return isValidStreak ? (
                      <span className={`text-[10px] tracking-wider font-bold px-2 py-0.5 rounded-full ${colors} shrink-0`} title={status === 'frozen' ? 'Grace Period - Complete today to save your streak!' : `Active streak: ${streak} days`}>
                        {icon} {streak}
                      </span>
                    ) : null;
                  })()}
                  {task.completionHistory && task.completionHistory.length >= 3 && (
                     <span className="text-[10px] tracking-wider font-medium px-2 py-0.5 rounded-full bg-surface border border-outline text-muted shrink-0" title="30-Day Consistency Score">
                       {calculateConsistency(task.completionHistory)}% consistent
                     </span>
                  )}
                </>
              ) : null}
            </h4>
          </div>
          <TaskDetails 
            task={task} 
            isCompleting={isCompleting} 
            onUpdateSubtask={async (newSubtasks) => {
              setTasks(prev => prev.map(t => t.id === task.id ? { ...t, subtasks: newSubtasks } : t));
              try {
                await dbService.updateTask(task.id, { subtasks: newSubtasks });
              } catch (e) {
                console.error("Failed to sync inline subtask update", e);
              }
            }}
            onStartFocus={(taskId, subtaskId, title) => setActiveFocusTask({taskId, subtaskId, title})}
          />
          {task.subtasks && task.subtasks.length > 0 && (
            <div className={`mt-3 w-full transition-opacity ${isCompleting ? 'opacity-40' : 'opacity-100'}`}>
              <div className="flex justify-between items-center mb-1 text-[10px] uppercase font-bold tracking-wider text-muted">
                <span>Sub-tasks</span>
                <span>{task.subtasks.filter(s => s.isCompleted).length} / {task.subtasks.length} - {Math.round((task.subtasks.filter(s => s.isCompleted).length / task.subtasks.length) * 100)}%</span>
              </div>
              <div className="w-full bg-outline h-1.5 rounded-full overflow-hidden">
                <div 
                  className="bg-primary h-full transition-all duration-500 ease-out"
                  style={{ width: `${(task.subtasks.filter(s => s.isCompleted).length / task.subtasks.length) * 100}%` }}
                />
              </div>
            </div>
          )}
        </div>
        <div className="flex items-start gap-2 mt-0.5 shrink-0">
          {activeTab === 'routines' && (
            <div className="flex flex-col gap-1 items-end mr-1">
              <button
                onClick={async (e) => {
                   e.stopPropagation();
                   const intervals: ('daily' | 'weekly' | 'monthly' | 'yearly')[] = ['daily', 'weekly', 'monthly', 'yearly'];
                   const currentIndex = intervals.indexOf(task.recurrenceInterval as any);
                   const next = intervals[(currentIndex + 1) % intervals.length];
                   if (!user) return;
                   try {
                     await dbService.updateTask(task.id, { recurrenceInterval: next });
                     fetchTasks();
                   } catch (e) {
                     if (isOffline) setToastError("Saved locally. Syncing when online.");
                     else setToastError("Failed to update task.");
                     console.error(e);
                   }
                }}
                className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-md text-muted hover:text-content hover:bg-outline/20 transition-colors"
                title="Change interval"
              >
                {task.recurrenceInterval?.substring(0, 1)}
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); togglePauseTask(task.id, !!task.isPaused); }}
                className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-md text-muted hover:text-content hover:bg-outline/20 transition-colors"
              >
                {task.isPaused ? "Resume" : "Pause"}
              </button>
            </div>
          )}
          <div className="flex flex-col gap-2">
            <motion.button 
              onClick={(e) => { e.stopPropagation(); completeTask(task.id); }}
              disabled={isCompleting}
              animate={isCompleting ? { scale: [1, 1.2, 1] } : { scale: 1 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className={`p-2 rounded-full border flex-shrink-0 transition-colors duration-300 ${isCompleting ? 'bg-success text-white border-success' : 'border-outline text-muted hover:border-success hover:text-success'}`}
            >
              <Check size={16} />
            </motion.button>
            {deleteConfirmId === task.id ? (
              <div className="flex flex-col gap-1 items-center justify-center translate-y-1">
                <button
                  onClick={(e) => deleteTaskDirectly(task.id, e)}
                  className="p-1 rounded-full text-red-500 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 transition-colors"
                  title="Confirm Delete"
                >
                  <Check size={14} />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(null); }}
                  className="p-1 rounded-full text-muted hover:text-content hover:bg-outline/20 transition-colors"
                  title="Cancel"
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <button
                onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(task.id); }}
                className="p-1 rounded-full text-muted hover:text-red-400 hover:bg-red-400/10 transition-colors flex justify-center mt-1"
                title="Delete task"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        </div>
        </motion.div>
      </motion.div>
    );
  };

const handlePullSubmit = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && pullInput.trim()) {
      e.preventDefault();
      setIsSubmitting(true);
      
      const firestoreId = dbService.getNewTaskId();
      const selectedCategory = activeTab === 'routines' ? 'household' : activeTab as 'life' | 'household' | 'inbox';
      const newTaskData: Omit<Task, 'id' | 'createdAt'> = {
          userId: user!.uid,
          title: pullInput.trim(),
          description: "",
          status: 'active',
          category: selectedCategory,
          isRecurring: false,
          subtasks: [],
          priority: 'medium',
          effortLevel: 'medium'
      };

      setTasks(prev => [{ id: firestoreId, ...newTaskData, createdAt: new Date().toISOString() } as Task, ...prev]);
      setPullInput("");
      setIsPullCapturing(false);
      setIsSubmitting(false);

      if (isOffline) {
        setSyncStatus('offline_saved');
      } else {
        setSyncStatus('syncing');
        try {
          await dbService.saveTask(firestoreId, newTaskData);
          setSyncStatus('synced');
        } catch (error) {
          console.error("Failed to background sync pull task", error);
        }
      }
    }
  };

  const EmptyState = () => {
    if (isSorting) return null;

    // Use useMemo to keep the same random visual for the duration of the component's lifecycle per tab
    const visual = useMemo(() => {
      const inboxVisuals = [
         { icon: Wind, title: "A Breath of Fresh Air.", message: "Inbox zero achieved. Your mind can rest easy for now." },
         { icon: Cloud, title: "Clear Skies.", message: "Nothing left unsorted. Take a deep breath." },
         { icon: Feather, title: "Light as a Feather.", message: "Your thoughts are all organized. Enjoy the clarity." }
      ];
      const lifeVisuals = [
         { icon: Leaf, title: "Quiet Moments.", message: "Your life focuses are handled. Enjoy the stillness of the present." },
         { icon: Sun, title: "Radiant Peace.", message: "You have nurtured your goals today. Bask in the warmth of progress." },
         { icon: Mountain, title: "Peak Reached.", message: "You've conquered today's personal challenges. Rest and recover." }
      ];
      const householdVisuals = [
         { icon: Coffee, title: "Chores Complete.", message: "The house is in order. Time to sit back, relax, and enjoy your space." },
         { icon: Home, title: "Sanctuary Restored.", message: "Everything is precisely where it should be. Enjoy your haven." },
         { icon: Sparkles, title: "Spotless and Serene.", message: "Your environment is calm and clean. You've earned a break." }
      ];
      const routinesVisuals = [
         { icon: Moon, title: "Habits Checked.", message: "You've successfully completed your routines. The rest of the day is yours." },
         { icon: Compass, title: "True North.", message: "You've stayed perfectly on course today. Beautiful consistency." },
         { icon: Waves, title: "Smooth Sailing.", message: "Your habits are flowing effortlessly. Ride the gentle wave." }
      ];

      let list = inboxVisuals;
      if (activeTab === 'life') list = lifeVisuals;
      else if (activeTab === 'household') list = householdVisuals;
      else if (activeTab === 'routines') list = routinesVisuals;

      return list[Math.floor(Math.random() * list.length)];
    }, [activeTab]);

    const Icon = visual.icon;

    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] py-12 text-center">
        <Icon size={48} strokeWidth={1} className="text-gray-500/50 mb-4" />
        <h3 className="text-xl font-medium mb-1 text-content">{visual.title}</h3>
        <p className="text-sm max-w-xs leading-relaxed text-muted">
          {visual.message}
        </p>
      </div>
    );
  };

  const renderTaskList = () => {
    if (activeTab === 'routines') {
      const intervals = ['daily', 'weekly', 'monthly', 'yearly'] as const;
      return (
        <div className="space-y-6">
          {intervals.map(interval => {
            const intervalTasks = sortedTasks.filter(t => t.recurrenceInterval === interval);
            if (intervalTasks.length === 0) return null;
            return (
              <div key={interval} className="flex flex-col">
                <h3 className="text-sm font-semibold tracking-wide text-muted uppercase ml-1 px-1 mb-3">{interval}</h3>
                <AnimatePresence mode="popLayout">
                  {intervalTasks.map(renderTask)}
                </AnimatePresence>
              </div>
            );
          })}
          {sortedTasks.length === 0 && <EmptyState />}
        </div>
      );
    }

    return (
      <div className="flex flex-col">
        <AnimatePresence mode="popLayout">
          {sortedTasks.map(renderTask)}
        </AnimatePresence>
        {currentTasks.length === 0 && <EmptyState />}
      </div>
    );
  };

  return (
    <div className={`distraction-free relative min-h-screen transition-colors duration-1000 ${phase === 'night' ? 'night-theme-override' : ''}`}>
      <header className="flex justify-between items-center mb-6 pt-4">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-light tracking-tight transition-colors duration-1000">
            {phase === 'morning' && "Let's focus."}
            {phase === 'afternoon' && "Keep the momentum."}
            {phase === 'evening' && "Wrapping up the day."}
            {phase === 'night' && "Time to wind down."}
          </h1>
        </div>
        <div className="flex gap-2 items-center">
          <div className="relative group flex items-center">
            <button onClick={handleManualSync} disabled={isSyncing} className="p-2 text-muted hover:text-content transition-colors rounded-full hover:bg-outline/30 flex items-center gap-2" title="Push to Cloud">
              {isSyncing ? <Repeat size={20} className="animate-spin text-primary" /> : <Cloud size={20} />}
              {hasUnsyncedChanges && !isSyncing && <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-orange-500 rounded-full border-2 border-base"></span>}
            </button>
            <div className="hidden group-hover:flex absolute top-full right-0 mt-2 bg-surface border border-outline rounded-lg p-3 text-xs text-muted shadow-lg flex-col whitespace-nowrap z-50">
              <span className="font-semibold text-content mb-1">Local-First Sync</span>
              {hasUnsyncedChanges ? <span className="text-orange-400">Unsynced changes</span> : <span className="text-green-500">All changes synced</span>}
              <span className="mt-1 opacity-70">Last synced: {lastSyncedAt ? new Date(lastSyncedAt).toLocaleString() : 'Never'}</span>
            </div>
          </div>
          <button onClick={() => setShowHistory(true)} className="p-2 text-muted hover:text-content transition-colors rounded-full hover:bg-outline/30" title="History">
            <Archive size={20} />
          </button>
          <button onClick={() => setShowWeeklyWins(true)} className="p-2 text-muted hover:text-content transition-colors rounded-full hover:bg-outline/30" title="Weekly Wins">
            <Trophy size={20} />
          </button>
          <button onClick={() => setShowProfile(true)} className="p-2 text-muted hover:text-content transition-colors rounded-full hover:bg-outline/30" title="Settings">
            <SettingsIcon size={20} />
          </button>
          <button 
            onClick={() => { 
              if (confirmLogout) {
                if (Capacitor.isNativePlatform()) {
                  GoogleAuth.signOut().catch(console.error).finally(() => {
                    offlineLogout();
                    auth.signOut();
                  });
                } else {
                  offlineLogout();
                  auth.signOut();
                }
              } else {
                setConfirmLogout(true);
                setTimeout(() => setConfirmLogout(false), 3000);
              }
            }} 
            className={`p-2 transition-colors rounded-full hover:bg-outline/30 flex items-center gap-2 ${confirmLogout ? 'text-red-500 bg-red-500/10 hover:bg-red-500/20 px-4' : 'text-muted hover:text-content'}`}
          >
            <LogOut size={20} />
            {confirmLogout && <span className="text-xs font-semibold uppercase tracking-wider">Confirm</span>}
          </button>
        </div>
      </header>

      {/* Low-Energy Mode Toggle */}
      <div className="mb-8 flex items-center justify-between bg-[var(--card-bg)] border border-outline rounded-[20px] p-4 shadow-sm relative overflow-hidden group transition-colors">
        {isLowEnergyMode && <div className="absolute inset-0 bg-yellow-500/5 mix-blend-overlay"></div>}
        <div className="flex flex-col relative z-10">
          <span className={`text-sm font-semibold flex items-center gap-2 transition-colors ${isLowEnergyMode ? 'text-yellow-600' : 'text-content'}`}>
            <span className="text-lg">⚡</span> Low-Energy Mode
          </span>
          <span className="text-xs text-muted">Only show quick, easy tasks</span>
        </div>
        <button
          onClick={() => setIsLowEnergyMode(!isLowEnergyMode)}
          className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 z-10 ${isLowEnergyMode ? 'bg-yellow-500' : 'bg-outline'}`}
        >
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${isLowEnergyMode ? 'translate-x-6' : 'translate-x-1 shadow-sm'}`}
          />
        </button>
      </div>

      <section className="mb-12">
        <div className="flex justify-between items-center mb-3 px-1">
          <div className="flex gap-2 overflow-x-auto no-scrollbar py-1 flex-1 mask-linear-right">
            <button
              onClick={() => setActiveTag(null)}
              className={`flex-shrink-0 text-[10px] uppercase font-semibold px-3 py-1.5 rounded-full transition-colors border ${!activeTag ? 'bg-primary text-white border-primary' : 'bg-surface text-muted border-outline hover:border-primary/50'}`}
            >
              All
            </button>
            {uniqueTags.map(tag => (
              <button
                key={tag}
                onClick={() => setActiveTag(tag)}
                className={`flex-shrink-0 text-[10px] uppercase font-semibold px-3 py-1.5 rounded-full transition-colors border ${activeTag === tag ? 'bg-primary text-white border-primary' : 'bg-surface text-muted border-outline hover:border-primary/50'}`}
              >
                {tag}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 ml-2 pl-2 border-l border-outline">
            <select
              value={sortOption}
              onChange={(e) => setSortOption(e.target.value as 'date' | 'priority' | 'effort')}
              className="text-xs font-medium text-primary bg-transparent outline-none cursor-pointer"
            >
              <option value="date" className="bg-surface text-content">Date</option>
              <option value="priority" className="bg-surface text-content">Priority</option>
              <option value="effort" className="bg-surface text-content">Energy Level</option>
            </select>
            <button 
              onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
              className="text-xs font-medium text-primary flex items-center gap-1 hover:opacity-80 transition-opacity whitespace-nowrap"
            >
              {sortOrder === 'desc' ? <><ArrowDown size={14} /> {sortOption === 'date' ? 'Newest' : 'Highest'}</> : <><ArrowUp size={14} /> {sortOption === 'date' ? 'Oldest' : 'Lowest'}</>}
            </button>
          </div>
        </div>
        <div className="relative">
          {isPullCapturing && (
            <div className="w-full mb-4 z-10 relative">
              <div className="flex items-center gap-2 bg-surface border border-primary/50 shadow-md rounded-[20px] p-2 pr-4">
                <input 
                  ref={pullRef}
                  type="text" 
                  value={pullInput}
                  onChange={(e) => setPullInput(e.target.value)}
                  onKeyDown={handlePullSubmit}
                  placeholder={`Quick add to ${activeTab === 'life' ? 'Life Focus' : activeTab === 'inbox' ? 'Unsorted' : 'Household'}...`}
                  className="flex-1 bg-transparent border-none outline-none text-content text-sm ml-2"
                  autoFocus 
                  disabled={isSubmitting}
                />
                <button onClick={() => setIsPullCapturing(false)} className="text-xs text-muted hover:text-red-500 font-medium">Cancel</button>
              </div>
            </div>
          )}

          <motion.div
            ref={listRef}
            style={{ y: dragY }}
            drag={canDrag && activeTab !== 'routines' ? "y" : false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={0.2}
            onDragEnd={(_, info) => {
              if (info.offset.y > 120 && activeTab !== 'routines') {
                if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate([50, 50]);
                setIsPullCapturing(true);
              }
            }}
            className="relative z-10 bg-[var(--bg-color)] min-h-[50vh]"
          >
            {renderTaskList()}
          </motion.div>
        </div>
      </section>

      <section className="pb-10">
        {activeTab === 'routines' ? (
          <button 
            onClick={() => {
               setRoutineTitle("");
               setRoutineDescription("");
               setRoutineTag("");
               setNewSubtasks([]);
               setNewSubtaskInput("");
               setShowRoutineModal(true);
            }}
            className="w-full mb-4 shadow-sm flex items-center justify-center py-4 rounded-[20px] gap-2 border border-outline border-dashed hover:border-primary/50 transition-colors bg-surface text-muted hover:text-content font-medium text-sm"
          >
            <Plus size={18} />
            <span>Add Routine Manually</span>
          </button>
        ) : (
          <button 
            onClick={() => {
               setNewTaskTitle("");
               setNewTaskDescription("");
               setNewTaskTag("");
               setNewTaskCategory(activeTab === 'routines' ? 'household' : (activeTab as 'life' | 'household' | 'inbox'));
               setShowTaskModal(true);
            }}
            className={`w-full mb-4 flex items-center justify-center py-4 px-2 gap-2 transition-colors font-medium text-sm group rounded-[20px] shadow-sm border border-outline border-dashed ${
              activeTab === 'life' ? 'text-blue-500 hover:bg-blue-500/5 hover:border-blue-500/30' : 
              activeTab === 'inbox' ? 'text-indigo-500 hover:bg-indigo-500/5 hover:border-indigo-500/30' : 
              'text-orange-500 hover:bg-orange-500/5 hover:border-orange-500/30'
            }`}
          >
            <Plus size={20} className="transition-transform group-hover:scale-110" />
            <span className="font-medium">Add Task</span>
          </button>
        )}
        <div className="flex flex-row items-center justify-center gap-3 w-full mt-4 mb-6 relative z-20">
          {activeTab !== 'inbox' ? (
            <>
              <button 
                onClick={generateSuggestions} 
                disabled={loadingSuggestions || !bio || bio === "{}" || isOffline}
                className={`flex-1 h-10 flex items-center justify-center gap-2 rounded-xl text-sm font-medium transition-all duration-200 bg-primary/10 text-primary hover:bg-primary/20 ${isOffline ? 'opacity-50 cursor-not-allowed' : ''}`}
                title="Anticipate For Me"
              >
                <Sparkles size={16} className={loadingSuggestions ? "animate-pulse" : ""} />
                <span className="hidden sm:inline">{isOffline ? "Offline" : loadingSuggestions ? "Anticipating" : "Anticipate"}</span>
              </button>
              <button
                onClick={handleSpinRoulette}
                disabled={currentTasks.length === 0}
                className={`flex-1 h-10 flex items-center justify-center gap-2 rounded-xl text-sm font-medium transition-all duration-200 bg-white/5 text-gray-300 hover:bg-white/10 border border-white/10 ${currentTasks.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                title="Pick For Me"
              >
                <span className="text-base leading-none">🎲</span> <span className="hidden sm:inline">{rouletteSelectedTaskId ? "Re-roll" : "Pick For Me"}</span>
              </button>
            </>
          ) : (
            <button 
              onClick={handleSortForMe} 
              disabled={isSorting || currentTasks.length === 0 || isOffline}
              className={`flex-1 h-10 flex items-center justify-center gap-2 rounded-xl text-sm font-medium transition-all duration-200 bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 ${(isOffline || currentTasks.length === 0) ? 'opacity-50 cursor-not-allowed' : ''}`}
              title="Sort For Me"
            >
              <Sparkles size={16} className={isSorting ? "animate-pulse" : ""} />
              <span className="hidden sm:inline">{isOffline ? "Offline" : isSorting ? "Sorting..." : "Sort For Me"}</span>
            </button>
          )}
          
          {clearAllConfirm ? (
             <div className={`flex-1 h-10 flex items-center justify-center gap-2 bg-red-500/10 rounded-xl transition-all duration-200 ${isOffline || isClearing ? 'opacity-50 cursor-not-allowed' : ''}`}>
               <button onClick={executeClearAllTasks} disabled={isClearing || isOffline} className="flex flex-1 items-center justify-center gap-1 text-sm font-medium text-red-500 hover:text-red-400 transition-colors" title="Confirm Clear"><Check size={16} /><span className="hidden sm:inline">Sure?</span></button>
               <div className="w-[1px] h-4 bg-red-500/20"></div>
               <button onClick={() => setClearAllConfirm(false)} className="flex flex-1 items-center justify-center text-muted hover:text-content transition-colors" title="Cancel"><X size={16} /></button>
             </div>
          ) : (
            <button
              onClick={() => setClearAllConfirm(true)}
              disabled={isClearing || isOffline}
              className={`flex-1 h-10 flex items-center justify-center gap-2 rounded-xl text-sm font-medium transition-all duration-200 bg-red-500/10 text-red-400 hover:bg-red-500/20 ${isOffline || isClearing ? 'opacity-50 cursor-not-allowed' : ''}`}
              title="Clear all tasks in this tab"
            >
              <Trash2 size={16} />
              <span className="hidden sm:inline">{isClearing ? "Clearing..." : "Clear All"}</span>
            </button>
          )}

          {currentSuggestions.length > 0 && (
            <button
              onClick={() => setSuggestionCache(prev => ({ ...prev, [activeTab]: [] }))}
              className="flex-[0.5] h-10 flex items-center justify-center gap-2 rounded-xl text-sm font-medium transition-all duration-200 bg-white/5 text-gray-400 hover:text-gray-200 hover:bg-white/10 border border-white/10"
              title="Clear suggestions"
            >
              Clear
            </button>
          )}
        </div>

        {loadingSuggestions && (
           <div className="flex flex-col items-center mb-6 animate-in fade-in slide-in-from-top-2 duration-300">
             {isTakingLong && (
               <p className="text-xs text-gray-400 text-center mb-2 px-4">
                 This is taking longer than usual. The AI might be under high demand or your connection is slow.
               </p>
             )}
             <button
               onClick={() => abortController?.abort()}
               className="px-4 py-1.5 text-xs font-medium text-red-500 bg-red-500/10 hover:bg-red-500/20 border-transparent rounded-full transition-colors"
             >
               Cancel Request
             </button>
           </div>
        )}

        {(!bio || bio === "{}") && (
          <div className="card-minimal bg-surface/50 border-dashed text-center py-8">
            <p className="text-muted mb-4 font-light text-sm">Tell the AI about your life to enable proactive suggestions.</p>
            <button onClick={() => setShowProfile(true)} className="btn-secondary text-xs uppercase tracking-widest px-4 py-2">Setup Context</button>
          </div>
        )}

        <div className="grid gap-3">
          {currentSuggestions.length > 0 && (
            <div className="flex items-center justify-end px-2 pb-1">
              <label className="flex items-center gap-2 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={sortAnticipatedByEffort}
                  onChange={(e) => setSortAnticipatedByEffort(e.target.checked)}
                  className="rounded text-primary border-outline focus:ring-primary/20 cursor-pointer w-3.5 h-3.5 transition-colors"
                />
                <span className="text-[11px] font-semibold text-muted group-hover:text-content uppercase tracking-wider transition-colors">Sort from easiest to hardest</span>
              </label>
            </div>
          )}
          <AnimatePresence>
            {displayedAnticipatedTasks.map((suggestion, idx) => (
              <motion.div
                key={suggestion.title}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: idx * 0.05, duration: 0.3 }}
                className="card-minimal border-outline bg-surface"
              >
                <div className="flex justify-between items-start mb-2 gap-2">
                  <h4 className="font-medium text-[15px] leading-snug flex items-center gap-2 flex-wrap">
                    {suggestion.isRecurring && <Repeat size={14} className="flex-shrink-0 text-muted/60" title={`Repeats ${suggestion.recurrenceInterval}`} />}
                    {suggestion.title}
                    {suggestion.tag && (
                      <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                        {suggestion.tag}
                      </span>
                    )}
                  </h4>
                  <div className="flex gap-1 flex-shrink-0">
                    <button onClick={() => acceptSuggestion(suggestion)} title="Add to list" className="p-1.5 text-muted hover:text-success bg-surface shadow-sm rounded-full border border-outline transition-colors">
                      <Check size={14} />
                    </button>
                    <button onClick={() => dismissSuggestion(suggestion.title)} title="Dismiss" className="p-1.5 text-muted hover:text-red-500 bg-surface shadow-sm rounded-full border border-outline transition-colors">
                      <X size={14} />
                    </button>
                  </div>
                </div>
                <TaskDetails task={suggestion as any} isCompleting={false} />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </section>

      {/* Routine Modal */}
      <BottomSheet isOpen={showRoutineModal} onClose={() => setShowRoutineModal(false)}>
        <h2 className="text-xl font-light mb-6">New Routine</h2>
        
        <form onSubmit={addRoutine} className="space-y-4">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted ml-1 mb-1 block">Title</label>
            <input
              type="text"
              required
              value={routineTitle}
              onChange={(e) => setRoutineTitle(e.target.value)}
              placeholder="e.g. Water plants"
              className="input-minimal w-full"
            />
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted ml-1 mb-1 block">Description (Optional)</label>
            <textarea
              value={routineDescription}
              onChange={(e) => setRoutineDescription(e.target.value)}
              placeholder="Add details..."
              className="input-minimal w-full min-h-[80px] resize-none bg-[var(--card-bg)] text-sm"
            />
          </div>
          
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted ml-1 mb-1 block">Sub-tasks (Checklist)</label>
            {newSubtasks.length > 0 && (
              <div className="mb-2 space-y-1">
                {newSubtasks.map((st) => (
                  <div key={st.id} className="flex justify-between items-center bg-[var(--card-bg)] px-3 py-2 rounded-xl border border-outline text-sm">
                    <span className="truncate">{st.text}</span>
                    {subtaskDeleteConfirmId === st.id ? (
                      <div className="flex items-center gap-1 border border-red-500/20 bg-red-500/10 rounded-full px-1 py-1 shrink-0 ml-2">
                        <button
                          type="button"
                          onClick={() => {
                            setNewSubtasks(prev => prev.filter(s => s.id !== st.id));
                            setSubtaskDeleteConfirmId(null);
                          }}
                          className="p-1 text-red-500 hover:bg-red-500/20 rounded-full transition-colors"
                        >
                          <Check size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setSubtaskDeleteConfirmId(null)}
                          className="p-1 text-muted hover:bg-outline/20 rounded-full transition-colors"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setSubtaskDeleteConfirmId(st.id)}
                        className="text-muted hover:text-red-500 transition-colors ml-2 shrink-0 bg-outline/20 p-1 rounded-full"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <input
                type="text"
                value={newSubtaskInput}
                onChange={(e) => setNewSubtaskInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (newSubtaskInput.trim()) {
                      setNewSubtasks(prev => [...prev, { id: 'st-' + Date.now(), text: newSubtaskInput.trim(), isCompleted: false }]);
                      setNewSubtaskInput("");
                    }
                  }
                }}
                placeholder="Add a sub-task..."
                className="input-minimal flex-1 text-sm bg-[var(--card-bg)]"
              />
              <button
                type="button"
                onClick={() => {
                  if (newSubtaskInput.trim()) {
                    setNewSubtasks(prev => [...prev, { id: 'st-' + Date.now(), text: newSubtaskInput.trim(), isCompleted: false }]);
                    setNewSubtaskInput("");
                  }
                }}
                className="px-3 bg-outline/20 hover:bg-outline/40 text-muted hover:text-content rounded-xl text-sm font-medium transition-colors"
              >
                Add
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted ml-1 mb-1 block">Interval</label>
              <select
                value={routineInterval}
                onChange={(e) => setRoutineInterval(e.target.value as any)}
                className="input-minimal w-full appearance-none bg-[var(--card-bg)] text-sm cursor-pointer"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted ml-1 mb-1 block">Category</label>
              <select
                value={routineCategory}
                onChange={(e) => setRoutineCategory(e.target.value as any)}
                className="input-minimal w-full appearance-none bg-[var(--card-bg)] text-sm cursor-pointer"
              >
                <option value="life">Life Focus</option>
                <option value="household">Household</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted ml-1 mb-1 block">Tag (Optional)</label>
            <input
              type="text"
              value={routineTag}
              onChange={(e) => setRoutineTag(e.target.value)}
              placeholder="e.g. garden"
              className="input-minimal w-full"
            />
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted ml-1 mb-1 block">Priority</label>
            <select
              value={routinePriority}
              onChange={(e) => setRoutinePriority(e.target.value as any)}
              className="input-minimal w-full appearance-none bg-[var(--card-bg)] text-sm cursor-pointer"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>

          <div className="pt-8">
            <button 
              type="submit" 
              disabled={isSubmitting}
              className={`w-full btn-primary py-4 rounded-[16px] shadow-sm text-sm font-medium transition-all ${isSubmitting ? 'opacity-70 cursor-not-allowed' : ''}`}
            >
              {isSubmitting ? 'Saving...' : 'Save Routine'}
            </button>
          </div>
        </form>
      </BottomSheet>


      {/* Task Modal */}
      <BottomSheet isOpen={showTaskModal} onClose={() => setShowTaskModal(false)}>
        <h2 className="text-xl font-light mb-6">New {activeTab === 'life' ? 'Life Focus' : activeTab === 'inbox' ? 'Unsorted' : 'Household'} Task</h2>
        
        <form onSubmit={addTask} className="space-y-4">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted ml-1 mb-1 block">Title</label>
            <input
              ref={inputRef}
              type="text"
              required
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              placeholder={activeTab === 'life' ? "e.g. Review UpToDate heart failure guidelines" : activeTab === 'inbox' ? "e.g. Brain dump..." : "e.g. Buy millet for Ziko"}
              className="input-minimal w-full"
            />
          </div>
          
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted ml-1 mb-1 block">Description (Optional)</label>
            <textarea
              value={newTaskDescription}
              onChange={(e) => setNewTaskDescription(e.target.value)}
              placeholder="Add details..."
              className="input-minimal w-full min-h-[80px] resize-none bg-[var(--card-bg)] text-sm"
            />
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted ml-1 mb-1 block">Sub-tasks</label>
            <div className="space-y-2 mb-3">
              {newSubtasks.map((subtask) => (
                <div key={subtask.id} className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setNewSubtasks(prev => prev.map(s => s.id === subtask.id ? { ...s, isCompleted: !s.isCompleted } : s))}
                    className={`w-4 h-4 rounded-sm border flex items-center justify-center transition-colors ${subtask.isCompleted ? 'bg-primary border-primary text-background' : 'border-outline hover:border-muted text-transparent'}`}
                  >
                    <Check size={12} />
                  </button>
                  <span className={`text-sm flex-1 ${subtask.isCompleted ? 'line-through text-muted' : 'text-content'}`}>{subtask.text}</span>
                  {subtaskDeleteConfirmId === subtask.id ? (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                           setNewSubtasks(prev => prev.filter(s => s.id !== subtask.id));
                           setSubtaskDeleteConfirmId(null);
                        }}
                        className="p-1 text-red-400 hover:bg-red-400/10 rounded-full transition-colors"
                      ><Check size={14} /></button>
                      <button type="button" onClick={() => setSubtaskDeleteConfirmId(null)} className="p-1 text-muted hover:bg-outline/20 rounded-full transition-colors"><X size={14} /></button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setSubtaskDeleteConfirmId(subtask.id)}
                      className="p-1 text-muted hover:text-red-400 transition-colors"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newSubtaskInput}
                onChange={(e) => setNewSubtaskInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (newSubtaskInput.trim()) {
                      setNewSubtasks(prev => [...prev, { id: 'st-' + Date.now(), text: newSubtaskInput.trim(), isCompleted: false }]);
                      setNewSubtaskInput("");
                    }
                  }
                }}
                placeholder="Add a sub-task..."
                className="input-minimal flex-1 text-sm bg-[var(--card-bg)]"
              />
              <button
                type="button"
                onClick={() => {
                  if (newSubtaskInput.trim()) {
                    setNewSubtasks(prev => [...prev, { id: 'st-' + Date.now(), text: newSubtaskInput.trim(), isCompleted: false }]);
                    setNewSubtaskInput("");
                  }
                }}
                className="px-3 bg-outline/20 hover:bg-outline/40 text-muted hover:text-content rounded-xl text-sm font-medium transition-colors"
              >
                Add
              </button>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted ml-1 mb-1 block">Category</label>
            <select
              value={newTaskCategory}
              onChange={(e) => setNewTaskCategory(e.target.value as any)}
              className="input-minimal w-full appearance-none bg-[var(--card-bg)] text-sm cursor-pointer"
            >
              <option value="life">Life Focus</option>
              <option value="household">Household & Shopping</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted ml-1 mb-1 block">Tag (Optional)</label>
            <input
              type="text"
              value={newTaskTag}
              onChange={(e) => setNewTaskTag(e.target.value)}
              placeholder={activeTab === 'life' ? "e.g. board prep" : activeTab === 'inbox' ? "e.g. thoughts" : "e.g. pet supplies"}
              className="input-minimal w-full"
            />
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted ml-1 mb-1 block">Priority</label>
            <div className="flex bg-[var(--card-bg)] rounded-xl p-1 gap-1 border border-outline">
              <button type="button" onClick={() => setNewTaskPriority('low')} className={`flex-1 py-2 text-xs font-medium rounded-lg transition-colors ${newTaskPriority === 'low' ? 'bg-background shadow-sm text-content' : 'text-muted hover:text-content'}`}>Low</button>
              <button type="button" onClick={() => setNewTaskPriority('medium')} className={`flex-1 py-2 text-xs font-medium rounded-lg transition-colors ${newTaskPriority === 'medium' ? 'bg-background shadow-sm text-content' : 'text-muted hover:text-content'}`}>Medium</button>
              <button type="button" onClick={() => setNewTaskPriority('high')} className={`flex-1 py-2 text-xs font-medium rounded-lg transition-colors ${newTaskPriority === 'high' ? 'bg-background shadow-sm text-content' : 'text-muted hover:text-content'}`}>High</button>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted ml-1 mb-1 block">Effort Level</label>
            <div className="flex bg-[var(--card-bg)] rounded-xl p-1 gap-1 border border-outline">
              <button type="button" onClick={() => setNewTaskEffortLevel('low')} className={`flex-1 py-2 text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-1.5 ${newTaskEffortLevel === 'low' ? 'bg-background shadow-sm text-content' : 'text-muted hover:text-content'}`}><span className="text-yellow-500 text-[10px]">⚡</span> Low</button>
              <button type="button" onClick={() => setNewTaskEffortLevel('medium')} className={`flex-1 py-2 text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-1.5 ${newTaskEffortLevel === 'medium' ? 'bg-background shadow-sm text-content' : 'text-muted hover:text-content'}`}><span className="text-yellow-500 text-[10px]">⚡⚡</span> Medium</button>
              <button type="button" onClick={() => setNewTaskEffortLevel('high')} className={`flex-1 py-2 text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-1.5 ${newTaskEffortLevel === 'high' ? 'bg-background shadow-sm text-content' : 'text-muted hover:text-content'}`}><span className="text-yellow-500 text-[10px]">⚡⚡⚡</span> High</button>
            </div>
          </div>

          <div className="pt-8">
            <button 
              type="submit" 
              disabled={isSubmitting}
              className={`w-full btn-primary py-4 rounded-[16px] shadow-sm text-sm font-medium transition-all ${isSubmitting ? 'opacity-70 cursor-not-allowed' : ''}`}
            >
              {isSubmitting ? 'Saving...' : 'Save Task'}
            </button>
          </div>
        </form>
      </BottomSheet>

      {/* Edit Task Modal */}
      <BottomSheet isOpen={showEditTaskModal && !!editingTask} onClose={() => setShowEditTaskModal(false)}>
        <h2 className="text-xl font-light mb-6">Edit Task</h2>
        
        <form onSubmit={saveEditTask} className="space-y-4">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted ml-1 mb-1 block">Title</label>
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              placeholder="E.g., Renew insurance"
              className="input-minimal w-full bg-[var(--card-bg)]"
              autoFocus
            />
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted ml-1 mb-1 block">Description (Optional)</label>
            <textarea
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              placeholder="Add details..."
              className="input-minimal w-full min-h-[80px] resize-none bg-[var(--card-bg)] text-sm"
            />
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted ml-1 mb-1 block">Sub-tasks</label>
            <div className="space-y-2 mb-3">
              {editSubtasks.map((subtask) => (
                <div key={subtask.id} className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      const updatedSubtasks = editSubtasks.map(s => s.id === subtask.id ? { ...s, isCompleted: !s.isCompleted } : s);
                      setEditSubtasks(updatedSubtasks);
                      if (editingTask) {
                        setTasks(prev => prev.map(t => t.id === editingTask.id ? { ...t, subtasks: updatedSubtasks } : t));
                        try {
                          await dbService.updateTask(editingTask.id, { subtasks: updatedSubtasks });
                        } catch (e) {
                          console.error("Failed to sync subtask", e);
                        }
                      }
                    }}
                    className={`w-4 h-4 rounded-sm border flex items-center justify-center transition-colors ${subtask.isCompleted ? 'bg-primary border-primary text-background' : 'border-outline hover:border-muted text-transparent'}`}
                  >
                    <Check size={12} />
                  </button>
                  <span className={`text-sm flex-1 ${subtask.isCompleted ? 'line-through text-muted' : 'text-content'}`}>{subtask.text}</span>
                  {subtaskDeleteConfirmId === subtask.id ? (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                           setEditSubtasks(prev => prev.filter(s => s.id !== subtask.id));
                           setSubtaskDeleteConfirmId(null);
                        }}
                        className="p-1 text-red-400 hover:bg-red-400/10 rounded-full transition-colors"
                      ><Check size={14} /></button>
                      <button type="button" onClick={() => setSubtaskDeleteConfirmId(null)} className="p-1 text-muted hover:bg-outline/20 rounded-full transition-colors"><X size={14} /></button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setSubtaskDeleteConfirmId(subtask.id)}
                      className="p-1 text-muted hover:text-red-400 transition-colors"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={editSubtaskInput}
                onChange={(e) => setEditSubtaskInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (editSubtaskInput.trim()) {
                      setEditSubtasks(prev => [...prev, { id: 'st-' + Date.now(), text: editSubtaskInput.trim(), isCompleted: false }]);
                      setEditSubtaskInput("");
                    }
                  }
                }}
                placeholder="Add a sub-task..."
                className="input-minimal flex-1 text-sm bg-[var(--card-bg)]"
              />
              <button
                type="button"
                onClick={() => {
                  if (editSubtaskInput.trim()) {
                    setEditSubtasks(prev => [...prev, { id: 'st-' + Date.now(), text: editSubtaskInput.trim(), isCompleted: false }]);
                    setEditSubtaskInput("");
                  }
                }}
                className="px-3 bg-outline/20 hover:bg-outline/40 text-muted hover:text-content rounded-xl text-sm font-medium transition-colors"
              >
                Add
              </button>
              {!editSubtaskInput && (
                <button
                  type="button"
                  onClick={handleDecomposeEdit}
                  disabled={isDecomposingEdit}
                  title="Break it down with AI"
                  className={`px-3 flex items-center justify-center rounded-xl text-sm font-medium transition-colors ${isDecomposingEdit ? 'bg-primary/20 text-primary opacity-70 cursor-not-allowed' : 'bg-primary/10 text-primary hover:bg-primary/20'}`}
                >
                  <Sparkles size={16} className={isDecomposingEdit ? "animate-pulse" : ""} />
                </button>
              )}
              {backupSubtasksEdit && !editSubtaskInput && (
                <button
                  type="button"
                  onClick={handleRevertEdit}
                  title="Revert AI Breakdown"
                  className="px-2 flex items-center justify-center bg-red-500/10 text-red-500 hover:bg-red-500/20 rounded-xl transition-colors"
                >
                  <CornerUpLeft size={16} />
                </button>
              )}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted ml-1 mb-1 block">Context</label>
            <div className="flex bg-[var(--card-bg)] rounded-full p-1 border border-outline mt-2">
              <button
                type="button"
                onClick={() => setEditCategory('life')}
                className={`flex-1 py-1.5 px-3 rounded-full text-xs font-semibold transition-all ${editCategory === 'life' ? 'bg-primary text-surface shadow-sm' : 'text-muted hover:text-content'}`}
              >
                Life
              </button>
              <button
                type="button"
                onClick={() => setEditCategory('household')}
                className={`flex-1 py-1.5 px-3 rounded-full text-xs font-semibold transition-all ${editCategory === 'household' ? 'bg-primary text-surface shadow-sm' : 'text-muted hover:text-content'}`}
              >
                Household
              </button>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted ml-1 mb-1 block">Priority</label>
            <div className="flex bg-[var(--card-bg)] rounded-xl p-1 gap-1 border border-outline">
              <button type="button" onClick={() => setEditPriority('low')} className={`flex-1 py-2 text-xs font-medium rounded-lg transition-colors ${editPriority === 'low' ? 'bg-background shadow-sm text-content' : 'text-muted hover:text-content'}`}>Low</button>
              <button type="button" onClick={() => setEditPriority('medium')} className={`flex-1 py-2 text-xs font-medium rounded-lg transition-colors ${editPriority === 'medium' ? 'bg-background shadow-sm text-content' : 'text-muted hover:text-content'}`}>Medium</button>
              <button type="button" onClick={() => setEditPriority('high')} className={`flex-1 py-2 text-xs font-medium rounded-lg transition-colors ${editPriority === 'high' ? 'bg-background shadow-sm text-content' : 'text-muted hover:text-content'}`}>High</button>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted ml-1 mb-1 block">Effort Level</label>
            <div className="flex bg-[var(--card-bg)] rounded-xl p-1 gap-1 border border-outline">
              <button type="button" onClick={() => setEditEffortLevel('low')} className={`flex-1 py-2 text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-1.5 ${editEffortLevel === 'low' ? 'bg-background shadow-sm text-content' : 'text-muted hover:text-content'}`}><span className="text-yellow-500 text-[10px]">⚡</span> Low</button>
              <button type="button" onClick={() => setEditEffortLevel('medium')} className={`flex-1 py-2 text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-1.5 ${editEffortLevel === 'medium' ? 'bg-background shadow-sm text-content' : 'text-muted hover:text-content'}`}><span className="text-yellow-500 text-[10px]">⚡⚡</span> Medium</button>
              <button type="button" onClick={() => setEditEffortLevel('high')} className={`flex-1 py-2 text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-1.5 ${editEffortLevel === 'high' ? 'bg-background shadow-sm text-content' : 'text-muted hover:text-content'}`}><span className="text-yellow-500 text-[10px]">⚡⚡⚡</span> High</button>
            </div>
          </div>

          <div className="pt-8 flex flex-col gap-2">
            <button 
              type="submit" 
              disabled={isSubmitting}
              className={`w-full btn-primary py-4 rounded-[16px] shadow-sm text-sm font-medium transition-all ${isSubmitting ? 'opacity-70 cursor-not-allowed' : ''}`}
            >
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </button>
            <button 
              type="button" 
              onClick={deleteExistingTask} 
              disabled={isSubmitting}
              className={`w-full bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500/20 hover:border-red-500/40 py-4 rounded-[16px] shadow-sm text-sm font-medium transition-colors ${isSubmitting ? 'opacity-70 cursor-not-allowed' : ''}`}
            >
              {isSubmitting ? 'Deleting...' : confirmDelete ? 'Tap again to confirm delete' : 'Delete Task'}
            </button>
          </div>
        </form>
      </BottomSheet>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 border-t border-outline pb-safe z-40 transition-colors duration-400 ease-in-out" style={{ backgroundColor: 'var(--nav-bg)', backdropFilter: 'blur(12px)' }}>
        <div className="flex max-w-md mx-auto relative px-2 py-2">
          <button
            onClick={() => { setActiveTab('inbox'); setActiveTag(null); }}
            className={`flex-1 flex flex-col items-center py-1 text-xs font-medium transition-colors ${activeTab === 'inbox' ? 'text-primary' : 'text-muted hover:text-content'}`}
          >
            <CircularProgressIcon icon={Inbox} isActive={activeTab === 'inbox'} hasIndicator={inboxActiveCount > 0} />
            <span className="truncate">Unsorted</span>
          </button>
          <button
            onClick={() => { setActiveTab('life'); setActiveTag(null); }}
            className={`flex-1 flex flex-col items-center py-1 text-xs font-medium transition-colors ${activeTab === 'life' ? 'text-primary' : 'text-muted hover:text-content'}`}
          >
            <CircularProgressIcon icon={UserTab} isActive={activeTab === 'life'} percentage={lifePercentage} />
            <span>Life</span>
          </button>
          <button
            onClick={() => { setActiveTab('household'); setActiveTag(null); }}
             className={`flex-1 flex flex-col items-center py-1 text-xs font-medium transition-colors ${activeTab === 'household' ? 'text-primary' : 'text-muted hover:text-content'}`}
          >
            <CircularProgressIcon icon={Home} isActive={activeTab === 'household'} percentage={householdPercentage} />
            <span className="truncate">Home</span>
          </button>
          <button
            onClick={() => { setActiveTab('routines'); setActiveTag(null); }}
            className={`flex-1 flex flex-col items-center py-1 text-xs font-medium transition-colors ${activeTab === 'routines' ? 'text-primary' : 'text-muted hover:text-content'}`}
          >
            <CircularProgressIcon icon={Repeat} isActive={activeTab === 'routines'} percentage={routinesPercentage} />
            <span className="truncate">Routines</span>
          </button>
        </div>
      </div>

      {/* Floating Action Button (FAB) */}
      <button 
        onClick={() => setShowQuickCapture(true)}
        className="fixed bottom-24 right-6 w-14 h-14 bg-indigo-500 hover:bg-indigo-600 text-white rounded-full flex items-center justify-center shadow-[0_8px_30px_rgb(99,102,241,0.4)] z-40 transition-transform hover:scale-105 active:scale-95"
      >
        <Plus size={28} className="stroke-[2.5]" />
      </button>

      {/* Quick Capture Modal */}
      <BottomSheet isOpen={showQuickCapture} onClose={() => setShowQuickCapture(false)}>
        <form onSubmit={handleQuickCapture} className="flex flex-col gap-4">
          <input
            ref={quickInputRef}
            type="text"
            value={quickCaptureInput}
            onChange={e => setQuickCaptureInput(e.target.value)}
            className="w-full bg-transparent border-none text-2xl outline-none placeholder:text-muted/50 font-light mb-4"
            placeholder="Brain dump..."
          />
          <div className="flex justify-end">
             <button type="submit" className="px-6 py-3 rounded-full bg-indigo-500 text-white shadow-lg hover:bg-indigo-600 transition-colors font-medium text-sm flex items-center justify-center min-w-[120px]" disabled={!quickCaptureInput.trim() || isSubmitting}>
               {isSubmitting ? 'Saving...' : 'Add Task'}
             </button>
          </div>
        </form>
      </BottomSheet>

      {/* Error Toast */}
      <AnimatePresence>
        {toastError && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-24 left-4 right-4 max-w-sm mx-auto bg-red-50 text-red-600 px-4 py-3 rounded-2xl shadow-sm border border-red-100 flex items-center justify-between text-sm z-50 overflow-hidden"
          >
            <span className="font-light pr-2">{toastError}</span>
            <button 
              onClick={() => setToastError(null)} 
              className="p-1.5 hover:bg-red-100 bg-red-50/50 rounded-full transition-colors flex-shrink-0"
            >
              <X size={14} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <FocusIsland
        activeFocusTask={activeFocusTask}
        rouletteTask={rouletteSelectedTaskId ? { id: rouletteSelectedTaskId, title: tasks.find(t => t.id === rouletteSelectedTaskId)?.title || 'Selected Task' } : null}
        onClearFocus={() => setActiveFocusTask(null)}
        onClearRoulette={() => setRouletteSelectedTaskId(null)}
        onCompleteFocus={async (taskId, subtaskId) => {
          const task = tasks.find(t => t.id === taskId);
          if (task && task.subtasks && subtaskId) {
            const updatedSubtasks = task.subtasks.map((s, sIdx) => 
              ((s.id || sIdx.toString()) === subtaskId) ? { ...s, isCompleted: true } : s
            );
            setTasks(prev => prev.map(t => t.id === taskId ? { ...t, subtasks: updatedSubtasks } : t));
            setActiveFocusTask(null);
            try {
              await dbService.updateTask(taskId, { subtasks: updatedSubtasks });
            } catch (error) {
              console.error("Failed to mark subtask complete", error);
            }
          } else {
            setActiveFocusTask(null);
          }
        }}
        onCompleteRoulette={(taskId) => {
           completeTask(taskId);
        }}
      />

      <AnimatePresence>
        {confirmResetApp && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-[100] backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-surface border border-red-500/20 max-w-sm w-full rounded-2xl p-6 shadow-2xl relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 right-0 h-1 bg-red-500" />
              <div className="flex justify-center mb-4">
                <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center">
                  <AlertTriangle size={24} className="text-red-500" />
                </div>
              </div>
              <h2 className="text-xl font-medium text-center mb-2">Reset All Data?</h2>
              <p className="text-muted text-sm text-center mb-6 leading-relaxed">
                Are you absolutely sure you want to permanently delete ALL data? This will wipe your entire history and cannot be undone.
              </p>
              
              <div className="mb-6">
                <label className="block text-xs uppercase tracking-wider font-semibold text-muted mb-2 text-center">
                  Type <span className="text-red-500 select-all">RESET</span> to confirm
                </label>
                <input
                  type="text"
                  value={resetChallengeInput}
                  onChange={(e) => setResetChallengeInput(e.target.value)}
                  className="input-minimal w-full text-center text-lg uppercase tracking-widest font-mono border-red-500/30 focus:border-red-500/70 py-4"
                  placeholder="RESET"
                  disabled={isResetting}
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="characters"
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  disabled={isResetting}
                  onClick={() => {
                    setConfirmResetApp(false);
                    setResetChallengeInput("");
                  }}
                  className="flex-1 px-4 py-2.5 rounded-[20px] text-muted hover:text-content font-medium transition-colors border border-outline hover:bg-outline/20 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (resetChallengeInput.toUpperCase() !== "RESET" || !user) return;
                    setIsResetting(true);
                    try {
                      // Fetch all completed items to ensure thorough wipe
                      const allHistoryTasks = await dbService.getTasks(user.uid, 'completed');
                      const activeTasksToDelete = tasks;
                      const allTaskIds = [...activeTasksToDelete.map(t => t.id), ...allHistoryTasks.map(t => t.id)];
                      // Delete from database
                      await dbService.clearTasks(allTaskIds);
                      // Reset local app level state
                      setTasks([]);
                      setConfirmResetApp(false);
                      setResetChallengeInput("");
                    } catch (e) {
                      setToastError("Failed to reset database.");
                    } finally {
                      setIsResetting(false);
                    }
                  }}
                  disabled={resetChallengeInput.toUpperCase() !== "RESET" || isResetting}
                  className="flex-1 px-4 py-2.5 rounded-[20px] bg-red-500 hover:bg-red-600 text-white font-medium transition-colors disabled:opacity-50 disabled:bg-surface disabled:text-muted disabled:border disabled:border-outline flex justify-center items-center gap-2"
                >
                  {isResetting ? <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" /> : "Delete All"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
};

const Main = () => {
  const { user, loading } = useAuth();

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <Sparkles className="animate-pulse text-gray-200" size={48} />
    </div>
  );

  return user ? <Dashboard /> : <Login />;
};

export default function App() {
  return (
    <AuthProvider>
      <Main />
    </AuthProvider>
  );
}
