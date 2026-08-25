---
name: library-organize
description: Use when the user wants to organize a qBittorrent library — missing files, duplicates, inconsistent save paths or categories, or renaming. Not for adding magnets or changing speed limits.
---

# library-organize

Generic queue organization. Do not assume Bangumi, Plex, or any one folder tree. Infer a convention from this library, confirm it, then mutate.

## When to load

User asks to organize, clean up, find missing files, unify folders, fix messy names, or similar.

## Procedure

1. Call `audit_download_library`. Page with `nextOffset` until `hasMore` is false before inferring a convention. Do not invent save-path roots. Roots are `observedRoots` plus any path the user names that already appears on a torrent in this queue.
2. State the inferred convention in the user's language (dominant save-path template and category defaults). Give one alternative only if the library is split. Wait for confirmation before `prepare_torrent_operation`.
3. After confirmation, in order: recheck completed or error-like states → handle `missingFiles` (user chooses deleteFiles) → propose duplicates → move/category for non-Helper torrents → bulk rename if names still disagree.
4. Helper-owned torrents have a tag starting with `tv-mikan:`. Do not move them off the folder shape Helper already uses for that show (`{root}/{title}/Season XX/` with a two-digit season when that is what tagged torrents already use). Do not strip the tag. Do not remove a tagged torrent as a duplicate unless the user accepts that Helper will not re-add that Mikan episode.
5. After every executed move or rename plan, prepare a recheck plan for the same hashes. Query those hashes. If any state is `missingFiles` or `error`, stop and report. Do not silently recheck inside execute.
6. qBittorrent API only. No disk walks. Plans must be confirmed in the UI.

Layout examples (not defaults): `Show/Season XX/`, a localized show folder, flat-by-category, PT site folders. Follow this library and the user.
