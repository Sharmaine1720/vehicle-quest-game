# 🏁 VEHICLE QUEST: RACE, DODGE & LEARN!

A touch-friendly English racing game for Grades 4–6. No frontend build or runtime dependencies. Student details and scores are never displayed on a public leaderboard.

## Run and preview

Use the existing checkout; there is no need for a separate worktree.

```sh
cd /workspace/vehicle-quest-game
npm start
```

Alternatively run `python3 -m http.server 8000 --bind 127.0.0.1` from the checkout. Open the local server in your own browser. Do not open `index.html` as a file: module loading and the question bank require HTTP. The onboarding interface does not provide a localhost preview link.

With empty URLs in `config.js`, the complete 15-question game runs in **practice mode**. Practice mode grades locally, uses the editable `data/questions.json`, and explicitly reports that results are **not sent to Google Sheets**. Those sample answers are public educational content. Class mode never loads the local answer bank: published lesson answers stay on the Apps Script server. Do not put a private current lesson in the public practice JSON or commit private exports.

Register (Grades 4–6, editable class, leading-zero student numbers), select any ride, and race. Hold LEFT / RIGHT, use arrow keys, or A / D. Collisions cost hearts and temporarily slow the vehicle; losing all hearts triggers a short recovery, not a restart. Only question accuracy affects grades. Every active question appears once, with untimed two-choice checkpoints and manual Continue after feedback. Pause and backgrounding stop racing. Three levels must each have at least one active question.

The ten original vehicle PNGs are preserved. The provided repository has **no background or obstacle images**, only placeholder files in those folders. Canvas scenery and six illustrated emoji obstacles provide fallbacks; no nonexistent asset paths are requested. A runtime edge-connected mask removes the pale checkerboard painted into the supplied vehicle images without modifying them. Music is disabled unless optional track URLs are configured. Sound effects use Web Audio only after interaction.

## Publish the student game on GitHub Pages

1. Commit and push the implementation to the intended branch (the prepared checkout branch is `work`). No push is performed automatically.
2. In GitHub **Settings → Pages**, select **GitHub Actions**.
3. Run the **Deploy Pages** workflow from the branch you want to publish. It tests and uploads only the student files (not backend source or tests). The workflow is manual to avoid publishing during development.
4. The project site normally lives at `https://sharmaine1720.github.io/vehicle-quest-game/`. All assets use relative paths.
5. Configure the Google integration below, edit only the public URLs in `config.js`, and redeploy. Leave URLs empty for an explicitly unrecorded practice deployment.

## Google Sheets and Apps Script setup (manual, not deployed here)

Use a teacher-owned Google account. Keep the spreadsheet, script project, and image folder **private**. Do not share them with students or publish sheets to the web. Google Workspace policy must permit anonymous student web apps; if it does not, this architecture needs school-approved hosting or student authentication.

1. Create a Google spreadsheet and a private Google Drive folder for question images.
2. From the spreadsheet, open **Extensions → Apps Script** (or create a standalone project).
3. Add `backend/Code.gs` and `backend/Seed.gs` as script files. Add `backend/Teacher.html` and `backend/Bridge.html` as HTML files named **Teacher** and **Bridge**. Enable viewing the manifest in Project Settings and copy `backend/appsscript.json` into `appsscript.json`.
4. In **Project Settings → Script properties**, add these values. These are backend configuration; never place administrative credentials in `config.js`:

   | Property          | Value                                                                                               |
   | ----------------- | --------------------------------------------------------------------------------------------------- |
   | `SPREADSHEET_ID`  | ID from your private spreadsheet URL                                                                |
   | `IMAGE_FOLDER_ID` | ID from your private question-image Drive folder                                                    |
   | `TEACHER_EMAILS`  | Comma-separated exact authorized Google email addresses                                             |
   | `STUDENT_ORIGINS` | Comma-separated allowed origins, e.g. `https://sharmaine1720.github.io` (no path or trailing slash) |

5. Sign in as an allowlisted teacher. Run **initialize** from the script editor and authorize Google access. This creates **Draft**, **Versions**, **Sessions**, and **Student Scores**, and publishes the exact initial 15 questions. Running it again preserves existing data. The account running it must be in `TEACHER_EMAILS`.
6. Create **two separate web-app deployments of the same project**:
   - **Student deployment**: execute as **you (the teacher owner)**; access **Anyone**, including signed-out users. It exposes only session start, sequential answer checking, and final score recording through the bridge. Never use this deployment URL as the teacher dashboard.
   - **Teacher deployment**: execute as **user accessing the web app**; restrict access to signed-in Google users or your school domain. Its URL ends in `/exec?mode=teacher`. Every teacher action checks `Session.getActiveUser().getEmail()` against `TEACHER_EMAILS` server-side. Blank/unavailable identities are denied, not trusted. Each additional teacher needs access to the private spreadsheet and image folder, and may need to authorize the script. Test the exact accounts in your school domain.
7. Set `studentApiUrl` in `config.js` to the public student `/exec` URL. Set `teacherUrl` to the authenticated teacher `/exec?mode=teacher` URL. These URLs are public addresses, not secrets. Use production `/exec`, not the editor-only `/dev` URL.
8. Redeploy Pages. After changing Apps Script source, update **both** deployments to the new script version.

### Why an iframe bridge?

Apps Script ContentService does not offer conventional customizable cross-origin CORS headers. The student app embeds the allowed Apps Script HTML bridge, then uses `google.script.run` inside Google's sandbox. The handshake uses a fresh random channel; messages validate channel, Google sandbox origin, and the established source window. The bridge only accepts messages from the configured student origin and top window. Session tokens are sent in messages, never URL query strings. Configure the student origin exactly. Third-party frame restrictions, school content filters, or Safari privacy settings may prevent the bridge from loading; errors are visible, and practice mode is not silently substituted. Verify in the actual classroom iPads before teaching.

## Teacher Mode: daily use

Open **Teacher Mode** in the game or bookmark the authenticated teacher URL. Sign in with an allowlisted Google account. No password is embedded in the student frontend.

- **Add question** creates an inactive draft question. Edit text, exactly Choice A and Choice B, correct answer, level, ID, order, and active status. Activate it when ready. Delete, duplicate, or move questions using the card buttons. Positive display orders must be unique within each active level. Move buttons resequence questions; the display-order field is also editable.
- **UPLOAD PICTURE** selects a JPG, PNG, or WebP from iPad or computer, under **200 KB**. The server checks MIME and file signatures, stores the image privately in the configured folder, and returns a reference. Replace or remove using the same card. Images are delivered as data URLs on demand, authorized against the session’s pinned published version; no public Drive permissions are needed. Do not use personal/sensitive images: published question pictures are visible to students. Orphaned uploads may be deleted manually only if no saved draft or retained version references them.
- **Preview** shows the same question text, picture, two choices, and feedback wording as the student checkpoint. It does not alter the draft. Teacher and student components use matched styling; the dashboard preview omits the animated race behind the dialog.
- **Save Draft** persists the complete draft and racing settings in Sheets. Incomplete question text can be saved. This never changes the published bank. A revision check prevents one teacher silently overwriting another; reload before editing after a revision conflict.
- **Publish Questions** publishes the **saved** draft after a confirmation. Unsaved edits must be saved first. Publication validates IDs, choices, correct answers, display order, all three levels, settings, and available images, then appends one complete immutable version. Publication failure leaves the previous version active.
- **View Version History** lists IDs, publication times, counts and teacher identities. **Inspect** displays previous question content; **RESTORE VERSION** republishes it as a new version without deleting history or replacing your saved draft. Start a new game to verify the restored bank.
- **Racing & lesson settings** changes speed, obstacle interval, hearts, minimum feedback duration, and volume. The question totals and questions per level come from active questions and their level assignments; progress and scores automatically adapt. Defaults are 3 levels × 5 questions, 3 hearts, 230 speed, 1.8-second obstacle interval, 1200 ms feedback, and 0.18 volume. There is no question timer.

Do not directly edit the internal **Versions** or **Sessions** sheets. Versions store complete JSON snapshots with ID, timestamp, publisher, question ID/level/order/text/two choices/key/image/active fields and settings. The Draft sheet is a persistent separate snapshot. The newest version is the single active published bank. Sessions pin a version so ongoing games never change when new content is published.

## Scores, privacy and security boundaries

**Student Scores** contains the 15 requested columns: submission ID, timestamp, student name, grade, class, number, vehicle, version, correct, total, final /100, three level scores /100, and completion time (seconds). Student number is stored as text to preserve leading zeros. Final score is `round(correct / total * 100, 2)`. Level scores use the same percentage formula within each level. Completion time on the server includes countdowns, reading and pauses; the results screen separately reports active racing time. These do not affect grades.

Class mode creates an unguessable 73-character bearer session token. Server answers are accepted in order once; retrying the same answer is idempotent. The API returns feedback for only that answered question, never future answer keys or private scores. Complete derives grades from server-stored answers and the pinned version, ignoring supplied score fields. A script lock and submission-ID lookup prevent duplicate score rows, including retry after an interrupted write. The frontend shows recording success only after receiving the server confirmation.

If final recording fails, the completed session token and server URL are kept in localStorage for retry, and **Retry recording result** or **Retry a pending result** attempts the same submission. No student name or registration fields are saved locally. Storage can be unavailable in private browsing: the game warns to keep the tab open. A fresh pending result replaces the previous pending token, so retry it before starting another recorded game on the same device. Tokens expire **24 hours** after session start; resolve pending submissions within that time. Close/reload before completion does not resume an unfinished race. Clear browser storage on shared iPads after retries are resolved. Keep the private Sheets session data under your school's retention policy; do not delete versions referenced by retained sessions.

Spreadsheet text is escaped against formula injection. Teacher methods always authorize on the server. Public requests are bounded; new sessions have a best-effort global limit of 120/minute. No public score-list endpoint exists. Drive file type/size/signature checks reject SVG/HTML and references outside the configured folder.

**Practical static-site limitation:** anonymous student names are self-reported, not identity-verified. Students can automate public calls, use multiple sessions, or inspect client behavior. Session binding, sequential locked answers, server grading, per-minute admission limiting, and private administrative authorization protect records and the answer-key API, but do not make this a high-stakes exam or prevent quota abuse. Google Apps Script has execution, lock, Drive and Sheets quotas; load-test a class before rollout. The origin allowlist protects the browser bridge and is not an authentication boundary for an attacker calling public Apps Script functions directly. For verified identities or stronger abuse controls, add a school identity provider and a dedicated authenticated backend. Do not embed a shared secret or password in public JavaScript as a workaround.

## Tests and verification

```sh
npm test
# Optional real Chromium smoke test; install Playwright in your development tooling first:
node tests/browser.mjs
# Optional dashboard browser checks:
node tests/teacher-browser.mjs
node tests/class-browser.mjs
node tests/bridge-browser.mjs
node tests/picture-browser.mjs
```

Node tests have no dependencies. They run actual core logic and Apps Script functions with in-memory substitutes for Google services; they verify registration, bank validation, scoring, collisions, teacher denial, hidden student keys, answer ordering/locking, draft isolation, pinned versions, restore, duplicate prevention, formula escaping and expiry. This is not proof of live Google integration. Browser tests use Playwright and `/usr/bin/chromium` by default (`CHROMIUM_PATH` and `TEST_URL` can override), with the local server already running. Playwright is optional and not loaded by the game.

**Manual release checklist (pending):** authorize and deploy Google services, confirm non-allowlisted and signed-out teachers are denied, upload/replace/remove all three supported image types, test publish/restore during an ongoing race, verify exactly one score row after network retry, check configured-origin rejection, then test Safari on a physical iPad including pointer holds, rotation, audio activation, image delivery and the bridge under school network/privacy settings. Local Chromium and service mocks do not verify physical Safari behavior or Google account policies.

## Source map

- `index.html`, `style.css`, `js/game.js`: student screens, canvas racing, controls, sound, checkpoints and results.
- `js/core.js`, `js/art.js`, `js/api.js`: validation/scoring/collision, preserved-art rendering, secure bridge client.
- `config.js`, `data/questions.json`: public URLs/music configuration and initial practice bank.
- `backend/`: Apps Script server, authenticated teacher dashboard, bridge, seed and manifest.
- `tests/`: unit/backend and browser checks.
- `.github/workflows/pages.yml`: manual tested Pages deployment.

### Faster picture lessons and upgrading an existing deployment

New student clients request `assetMode: "deferred"`. The server returns only the published question text, choices and image references during startup: **no Drive reads or picture bytes are required to start the race**. The game prefetches the next two question pictures while driving (one request at a time per device), deduplicates shared images in memory, and waits at a picture checkpoint if the image is not ready. Answers stay disabled until the picture decodes; a failed download shows **Retry picture** without grading the student. Pictures never persist to browser storage.

The student `image` action requires a valid session and question ID from its pinned version. It cannot retrieve arbitrary Drive IDs or draft pictures. Student image reads and authorized teacher picture previews run outside the shared score/session lock. Verified raster data is cached on the server for up to 15 minutes in 64 KB chunks, below Apps Script's per-value cache limit. Cache misses and eviction fall back to Drive; a first picture can still take time. Versions are read one row at a time instead of loading the whole history. Publication checks file metadata without downloading every image blob. Older clients still receive inline images, and new clients still accept older servers' inline responses, so deployment order does not expose questions or discard pictures.

**Existing users must update both the website and Apps Script to get the speed improvement.** A website-only update cannot change an older Google deployment's eager picture loading:

1. Merge the performance changes into `main`, then run **Actions → Deploy Pages → Run workflow** on `main`.
2. Open the existing Apps Script project. Replace the entire contents of **Code.gs** with `backend/Code.gs`, and **Bridge.html** with `backend/Bridge.html`, then save. Keep Seed.gs, Teacher.html, appsscript.json, Script properties, Sheets and Drive files unchanged. The bridge must allow the new `image` action.
3. Choose **Deploy → Manage deployments**. Select **Vehicle Quest Student**, click the pencil icon, select **New version**, and click **Deploy**. Updating the existing deployment keeps its `/exec` URL; do not create a replacement URL or rerun initialize. The backend uses the existing private spreadsheet and all previously published questions.
4. Update the existing **Vehicle Quest Teacher** deployment to the saved source as well using **Manage deployments → Edit → New version → Deploy**. Keep its execute-as and Google-sign-in access settings unchanged.
5. Refresh the published game and test a picture lesson. Inspect the student `publicRequest` startup execution and verify race startup no longer includes every picture download. Test one final score row and retry if needed. Actual Google latency and class-size performance still require live verification.

The separate initial bridge handshake deadline remains 25 seconds. RPC safety deadlines remain up to 2 minutes for startup and 90 seconds for answer checking, picture retrieval, or score confirmation, but the normal startup notice no longer asks students to wait two minutes. These are maximum failure bounds, not intentional delays or guaranteed response times. If startup is still slow after updating both deployments, inspect Apps Script Executions for quota errors, sheet size, or other concurrent teacher operations. Repeated retry clicks can create extra sessions, so wait for the current attempt to finish before retrying.
