import fs from 'fs';

let c = fs.readFileSync('src/App.tsx', 'utf8');

c = c.replace(/        try \{\n          await storageService\.completeTask\(id\);\n          \n          fetchCompletedTasksCount\(\);\n         catch \(error\) \{/g, 
`        try {
          await storageService.completeTask(id);
          fetchCompletedTasksCount();
        } catch (error) {`);

// 1158 error `, expected`, probably in `importTasksBatch` or similar
// Let's replace the whole `completeTask` just to be safe
c = c.replace(/      setTasks\(prev => prev.filter\(t => t.id !== id\)\);\n      \n      \n        \n        try \{\n          await storageService\.completeTask\(id\);\n          fetchCompletedTasksCount\(\);\n        \} catch \(error\) \{\n          console\.error\("Failed to complete task", error\);\n        \} finally \{\n          setCompletingIds\(prev => prev\.filter\(compId => compId !== id\)\);\n        \}\n      \}/g,
`      setTasks(prev => prev.filter(t => t.id !== id));
      try {
        await storageService.completeTask(id);
        fetchCompletedTasksCount();
      } catch (error) {
        console.error("Failed to complete task", error);
      } finally {
        setCompletingIds(prev => prev.filter(compId => compId !== id));
      }`);

// Around 1165 `Declaration or statement expected`
c = c.replace(/      \} catch \(error\) \{\n        setToastError\("Failed to back up data\."\);\n        console\.error\("Backup failed:", error\);\n      \}\n    \}\n  \};/g,
`      } catch (error) {
        setToastError("Failed to back up data.");
        console.error("Backup failed:", error);
      }
  };`);

// Around 1622 `Declaration or statement expected`
c = c.replace(/      \} catch \(error\) \{\n        console\.error\("Failed to background sync pull task", error\);\n      \}\n    \}\n  \};/g,
`      } catch (error) {
        console.error("Failed to background sync pull task", error);
      }
  };`);

// Around 1826 `Declaration or statement expected`
// App.tsx closing braces formatting is probably having one extra `}`.
// Let's just remove the last line if it's an extra bracket?
// 1826 is close to the end. The end has:
/*
  );
};

export default function App() {
  return <Dashboard />;
}
*/
// If there is an extra `}` above the `export default`, let's just strip it.
c = c.replace(/\}\n\nexport default function/g, '\nexport default function');


fs.writeFileSync('src/App.tsx', c);
console.log('Fixed syntax 4');
