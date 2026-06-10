# Hae App — Stack technique

## Présentation

Frontend unifié de l'application **Hae** (해 — "fais-le").
Application GTD open source, gratuite, développée par [Breizhzion](https://github.com/bzhzion).

Se connecte à n'importe quelle instance `hae-api` via URL configurable.

## Stack

| Composant | Choix | Raison |
|-----------|-------|--------|
| Framework | **React Native + Expo** | Une codebase → iOS + Android + Web |
| Navigation | **Expo Router** | File-based routing, simple |
| UI | **NativeWind** (Tailwind pour RN) | Léger, cohérent Web/Mobile |
| State | **Zustand** | Minimal, pas de boilerplate |
| HTTP | **fetch** natif | Zéro dépendance externe |
| STT | Web Speech API (Web) / Expo AV (Mobile) | Natif selon plateforme |

## Cibles

| Plateforme | Distribution |
|------------|-------------|
| iOS | App Store (compte Apple Developer Breizhzion) |
| Android | Google Play Store |
| Web | PWA — build statique servi indépendamment |

## Connexion au backend

L'utilisateur configure l'URL de son instance `hae-api` dans les settings :

```
https://monserveur.example.com  →  hae-api sur port 8150
```

Pas d'instance imposée. Chacun héberge le sien ou utilise une instance publique.

## Structure des vues

```
/                   ← Inbox (capture rapide)
/next               ← Actions Next
/someday            ← Un jour / Peut-être
/urgent             ← Urgent
/waiting            ← En attente / À suivre
/done               ← Complété
/projects           ← Projets (vue kanban)
/projects/:id       ← Board projet (colonnes libres)
/organisations      ← Liste des organisations, créer une org
/organisation/:id   ← Détail org : membres + projets (créer, supprimer, gérer rôles)
/settings           ← Config serveur, membres projet, gestion utilisateurs (admin)
```

## Fonctionnalités clés

- Saisie texte + dictée vocale (STT) dans l'Inbox
- Parsing IA de la tâche (titre, date, contexte, projet)
- Glisser-déposer entre colonnes (kanban)
- Assignation multi-utilisateurs + invitations par email
- Gestion des rôles projet (owner / editor / viewer) depuis les settings
- Inscription depuis l'écran de login (register mode)
- Date de rendu + compte à rebours
- Mode offline avec sync au retour réseau
