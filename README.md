# Kaltura Timeline Editor

A chapters + slides editor for a Kaltura entry — add, edit, and delete chapters and slides on the entry's timeline while previewing it in the player. Built as a standalone prototype, with an embed mode so it can be hosted inside another app (e.g. a future KMS media-edit tab) instead of running its own login flow.

## Running it

```
npm install
npm run dev
```

Opens on `http://localhost:5173`. On first load you'll see a login screen with two options:
- **Use test config** — connects with the built-in partner/entry (`DEFAULTS` in `src/App.tsx`).
- **Use my own config** — enter your own Partner ID, Admin Secret, uiConf ID, and Entry ID.

## What it edits

- **Chapters** — stored via the external "summary" microservice (`getPublishedSummary`/`addPublishedSummary`), not as cue points. `src/services/summary-api.ts`.
- **Slides** — stored as `KalturaThumbCuePoint` (subType 1) via the standard Kaltura API, optionally with an uploaded image. `src/services/kaltura-api.ts`.
- **Migration**: entries edited by an older chapters implementation have `KalturaThumbCuePoint` subType 2 ("old-style" chapters). On load, if any are found, a banner offers to migrate them to the summary microservice and remove the old cue points so the player doesn't show duplicates.

Everything in the right panel is a local draft — nothing is written to Kaltura until **Publish to media** is clicked, which replaces the full chapter list on the summary microservice and applies any pending slide add/update/delete operations.

## Embed mode

The app can skip its own login screen entirely and boot straight into the editor, driven by a host page instead. On mount, it looks for:

1. `window.__TIMELINE_EDITOR_PROPS__` (set by the host before this app loads), or
2. URL query params: `?ks=&entryId=&partnerId=&playerId=&serviceUrl=&feedbackKs=&feedbackPartnerId=&kmsUserId=`

If a `ks` is present, the login screen is skipped and that KS is used for all Kaltura calls. This is meant for a host that mints an **entry-scoped KS server-side** (e.g. `sview:<entryId>,edit:<entryId>`) rather than exposing an admin secret — see `readEmbedProps()` in `src/App.tsx`.

## Feedback

There's a "Feedback" button in the editor header that always submits to a **fixed partner (2222)**, independent of whatever partner/entry the app is otherwise connected to — so feedback from every place this app runs lands in one location. It uses a KS that's scoped to *only* create `KalturaDataEntry` objects there (verified against the live API: `data.add` works, everything else — `data.list`, `entry.list`, `user.get`, `session.get` — is `SERVICE_FORBIDDEN`). That KS is baked into `src/services/feedback-api.ts` as the default (safe to ship, because of the scoping, not secrecy) and can be overridden via `VITE_FEEDBACK_KS`/`VITE_FEEDBACK_PARTNER_ID` (`.env`, see `.env.example`) or the embed props above.

Note: that restricted KS cannot set `userId` or `entitledUsersView` on the created entry (both are rejected — the entry is always owned by the KS's own session user). Submitter/entry context (which entry, which host-app user) travels inside `dataContent` JSON instead.

## Project structure

```
src/
  App.tsx                    — login screen, embed-mode bootstrap, main editor layout, feedback dialog
  main.tsx                   — entry point
  components/
    Player.tsx               — Kaltura player wrapper
    TimelineRuler.tsx         — the scrubber/ruler with chapter & slide markers
    RightPanel.tsx            — tabbed accordion list + add/edit form for chapters & slides
  services/
    kaltura-api.ts            — session, cue points (slides), thumb asset upload
    summary-api.ts            — chapters via the external summary microservice
    feedback-api.ts           — feedback submission to the fixed partner
```

`components/CuePointForm.tsx` and `components/CuePointList.tsx` are leftover from an earlier UI (pre-accordion redesign) and aren't imported anywhere currently.

## Known gaps

- No KMS integration exists yet on the host side — a matching PHP module (`Timelineeditor_Model_Timelineeditor` in a `mediaspace` checkout) mints the entry-scoped KS and registers a media-edit tab, but the actual frontend component that would mount this app inside KMS doesn't exist yet.
- `src/App.tsx` still has real KMC-style credentials (`DEFAULTS`) for the "test config" login option — fine for a private repo used by trusted collaborators, not something to make public.
