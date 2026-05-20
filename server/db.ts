import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  limit as firestoreLimit,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import dotenv from 'dotenv';

dotenv.config();

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

interface Profile {
  bio: string;
}

interface Task {
  id: string;
  title: string;
  description: string;
  status: 'active' | 'completed' | 'dismissed';
  category: 'life' | 'household';
  userId: string;
  createdAt: any;
  completedAt?: any;
  tag?: string;
  isRecurring?: boolean;
  recurrenceInterval?: 'daily' | 'weekly' | 'monthly' | 'yearly';
  isPaused?: boolean;
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
    }
  },
  getTasks: async (userId: string, status?: 'active' | 'completed', limit?: number, offset?: number) => {
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
          // Convert Firestore Timestamps to strings for the frontend
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
      return [];
    }
  },
  addTask: async (userId: string, title: string, description: string = "", category: 'life' | 'household' = 'life', tag?: string, isRecurring?: boolean, recurrenceInterval?: 'daily' | 'weekly' | 'monthly' | 'yearly') => {
    try {
      const tasksRef = collection(db, 'tasks');
      const newTaskDoc = doc(tasksRef);
      const newTask: Omit<Task, 'id'> = {
        userId,
        title,
        description,
        status: 'active',
        category,
        tag: tag || null as any,
        isRecurring: isRecurring || false,
        recurrenceInterval: recurrenceInterval || null as any,
        createdAt: serverTimestamp()
      };
      await setDoc(newTaskDoc, newTask);
      return { id: newTaskDoc.id, ...newTask, createdAt: new Date().toISOString() };
    } catch (error) {
      console.error("Error adding task:", error);
      throw error;
    }
  },
  updateTask: async (id: string, updates: Partial<Task>) => {
    try {
      const docRef = doc(db, 'tasks', id);
      const cleanUpdates = JSON.parse(JSON.stringify(updates)); // Remove undefined
      await updateDoc(docRef, cleanUpdates);
      const updatedSnap = await getDoc(docRef);
      return { id, ...updatedSnap.data() };
    } catch (error) {
      console.error("Error updating task:", error);
      return null;
    }
  },
  completeTask: async (id: string) => {
    try {
      const docRef = doc(db, 'tasks', id);
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) return null;
      
      const task = docSnap.data() as Task;
      const completedAt = serverTimestamp();
      
      await updateDoc(docRef, {
        status: 'completed',
        completedAt
      });
      
      if (task.isRecurring && task.recurrenceInterval) {
        const nextDate = new Date();
        if (task.recurrenceInterval === 'daily') nextDate.setDate(nextDate.getDate() + 1);
        if (task.recurrenceInterval === 'weekly') nextDate.setDate(nextDate.getDate() + 7);
        if (task.recurrenceInterval === 'monthly') nextDate.setMonth(nextDate.getMonth() + 1);
        if (task.recurrenceInterval === 'yearly') nextDate.setFullYear(nextDate.getFullYear() + 1);
        
        await setDoc(doc(collection(db, 'tasks')), {
          ...task,
          status: 'active',
          createdAt: Timestamp.fromDate(nextDate),
          completedAt: null
        });
      }
      
      return { ...task, status: 'completed', completedAt: new Date().toISOString() };
    } catch (error) {
      console.error("Error completing task:", error);
      return null;
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
      return null;
    }
  },
  deleteTask: async (id: string) => {
    try {
      const docRef = doc(db, 'tasks', id);
      await deleteDoc(docRef);
    } catch (error) {
      console.error("Error deleting task:", error);
    }
  }
};
