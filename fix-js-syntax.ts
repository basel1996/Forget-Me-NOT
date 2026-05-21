import fs from 'fs';

function fixFileLines(filePath: string) {
    const lines = fs.readFileSync(filePath, 'utf8').split('\n');
    let fixed = false;
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // Fix getTasks(,
        if (line.includes('storageService.getTasks(,')) {
            lines[i] = line.replace('storageService.getTasks(, ', 'storageService.getTasks(').replace('storageService.getTasks(,(', 'storageService.getTasks(');
        }
        
        // Fix empty argument
        if (line.includes('storageService.getCompletedTasksToday()') && lines[i].includes('""')) {
             lines[i] = line.replace('""', '');
        }

        // Fix try { await storageService... catch (error) missing }
        if (line.match(/^\s*catch \(/) && !lines[i-1].includes('}')) {
             lines[i-1] += ' }';
             // wait, if we also missed the `try {` ?
             // let's look for `try {` before this
             let j = i - 1;
             let hasTry = false;
             while(j > i - 10 && j >= 0) {
                 if (lines[j].includes('try {')) { hasTry = true; break; }
                 j--;
             }
             if(!hasTry) {
                 // oops, no try
             }
        }
    }
    fs.writeFileSync(filePath, lines.join('\n'));
}

fixFileLines('src/App.tsx');
fixFileLines('src/HistoryView.tsx');
fixFileLines('src/components/WeeklyWinsDashboard.tsx');
console.log('Fixed lines');
