# Changelog

## [1.3.7] - 2026-06-13

### Added
- **Ingest API** : section "TOKEN API NOTIFICATIONS" dans Settings pour générer/régénérer le token
- Copie du token en un tap (feedback visuel "check" 2 secondes)
- Notifications : affichage `inbox_message` avec titre, corps, bouton "Ouvrir" si URL présente
- Notifications : swipe gauche auto-archive au relâchement (plus besoin de taper le bouton rouge)
- Notifications : retour haptique `NotificationFeedbackType.Success` à l'archivage par swipe

## [1.3.6] - 2026-06-12

### Added
- Share Extension iOS : partager une URL/texte depuis n'importe quelle app vers hae
- UI native (sheet iOS) avec sélecteur de projet et bouton "Créer la carte"
- Module natif `HaeAppGroup` : partage du token JWT via App Group UserDefaults
- Login écrit serverUrl + token dans l'App Group après authentification
- Logout efface l'App Group
- Config plugin Expo `withShareExtension` + `withHaeAppGroup` pour le build EAS
- App Group `group.org.breizhzion.hae` configuré dans les entitlements iOS

## [1.3.5] - 2026-06-12

### Added
- Notifications : archivage par swipe gauche (bouton rouge archive)
- Notifications : bouton "Tout archiver" dans le header
- Notifications : vue Archives (toggle Inbox/Archives dans le header)
- API : `PATCH /api/notifications/:id/dismiss` et `POST /api/notifications/dismiss-all`
- API : `GET /api/notifications/archived` pour les notifications archivées
- DB : colonne `is_dismissed` sur la table `notifications` (migration automatique)
- Logique : `card_due_soon` ne se recrée pas si une notif existe déjà (dismissed ou non)

## [1.3.4] - 2026-06-12

### Added
- STT (Whisper) : micro dans le champ de saisie de commentaire
- Bouton baguette magique (`color-wand-outline`) avec bordure cohérente sur description et checklist
- Correction visuelle : boutons IA (baguette) alignés sur le style des boutons micro (28x28, bordure BRAND)

## [1.3.3] - 2026-06-11

### Fixed
- Checklist : progress counters (X/Y) synchronisés en temps réel après toggle/ajout/suppression d'un item
- Checklist : vrai checkmark Ionicons (`checkmark`) remplace le texte `v`
- Tâches : ordre colonnes corrigé — Inbox > Someday > Next > Urgent > Waiting > Done

### Added
- Colonne **Done** toujours visible (colonne GTD native, non personnalisable)
- Correction login : réponse non-JSON du serveur ne provoque plus de crash "JSON Parse error"
- Auto-sélection du projet Personnel au premier lancement (plus d'écran vide "Aucun projet")
- Dernier projet ouvert mémorisé via AsyncStorage (fallback Personnel si disparu)

## [1.3.2] - 2026-06-11

### Added
- **Cascade IA** : composant `AiConfigSection` réutilisable (collapsible, dot rouge si config active)
- Config IA dans Settings (niveau user personnel)
- Config IA dans Organisation (niveau org, admin/owner requis)
- Config IA dans Paramètres Projet (niveau projet, surcharge la cascade)
- Preset pills dans AiConfigSection (OpenAI, Mistral, Groq, OpenRouter, Ollama) pour auto-remplir l'URL
- `{ silent, noRetry }` options dans `makeApi()` — plus de toast/retry sur les fetches background
- Migration expo-av supprimée : `expo-audio` + `expo-video` utilisés partout
- Fix nouveau user : `logout()` efface maintenant `currentProjectId` (plus de boucle 403)
- Fix `((moi))` dans project-settings
- Logo de l'app affiché dans l'écran de login
- Icônes standardisées `#A00000` + fond transparent
- Toast global (session expirée, accès refusé, erreur réseau)
- Retry auto + timeout AbortController dans `makeApi()`
- Bouton téléchargement pour tous les types de pièces jointes (audio, vidéo, fichiers)

### Accessibility
- **ToastBanner** : `accessibilityLiveRegion='polite'` + `accessibilityRole='alert'` (annonce VoiceOver/TalkBack)
- **UserAvatar** : `accessibilityLabel` sur image et fallback View
- **CardDetailSheet** : 33 corrections — close button, checkboxes (role+state), modals (viewIsModal), attachments, comments, labels, stopwatch, CalendarPicker
- **Settings** : Switch biométrie label, boutons langue `role='radio'` + `state.selected`, modals viewIsModal
- **Organisation** : labels accessibilité sur tous les boutons d'action
- **AiConfigSection** : `expanded` state, `selected` state sur les pills, labels TextInput

### i18n
- Bloc `aiConfig` ajouté dans EN/FR/KO — aucune string hardcodée

### Docs
- README complet : architecture, features, setup, MCP tools

## [1.3.1] - 2026-06-10

### Chore
- Alignement version 1.3.1 (fix routing pièces jointes côté API)

## [1.3.0] - 2026-06-10

### Chore
- Alignement de version avec hae-api et hae-mcp (v1.3.0 sur les 3 repos)

## [0.9.4] - 2026-06-10

### Added
- **Pièces jointes** dans CardDetailSheet : images affichées plein-largeur (tap = plein écran + bouton télécharger), fichiers non-image = chip (icône + nom + taille + téléchargement), bouton upload (+)
- **Changement d'avatar** dans Settings : tap sur l'avatar → galerie → recadrage 1:1 → upload vers `/api/users/me/avatar`, badge ✎ visible sur la photo
- Nouveau dépendance : `expo-document-picker`, `expo-image-picker`, `expo-file-system`, `expo-sharing`
- `AuthUser` étendu avec `avatar_url?: string | null`

## [0.9.3] - 2026-06-10

### Accessibilité
- Audit WCAG complet : `#9A9A92`, `#B0B0A8`, `#C4C4BE` remplacés par `#6B6B63` / `#8A8A80` sur fond `#FAFAF8`
- Ratio de contraste texte secondaire : 2.7:1 → 5.1:1 (AA conforme)
- Icônes décoratives (`#D0D0C8`) passent à `#A8A8A0` pour rester subtiles mais visibles
- Onglets inactifs (`INACTIVE`) : `#C4C4BE` → `#8A8A80`
- Placeholders : `#C4C4BE` → `#A0A098`
- Exceptions préservées : `clTextDone` (items cochés barrés), bordures décoratives `addChip`/`clCheck`

## [0.9.2] - 2026-06-10

### Cartes
- Barre de progression checklist sur chaque carte dans la liste (visible uniquement si `checklist_total > 0`)
- Affichage `X/Y` à droite de la barre, couleur BRAND pour la progression
- Données proviennent de `checklist_total` / `checklist_done` retournés par l'API (aucun appel supplémentaire)
- Chrono en cours affiché sur la carte (icône `play-circle` + timer `MM:SS` / `H:MM:SS` rouge, mis à jour chaque seconde via composant `RunningTimer`)
- Bulle commentaires sur la carte (icône `message-circle` + nombre, fond gris neutre, masquée si 0)

## [0.9.1] - 2026-06-10

### Notifications
- Fix ouverture carte depuis notification : remplacement du `useFocusEffect` + `.then()` stale-closure par `useEffect([pendingCardId, columns])` qui ouvre la carte dès que colonnes + ID sont disponibles
- Navigation cross-projet : `setCurrentProject` avant `setPendingCard` + navigate → `fetchProject` se relance via `useEffect([currentProjectId])`, puis la carte s'ouvre

## [0.9.0] - 2026-06-10

### UI / Navigation
- Onglets tâches : suppression de Réglages et Notifications du tab bar, déplacés en icônes header (Feather : loupe, cloche+badge, archive, engrenage)
- Bouton "+" remplacé par FAB rouge 52px fixe en bas à droite
- Icônes header/tabs : ronds rouges `#A00000` avec icône Feather blanche (remplace emojis)
- Onglet Projets : même structure header (loupe, cloche, engrenage) + FAB pour créer
- Projets groupés en 3 sections : PERSONNEL / PARTAGÉS / ORGANISATIONS
- Colonnes GTD : icône Feather par type (inbox, zap, alert-circle, clock, pause-circle) + icône `grid` pour custom
- Colonnes custom affichées toujours après les colonnes GTD
- Noms GTD francisés : À TRIER, PROCHAIN, URGENT, UN JOUR, EN ATTENTE (fallback si nom API = nom anglais par défaut)
- Long press sur onglet colonne → renommer, avec hint GTD affiché sous le champ

### Archives / Corbeille
- "Déplacer vers corbeille" renommé "Archiver" dans CardDetailSheet
- Archive = PATCH vers colonne `gtd_trash`. Si pas de colonne trash → DELETE
- Si carte déjà dans trash → bouton "⚠ Supprimer" avec confirmation "irréversible"
- `refreshKey` dans `stores/project.ts` : `triggerRefresh()` appelé depuis archives → tasks se re-fetch sans perdre la position de scroll
- Fix bug scroll : spinner affiché uniquement si `columns.length === 0` (évite démontage du pager)

### Calendrier
- Fix alignement jours : remplacement du `flexWrap` + `width: 14.285%` (arrondi flottant) par des lignes explicites avec `flex: 1`

### Réglages
- Section "À PROPOS" : version extraite de `app.json` via `Constants.expoConfig.version`, lien site, copyright Breizhzion
- Section "Paramètres avancés" dépliable (▼/▲) avec réinitialisation locale (AsyncStorage + SecureStore `hae-auth` + logout)
- URL serveur : texte gris non modifiable + icône copier (expo-clipboard)
- `NSFaceIDUsageDescription` + plugin `expo-local-authentication` ajoutés à `app.json` pour build natif Face ID

### Biométrie
- Fix boucle infinie : lock/unlock sur `background` uniquement (pas `inactive`). `inactive` = état déclenché par les dialogs système eux-mêmes
- Fix séquence iOS `background → inactive → active` : ref `cameFromBackground` pour déclencher re-auth au bon moment
- Guard `authenticating` ref pour éviter double appel concurrent
- Biométrie intentionnellement exclue des prefs cloud (hardware-dépendant, local uniquement)

### Prefs cloud
- `stores/prefs.ts` : store Zustand, fetch au login, save silencieux à chaque changement
- Endpoints `GET|PATCH /api/users/me/prefs` dans `hae-api` (table `user_preferences`)
- Langue synchronisée entre appareils via cloud, appliquée automatiquement à la reconnexion
- Reset appareil = efface local uniquement, prefs cloud préservées (restaurées au prochain login)

### Divers
- Fix reconnexion forcée Expo Go : attente hydratation Zustand (`onFinishHydration`) avant redirect dans `index.tsx`
- Suppression fichiers morts : `SortableCardList.native.tsx`, `SortableCardList.web.tsx`, `shims/draggable-flatlist-web.js`
- Fix crash null dans `search.tsx` : `projectForCard(activeCard!)` → guard `activeCard ? ... : ''`

## [0.8.0] - 2026-06-09
### Fixed / Added
- Profil éditable dans Réglages (nom, via PATCH /api/users/me)
- Changement de mot de passe dans Réglages (PATCH /api/users/me/password)
- Édition des commentaires inline dans CardDetailSheet (PATCH /api/comments/:id)
- Édition de projet via long press (menu Modifier / Supprimer)
- Bouton quitter organisation pour les membres non-owner
- Chips "+N" du calendrier cliquables (modal avec liste complète)
- Navigation depuis notifications vers la carte concernée (via pendingCardId store)
- unreadCount persisté entre sessions (AsyncStorage)
- Port 8083 ajouté à HAE_CORS_ORIGINS dans .env.dev

## [0.7.0] - 2026-06-09
### Added
- Biométrie FaceID/TouchID (expo-local-authentication, verrou au retour foreground, toggle dans Settings)
- Notifications screen : liste, badge rouge sur onglet, marquer lu/tout lire
- Markdown dans description des cartes (react-native-marked) + toolbar d'édition (Bold, Italic, Code, H1, H2, listes)
- Calendrier mensuel des cartes par date d'échéance : navigation mois, chips couleur, retards en rouge, tap ouvre CardDetailSheet
- Recherche full-text : filtres projets + labels, breadcrumb projet › colonne, résultats live
- Archives : écran dédié (colonne Trash), restaurer vers Inbox, supprimer définitivement
- Composant UserAvatar : fetch avec JWT, fallback initiales colorées, utilisé dans Settings membres
- Onglets Agenda, Search, Notifs ajoutés à la tab bar

## [0.6.0] - 2026-06-09
### Added
- i18n EN/FR/KO (i18next + react-i18next, 3 fichiers de traduction complets)
- Sélecteur de langue dans Settings (drapeaux, persisté via AsyncStorage)
- SecureStore pour tokens JWT (iOS Keychain / Android Keystore, migration auto depuis AsyncStorage)

## [0.5.0] - 2026-06-09
### Added
- Drag & drop cartes : appui long (200ms) + vibration haptique (Medium Impact) pour initier le glissement
- Carte draggée : légère mise à l'échelle (1.03x) + bordure rouge + ombre renforcée
- Réordonnancement persisté : positions flottantes (`between`) patchées sur l'API à la fin du drag

## [0.4.2] - 2026-06-09
### Added
- Organisation/Projets : bouton "Rattacher un projet existant" (picker des projets dont tu es owner, non encore dans l'org)
### Fixed
- Modals : `KeyboardAvoidingView` restructuré (sheet non-absolute) — le sheet ne sort plus de l'écran sur iOS quand le clavier apparaît

## [0.4.1] - 2026-06-09
### Changed
- Projet perso : invitation par email libre (n'importe quel user du système)
- Projet org : invitation = picker membres org uniquement (inchangé)

## [0.4.0] - 2026-06-09
### Added
- Onglet "ORGS" dans la tab bar
- `organisations.tsx` : liste des orgs, créer une org (nom + description)
- `organisation/[id].tsx` : écran détail org (hors tabs) avec deux onglets Membres / Projets
  - Membres : liste avec rôles, ajouter par email (recherche globale), changer rôle, retirer
  - Projets : liste des projets de l'org, créer un projet dans l'org, supprimer un projet
  - Modifier nom/description de l'org, supprimer l'org (owner only)
- `projects.tsx` : bouton "+ Créer", modal de création avec sélecteur org (Personnel ou une org)
- Projets groupés par type (Personnels / Organisations) dans la liste
- `stores/org.ts` : nouveau store pour la liste des orgs
- `stores/project.ts` : ajout `currentProjectOwnerType` et `currentProjectOwnerId` (persist)

### Changed
- Settings invitation projet : si projet org, picker parmi membres de l'org uniquement (plus de saisie email libre)
- `setCurrentProject` transmet maintenant `ownerType` et `ownerId`

## [0.3.0] - 2026-06-09
### Added
- User registration on login screen (toggle login/register, name field)
- Settings screen: project members management (list, invite by email, change role, remove)
- Settings screen: admin panel (list all users, toggle active/inactive, change system role)
- `GET /api/users/search?email=` endpoint for member invite lookup
- `stores/auth.ts`: persists `user: AuthUser | null`, `setUser`, `logout` clears user

### Changed
- CalendarPicker: date picker replaced text input (JJ/MM/AAAA) with pure RN calendar grid
- Labels in card list view moved to bottom-right (footer row, date left / labels right)
- `toggleLabel` now calls `onCardUpdated` to propagate label changes to list immediately
- Label picker: scrollable, "+ Nouveau label" button, inline create form with color palette

---

## [0.2.0] - 2026-06-09
### Added
- Card detail view: full CRUD for labels, members, checklists (+ items), comments, due date, stopwatch
- Label picker (toggle labels from project labels list)
- Member picker (toggle members from project members list)
- Checklist management: add/delete checklists, add/toggle/delete items with progress bar
- Comments: add/delete, author + date display
- Stopwatch: start/stop with live ticker, formatted HH:MM:SS display
- Due date editor (inline modal, JJ/MM/AAAA format)
- Move card to another column
- Delete card (soft-delete to Trash column)
- Card title + description inline editing (tap to edit)
- `CardDetailSheet` extracted as standalone component

### Changed
- Card detail overlay is now fully interactive (was read-only)
- `tasks.tsx` delegates all card interactions to `CardDetailSheet`

---

## [0.1.0] - 2026-06-08
### Added
- Initial app skeleton: Expo SDK 54 + Expo Router + Zustand
- Auth screen (login with server URL + JWT)
- Projects screen (list, select active project)
- Tasks screen: GTD kanban (Inbox/Next/Urgent/Someday/Waiting), scrollable tabs
- Pull-to-refresh on projects and tasks screens
- 401 auto-logout + redirect to login
- Inline card creation (+ button in header)
- Card design: white card, shadow, border-radius, due date badge
- Card detail overlay: expand animation (spring + scale), read-only view
- Rich test data: 98 cards across 4 projects (labels, members, checklists, comments, stopwatch, due dates)
- App logo top-left in tasks header
