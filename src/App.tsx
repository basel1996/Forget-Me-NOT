import React, { useState, useEffect, useRef, useMemo } from "react";
import { storageService } from "./lib/storageService";
import { LogIn, User as UserIcon, Plus, Check, X, Sparkles, LogOut, Settings as SettingsIcon, ArrowLeft, Home, User as UserTab, ArrowDown, ArrowUp, Repeat, RotateCcw, Archive, Trash2, Inbox, Play, Trophy, Activity, AlertTriangle, CornerUpLeft, Coffee, Wind, Leaf, Moon, Cloud, Feather, Sun, Mountain, Compass, Waves, Download, UploadCloud } from "lucide-react";
import { motion, AnimatePresence, useMotionValue, useTransform } from "motion/react";
import { HistoryView } from "./HistoryView";
import { FocusIsland } from "./components/FocusIsland";
import { WeeklyWinsDashboard } from "./components/WeeklyWinsDashboard";
import { BottomSheet } from "./components/BottomSheet";
import { useCircadian } from "./hooks/useCircadian";

interface Task {
  id: string;
  title: string;
  description: string;
  status: 'active' | 'completed';
  category?: 'life' | 'household' | 'inbox';
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
    setLastSyncedAt(localStorage.getItem(`fmn_last_synced_`) || null);
    
    const handleLocalTasksUpdate = () => {
      setHasUnsyncedChanges(localStorage.getItem('has_unsynced_changes') === 'true');
      setLastSyncedAt(localStorage.getItem(`fmn_last_synced_`) || null);
    };
    
    window.addEventListener('local_tasks_updated', handleLocalTasksUpdate);
    return () => window.removeEventListener('local_tasks_updated', handleLocalTasksUpdate);
  }, []);

  const handleManualSync = async () => {
    
    setIsSyncing(true);
    try {
      
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
  const isOffline = false;
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [subtaskDeleteConfirmId, setSubtaskDeleteConfirmId] = useState<string | null>(null);
  const [clearAllConfirm, setClearAllConfirm] = useState(false);

  const deleteTaskDirectly = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const taskToDelete = tasks.find(t => t.id === id);
    setTasks(prev => prev.filter(t => t.id !== id));
    
    
      
    try {
      if (!String(id).startsWith('temp-')) {
        await storageService.deleteTask(id);
      }
    } catch (error) {
        if (taskToDelete) {
          setTasks(prev => [...prev, taskToDelete]);
        }
        setToastError("Failed to delete task.");
        console.error("Failed to delete task:", error);
      }
    setDeleteConfirmId(null);
  };

  const executeClearAllTasks = async () => {
    
    
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
    try {
            // 2. SAFETY CHECK: Only send REAL Firebase IDs to the database
            const realTaskIds = currentTasks
                .map(t => t.id)
                .filter(id => !String(id).startsWith('temp-'));

            // 3. Only fire the database call if there are actual database documents to delete
            if (realTaskIds.length > 0) {
                await storageService.clearTasks(realTaskIds);
            }
        } catch (error) {
            setTasks(previousTasks); // Rollback
            setToastError("Failed to clear tasks.");
            console.error("Failed to clear tasks:", error);
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
    if (!editingTask || !editTitle.trim() ||  isSubmitting) return;
    
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

    storageService.updateTask(editingTask.id, {
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
    if (!editingTask ||  isSubmitting) return;
    
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }

    setIsSubmitting(true);
    try {
      await storageService.deleteTask(editingTask.id);
      
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
    if (!routineTitle.trim() ||  isSubmitting) return;
    
    setIsSubmitting(true);
    // Optimistic UI update for routine with pre-generated ID
    const firestoreId = storageService.getNewTaskId();
    const newRoutineData: Omit<Task, 'id' | 'createdAt'> = {
      
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
      await storageService.saveTask(firestoreId, newRoutineData);
    } catch (error) {
      console.error("Failed to background sync routine", error);
    }
  };

  const fetchTasks = async (status: 'active' | 'completed' = 'active') => {
    
    try {
      const data = await storageService.getTasks(status, status === 'completed' ? 50 : undefined);
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
    
    try {
      const counts = await storageService.getCompletedTasksToday();
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
    

    const fetchProfile = async () => {
      try {
        const data = await storageService.getProfile();
        setBio(data.bio || "{}");
      } catch (error) {
        console.error("Failed to fetch profile", error);
      }
    };
    
    fetchProfile();
    fetchTasks();
    fetchCompletedTasksCount();
  }, []);

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
    if (!quickCaptureInput.trim() ||  isSubmitting) return;

    setIsSubmitting(true);
    const title = quickCaptureInput.trim();

    const firestoreId = storageService.getNewTaskId();
    const newTaskData: Omit<Task, 'id' | 'createdAt'> = {
      
      title,
      description: '',
      status: 'active',
      category: 'inbox',
      isRecurring: false,
      priority: 'medium',
      subtasks: [],
      effortLevel: 'medium', completedAt: null };

    setTasks(prev => [{ id: firestoreId, ...newTaskData, createdAt: new Date().toISOString() } as Task, ...prev]);
    setQuickCaptureInput("");
    setShowQuickCapture(false);
    setIsSubmitting(false);

    
      
      try {
        await storageService.saveTask(firestoreId, newTaskData);
      } catch (error) {
        console.error("Failed to background sync quick capture task", error);
      }
  };

  const addTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim() ||  isSubmitting) return;
    
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
    const firestoreId = storageService.getNewTaskId();
    const newTaskData: Omit<Task, 'id' | 'createdAt'> = {
      
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

    
      
      try {
        await storageService.saveTask(firestoreId, newTaskData);
      } catch (error) {
        console.error("Failed to background sync added task", error);
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
      try {
        await storageService.completeTask(id);
        fetchCompletedTasksCount();
      } catch (error) {
        console.error("Failed to complete task", error);
      } finally {
        setCompletingIds(prev => prev.filter(compId => compId !== id));
      }
    }, 500); // Wait for the visual strike-through animation
  };

  const undoTask = async (id: string) => {
    try {
      await storageService.undoTask(id);
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
        await storageService.updateTasksBatch(sortedResults);
        
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
    if ( !bio || bio === "{}" || isOffline) return;
    setLoadingSuggestions(true);
    setIsTakingLong(false);
    
    const controller = new AbortController();
    setAbortController(controller);
    
    setSuggestionCache(prev => ({ ...prev, [activeTab]: [] })); // Clear previous
    
    const timeoutId = setTimeout(() => setIsTakingLong(true), 30000);
    
    try {
      const allTasks = await storageService.getTasks('completed');
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
          'x-user-id': 'local'
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
    
    const firestoreId = storageService.getNewTaskId();
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

      await storageService.saveTask(firestoreId, newTaskData);
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
    
    try {
      const allTasks = await storageService.getTasks();
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
    if (!importFile ) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const content = event.target?.result as string;
        const backup = JSON.parse(content);
        if (!backup.tasks) throw new Error("Invalid backup file: Missing tasks array");
        
        const currentTasks = await storageService.getTasks();
        if (currentTasks.length > 0) {
          await storageService.clearTasks(currentTasks.map(t => t.id));
        }
        
        const importedTasks = backup.tasks.map((t: any) => ({
          ...t,
          userId: ""
        }));
        
        await storageService.replaceAllTasks(importedTasks);
        
        if (backup.bio && typeof backup.bio === 'string') {
          await storageService.saveProfile( backup.bio);
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
    if (!rawProfileText.trim()) return;
    setSavingProfile(true);
    try {
      await storageService.saveProfile(rawProfileText.trim());
      setBio(rawProfileText.trim());
      setShowProfile(false);
    } catch (error) {
      console.error("Failed to save profile", error);
      setToastError("An error occurred while saving profile.");
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
    
    try {
      await storageService.updateTask(id, { isPaused: !currentPaused });
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
      await storageService.updateTask(taskId, { effortLevel: nextValue });
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
      await storageService.updateTask(taskId, { priority: nextValue });
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
                await storageService.updateTask(task.id, { subtasks: newSubtasks });
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
                   
                   try {
                     await storageService.updateTask(task.id, { recurrenceInterval: next });
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
      
      const firestoreId = storageService.getNewTaskId();
      const selectedCategory = activeTab === 'routines' ? 'household' : activeTab as 'life' | 'household' | 'inbox';
      const newTaskData: Omit<Task, 'id' | 'createdAt'> = {
          
          title: pullInput.trim(),
          description: "",
          status: 'active',
          category: selectedCategory,
          isRecurring: false,
          subtasks: [],
          priority: 'medium',
          effortLevel: 'medium', completedAt: null };

      setTasks(prev => [{ id: firestoreId, ...newTaskData, createdAt: new Date().toISOString() } as Task, ...prev]);
      setPullInput("");
      setIsPullCapturing(false);
      setIsSubmitting(false);

      
        
        try {
          await storageService.saveTask(firestoreId, newTaskData);
        } catch (error) {
          console.error("Failed to background sync pull task", error);
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
        </div>
      </header>

      <div className="flex gap-4 mb-6 sticky top-0 bg-base/80 backdrop-blur-sm z-10 py-2 border-b border-outline/10 overflow-x-auto no-scrollbar">
        {(['inbox', 'life', 'household', 'routines'] as const).map(tab => (
          <button 
            key={tab} 
            onClick={() => { setActiveTab(tab); document.documentElement.setAttribute('data-theme', tab === 'life' || tab === 'inbox' ? 'default' : tab); }} 
            className={`font-medium pb-2 border-b-2 whitespace-nowrap transition-all ${activeTab === tab ? 'border-primary text-primary' : 'border-transparent text-muted hover:text-content'}`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      <main className="flex-1 pb-32 no-scrollbar">
        {renderTaskList()}
      </main>

      {/* Quick Add FAB */}
      <button 
        onClick={() => setShowQuickCapture(true)}
        className="fixed bottom-8 right-8 w-14 h-14 bg-primary text-primary-content rounded-full shadow-lg shadow-black/20 flex items-center justify-center hover:scale-105 active:scale-95 transition-all z-40"
      >
        <Plus size={28} strokeWidth={2} />
      </button>

      {/* Quick Capture Overlay */}
      <AnimatePresence>
        {showQuickCapture && (
          <motion.div 
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.95 }}
            className="fixed bottom-8 left-4 right-24 bg-surface border border-outline/20 p-2 rounded-2xl shadow-xl z-50 flex items-center gap-2"
          >
            <input 
              autoFocus
              type="text" 
              value={quickCaptureInput}
              onChange={e => setQuickCaptureInput(e.target.value)}
              onKeyDown={async (e) => {
                if (e.key === 'Enter' && quickCaptureInput.trim()) {
                  const newTask = await storageService.saveTask(storageService.getNewTaskId(), {
                    title: quickCaptureInput.trim(),
                    description: "",
                    status: 'active',
                    category: activeTab === 'routines' ? 'life' : activeTab,
                    isRecurring: false,
                    subtasks: [],
                    priority: 'medium',
                    effortLevel: 'medium', completedAt: null });
                  setTasks(prev => [newTask, ...prev]);
                  setQuickCaptureInput("");
                  setShowQuickCapture(false);
                }
              }}
              placeholder="What's happening?" 
              className="flex-1 bg-transparent border-none outline-none text-content placeholder:text-muted/50 px-4 py-2"
            />
            <button onClick={() => setShowQuickCapture(false)} className="p-2 text-muted hover:text-content rounded-full hover:bg-outline/20">
              <X size={20} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast Notification */}
      <AnimatePresence>
        {toastError && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 bg-red-500/10 border border-red-500/20 text-red-500 px-4 py-2 rounded-xl text-sm font-medium z-50 flex items-center justify-center gap-2"
          >
            <AlertTriangle size={16} />
             {toastError}
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
};

export default function App() {
  return <Dashboard />;
}