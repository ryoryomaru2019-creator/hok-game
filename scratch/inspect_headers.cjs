const fs = require('fs');
const html = fs.readFileSync('admin.html', 'utf8');
const lines = html.split('\n');
const panelIds = ['subPanelParams', 'subPanelBgm', 'subPanelTitles', 'subPanelXShare', 'subPanelTitleMode', 'subPanelRanking', 'subPanelLore', 'subPanelAmbient'];
panelIds.forEach(id => {
  const idx = lines.findIndex(l => l.includes(`id="${id}"`));
  if (idx !== -1) {
    console.log(`\n=== ${id} (line ${idx+1}) ===`);
    for (let i = idx; i < Math.min(idx + 30, lines.length); i++) {
      if (lines[i].includes('class="card-header"') || lines[i].includes('class="panel-header"') || lines[i].includes('admin-inner-tabs-nav')) {
        console.log(`HEADER FOUND at ${i+1}: ${lines[i].trim()}`);
        for (let j = i; j < Math.min(i + 12, lines.length); j++) {
          console.log(`  ${j+1}: ${lines[j]}`);
        }
        break;
      }
    }
  }
});
