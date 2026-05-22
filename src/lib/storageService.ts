import { Preferences } from '@capacitor/preferences';

const STORAGE_KEY = 'forgetMeNotData';

// Define the shape of your master data
interface AppData {
  tasks: any[];
  routines: any[];
}

export const storageService = {
  // 1. Fetch data on app boot
  async loadData(): Promise<AppData> {
    try {
      const { value } = await Preferences.get({ key: STORAGE_KEY });
      if (value) {
        return JSON.parse(value);
      }
      // If no data exists yet, return empty defaults
      return { tasks: [], routines: [] };
    } catch (error) {
      console.error("Failed to load local data", error);
      return { tasks: [], routines: [] };
    }
  },

  // 2. Save data instantly (Optimistic UI)
  async saveData(data: AppData): Promise<void> {
    try {
      // Stringify the master state and push it to the native device storage
      await Preferences.set({
        key: STORAGE_KEY,
        value: JSON.stringify(data),
      });
    } catch (error) {
      console.error("Failed to save local data", error);
    }
  },
  
  // 3. Clear everything (just in case)
  async clearAll(): Promise<void> {
    await Preferences.remove({ key: STORAGE_KEY });
  }
};
