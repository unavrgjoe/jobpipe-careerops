import fs from 'fs';
import path from 'path';

const providers = new Set();
const dir = 'C:/jobpipe-careerops/providers';

fs.readdirSync(dir).filter(f => f.endsWith('.mjs') && !f.startsWith('_')).forEach(f => {
  const content = fs.readFileSync(path.join(dir, f), 'utf-8');
  const match = content.match(/id:\s*['"](\w+)['"]/);
  if (match) providers.add(match[1]);
});

console.log('Total providers:', providers.size);
console.log('Providers:');
[...providers].sort().forEach(p => console.log('  -', p));
