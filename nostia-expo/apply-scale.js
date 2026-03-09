const fs = require('fs');
const path = require('path');

const screensDir = path.join(__dirname, 'nostia-mobile/src/screens');
const files = fs.readdirSync(screensDir).filter(f => f.endsWith('.tsx'));

let totalReplaced = 0;

for (const file of files) {
  const filePath = path.join(screensDir, file);
  let content = fs.readFileSync(filePath, 'utf8');

  if (content.includes("from '../utils/scale'")) {
    console.log(file + ': already has scale import, skipping');
    continue;
  }

  const matches = content.match(/fontSize: \d+/g) || [];
  if (matches.length === 0) {
    console.log(file + ': no fontSize values found');
    continue;
  }

  // Add import before 'export default function'
  content = content.replace(
    /^(export default function)/m,
    "import { ms } from '../utils/scale';\n\n$1"
  );

  // Replace fontSize: NUMBER with fontSize: ms(NUMBER)
  content = content.replace(/fontSize: (\d+)/g, 'fontSize: ms($1)');
  const count = (content.match(/fontSize: ms\(/g) || []).length;

  fs.writeFileSync(filePath, content);
  totalReplaced += count;
  console.log(file + ': replaced ' + count + ' fontSize values');
}

console.log('\nTotal fontSize values scaled: ' + totalReplaced);
