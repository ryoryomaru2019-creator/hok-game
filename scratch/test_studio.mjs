import * as fs from 'fs';

const content = fs.readFileSync('./src/studio/studioApp.js', 'utf8');

// Find all `this.xxx(` calls in studioApp.js
const methodCalls = [...content.matchAll(/this\.([a-zA-Z0-9_]+)\s*\(/g)].map(m => m[1]);
const uniqueCalls = [...new Set(methodCalls)];

// Find all method definitions `xxx(` in StudioApp class
const methodDefs = [...content.matchAll(/^\s*([a-zA-Z0-9_]+)\s*\([^)]*\)\s*\{/gm)].map(m => m[1]);
const uniqueDefs = new Set(methodDefs);

// Also properties initialized in constructor
const constructorMatch = content.match(/constructor\s*\([^)]*\)\s*\{([\s\S]*?)\n\s*init/);
const assignedProps = constructorMatch ? [...constructorMatch[1].matchAll(/this\.([a-zA-Z0-9_]+)\s*=/g)].map(m => m[1]) : [];
const uniqueProps = new Set(assignedProps);

console.log('Total unique this.xxx() calls:', uniqueCalls.length);
const missing = uniqueCalls.filter(name => !uniqueDefs.has(name));
console.log('Calls without a method definition in class:');
missing.forEach(m => console.log(' - ' + m));
