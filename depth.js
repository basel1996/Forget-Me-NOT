import * as fs from 'fs';

const code = fs.readFileSync('src/App.tsx', 'utf8');
const lines = code.split('\n');

let depth = 0;
let dashboardStart = -1;

for(let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if(line.includes('const Dashboard = () => {')) {
    dashboardStart = i;
  }
  
  if (dashboardStart !== -1) {
    let lineDepthChange = 0;
    for(let char of line) {
       if (char === '{') lineDepthChange++;
       if (char === '}') lineDepthChange--;
    }
    depth += lineDepthChange;
    if (depth <= 0 && i > dashboardStart) {
       console.log("Dashboard closed at line", i + 1);
       depth = 0; // reset to see if it jumps around
       dashboardStart = -1; // stop tracking Dashboard
    }
  }
}
