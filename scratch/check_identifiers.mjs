import * as fs from 'fs';

const content = fs.readFileSync('./src/studio/studioApp.js', 'utf8');

// Extract renderDopeSheet method
const startIdx = content.indexOf('renderDopeSheet() {');
const endIdx = content.indexOf('updatePlayhead() {');
const dopeSheetCode = content.substring(startIdx, endIdx);

console.log('renderDopeSheet length:', dopeSheetCode.length);

// Check all global/outer identifiers used in renderDopeSheet
// Regex for identifiers
const idents = [...new Set([...dopeSheetCode.matchAll(/\b([a-zA-Z_$][a-zA-Z0-9_$]*)\b/g)].map(m => m[1]))];

// Check which of these are not JS keywords/globals and not defined in scope or imports
const jsGlobals = new Set([
  'document', 'window', 'Math', 'Array', 'Set', 'Map', 'parseFloat', 'parseInt', 'isNaN', 'String', 'JSON',
  'console', 'e', 'me', 'this', 'const', 'let', 'var', 'if', 'else', 'for', 'return', 'function',
  'true', 'false', 'null', 'undefined', 'new', 'delete', 'typeof', 'instanceof', 'void', 'default',
  'performance', 'cancelAnimationFrame', 'requestAnimationFrame', 'alert', 'confirm', 'prompt'
]);

// Check imports in studioApp.js
const imports = [...content.matchAll(/import\s*\{([^}]+)\}/g)].flatMap(m => m[1].split(',').map(s => s.trim().split(' as ')[0]));
const importSet = new Set(imports);

// Top level functions in studioApp.js
const topLevelFns = [...content.matchAll(/^(?:export\s+)?function\s+([a-zA-Z0-9_$]+)/gm)].map(m => m[1]);
const topLevelSet = new Set(topLevelFns);

console.log('Imports:', imports);
console.log('Top level fns in studioApp:', topLevelFns);

