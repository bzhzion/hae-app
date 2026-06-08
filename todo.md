# Todo

## Core features (v0.3)
- [ ] Comment editing (PATCH /api/comments/:id)
- [ ] Checklist item text editing (PATCH /api/items/:id with text field)
- [ ] Create project label from within card detail (POST /api/projects/:projectId/labels)
- [ ] Card duplicate (POST /api/cards/:id/duplicate)
- [ ] Subscribe / unsubscribe card (POST/DELETE /api/cards/:id/subscribe)
- [ ] Done/Trash columns in Tasks screen (toggle view)

## AI features (v0.4)
- [ ] AI settings screen: provider, base URL, API key, model (stored in project via PATCH /api/projects/:id)
- [ ] AI text actions: elaborate, improve, summarize, generate checklist from description
- [ ] STT settings: Whisper endpoint + API key

## Project management (v0.3)
- [ ] Create project (POST /api/projects)
- [ ] Edit project (name, description, color)
- [ ] Delete project (non-personal only)
- [ ] Manage project members (invite, remove, change role)

## Profile & settings (v0.3)
- [ ] Profile screen (GET/PATCH /api/users/me): name, email
- [ ] Change password (PATCH /api/users/me/password)
- [ ] App settings screen: theme (dark/light), language

## Polish
- [ ] Card list loading skeleton instead of global spinner
- [ ] Swipe-to-delete on card in list (or long press)
- [ ] Haptic feedback on checklist item toggle
- [ ] Empty state illustrations
- [ ] Card color/cover support
- [ ] Offline indicator

## Technique
- [ ] Dev build (EAS) for Reanimated + smoother animations
- [ ] Push notifications (GET /api/notifications)
- [ ] Biometric auth
- [ ] Android build
