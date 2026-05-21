import fs from 'fs';

let content = fs.readFileSync('src/HistoryView.tsx', 'utf8');

content = content.replace(/import { useAuth } from ".\/components\/AuthProvider";/g, '');
content = content.replace(/import { dbService } from ".\/lib\/dbService";/g, 'import { storageService } from "./lib/storageService";');
content = content.replace(/const { user } = useAuth\(\);/g, '');
content = content.replace(/if \(!user\) return;/g, '');
content = content.replace(/userId: string;/g, '');
content = content.replace(/dbService/g, 'storageService');
content = content.replace(/user\.uid/g, '""');
content = content.replace(/\[user\]/g, '[]');

fs.writeFileSync('src/HistoryView.tsx', content);

console.log('Fixed src/HistoryView.tsx');
