# Changelog

## [1.3.45] - 2026-06-14

### Fixed
- Web compat : FileSystem/Sharing remplacés par fetch+blob+`<a download>` pour téléchargement pièces jointes
- Web compat : audio/vidéo attachments utilisent blob URL sur web, FileSystem en cache sur natif
- Web compat : expo-haptics wrappé avec `Platform.OS !== 'web'` (4 appels dans notifications)
- Web compat : `Dimensions.get('window')` remplacé par `useWindowDimensions()` dans tasks.tsx (réactif au resize)

## [1.3.44] - 2026-06-14

### Fixed
- Onboarding web : navigation suivant/précédent cassée (FlatList.scrollToIndex ne fonctionne pas sur web) — remplacé par rendu direct du slide courant via ScrollView

## [1.3.43] - 2026-06-14

### Fixed
- STT Azure OpenAI : URL native `/openai/deployments/{model}/audio/transcriptions?api-version=2024-06-01` au lieu de `/openai/v1/audio/transcriptions` (DeploymentNotFound résolu)
- STT Azure : header `api-key` au lieu de `Authorization: Bearer`
- STT Azure : `model` retiré du body FormData (inutile avec URL deployment-specific)

## [1.3.42] - 2026-06-14

### Fixed
- STT web : FormData utilisait `{ uri, type, name }` (syntax React Native), invalide sur web — remplacé par `fetch(uri)` → Blob pour les plateformes web
- STT : ajout try/catch dans `start()` pour éviter les exceptions non catchées
- STT : `setAudioModeAsync` skippé sur web (`playsInSilentMode` est iOS-only)

## [1.3.41] - 2026-06-14

### Fixed
- Metro (Node 25) : stub CJS pour `expo-modules-core` via condition `node` dans exports — Metro non affecté (utilise `default` → TypeScript)
- Retrait de `expo-sharing` des plugins `app.json` (pas d'`app.plugin.js`, Expo recommande de l'enlever)
- `postinstall` : ajout de `fix-expo-modules-core.js` pour appliquer le patch après `npm install`

## [1.3.40] - 2026-06-13

### Added
- `Dockerfile.web` : build multi-stage (Node 20 → nginx alpine), `npx expo export --platform web`
- `nginx.web.conf` : SPA routing (`try_files → index.html`), gzip, cache immutable pour assets
- `.github/workflows/deploy-web.yml` : build + push image `ghcr.io/bzhzion/hae-web:latest` sur chaque push main

## [1.3.39] - 2026-06-13

### Added
- Messages motivants par colonne GTD vide : Inbox (📭 + encouragement) et Urgent (🎉 + redirection vers Suivant), avec emoji, titre et sous-titre centrés
- Clés i18n `tasks.emptyInboxTitle/Sub` et `tasks.emptyUrgentTitle/Sub` en FR/EN/KO

## [1.3.38] - 2026-06-13

### Fixed
- Audit complet des `catch {}` silencieux : ~30 endroits corrigés dans 14 fichiers
- Nouvelles clés i18n `common.loadError/saveError/networkError/sessionExpired/accessDenied/serverError` + `cards.fileTypeError/downloadError/audioError/videoError`
- `Alert.alert('Erreur', ...)` hardcodés remplacés par `showToast(t(...))`
- `lib/api.ts` : strings FR hardcodées remplacées par `i18n.t()`
- Fichiers couverts : CardDetailSheet, AiConfigSection, tasks, notifications, projects, organisations, calendar, search, archives, admin, project-settings, organisation/[id], stores/prefs, lib/api

## [1.3.37] - 2026-06-13

### Fixed
- Création de carte : erreur réseau silencieuse (`catch {}`) → re-ouvre le modal avec le titre pré-rempli + toast `tasks.createError`

## [1.3.36] - 2026-06-13

### Fixed
- Modal création carte : accessibilityLabels traduits (`tasks.dictate`, `common.cancel`, `common.create`)
- Ajout clé `tasks.dictate` en FR/EN/KO

## [1.3.35] - 2026-06-13

### Changed
- Création de carte : formulaire inline remplacé par un bottom sheet modal (slide)
  - Sélecteur de colonne GTD en pills horizontales
  - TextInput multiline auto-extensible, grisé pendant l'enregistrement mic
  - Footer : mic (gauche) + annuler + valider (droite)
  - Flow notification `pendingNewCardTitle` compatible : ouvre le modal pré-rempli sur la 1ère colonne

## [1.3.34] - 2026-06-13

### Fixed
- Mic button : `onPressIn` met `micActiveRef=true` avant que le TextInput perde le focus — le form ne se ferme plus au clic mic
- Auto-grow input : suppression de `onContentSizeChange`/height calculée, utilisation de `minHeight` + `scrollEnabled={false}` — croissance naturelle iOS

## [1.3.33] - 2026-06-13

### Changed
- Champ création rapide de carte : multiline auto-extensible (jusqu'à ~6 lignes), bordure complète, bouton check pour valider, mic + check + x en colonne à droite

## [1.3.32] - 2026-06-13

### Fixed
- Bouton mic dans création de carte : clic ne ferme plus le champ de saisie (onBlur ignoré quand mic actif via `micActiveRef`)
- Suppression des logs debug `[AI]` dans CardDetailSheet.tsx

## [1.3.31] - 2026-06-13

### Added
- Gestion des labels dans les réglages du projet : liste en pills cliquables, modal édition/ajout (nom + palette couleurs + preview), suppression avec confirmation
- Bouton "+ Ajouter" labels dans project-settings.tsx
- Nouvelles clés i18n : `projectSettings.labels`, `projectSettings.editLabel`, `projectSettings.newLabel`, `projectSettings.color`

## [1.3.30] - 2026-06-13

### Fixed
- Fusion section `card` (singulier) dans `cards` (pluriel) dans fr.ts/en.ts/ko.ts — conflit de clés qui causait `cards.moveToColumn` affiché en brut
- Noms de colonnes GTD : `i18n.exists()` remplacé par `t(..., { defaultValue: '' })` plus fiable

## [1.3.29] - 2026-06-13

### Fixed
- i18n CardDetailSheet complet : Déplacer, Archiver, Enregistrer, Annuler, Créer, Echéance, Membres du projet, Aucun label, Télécharger
- Nouvelles clés ajoutées : `cards.move`, `cards.archive`, `cards.noLabels`, `cards.projectMembers`, `cards.dueDate`, `common.create`, `common.download`
- XSS Linking : validation protocole http/https dans tasks.tsx (cta_url annonces)
- XSS Markdown : sanitizeMd() appliquée avant rendu `<Marked>` dans CardDetailSheet
- maxLength={254} sur TextInput email dans project-settings.tsx

## [1.3.28] - 2026-06-13

### Fixed
- i18n complet : toutes les strings hardcodées remplacées par `t()` (login, notifications, settings, organisations, biométrie, cards)
- Nouvelles clés ajoutées dans fr.ts, en.ts, ko.ts : sections `common`, `login`, `biometric`, `cards`, `orgs`, `settings`, `notifications`
- Clé `projectSettings.role` ajoutée dans les 3 langues
- Sanitization : `maxLength` sur tous les `TextInput` (title 200, description 10000, comment 10000, label 50, password 128, name 100, url 500)
- `trim()` sur email et serverUrl avant envoi dans login.tsx

## [1.3.27] - 2026-06-13

### Fixed
- Sheet "Déplacer vers" localisé : titre via `cards.moveToColumn`, noms colonnes via `columns.<type>` (FR/EN/KO)

## [1.3.26] - 2026-06-13

### Fixed
- Annonces triées chronologiquement (plus ancienne en premier, plus récente en dernier) pour navigation "Suivant" cohérente

## [1.3.25] - 2026-06-13

### Fixed
- Annonces affichées sur l'écran des tâches (modal overlay) au lieu du splash screen — s'affiche bien après connexion

### Changed
- `stores/announcements` : ajout de `pending` + `setPending` + `clearPending` pour persister les annonces entre la navigation
- `app/index.tsx` : simplifié, ne gère plus la phase 'announcing'

## [1.3.24] - 2026-06-13

### Fixed
- Bouton "Revoir l'onboarding" navigue immédiatement au lieu d'afficher un alert + redémarrage manuel

### Added
- Annonce "IA intégrée — dictée vocale améliorée" dans `public/announcements.json`

## [1.3.23] - 2026-06-13

### Added
- Hook `useAiConfig` : résout la config IA au montage et expose `aiReady` + `sttReady`
- Boutons IA grisés si IA non configurée : mic dictée (tasks), baguette description, baguette checklist, mic commentaire (CardDetailSheet)

## [1.3.22] - 2026-06-13

### Changed
- Parse dictée vocale migré client-side : plus d'appel `/api/ai/parse`, appel LLM direct
- Récupère les labels du projet via `GET /api/projects/:id/labels` puis les passe au LLM

## [1.3.21] - 2026-06-13

### Changed
- Dictée vocale : après transcription, appel au route `/ai/parse` pour extraire titre, description, date, colonne GTD et labels depuis le texte
- Carte créée directement dans la bonne colonne GTD avec tous les champs remplis (labels compris) — toast de confirmation affiché
- Fallback : si parse ou IA indisponible, le texte est mis dans le champ titre comme avant

## [1.3.20] - 2026-06-13

### Added
- Config IA : preset **Gemini** (endpoint OpenAI-compatible Google, modèle `gemini-2.0-flash`, clé via Google AI Studio)

## [1.3.19] - 2026-06-13

### Added
- Config IA : preset **Azure AI** (GitHub Models / Azure AI Foundry, endpoint OpenAI-compatible, clé = GitHub PAT)
- Config IA : preset **···** (Personnalisé) pour entrer n'importe quelle URL manuellement
- Config IA : bandeau bleu informatif pour Azure (explication GitHub token) et Personnalisé

## [1.3.18] - 2026-06-13

### Changed
- Config IA : ajout preset **Claude** (via OpenRouter, modèle `anthropic/claude-haiku-4-5`) avec badge "★ Recommandé"
- Config IA : OpenAI passe de `gpt-4o` à `gpt-4.1-mini` (plus léger, suffisant pour la gestion de tâches)
- Config IA : Mistral passe de `mistral-large-latest` à `mistral-small-latest`
- Config IA : preset actif tracké par ID (Claude et OpenRouter ont la même URL mais des modèles distincts)

## [1.3.17] - 2026-06-13

### Changed
- Config IA : terminologie simplifiée ("Adresse du serveur IA", "Modèle IA", "Transcription vocale") en FR/EN/KO
- Config IA : bandeau contextuel après sélection d'un preset — lien direct vers la page de clé API (OpenAI, Mistral, Groq, OpenRouter)
- Config IA : Ollama affiche un bandeau vert "tourne en local, aucune clé requise"
- Config IA : section transcription vocale avec description explicative

## [1.3.16] - 2026-06-13

### Changed
- Config IA (profil, org, projet) : visuel cascade priorité affiché à l'ouverture de chaque section
- Config IA : badge ①②③ à côté du titre indique le rang de priorité
- Config IA : subtitles mis à jour avec mention explicite de la priorité (1/2/3) en FR/EN/KO
- Config IA : note "La première config trouvée est utilisée" dans le bandeau cascade

## [1.3.15] - 2026-06-13

### Fixed
- Token API ingest : confirmation Alert avant régénération ("L'ancien token sera révoqué")
- Token API ingest : URL complète affichée dans la description (`POST {serverUrl}/api/ingest`)

## [1.3.14] - 2026-06-13

### Changed
- **Onboarding refondu** : 7 slides pédagogiques (Hae/해, GTD concept, GTD 5 étapes, 6 colonnes, Cartes, Équipe, IA)
- Onboarding : slide GTD explique pourquoi la méthode fonctionne (David Allen, charge mentale)
- Onboarding : slide "5 étapes" avec rendering custom (liste numérotée : Capturer, Clarifier, Organiser, Réviser, Agir)
- Onboarding : slide "6 colonnes" avec rendering custom (chaque colonne avec couleur + description de son rôle GTD)
- Onboarding : navigation retour (flèche gauche) pour revenir à la slide précédente
- Onboarding : tout le texte en 3 langues (FR/EN/KO) via le système i18n existant

## [1.3.13] - 2026-06-13

### Added
- **Loading screen au démarrage** : après auth, preload en parallèle (profil, notifs, prefs, langue, annonces) avant d'afficher l'app
- **Système d'annonces** : lecture d'un fichier JSON public (`public/announcements.json`) au démarrage — les annonces non vues sont affichées en modal avant l'accès à l'app
- **Onboarding** : carousel 4 slides au premier lancement (méthode GTD, kanban, équipe, IA). Bouton "Revoir l'onboarding" dans Paramètres > Zone dangereuse.
- Réinitialisation complète (reset app) remet aussi l'onboarding à zéro

## [1.3.12] - 2026-06-13

### Added
- **Silent re-login au démarrage** : si le refreshToken est valide (30 jours), l'app se reconnecte automatiquement sans écran de login

## [1.3.11] - 2026-06-13

### Security
- **C1** : "Se souvenir de moi" ne stocke plus le mot de passe (email + serverUrl uniquement)
- **C3** : token JWT transféré à la Share Extension via Keychain (access group) au lieu de UserDefaults non chiffré
- **H1** : verrou biométrique actif dès le cold start si activé ; plus de déverrouillage automatique sur appareils sans biométrie
- **H2** : URL serveur validée (`https://` obligatoire, sauf localhost) à la connexion
- **H4** : `Linking.openURL` valide le schéma (`https://` / `http://` uniquement) avant ouverture
- **M2** : upload sans MIME type connu échoue proprement (au lieu du fallback `application/octet-stream` rejeté par l'API) ; nom de fichier au téléchargement sanitizé contre le path traversal
- **M4** : messages d'erreur API remplacés par extraction du champ `error` JSON uniquement (plus de body brut)

## [1.3.10] - 2026-06-13

### Added
- **Système d'invitations in-app** : bouton "Inviter" dans l'écran organisation (via email), appelle `POST /api/organisations/:id/invitations`
- Organisations : section "EN ATTENTE" affiche les invitations non répondues (visible owners/admins)
- Notifications : type `org_invitation` affiché avec boutons "Accepter" / "Refuser" inline (pas de swipe)
- Notifications : accepter une invitation navigue directement vers l'org
- Organisations : role picker multi-owner (rôle `owner` désormais sélectionnable)

### Changed
- Organisations : bouton "Ajouter" renommé "Inviter" (flux invitation, plus ajout direct)
- Organisations : clic sur un badge `owner` ouvre le role picker (était bloqué)

### Fixed
- Tasks : bouton annuler (croix dans rond) sur la saisie rapide de carte, dans ScrollView et FlatList
- Notifications : long press (400ms) + haptic Heavy = pré-remplir le titre et naviguer vers tasks

### Security
- Settings : token ingest visible une seule fois après génération (modal bloquant avec bouton "J'ai copié")
- Settings : section token accessible à tous les utilisateurs (pas seulement admin)
- Auth store : suppression du fallback silencieux `SecureStore → AsyncStorage` (erreur levée en production)

## [1.3.9] - 2026-06-13

### Added
- Notifications : swipe droite = créer une carte (titre pré-rempli, navigue vers tasks)
- Notifications : swipe gauche = archive (migration PanResponder, feel élastique identique à kpopify)
- Tasks : ouverture automatique de la saisie si `pendingNewCardTitle` est défini à l'arrivée

## [1.3.8] - 2026-06-13

### Added
- Notifications : animation "désintégration" au swipe archive (fade opacity + slide + collapse hauteur)
- Notifications : swipe élastique résistant en fin de course (`friction=1.8`, `overshootFriction=7`)

## [1.3.7] - 2026-06-13

### Added
- **Ingest API** : section "TOKEN API NOTIFICATIONS" dans Settings pour générer/régénérer le token
- Copie du token en un tap (feedback visuel "check" 2 secondes)
- Notifications : affichage `inbox_message` avec titre, corps, bouton "Ouvrir" si URL présente
- Notifications : swipe gauche auto-archive au relâchement (plus besoin de taper le bouton rouge)
- Notifications : retour haptique `NotificationFeedbackType.Success` à l'archivage par swipe
- Notifications : badge rouge avec compteur non lus sur l'onglet notifications
- Notifications : refresh du badge à chaque lecture/archivage
- Notifications : auto-refresh silencieux du JWT expiré (retry transparent sans forcer re-login)
- Notifications : suppression du compteur archives sur le bouton "Archives"

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
