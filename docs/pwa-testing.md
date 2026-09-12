# PWA and Android testing

## Current verification record

| Check                                      | Result                                      | Evidence / limitation                                                            |
| ------------------------------------------ | ------------------------------------------- | -------------------------------------------------------------------------------- |
| Production PWA build                       | Passed locally                              | Vite generated the manifest, service worker, and Workbox bundle                  |
| Required icon dimensions                   | Passed locally                              | 192×192 and 512×512 regular/maskable PNG files generated from a safe-zone master |
| Desktop/mobile render                      | Passed with installed Microsoft Edge engine | 1440×1024 and 390×844 screenshots in `public/screenshots`                        |
| Unit/component tests                       | Passed locally                              | See latest `npm test` result                                                     |
| Lighthouse PWA audit                       | Not yet run                                 | Requires final deployed HTTPS URL; record scores/failures before launch          |
| Real Android browser/standalone acceptance | Not yet run                                 | Requires owner-provided device/emulator and hosted environment                   |

Lighthouse is useful but is not a substitute for the manual matrix below.

## Android test matrix

Record device, Android version, Chrome version, URL, tester, date, and pass/fail notes for every row.

| Scenario                           | Browser mode | Installed mode | Expected result                                                                  |
| ---------------------------------- | ------------ | -------------- | -------------------------------------------------------------------------------- |
| Fresh installation                 | Test         | Test           | Manifest and icons shown; installation succeeds without clipping                 |
| Reinstallation after uninstall     | Test         | Test           | Fresh icon/app entry; no broken stale scope                                      |
| Online startup                     | Test         | Test           | Session restores or sign-in appears without loop                                 |
| Offline startup after online visit | Test         | Test           | Cached shell/help loads; obvious offline message; mutations do not claim success |
| Slow network                       | Test         | Test           | Loading/saving states remain clear; no duplicate month                           |
| Session restoration                | Test         | Test           | Last route/month restores when safe                                              |
| Session expiration                 | Test         | Test           | User returns to sign-in with an understandable message                           |
| Sign-in/sign-out                   | Test         | Test           | Back does not reopen private content as authenticated                            |
| Email verification redirect        | Test         | Test           | PKCE callback exchanges once and opens app                                       |
| Password reset redirect            | Test         | Test           | Reset page opens and accepts new password                                        |
| Virtual keyboard editing           | Test         | Test           | Focused amount stays visible; page can scroll; correct decimal keyboard offered  |
| Android back button                | Test         | Test           | Navigates history without loops or exiting unexpectedly                          |
| Portrait 390×844 and 360×800       | Test         | Test           | No horizontal desktop table; actions/inputs remain reachable                     |
| Landscape                          | Test         | Test           | Content scrolls; dialogs/keyboard remain usable                                  |
| Display cutout/safe area           | N/A if none  | Test           | Header/bottom nav/toasts avoid system areas                                      |
| GitHub project base path           | Test         | Test           | Assets, direct routes, start URL, scope, and shortcuts retain `/<repo>/`         |
| Update available                   | Test         | Test           | Prompt appears; update waits while editing/saving; explicit update reloads       |
| Clear site data                    | Test         | Test           | App returns to clean signed-out state and can recover                            |
| Copy/select/long press             | Test         | Test           | Ordinary text/amount selection is not unnecessarily blocked                      |

## Install instructions

Android Chrome wording varies:

1. Open BuddyBudget in Chrome.
2. Open the browser menu.
3. Choose **Install app** or **Add to Home screen**.
4. Confirm.
5. Launch from the home screen or app drawer.

On iOS/iPadOS Safari, use Share → **Add to Home Screen**. On supported desktop browsers, use the address-bar install control or app menu.

## Inspect with browser developer tools

1. Application → Manifest: confirm identity, icon purposes, screenshots, shortcuts, start URL, display, theme, and scope.
2. Application → Service Workers: confirm one controlled scope at the configured base and test update/unregister.
3. Application → Cache Storage: confirm only shell, hashed JS/CSS, icons/fonts/screenshots/public content. There must be no Supabase responses, Auth URLs, tokens, exports, or financial JSON.
4. Network: enable Offline and Slow 3G; verify mutation UX and no unexpected retries.
5. Lighthouse: run PWA/accessibility/best-practices against deployed HTTPS, save the report, and document each meaningful failure.

## Update test

1. Install build A and focus/edit an amount.
2. Deploy build B and reopen build A.
3. Confirm the update notification does not enable reload while edit/save is pending.
4. Finish or retry the save, choose Update, and confirm a single reload to build B.
5. Verify all chunks load from one build and the saved amount remains.

## Offline honesty test

Visit once online, go offline, relaunch, edit an amount, and wait. The value may remain focused in the current interface, but status must say it is not saved and provide a retry. Reconnect, choose retry, reload, and verify persistence. No background-sync queue is configured in V1.
