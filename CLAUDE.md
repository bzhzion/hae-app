# hae-app — Instructions Claude

## Stack

- Expo SDK 54, Expo Router (file-based navigation), React Native
- Zustand + AsyncStorage (persist)
- Vanilla `Animated` from React Native (NOT Reanimated, incompatible with Expo Go)
- TypeScript strict

## Expo Go vs Dev Build

**Reanimated requires a dev build.** `react-native-worklets` is a native TurboModule not included in Expo Go.
Always use `Animated` from `react-native` for animations in this project until a dev build is set up.

## Architecture

- `app/(auth)/` — login screen
- `app/(app)/(tabs)/` — main tabs: tasks, projects
- `components/` — reusable components (CardDetailSheet, etc.)
- `stores/` — Zustand stores: auth (token, serverUrl), project (currentProjectId, currentProjectName)

## API

hae-api runs on port 8150 (Bun + Hono + SQLite). JWT auth.
Key endpoints: `/api/projects`, `/api/cards/:id`, `/api/checklists`, `/api/items`, `/api/comments`, etc.
Always check `D:\Git\hae-api\src\routes\` before implementing API calls.

## Testing avec Playwright MCP

**Playwright MCP est disponible pour tester l'UI.** Utilise-le pour:
- Vérifier que la navigation fonctionne
- Tester les formulaires
- Faire des screenshots pour voir l'etat visuel

Expo Web tourne sur `http://localhost:8081` quand Metro est lance (`npx expo start --clear`).
Playwright MCP est en mode `--headed` avec profil persistant.

**TOUJOURS tester les changements UI avant de reporter "done".** Si Metro tourne, ouvre un screenshot Playwright pour verifier.

## Commits

- Version dans `package.json` (semver, bump avant chaque commit signifiant)
- CHANGELOG.md a jour a chaque version
- todo.md a mettre a jour (cocher ce qui est fait)
- Commit message format: `feat|fix|style|refactor(scope): description`

## Regles

- Pas de Reanimated dans ce projet (Expo Go)
- Pas de commentaires dans le code sauf si WHY non-evident
- Styles dans `StyleSheet.create`, pas de styles inline complexes
