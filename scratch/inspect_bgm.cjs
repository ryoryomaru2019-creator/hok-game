const fs = require('fs');
const html = fs.readFileSync('admin.html', 'utf8');
const lines = html.split('\n');
const start = lines.findIndex(l => l.includes('id="paneBgmVolumeList"'));
for (let i = start; i < start + 60; i++) {
  console.log(`${i+1}: ${lines[i]}`);
}
