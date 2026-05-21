import fs from 'fs';

function fixFile(filePath: string) {
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, 'utf8');

  // Remove sync status references
  content = content.replace(/setSyncStatus\(.*?\);/g, '');
  content = content.replace(/if \(isOffline\) \{(.*?)\} else \{(.*?)\}/gms, '$2'); // remove the isOffline branching
  
  // Fix arguments that passed user.id
  content = content.replace(/storageService\.getTasks\(""/g, 'storageService.getTasks(');
  content = content.replace(/storageService\.getTasks\("",/g, 'storageService.getTasks(');
  content = content.replace(/storageService\.getCompletedTasksToday\(""\)/g, 'storageService.getCompletedTasksToday()');
  content = content.replace(/storageService\.getProfile\(""\)/g, 'storageService.getProfile()');
  content = content.replace(/storageService\.saveProfile\("",/g, 'storageService.saveProfile(');
  
  // StorageService methods we need to export correctly
  content = content.replace(/importTasksBatch/g, 'replaceAllTasks');
  
  // Task status types
  content = content.replace(/'active' \| 'completed' \| 'dismissed'/g, "'active' | 'completed'");

  // the remaining of `syncWithCloud` error: it's not defined, so remove the manual sync code that calls syncWithCloud
  // I removed the manual sync button, but the `handleManualSync` is still defined
  // Wait, I can just replace `storageService.syncWithCloud(user.uid)` with nothing
  content = content.replace(/await storageService\.syncWithCloud\(""\);/g, '');

  fs.writeFileSync(filePath, content);
}

fixFile('src/App.tsx');
fixFile('src/HistoryView.tsx');
fixFile('src/components/WeeklyWinsDashboard.tsx');

// Also, storageService interface Task needs `completedAt` to be correctly aligned, I missed it in Quick Capture...
// But wait, the error is: Property 'completedAt' is missing in type... I can add it to the quick capture object: completedAt: null.
// Let's replace: `effortLevel: 'medium'` with `effortLevel: 'medium', completedAt: null` in QuickCapture
let appContent = fs.readFileSync('src/App.tsx', 'utf8');
appContent = appContent.replace(/effortLevel: 'medium'\s*\}/g, "effortLevel: 'medium', completedAt: null }");
// Remove the useNetworkStatus import line entirely if it exists
appContent = appContent.replace(/import \{ useNetworkStatus \} from ".*?";/gi, '');
appContent = appContent.replace(/import \{ SyncIndicator \} from ".*?";/gi, '');
fs.writeFileSync('src/App.tsx', appContent);

let dashContent = fs.readFileSync('src/components/WeeklyWinsDashboard.tsx', 'utf8');
dashContent = dashContent.replace(/import \{ AuthProvider, useAuth \} from "\.\/AuthProvider";/g, '');
dashContent = dashContent.replace(/import \{ useAuth \} from "\.\/AuthProvider";/g, '');
fs.writeFileSync('src/components/WeeklyWinsDashboard.tsx', dashContent);

console.log('Fixed typescript errors');
