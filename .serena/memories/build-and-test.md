# Build and Test Commands

## Build Commands

### Full Build
```bash
npm run compile
```
Runs both extension and webview compilation.

### Extension Only
```bash
npm run compile:extension
# or
tsc -p ./
```
Compiles TypeScript to `out/` directory.

### Webview Only
```bash
npm run compile:webview
# or
node build/esbuild.webview.js
```
Bundles React webview with esbuild.

## Watch Mode
```bash
npm run watch              # Both
npm run watch:extension    # Extension only
npm run watch:webview      # Webview only
```

## Packaging
```bash
npx vsce package --allow-missing-repository
```
Creates `claude-code-chat-1.1.0.vsix`.

## Installation
```bash
code --install-extension claude-code-chat-1.1.0.vsix --force
```

## Linting
```bash
npm run lint
```
Uses ESLint with TypeScript parser.

## Testing
```bash
npm run test
```
Uses @vscode/test-cli.

## Build Output
- Extension: `out/extension.js` (main entry)
- Webview: `out/webview/` (bundled React app)

## Key Build Files
- `tsconfig.json` - Extension TypeScript config (excludes webview)
- `tsconfig.webview.json` - Webview TypeScript config
- `build/esbuild.webview.js` - Webview bundler script
- `postcss.config.js` - PostCSS for Tailwind
- `tailwind.config.js` - Tailwind CSS configuration
