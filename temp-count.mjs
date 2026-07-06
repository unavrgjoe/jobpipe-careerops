import yaml from 'js-yaml';
import fs from 'fs';

const content = fs.readFileSync('C:/jobpipe-careerops/portals.yml', 'utf-8');
const config = yaml.load(content);

console.log('Total tracked companies:', config.tracked_companies?.length || 0);
console.log('Total job boards:', config.job_boards?.length || 0);
