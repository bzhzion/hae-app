const fs = require('fs');
const path = require('path');

const pkgPath = path.resolve(__dirname, '../node_modules/react-native-gesture-handler/package.json');
if (!fs.existsSync(pkgPath)) process.exit(0);

const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
if (pkg['react-native'] === 'src/index.ts') {
  pkg['react-native'] = 'lib/commonjs/index.js';
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));
  console.log('fix-gesture-handler: react-native field patched to lib/commonjs/index.js');
}
