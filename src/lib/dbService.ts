import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  limit as firestoreLimit,
  serverTimestamp,
  Timestamp,
  writeBatch
} from 'firebase/firestore';
import { db } from './firebase';

interface Profile {
  bio: string;
}

interface Task {
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
}

export const dbService = {
  getProfile: async (userId: string) => {
    try {
      const docRef = doc(db, 'profiles', userId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return docSnap.data() as Profile;
      }
      return { bio: "{}" };
    } catch (error) {
      console.error("Error getting profile:", error);
      return { bio: "{}" };
    }
  },
  saveProfile: async (userId: string, bio: string) => {
    try {
      const docRef = doc(db, 'profiles', userId);
      await setDoc(docRef, { bio }, { merge: true });
    } catch (error) {
      console.error("Error saving profile:", error);
      throw error;
    }
  },
  getTasks: async (userId: string, status?: 'active' | 'completed', limit?: number) => {
    try {
      const tasksRef = collection(db, 'tasks');
      let q = query(tasksRef, where('userId', '==', userId));
      
      if (status) {
        q = query(q, where('status', '==', status));
      }

      const querySnapshot = await getDocs(q);
      const tasks: Task[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        tasks.push({
          ...data,
          id: doc.id,
          createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : data.createdAt,
          completedAt: data.completedAt instanceof Timestamp ? data.completedAt.toDate().toISOString() : data.completedAt,
        } as Task);
      });

      if (status === 'completed') {
        tasks.sort((a, b) => new Date(b.completedAt || 0).getTime() - new Date(a.completedAt || 0).getTime());
      } else {
        tasks.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      }

      if (limit) {
        return tasks.slice(0, limit);
      }
      return tasks;
    } catch (error) {
      console.error("Error getting tasks:", error);
      throw error;
    }
  },
  saveTask: async (id: string, taskData: Omit<Task, 'id' | 'createdAt'>) => {
    try {
      const docRef = doc(db, 'tasks', id);
      await setDoc(docRef, {
        ...taskData,
        createdAt: serverTimestamp()
      });
      return { id, ...taskData, createdAt: new Date().toISOString() };
    } catch (error) {
      console.error("Error saving task:", error);
      throw error;
    }
  },
  getNewTaskId: () => {
    return doc(collection(db, 'tasks')).id;
  },
  updateTask: async (id: string, updates: Partial<Task>) => {
    try {
      const docRef = doc(db, 'tasks', id);
      const cleanUpdates = JSON.parse(JSON.stringify(updates));
      await updateDoc(docRef, cleanUpdates);
      const updatedSnap = await getDoc(docRef);
      return { id, ...updatedSnap.data() };
    } catch (error) {
      console.error("Error updating task:", error);
      throw error;
    }
  },
  completeTask: async (id: string) => {
    try {
      const docRef = doc(db, 'tasks', id);
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) return null;
      
      const task = docSnap.data() as Task;
      const completedAt = serverTimestamp();
      
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
        
        await setDoc(doc(collection(db, 'tasks')), {
          ...task,
          status: 'active',
          createdAt: Timestamp.fromDate(nextDate),
          completedAt: null,
          streakCount: newStreakCount,
          currentStreak: newStreakCount,
          completionHistory: newCompletionHistory,
          lastCompletedDate: now.toISOString()
        });
      }
      
      await updateDoc(docRef, {
        status: 'completed',
        completedAt,
        streakCount: newStreakCount,
        currentStreak: newStreakCount,
        completionHistory: newCompletionHistory,
        lastCompletedDate: now.toISOString()
      });
      
      return { ...task, status: 'completed', completedAt: now.toISOString(), streakCount: newStreakCount, currentStreak: newStreakCount, completionHistory: newCompletionHistory, lastCompletedDate: now.toISOString() };
    } catch (error) {
      console.error("Error completing task:", error);
      throw error;
    }
  },
  undoTask: async (id: string) => {
    try {
      const docRef = doc(db, 'tasks', id);
      await updateDoc(docRef, {
        status: 'active',
        completedAt: null
      });
      const updatedSnap = await getDoc(docRef);
      return { id, ...updatedSnap.data() };
    } catch (error) {
      console.error("Error undoing task:", error);
      throw error;
    }
  },
  deleteTask: async (id: string) => {
    try {
      const docRef = doc(db, 'tasks', id);
      await deleteDoc(docRef);
    } catch (error) {
      console.error("Error deleting task:", error);
      throw error;
    }
  },
  clearTasks: async (taskIds: string[]) => {
    try {
      const batch = writeBatch(db);
      taskIds.forEach(id => {
        const docRef = doc(db, 'tasks', id);
        batch.delete(docRef);
      });
      await batch.commit();
    } catch (error) {
      console.error("Error clearing tasks:", error);
      throw error;
    }
  },
  updateTasksBatch: async (updates: { id: string; category: string; effortLevel: string; priority: string; }[]) => {
    try {
      const batch = writeBatch(db);
      updates.forEach(update => {
        const docRef = doc(db, 'tasks', update.id);
        batch.update(docRef, {
          category: update.category,
          effortLevel: update.effortLevel,
          priority: update.priority
        });
      });
      await batch.commit();
    } catch (error) {
      console.error("Error updating tasks in batch:", error);
      throw error;
    }
  }
};
