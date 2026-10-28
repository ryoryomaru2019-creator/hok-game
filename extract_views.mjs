import fs from 'fs';
import readline from 'readline';

const rl = readline.createInterface({
  input: fs.createReadStream('C:/Users/ryory/.gemini/antigravity-ide/brain/54bdd987-93bf-4203-a52b-a187a280ffe7/.system_generated/logs/transcript_full.jsonl')
});

let found = [];
rl.on('line', (line) => {
  if (line.includes('admin.html') && line.includes('subPanelTitles') && line.includes('adminTitleTiersList')) {
    found.push(line);
  }
});

rl.on('close', () => {
  console.log('Found:', found.length);
  for (let i = 0; i < found.length; i++) {
    const o = JSON.parse(found[i]);
    console.log(`[${i}] step_index: ${o.step_index}, type: ${o.type}`);
    if (o.tool_calls) {
      o.tool_calls.forEach(tc => {
        console.log('   tool:', tc.name);
        if (tc.args && tc.args.TargetContent) {
          console.log('   TargetContent len:', tc.args.TargetContent.length);
          fs.writeFileSync(`d:/AI/GAME/HIRAME/tc_${o.step_index}.txt`, tc.args.TargetContent);
        }
        if (tc.args && tc.args.ReplacementContent) {
          console.log('   ReplacementContent len:', tc.args.ReplacementContent.length);
          fs.writeFileSync(`d:/AI/GAME/HIRAME/rc_${o.step_index}.txt`, tc.args.ReplacementContent);
        }
      });
    }
    if (o.content && o.content.includes('subPanelTitles')) {
      fs.writeFileSync(`d:/AI/GAME/HIRAME/content_${o.step_index}.txt`, o.content);
    }
  }
});
