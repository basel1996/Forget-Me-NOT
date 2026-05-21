import { Preferences } from '@capacitor/preferences';

export interface Profile {
  bio: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: 'active' | 'completed';
  createdAt: string;
  completedAt?: string | null;
  priority?: 'low' | 'medium' | 'high';
  category?: 'life' | 'household' | 'inbox';
  tags?: string[];
  isRecurring?: boolean;
  recurrenceInterval?: 'daily' | 'weekly' | 'monthly' | 'yearly';
  lastCompletedDate?: string | null;
  streakCount?: number;
  currentStreak?: number;
  completionHistory?: string[];
  isPaused?: boolean;
  subtasks?: { id?: string, text: string, isCompleted: boolean }[];
  effortLevel?: 'low' | 'medium' | 'high';
}

const TASKS_KEY = 'fmn_tasks';
const PROFILE_KEY = 'fmn_profile';

const getLocalTasks = async (): Promise<Task[]> => {
  const { value } = await Preferences.get({ key: TASKS_KEY });
  return value ? JSON.parse(value) : [];
};

const saveLocalTasks = async (tasks: Task[]) => {
  await Preferences.set({ key: TASKS_KEY, value: JSON.stringify(tasks) });
};

const getLocalProfile = async (): Promise<Profile> => {
  const { value } = await Preferences.get({ key: PROFILE_KEY });
  return value ? JSON.parse(value) : { bio: "{}" };
};

const saveLocalProfile = async (bio: string) => {
  await Preferences.set({ key: PROFILE_KEY, value: JSON.stringify({ bio }) });
};

export const storageService = {
  getProfile: async () => {
    return getLocalProfile();
  },
  saveProfile: async (bio: string) => {
    await saveLocalProfile(bio);
  },
  getTasks: async (status?: 'active' | 'completed', limit?: number) => {
    let tasks = await getLocalTasks();
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
  getCompletedTasksToday: async () => {
    const tasks = await getLocalTasks();
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
    const tasks = await getLocalTasks();
    const newTask: Task = {
      ...taskData,
      id,
      createdAt: new Date().toISOString()
    };
    tasks.push(newTask);
    await saveLocalTasks(tasks);
    return newTask;
  },
  getNewTaskId: () => {
    return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2);
  },
  updateTask: async (id: string, updates: Partial<Task>) => {
    const tasks = await getLocalTasks();
    const taskIdx = tasks.findIndex(t => t.id === id);
    if (taskIdx >= 0) {
      tasks[taskIdx] = { ...tasks[taskIdx], ...updates };
      await saveLocalTasks(tasks);
      return tasks[taskIdx];
    }
    return null;
  },
  completeTask: async (id: string) => {
    let completedTask: Task | null = null;
    let newGeneratedTask: Task | null = null;
    
    const tasks = await getLocalTasks();
    const taskIdx = tasks.findIndex(t => t.id === id);
    
    if (taskIdx >= 0) {
      const task = tasks[taskIdx];
      
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
      
      await saveLocalTasks(tasks);
    }
    
    return completedTask;
  },
  undoTask: async (id: string) => {
    const tasks = await getLocalTasks();
    const taskIdx = tasks.findIndex(t => t.id === id);
    if (taskIdx >= 0) {
      tasks[taskIdx] = { ...tasks[taskIdx], status: 'active', completedAt: null };
      await saveLocalTasks(tasks);
      return tasks[taskIdx];
    }
    return null;
  },
  deleteTask: async (id: string) => {
    let tasks = await getLocalTasks();
    tasks = tasks.filter(t => t.id !== id);
    await saveLocalTasks(tasks);
  },
  clearTasks: async (taskIds: string[]) => {
    let tasks = await getLocalTasks();
    tasks = tasks.filter(t => !taskIds.includes(t.id));
    await saveLocalTasks(tasks);
  },
  replaceAllTasks: async (importedTasks: Task[]) => {
    await saveLocalTasks(importedTasks);
  },
  updateTasksBatch: async (updates: { id: string; category: string; effortLevel: string; priority: string; }[]) => {
    const tasks = await getLocalTasks();
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
      await saveLocalTasks(tasks);
    }
  }
};
