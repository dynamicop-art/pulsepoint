V5.7 PRACTICE IMPORT + ADAPTIVE PRACTICE UPDATE
- Fixed the Student -> Tests -> Personal Practice Test import flow. It is no
  longer limited to one exact ChatGPT text layout.
- Students can now import practice questions by normal paste, clipboard read,
  or TXT / MD / JSON file upload (client-side only; max 512 KB).
- The practice parser accepts common ChatGPT variations such as fenced code,
  numbered questions, A:/A)/A. options, and Answer/Ans/Correct Answer labels.
- Added Preview & Validate with ready/skipped counts before starting practice.
- Added "Auto Practice from My Performance": the app builds a free local
  practice set from the student's own graded review, prioritizing recent wrong
  answers first. No OpenAI API key, backend, or new Firebase collection needed.
- Practice results remain device/session-only and do not affect official exam
  attempts or leaderboards.
- Direct automatic transfer of a ChatGPT response back into this static site is
  intentionally not attempted; clipboard/file import avoids cross-site browser
  restrictions without adding a paid API or exposing a secret key.

STUDENT LEARNING HUB V3 (PREMIUM DESIGN + FULL FEATURE SET) — SETUP

V5.6 PUBLISHED TEST NAME EDIT UPDATE
- Admin -> Tests -> Test Catalog now has an Edit Name button on every test.
- Renaming keeps the same Test ID, questions, answer key, attempts and
  leaderboard rows, so rankings and first-attempt locking remain unchanged.
- Existing submitted and in-progress attempt labels are synchronized in safe
  batches, so Test History, Results, Mistake Notebook and CSV show the new name.
- Empty names and names over 120 characters are blocked.
- A duplicate name is blocked within the same Class + Subject + Unit/Chapter.
  The same name may still be used in a different class, subject or unit.
- If history synchronization is interrupted, the new test name remains saved;
  open Edit Name and press OK with the same name to retry the label sync.
- No Firestore Rules change was required beyond the included v5.5 rules.

V5.5 SAFE TEST DELETE UPDATE
- Admin -> Tests -> Test Catalog now has a Delete Test button on every test.
- A detailed confirmation shows the test, class, subject, unit, attempt count,
  in-progress count and leaderboard-row count before anything is removed.
- Confirmed deletion first hides the test from students, then removes its answer
  key, every submitted/in-progress attempt and every linked leaderboard row.
- If a network/permission error interrupts cleanup, the test stays hidden and
  remains in the Admin catalog so Delete Test can be pressed again safely.
- Attempt grading/leaderboard sync now ignores hidden or deleted tests, avoiding
  orphan leaderboard data during cleanup.
- IMPORTANT: publish the included firestore.rules after uploading this version;
  its v5.5 guard prevents another open Admin session from recreating a score row
  while a test is being deleted.

V4 SAFE MERGE UPDATE
- Secure V3.4 was kept as the base; the supplied experimental files were not
  used as replacements.
- Added client-only Personal Practice Tests, Answer Review, printable Question
  Papers, printable Full Progress Reports, XP/Levels, daily study quotes,
  optional sound, and celebration only for results of 80% or higher.
- Added Admin CSV export, attempt search, class average/top performer stats,
  free test-generation prompt helper, and validated multi-test batch import.
- Strengthened avatar/bookmark/streak/doubt validation in Firestore rules.
- Full attempts remain private. Latest-three leaderboards still use sanitized
  leaderboardEntries documents, so classmates cannot read saved answers.
- effects.js is optional: the core website continues working if effects fail.

DEPLOYMENT: upload every file in this package, including effects.js, and publish
firestore.rules again from Firebase Console.

V4.1 HOME UPDATE
- Latest-three-exam leaderboards are now also visible on the Home tab.
- Added a Home Performance Snapshot: completed tests, average, best score and
  the student's rank in the latest exam.
- Added an automatic Home revision-focus card with weak-topic ChatGPT help.
- Added an animated gradient profile ring, online pulse and optional tap sparkle.
- All effects respect reduced-motion preferences; sound remains off by default.

V4.2 NAVIGATION & PROGRESS UPDATE
- Test History is now a separate navigation tab, so students no longer need to
  scroll through the full Progress page to reach results and answer reviews.
- Progress now has separate Subject and Unit/Chapter filters.
- Subject accuracy and weak-topic calculations update from the selected scope
  without downloading attempts again, reducing unnecessary Firestore reads.

V4.3 VISUAL & GOALS UPDATE
- Added progressive-enhancement glass surfaces, subtle desktop-only 3D card
  tilt, cursor light response, button ripples and 3D popup entrances.
- Effects are disabled on touch/low-motion contexts and never tilt the test runner.
- Added a device-local Weekly Test Goal with current-week completion tracking.
- Added an admin-only Revision Priority summary derived from existing graded
  results; no new Firestore collection or permission is required.

V4.4 NAMEPLATE & GAMES UPDATE
- Added drifting maths/physics symbols and sparkle motion to every opening hero.
- Added a separate student Games tab with a 10-round Math Sprint and a
  10-round F=ma Force Lab challenge.
- Game scores and best scores stay only in localStorage; they never affect
  exams, XP, progress, leaderboards or Firestore usage.

V4.5 MOBILE NAMEPLATE UPDATE
- Rebuilt the hero specifically for phones: centered layout, safe clearance for
  floating controls, compact glass brand badge, stronger typography and avatar.
- Mobile shows only three carefully positioned learning symbols instead of the
  full desktop decoration, reducing clutter and improving performance.
- Added animated mobile gradient depth with reduced-motion fallback and an
  extra compact layout for screens 360px wide or smaller.

V4.6 COMPACT MOBILE HEADER FIX
- Replaced the tall stacked student header with a compact two-column layout:
  avatar/name/details on the left and a small Logout action on the right.
- Removed all floating symbols and sparkle nodes on phones; the animated
  gradient remains as the lightweight visual effect.
- Added strict auto-height containment so decorative nodes cannot stretch the
  nameplate, plus tighter variants for screens below 380px.

V3.4 UPDATE
- Latest 3 Exam Leaderboards: separate top-10 ranking for each of the newest
  three published tests, including tie-aware ranks and the current student.
- Weak-topic ChatGPT Help: topics below 60% now generate and copy a personalized
  Bengali learning prompt, then open ChatGPT. No API key or paid API is used.
- Premium Motion: subtle page/card entrances, medal glow, loading skeletons and
  toast messages, with prefers-reduced-motion support.
- Privacy fix: students can no longer read classmates' complete attempts.
  Leaderboards use the sanitized leaderboardEntries collection instead.

IMPORTANT AFTER UPDATING
Publish the included firestore.rules again. Then open admin.html and log in once;
the admin dashboard will create sanitized leaderboard entries for existing
graded attempts as well as all newly graded attempts.

⚠️ IMPORTANT: RE-PUBLISH firestore.rules AGAIN
This update adds new collections (announcements, assignments, assignmentStatus,
doubts) and changes attempt/user permissions. Go to
Firebase Console -> Firestore Database -> Rules -> paste the new firestore.rules
-> Publish, or NONE of the new features below will work.

WHAT'S NEW IN V2.1
- Full visual redesign: richer violet/gold theme, Poppins + Hind Siliguri fonts,
  glass-style nav, nicer cards, buttons and subject tiles.
- Student profile picture (under 150 KB), stored on the user doc.

WHAT'S NEW IN V3.3
- Fixed: a student who was already logged in did NOT see a test/note/notice/
  assignment the teacher published afterward, until they logged out and back
  in. Notes, Tests, Notices and Assignments now update LIVE on the student's
  screen the moment the teacher publishes — no reload or re-login needed.

WHAT'S NEW IN V3
Student side (student.html):
- 🏠 Home: Notice board, study streak with badges (3/7/14/30-day), a Pomodoro
  study timer (25/5/15 min presets).
- 📝 Notes: search box, chapter filter dropdown, bookmark (star) any note,
  "Bookmarked only" filter, and a Flashcard revision mode (front = title,
  tap to flip to the note content, shuffle/prev/next).
- 🧪 Tests: search box added on top of the existing live-test flow.
- 📌 Assignments (new tab): homework list with due-date tags (Due soon /
  Overdue), tick-box to mark done — saved per student.
- 📊 Progress (new tab): subject-wise accuracy bars, topic-wise weak-area
  bars (built from each test's per-question "TOPIC"), a class leaderboard
  (average % per student, own row highlighted), and a Test History list
  with a "Print / Save as PDF" button per result (uses the browser's print
  dialog — choose "Save as PDF" there, no extra library needed).
- 💬 Doubts (new tab): ask the teacher a subject-tagged question, see your
  own question list with "Waiting" / "Answered" status and the reply.
- 🌙 Dark mode toggle (top-right on every page), remembered per device.

Teacher side (admin.html):
- 📣 Notices tab: publish a notice to a class; shows on students' Home tab.
- 📌 Assignments tab: publish homework with title/description/due date;
  Dashboard shows an assignment count.
- 💬 Doubts tab: see every student's question live, type a reply once —
  it's saved and marked "answered" automatically. Dashboard shows an open-
  doubts count.
- Notes now have an optional Chapter field (used for the student chapter
  filter above).
- Grading now also computes per-topic correctness (topicStats) on each
  attempt, which powers the student's "weak areas" chart — this happens
  automatically, no extra step needed.

DATA MODEL ADDITIONS (for your reference, no action needed)
- announcements/{id}: title, content, classId
- assignments/{id}: title, description, classId, subjectId, dueDate
- assignmentStatus/{assignmentId_uid}: uid, assignmentId, classId, done
- doubts/{id}: uid, studentName, classId, subjectId, question, status,
  answer, answeredAt
- users/{uid} gained: avatarData, bookmarks (array of note IDs),
  streak {count, lastDate} — students may ONLY self-update these 3 fields,
  enforced by firestore.rules.
- attempts/{id} stores private answers, review and topicStats. A student may
  read only their own attempt. Class leaderboards read separate sanitized
  leaderboardEntries documents, which never contain answers or email.


FILES TO UPLOAD TO YOUR GITHUB PAGES REPOSITORY ROOT
- index.html
- admin.html
- student.html
- style.css
- config.js

OTHER FILES (do NOT need to be public for website operation)
- firestore.rules
- TEST_IMPORT_TEMPLATE.txt
- README.txt

FIRST, KEEP A BACKUP OF YOUR WORKING V1.

ONE-TIME SETUP
1) Teacher email is already configured as:
   arpanalaps64@gmail.com

2) Firestore Rules:
   Firebase Console -> Firestore Database -> Rules -> replace all with firestore.rules -> Publish.

3) Firebase Authentication:
   Email/Password must be enabled.
   (Anonymous is no longer needed for this V2, but it can remain enabled.)

4) Upload index.html, admin.html, student.html, style.css and config.js to the ROOT of the same GitHub repository.
   Commit changes.
   GitHub Pages updates automatically.

HOW TO START
Teacher:
- Open /admin.html
- Login
- Students tab: add student name, email, Class ID and display class
  Recommended IDs:
    class5 / Class V
    class12 / Class XII
- Student uses that exact email on the home page -> First-time Student Setup -> creates password.

Subjects:
- Add subject + Class ID.
- After adding, copy the SUBJECT ID shown in the Subjects list.
- Use that ID when publishing notes/tests.

FAST TEST CREATION (RECOMMENDED)
- Ask ChatGPT for a test in your website import format.
- Admin -> Import Test
- Paste the whole block
- Preview Import
- Publish Imported Test

Required format:
TEST: ...
CLASS: class12
SUBJECT_ID: ...
CHAPTER: ...
DURATION: 30

---
Q: ...
A: ...
B: ...
C: ...
D: ...
ANSWER: B
TOPIC: ...

NOTES
- Text notes are easiest and safest.
- Optional PDF/image attachment is limited in this app to 80 KB because it is stored inside a Firestore document.
- For larger files, do not use this method.

DATA MINIMIZATION
- Student profile, subjects, notes and tests remain because the site needs them.
- Submitted test attempts/results can be removed from Admin -> Live Results -> Delete all submitted attempt data.

AI HELP
- No OpenAI API key is stored in the website.
- Student notes have “Explain with ChatGPT”.
- It creates and copies a Bengali learning prompt and opens ChatGPT.
- AI Help is not placed inside the active test screen.

IMPORTANT V2 FREE-TIER DESIGN
- GitHub Pages for hosting
- Firebase Authentication
- Cloud Firestore
- No custom backend
- No Firebase Storage
- No paid OpenAI API integration

LIMITATION
Grading happens when the teacher Admin dashboard is open, because answer keys are teacher-only and this free static architecture has no server-side grading function.

ABOUT MORE FREE STORAGE (Google Drive etc.)
Linking Google Drive for bigger note attachments is possible, but it needs
Google Cloud OAuth setup (Drive API, consent screen, picker) which is a
separate, more involved integration than a simple file swap — happy to build
it as a next step if you want it. For now, small text notes plus attachments
under 80 KB keep everything on Firebase's free tier with zero extra setup.
V4.7 GUARANTEED COMPACT LOGGED-IN MOBILE HEADER
- The logged-in student nameplate now stays compact like the pre-login hero.
- Critical mobile sizing is included in student.html, preventing stale CSS cache from restoring the oversized card.
- Stylesheet URLs now use a v4.7 cache-busting query.

V5.0 STUDY-FIRST UPGRADE
- Compact mobile bottom navigation: Home, Notes, Tests and a More sheet.
- Smart Dashboard: pending assignment, next available test, weakest area and continue-last-section.
- Revision Centre with a daily smart plan and carry-forward behaviour.
- Mistake Notebook generated automatically from graded answer reviews.
- Students can practise a wrong question again, mark it mastered, request an explanation prompt, or send it to the teacher as a doubt.
- Subject and unit analytics now include averages, test counts and previous-result trends.
- Test runner now has a question palette, answered/review states, Mark for Review, next-unanswered jump, full-screen mode, resume support and unload protection.
- Answer saves are debounced to reduce unnecessary Firestore writes.
- One deterministic attempt document per student/test prevents accidental duplicate attempts.
- Test explanations are stored with teacher-only answer keys and become visible only after grading.
- Firestore rules lock attempt identity, timestamps and the in-progress -> submitted transition.

V5.0 DEPLOYMENT NOTE
Upload every file to the GitHub repository root. Because the attempt security model changed, also copy firestore.rules into Firebase Rules and click Publish. Deploy the website files and rules together before students start a new test.

V5.1 CLEAN PREMIUM VISUAL UPDATE
- No study feature, Firebase collection, grading rule or stored data was changed.
- Refined the colour system, typography, spacing, shadows, controls and focus states.
- Home uses a balanced dashboard grid on wide screens and a clean single flow on phones.
- Smart tiles, statistics, notices, leaderboards, revision cards and analytics now have a consistent visual hierarchy.
- The test runner is calmer and more focused, with clearer question cards, options and palette states.
- Mobile bottom navigation and the More sheet support safe-area insets and stronger contrast.
- Dark mode has improved surface separation and the browser theme colour now follows the selected theme.
- Hover-heavy effects are suppressed on phones; reduced-motion support remains enabled.

V5.2 TEACHER WORKFLOW UPDATE
- Notes, manual tests, imported tests, AI test prompts, notices and assignments
  now use Class dropdowns instead of requiring repeated Class ID typing.
- Subject dropdowns are linked to the chosen Class and store the correct
  subject document ID automatically; mismatched Class/Subject saves are blocked.
- Import Destination overrides CLASS and SUBJECT_ID text inside every pasted
  TEST block, so one Class + Subject selection can publish a whole batch safely.
- A duplicate subject name (including differences only in case or extra spaces)
  is blocked inside the same Class. The same subject name is still allowed in a
  different Class.
- On phones, Teacher Admin now has Dashboard, Students, Tests and More as a
  fixed bottom menu. Subjects, Notes, Import, Results, Notices, Assignments and
  Doubts are available in the More sheet.
- Class dropdowns are built from the Student/Class list plus classes already
  used by existing subjects. Add/Update a Student first to introduce a new Class.
- No new paid service, API or Firebase collection was added.

V5.3 ATTEMPT LIFECYCLE FIX
- Students can submit the same published test repeatedly. Every submission is
  preserved as a separate attempt for teacher review and student history.
- Only the earliest remaining submitted attempt for each Student + Test is the
  official attempt used by the leaderboard, class average, top performer and
  teacher revision-priority summary. Retakes never overwrite that row.
- Leaderboard creation now uses an atomic transaction, so two open Admin tabs
  cannot race and replace the first result with a later retake.
- Student test cards show Start, Resume or Retake correctly and are no longer
  disabled merely because a previous attempt was submitted.
- Test start now validates question data, refreshes the student's attempts from
  Firestore, resumes a real in-progress attempt, and reports Rules/start errors
  clearly instead of failing silently.
- Admin Live Results has All/In-progress/Submitted filtering, per-attempt delete,
  and Full Reset Student/Test. Full Reset removes all attempts/results plus the
  leaderboard row; the next submission becomes the new official first attempt.
- If Admin deletes/resets an attempt while it is still open on a Student device,
  that page now exits the stale runner cleanly and allows a fresh start.
- Deleting the official attempt safely promotes the earliest remaining attempt.
- Bulk submitted-data deletion also removes matching leaderboard rows, avoiding
  stale scores.
- Student Test History labels the official first attempt and every retake.

V5.3 CRITICAL DEPLOYMENT ORDER
1) Upload/replace ALL website files from this package in the GitHub repository root.
2) Firebase Console -> Firestore Database -> Rules.
3) Replace the Rules editor with this package's firestore.rules and click Publish.
4) Wait for GitHub Pages to finish, then hard-refresh Admin and Student pages.

The v5.3 website and v5.3 Firestore Rules must be deployed together. If the old
rules remain active, new multi-attempt document IDs will correctly be rejected
and students will see a test-start error.

V5.4 LINKED TEST CATALOG
- Teacher Tests now has linked Class -> Subject -> Unit/Chapter dropdowns,
  title search, live matching/total counts, Reset, and grouped exam cards.
- All Classes displays every published test in clearly labelled Class,
  Subject, and Unit groups instead of one mixed list.
- Student Exam Portal now has linked Subject -> Unit/Chapter dropdowns,
  title search, live counts, Reset, and grouped exam cards.
- Selecting a Subject only exposes Units that actually contain published tests;
  selecting a Unit shows only exams in that exact Unit.
- Unit matching normalizes extra spaces and letter case, so accidental formatting
  differences do not create separate filter categories.
- Manual Test Creator now includes a required Unit / Chapter field. Imported
  tests must also contain CHAPTER, preventing new uncategorized tests.
- Older tests without a chapter remain visible under "Uncategorized" so no
  existing data is hidden or deleted.
- No new paid service, Firestore collection, or index was introduced.

V5.4 DEPLOYMENT
Upload/replace all files from the v5.4 package in the GitHub repository root.
The included firestore.rules retains the secure v5.3 attempt lifecycle rules;
keep those rules published in Firebase. Then hard-refresh Admin and Student pages.

============================================================
ULTIMATE v6 UPDATE — IMPORTANT DEPLOYMENT NOTES
============================================================

This package upgrades the student experience without changing the teacher grading model.

NEW STUDENT FEATURES
- Confidence Mode in live tests: Sure / Maybe / Guess per question.
- Confidence Intelligence: shows how confidence matches real accuracy.
- Exam Replay: answer changes, first-answer timing, total duration and late-mistake insight.
- Mistake DNA: tag wrong answers as Concept gap / Careless / Calculation / Guess / Question reading.
- Knowledge Map: Priority / Building / Strong / Mastered topic states from graded results.
- Smart Practice Feed: one-question-at-a-time adaptive feed prioritising wrong/uncertain questions.
- Daily Mission: personalised 3-task plan derived from weak topics, assignments and tests.
- Personal AI Study Coach: context-aware ChatGPT prompts using current performance data; no paid API required.
- Universal Quick Find: Ctrl/Cmd + K searches notes, tests, assignments and app sections.
- PWA app shell: installable experience where supported, online/offline indicator and same-origin shell caching.
- Chapter Boss: 5-question weak-topic mastery challenge using graded review questions.
- Challenge Link Duel: play first, then share the same practice question set and target score with a friend; no duel backend required.
- Viva Rehearsal: oral-answer prompt, optional browser speech-to-text and explicit ChatGPT evaluation flow.
- Share-to-app target: supported installed browsers can share text into student.html; shared text is loaded into the Practice importer.
- Practice importer from v5.7 remains: textarea, clipboard, TXT/MD/JSON and tolerant ChatGPT formatting.
- Teacher Test Importer is now tolerant too: ChatGPT code fences, numbered questions, A)/A./A: options, Ans:/Correct Answer:, CHAPTER fallback for missing TOPIC, plus TXT/MD file loading.

FILES ADDED
- manifest.webmanifest
- sw.js
- app-icon-192.png
- app-icon-512.png

IMPORTANT: FIRESTORE RULES MUST BE PUBLISHED
Ultimate v6 stores two additional student-owned fields inside attempt documents:
- confidence (map, max 500 entries)
- answerTimeline (list, max 600 events)

Publish the included firestore.rules BEFORE students start v6 tests. The rules continue to prevent students from writing grades, scores, answer keys or leaderboard results.

DEPLOYMENT CHECKLIST
1. Upload/replace ALL files from this folder in the hosting root.
2. Publish the included firestore.rules in Firebase Console / Firebase CLI.
3. Hard refresh once after deployment so style.css?v=6.0 and the new service worker are active.
4. Sign in as one student and run a short test: answer + confidence -> submit -> teacher grades -> student Review / Progress / Replay.
5. Verify Practice importer and Smart Feed with at least one graded test containing review data.
6. PWA install/share features depend on browser/platform support; normal website and clipboard/file import remain the fallback.

DATA / PRIVACY NOTES
- Confidence and answer timeline belong only to the student's attempt; normal attempt privacy rules still apply.
- Mistake DNA labels and Daily Mission completion are stored locally in that browser via localStorage. They are not sent to ChatGPT.
- AI Study Coach only copies a concise performance-context prompt when the student explicitly presses a coach button, then opens ChatGPT.

COMPATIBILITY
- Old attempts without confidence or answerTimeline continue to render normally.
- Old results without replay data simply do not show the Replay button.
- Existing grading, leaderboard, notes, assignments, doubts, bookmarks, streaks and teacher/admin pages remain compatible.
