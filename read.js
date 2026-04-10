const fs = require('fs');
const content = fs.readFileSync('korean.csv', 'utf-8');
console.log(content.split('\n').slice(0, 10).join('\n'));
