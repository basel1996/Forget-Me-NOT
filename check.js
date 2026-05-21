import * as p from '@babel/parser';
import * as fs from 'fs';

const code = fs.readFileSync('src/App.tsx', 'utf8');
try {
  p.parse(code, {
    sourceType: 'module',
    plugins: ['jsx', 'typescript']
  });
  console.log("No syntax errors");
} catch(e) {
  console.log("Syntax error at", e.loc);
  const lines = code.split('\n');
  const lineNum = e.loc.line - 1;
  console.log(lines.slice(Math.max(0, lineNum - 5), lineNum + 6).join('\n'));
}
