const fs = require('fs');
const readline = require('readline');

const rl = readline.createInterface({
  input: fs.createReadStream('C:/Users/ryory/.gemini/antigravity-ide/brain/54bdd987-93bf-4203-a52b-a187a280ffe7/.system_generated/logs/transcript_full.jsonl')
});

rl.on('line', (line) => {
  if (line.includes('"step_index":6983') || line.includes('"step_index":6920') || line.includes('"step_index":6916')) {
    const obj = JSON.parse(line);
    fs.writeFileSync('d:/AI/GAME/HIRAME/view_' + obj.step_index + '.txt', obj.content || '');
    console.log('Saved view_' + obj.step_index + '.txt, length:', (obj.content || '').length);
  }
});
