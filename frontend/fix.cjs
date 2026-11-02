const fs = require('fs');
const lines = fs.readFileSync('src/App.tsx', 'utf8').split('\n');
fs.writeFileSync('src/App.tsx', lines.slice(0, 1023).join('\n'));
