const fs = require('fs');
const path = require('path');

const pkgPath = path.resolve(__dirname, '../node_modules/expo-modules-core/package.json');
if (!fs.existsSync(pkgPath)) process.exit(0);

// Create a CJS stub — used by Node.js during config plugin resolution.
// Metro uses its own resolver and never loads this stub (it uses 'default' → src/index.ts).
// Node 25 cannot strip TypeScript from node_modules, so we need a plain CJS file.
const stubPath = path.resolve(__dirname, '../node_modules/expo-modules-core/_node_compat.cjs');
fs.writeFileSync(stubPath, [
  '// CJS stub for Node.js config plugin resolution (not used by Metro)',
  'class CodedError extends Error { constructor(code, msg) { super(msg); this.code = code; } }',
  'class UnavailabilityError extends CodedError {',
  '  constructor(modName, propName) { super("ERR_UNAVAILABLE", modName + "." + propName + " is not supported"); }',
  '}',
  'class EventEmitter { addListener() {} removeListener() {} emit() {} listenerCount() { return 0; } }',
  'class NativeModule extends EventEmitter {}',
  'class SharedObject {}',
  'class SharedRef {}',
  'const NativeModulesProxy = new Proxy({}, { get: () => ({}) });',
  'const Platform = { OS: "web", select: (s) => s.web || s.default || null };',
  'module.exports = {',
  '  CodedError, UnavailabilityError, EventEmitter, NativeModule, SharedObject, SharedRef,',
  '  NativeModulesProxy, Platform,',
  '  requireNativeModule: () => ({}),',
  '  requireOptionalNativeModule: () => null,',
  '  registerWebModule: (cls) => cls,',
  '};',
].join('\n'));

const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

if (!pkg.exports) pkg.exports = {};
if (!pkg.exports['.']) pkg.exports['.'] = {};

// 'node' condition is checked by Node.js (both require and import) but NOT by Metro.
// So Metro falls through to 'default' = './src/index.ts' (TypeScript, handled fine by Metro).
pkg.exports['.'] = {
  node: './_node_compat.cjs',
  types: './build/index.d.ts',
  default: './src/index.ts',
};

fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));
console.log('fix-expo-modules-core: node condition → CJS stub (Node 25 compat, Metro unaffected)');
