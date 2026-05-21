import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  writeBatch
} from 'firebase/firestore';
import { db } from './firebase';

interface Profile {
  bio: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: 'active' | 'completed' | 'dismissed';
  category: 'life' | 'household' | 'inbox';
  userId: string;
  createdAt: any;
  completedAt?: any;
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

const getLocalTasks = (userId: string): Task[] => {
  const data = localStorage.getItem(`fmn_tasks_${userId}`);
  return data ? JSON.parse(data) : [];
};

const saveLocalTasks = (userId: string, tasks: Task[]) => {
  localStorage.setItem(`fmn_tasks_${userId}`, JSON.stringify(tasks));
  localStorage.setItem(`has_unsynced_changes`, 'true');
  // Dispatch an event so App.tsx can show the unsynced indicator
  window.dispatchEvent(new Event('local_tasks_updated'));
};

const getLocalProfile = (userId: string): Profile => {
  const data = localStorage.getItem(`fmn_profile_${userId}`);
  return data ? JSON.parse(data) : { bio: "{}" };
};

const saveLocalProfile = (userId: string, bio: string) => {
  localStorage.setItem(`fmn_profile_${userId}`, JSON.stringify({ bio }));
  localStorage.setItem(`has_unsynced_changes`, 'true');
  window.dispatchEvent(new Event('local_tasks_updated'));
};

export const dbService = {
  getProfile: async (userId: string) => {
    return getLocalProfile(userId);
  },
  saveProfile: async (userId: string, bio: string) => {
    saveLocalProfile(userId, bio);
  },
  getTasks: async (userId: string, status?: 'active' | 'completed', limit?: number) => {
    let tasks = getLocalTasks(userId);
    if (status) {
      tasks = tasks.filter(t => t.status === status);
    }
    
    if (status === 'completed') {
      tasks.sort((a, b) => new Date(b.completedAt || 0).getTime() - new Date(a.completedAt || 0).getTime());
    } else {
      tasks.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    }

    if (limit) {
      return tasks.slice(0, limit);
    }
    return tasks;
  },
  getCompletedTasksToday: async (userId: string) => {
    const tasks = getLocalTasks(userId);
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    const todayCount = { life: 0, household: 0, routines: 0 };
    
    tasks.forEach(task => {
      if (task.status !== 'completed') return;
      const completedAtDate = task.completedAt ? new Date(task.completedAt) : null;
      if (completedAtDate && completedAtDate >= startOfDay) {
        if (task.isRecurring) {
          todayCount.routines++;
        } else if (task.category === 'life') {
          todayCount.life++;
        } else if (task.category === 'household') {
           todayCount.household++;
        }
      }
    });
    return todayCount;
  },
  saveTask: async (id: string, taskData: Omit<Task, 'id' | 'createdAt'>) => {
    const tasks = getLocalTasks(taskData.userId);
    const newTask: Task = {
      ...taskData,
      id,
      createdAt: new Date().toISOString()
    };
    tasks.push(newTask);
    saveLocalTasks(taskData.userId, tasks);
    return newTask;
  },
  getNewTaskId: () => {
    return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2);
  },
  updateTask: async (id: string, updates: Partial<Task>) => {
    // Need to find userId, but we might not have it in the arguments.
    // However, updateTask assumes we know the user. To keep it simple, we'll scan localStorage?
    // Wait, all tasks are stored per user: localStorage.getItem(`fmn_tasks_${userId}`)
    // We can just iterate through all local storage keys, but it's easier to find the user.
    // Let's assume there's one primary user logged in.
    let updatedTask: Task | null = null;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('fmn_tasks_')) {
        const userId = key.replace('fmn_tasks_', '');
        const tasks = getLocalTasks(userId);
        const taskIdx = tasks.findIndex(t => t.id === id);
        if (taskIdx >= 0) {
          tasks[taskIdx] = { ...tasks[taskIdx], ...updates };
          updatedTask = tasks[taskIdx];
          saveLocalTasks(userId, tasks);
          break;
        }
      }
    }
    return updatedTask;
  },
  completeTask: async (id: string) => {
    let completedTask: Task | null = null;
    let newGeneratedTask: Task | null = null;
    let foundUserId: string | null = null;
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('fmn_tasks_')) {
        const userId = key.replace('fmn_tasks_', '');
        const tasks = getLocalTasks(userId);
        const taskIdx = tasks.findIndex(t => t.id === id);
        
        if (taskIdx >= 0) {
          const task = tasks[taskIdx];
          foundUserId = userId;
          
          let newStreakCount = task.currentStreak || task.streakCount || 0;
          let newCompletionHistory = [...(task.completionHistory || [])];
          
          const now = new Date();
          const lastCompleted = task.lastCompletedDate ? new Date(task.lastCompletedDate) : null;
          
          const todayStr = now.toISOString().split('T')[0];
          if (!newCompletionHistory.includes(todayStr)) {
            newCompletionHistory.push(todayStr);
          }
          
          const thirtyOneDaysAgo = new Date(now.getTime() - 31 * 24 * 60 * 60 * 1000);
          newCompletionHistory = newCompletionHistory.filter(d => new Date(d) >= thirtyOneDaysAgo);
          
          if (task.isRecurring && task.recurrenceInterval) {
            if (!lastCompleted) {
              newStreakCount = 1;
            } else {
              const lastCompletedDateOnly = new Date(lastCompleted.getFullYear(), lastCompleted.getMonth(), lastCompleted.getDate());
              const nowDateOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());
              const diffDays = Math.floor((nowDateOnly.getTime() - lastCompletedDateOnly.getTime()) / (1000 * 60 * 60 * 24));
              
              let windowMissed = false;
              
              if (task.recurrenceInterval === 'daily') {
                if (diffDays <= 2) newStreakCount += 1;
                else windowMissed = true;
              } else if (task.recurrenceInterval === 'weekly') {
                if (diffDays <= 14) newStreakCount += 1;
                else windowMissed = true;
              } else if (task.recurrenceInterval === 'monthly') {
                if (diffDays <= 60) newStreakCount += 1; // Approx 2 months
                else windowMissed = true;
              } else if (task.recurrenceInterval === 'yearly') {
                if (diffDays <= 730) newStreakCount += 1; // Approx 2 years
                else windowMissed = true;
              }
              
              if (windowMissed) newStreakCount = 1;
            }

            const nextDate = new Date();
            if (task.recurrenceInterval === 'daily') nextDate.setDate(nextDate.getDate() + 1);
            if (task.recurrenceInterval === 'weekly') nextDate.setDate(nextDate.getDate() + 7);
            if (task.recurrenceInterval === 'monthly') nextDate.setMonth(nextDate.getMonth() + 1);
            if (task.recurrenceInterval === 'yearly') nextDate.setFullYear(nextDate.getFullYear() + 1);
            
            newGeneratedTask = {
              ...task,
              id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2),
              status: 'active',
              createdAt: nextDate.toISOString(),
              completedAt: null,
              streakCount: newStreakCount,
              currentStreak: newStreakCount,
              completionHistory: newCompletionHistory,
              lastCompletedDate: now.toISOString()
            };
          }
          
          tasks[taskIdx] = {
            ...task,
            status: 'completed',
            completedAt: now.toISOString(),
            streakCount: newStreakCount,
            currentStreak: newStreakCount,
            completionHistory: newCompletionHistory,
            lastCompletedDate: now.toISOString()
          };
          
          completedTask = tasks[taskIdx];
          
          if (newGeneratedTask) {
            tasks.push(newGeneratedTask);
          }
          
          saveLocalTasks(userId, tasks);
          break;
        }
      }
    }
    return completedTask;
  },
  undoTask: async (id: string) => {
    let updatedTask: Task | null = null;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('fmn_tasks_')) {
        const userId = key.replace('fmn_tasks_', '');
        const tasks = getLocalTasks(userId);
        const taskIdx = tasks.findIndex(t => t.id === id);
        if (taskIdx >= 0) {
          tasks[taskIdx] = { ...tasks[taskIdx], status: 'active', completedAt: null };
          updatedTask = tasks[taskIdx];
          saveLocalTasks(userId, tasks);
          break;
        }
      }
    }
    return updatedTask;
  },
  deleteTask: async (id: string) => {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('fmn_tasks_')) {
        const userId = key.replace('fmn_tasks_', '');
        let tasks = getLocalTasks(userId);
        if (tasks.some(t => t.id === id)) {
          tasks = tasks.filter(t => t.id !== id);
          saveLocalTasks(userId, tasks);
          break;
        }
      }
    }
  },
  clearTasks: async (taskIds: string[]) => {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('fmn_tasks_')) {
        const userId = key.replace('fmn_tasks_', '');
        let tasks = getLocalTasks(userId);
        tasks = tasks.filter(t => !taskIds.includes(t.id));
        saveLocalTasks(userId, tasks);
      }
    }
  },
  importTasksBatch: async (importedTasks: any[]) => {
    if (importedTasks.length === 0) return;
    const userId = importedTasks[0].userId;
    let tasks = getLocalTasks(userId);
    const newIds = importedTasks.map(t => t.id);
    tasks = tasks.filter(t => !newIds.includes(t.id));
    tasks = [...tasks, ...importedTasks];
    saveLocalTasks(userId, tasks);
  },
  updateTasksBatch: async (updates: { id: string; category: string; effortLevel: string; priority: string; }[]) => {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('fmn_tasks_')) {
        const userId = key.replace('fmn_tasks_', '');
        const tasks = getLocalTasks(userId);
        let changed = false;
        
        updates.forEach(update => {
          const taskIdx = tasks.findIndex(t => t.id === update.id);
          if (taskIdx >= 0) {
            tasks[taskIdx] = { 
              ...tasks[taskIdx], 
              category: update.category as any, 
              effortLevel: update.effortLevel as any, 
              priority: update.priority as any 
            };
            changed = true;
          }
        });
        
        if (changed) {
          saveLocalTasks(userId, tasks);
        }
      }
    }
  },
  
  // -- CLOUD SYNC FUNCTIONALITY --
  syncWithCloud: async (userId: string) => {
    try {
      const tasks = getLocalTasks(userId);
      const profile = getLocalProfile(userId);
      
      const batch = writeBatch(db);
      
      // We will blindly overwrite cloud state with local state by writing all local tasks.
      // Wait, we probably should delete everything else in cloud first, but pulling all cloud IDs is heavy. 
      // We'll write everything from local to cloud.
      
      tasks.forEach(task => {
        const docRef = doc(db, 'tasks', task.id);
        const { id, ...data } = task; // avoid writing duplicate ID
        batch.set(docRef, data);
      });
      
      const profileRef = doc(db, 'profiles', userId);
      batch.set(profileRef, profile, { merge: true });
      
      await batch.commit();
      
      // Clear unsynced changes flag
      localStorage.removeItem('has_unsynced_changes');
      localStorage.setItem(`fmn_last_synced_${userId}`, new Date().toISOString());
      window.dispatchEvent(new Event('local_tasks_updated'));
      
      return true;
    } catch (e) {
      console.error("Cloud sync failed", e);
      throw e;
    }
  }
};

