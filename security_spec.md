# Caption Lite Firestore Security Specification

## 1. Data Invariants
1. **User PII Isolation**: `/users/{userId}` stores verified creator profile metadata (`uid`, `email`, `displayName`, `photoURL`) and is strictly readable and writable only by the matching authenticated and email-verified user (`request.auth.uid == userId`).
2. **Project Ownership**: Every document in `/projects/{projectId}` has an immutable `ownerId` matching `request.auth.uid` on creation. Cross-user reads, lists, updates, and deletes are denied.
3. **Master Gate on Subcollections**: Every caption cue in `/projects/{projectId}/captions/{captionId}` must reference an existing parent project owned by `request.auth.uid` and carry immutable `projectId` and `ownerId`. Every preset in `/users/{userId}/presets/{presetId}` must belong to an existing user profile owned by `request.auth.uid`.
4. **Strict Schema & Bounds**: All IDs match `^[a-zA-Z0-9_\-]+$` with length `1..128`. Strings enforce strict max lengths (`title <= 120`, `text <= 500`, `name <= 64`, `accentColor` matches `^#[0-9a-fA-F]{6}$`). Enums are allowlisted (`aspectRatio`, `style`, `fontFamily`, `position`).
5. **Temporal Integrity**: `createdAt` and `updatedAt` must equal `request.time` on creation, `createdAt` is immutable on update, and `updatedAt` must equal `request.time` on update.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Unauthenticated Write**: Create `/projects/proj-1` with `request.auth == null` -> `PERMISSION_DENIED`.
2. **Unverified Email Write**: Create `/projects/proj-1` with `request.auth.token.email_verified == false` -> `PERMISSION_DENIED`.
3. **Identity Spoofing on Create**: User A creates `/projects/proj-1` with `ownerId: "user-B"` -> `PERMISSION_DENIED`.
4. **Shadow Field Injection**: User A creates `/projects/proj-1` with extra key `isAdmin: true` -> `PERMISSION_DENIED`.
5. **ID Poisoning**: User A creates `/projects/../../evil` or 200-char ID -> `PERMISSION_DENIED`.
6. **Timestamp Forgery**: User A creates `/projects/proj-1` with client-supplied `createdAt` instead of `request.time` -> `PERMISSION_DENIED`.
7. **Immutable Owner Tampering**: User A updates `/projects/proj-1` attempting to change `ownerId` -> `PERMISSION_DENIED`.
8. **Immutable CreatedAt Tampering**: User A updates `/projects/proj-1` attempting to modify `createdAt` -> `PERMISSION_DENIED`.
9. **Value / Type Poisoning**: User A updates `/projects/proj-1` setting `style: "hacked"` or `title: 999` or 2000-char `title` -> `PERMISSION_DENIED`.
10. **PII Cross-User Read**: User B attempts `get` on `/users/user-A` -> `PERMISSION_DENIED`.
11. **Query Scraping (`list`)**: User A issues unfiltered `list` on `/projects` without `where('ownerId', '==', uid)` -> `PERMISSION_DENIED`.
12. **Orphaned Caption Write**: User A creates `/projects/nonexistent/captions/cap-1` or attaches a caption to User B's project -> `PERMISSION_DENIED`.
