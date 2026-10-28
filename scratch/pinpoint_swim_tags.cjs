const fs = require('fs');
const html = fs.readFileSync('admin.html', 'utf8');
const lines = html.split('\n');

const stack = [];

for (let i = 348; i < 635; i++) {
  const line = lines[i];
  const tagRegex = /<\/?([a-zA-Z0-9-]+)(?:\s+[^>]*)?>/g;
  let match;
  while ((match = tagRegex.exec(line)) !== null) {
    const fullTag = match[0];
    const tagName = match[1].toLowerCase();
    const isClosing = fullTag.startsWith('</');
    const isSelfClosing = fullTag.endsWith('/>') || ['img', 'input', 'br', 'hr', 'meta', 'link'].includes(tagName);

    if (isSelfClosing) continue;

    if (isClosing) {
      if (stack.length > 0) {
        const top = stack.pop();
        console.log(`L${i+1}: close </${tagName}> (opened at L${top.line}: <${top.tagName} id="${top.id}" class="${top.class}">), depth now ${stack.length}`);
      }
    } else {
      const idMatch = fullTag.match(/id="([^"]+)"/);
      const classMatch = fullTag.match(/class="([^"]+)"/);
      stack.push({
        tagName,
        line: i + 1,
        id: idMatch ? idMatch[1] : '',
        class: classMatch ? classMatch[1] : ''
      });
      console.log(`L${i+1}: open <${tagName} id="${idMatch ? idMatch[1] : ''}" class="${classMatch ? classMatch[1] : ''}">, depth now ${stack.length}`);
    }
  }
}
console.log('Unclosed inside paneParamSwim:');
stack.forEach(s => console.log(`  <${s.tagName} id="${s.id}" class="${s.class}"> at L${s.line}`));
