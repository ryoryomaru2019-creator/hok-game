const fs = require('fs');
let html = fs.readFileSync('admin.html', 'utf8');

// Line 460 の後に </div> を入れた場合
html = html.replace(
`                <span class="desc-text">魚同士が適度な間隔を保ち、画面全体にまばらに散らばって泳ぐ強さです。ゲーム開始時の初期配置や遊泳中の分散に適用されます。</span>
              </div>
            <!-- 4. ゲーム開始時のキャラクター配置・遊泳設定 (全モード共通) -->`,
`                <span class="desc-text">魚同士が適度な間隔を保ち、画面全体にまばらに散らばって泳ぐ強さです。ゲーム開始時の初期配置や遊泳中の分散に適用されます。</span>
              </div>
            </div><!-- /Line 351 settings-block -->

            <!-- 4. ゲーム開始時のキャラクター配置・遊泳設定 (全モード共通) -->`
);

const lines = html.split('\n');
const stack = [];

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const tagRegex = /<\/?([a-zA-Z0-9-]+)(?:\s+[^>]*)?>/g;
  let match;
  while ((match = tagRegex.exec(line)) !== null) {
    const fullTag = match[0];
    const tagName = match[1].toLowerCase();
    if (tagName !== 'div') continue;
    const isClosing = fullTag.startsWith('</');

    if (isClosing) {
      if (stack.length > 0) {
        const top = stack.pop();
        if (top.id && (top.id.startsWith('paneParam') || top.id === 'subPanelParams')) {
          console.log(`L${i+1}: close </div> for ${top.id} (opened at L${top.line})`);
        }
      }
    } else {
      const idMatch = fullTag.match(/id="([^"]+)"/);
      const classMatch = fullTag.match(/class="([^"]+)"/);
      const id = idMatch ? idMatch[1] : '';
      stack.push({
        line: i + 1,
        id: id,
        class: classMatch ? classMatch[1] : ''
      });
      if (id && (id.startsWith('paneParam') || id === 'subPanelParams')) {
        console.log(`L${i+1}: open <div id="${id}"> (depth ${stack.length})`);
      }
    }
  }
}
console.log('Unclosed div tags:');
stack.forEach(s => console.log(`  <div id="${s.id}" class="${s.class}"> opened at L${s.line}`));
