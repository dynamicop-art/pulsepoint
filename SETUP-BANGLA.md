# PulsePoint — GitHub + backend full setup

এই package তোমার দেওয়া frontend ও Node/Express backend একসঙ্গে যুক্ত করেছে। তোমার বর্তমান website URL থাকবে:
https://dynamicop-art.github.io/pulsepoint/

**এই code এখনও তোমার GitHub বা Render account-এ deploy করা হয়নি।** Backend URL পাওয়ার পরে `config.js`-এ বসাতে হবে। GitHub Pages শুধু frontend চালায়; backend চলে Render-এ।

## 1. ZIP extract করো

ZIP-এর `pulsepoint` folder খুললে `index.html`, `style.css`, `script.js`, `config.js`, `assets`, `backend`, `.github` পাবে। Upload করবে এই folder-এর **ভিতরের contents**—ZIP অথবা পুরো outer folder নয়। `index.html` repository root-এ থাকতে হবে।

Backend-এর `node_modules` ইচ্ছা করে দেওয়া হয়নি। Render `npm ci` দিয়ে dependencies install করবে। পুরোনো `paste-only.html` এই connected version নয়; সেটি ব্যবহার কোরো না।

## 2. GitHub-এ code update

1. খুলে নাও https://github.com/dynamicop-art/pulsepoint
2. আগে পুরোনো version download করে backup রাখতে পারো।
3. **Add file → Upload files** দিয়ে extracted contents upload করো; existing root files replace করে commit করো।
4. Existing backend থাকলে এই package-এর `backend` ব্যবহার করবে। আলাদা `pulsepoint-backend` folder লাগবে না।
5. `.github` hidden হলে GitHub-এ **Add file → Create new file**। Filename দাও `.github/workflows/pages.yml`, package-এর একই file-এর contents paste করে commit করো।
6. একইভাবে `.gitignore` file-ও রাখো। `.env`, `node_modules`, `backend/storage/database.json` upload করবে না।
7. **Settings → Pages → Build and deployment → Source → GitHub Actions** বেছে নাও।
8. **Actions → Deploy frontend to GitHub Pages → Run workflow**। Branch `main`। Workflow শেষে green tick দেখো। Repository-র default branch অন্য হলে workflow-এর `branches: [main]` বদলাও।

এই workflow শুধু frontend files publish করে। Backend source বা private runtime data Pages artifact-এ যায় না। আগের Pages deploy workflow থাকলে duplicate workflow বন্ধ/সরিয়ে শুধু এইটি রাখো।

### Git দিয়ে করতে চাইলে (optional)

```bash
git clone https://github.com/dynamicop-art/pulsepoint.git
cd pulsepoint
```

তারপর extracted files clone করা folder-এ copy/replace করো।

```bash
git add .
git status
git commit -m "Connect frontend and backend"
git push origin main
```

`git status`-এ `.env`, `node_modules` বা database দেখালে commit করার আগে সেগুলো staging থেকে সরাও। Previously committed secret থাকলে শুধু `.gitignore` যথেষ্ট নয়—secret rotate করতে হবে।

## 3. Render-এ backend তৈরি

https://dashboard.render.com খুলে GitHub দিয়ে sign in করো।

**New → Web Service → Connect GitHub repository → dynamicop-art/pulsepoint**।

| Setting | Value |
|---|---|
| Name | `pulsepoint-api` বা available অন্য name |
| Branch | `main` |
| Language / Runtime | Node |
| Root Directory | `backend` |
| Build Command | `npm ci --omit=dev` |
| Start Command | `npm start` |
| Health Check Path | `/api/health` |

### Storage: একটি option বেছে নাও

**A. প্রথমে free demo পরীক্ষা:** Free instance ব্যবহার করতে পারো। `STORAGE_MODE=ephemeral-demo` দেবে। এই mode-এ account, photo, request এবং inventory Render restart/redeploy/sleep হলে হারাতে পারে। শুধু test data ব্যবহার করো।

**B. Data রাখতে চাইলে:** paid Web Service এবং persistent disk লাগবে। Disk mount path `/var/data` রাখো। নিচের env-তে `DATA_DIR=/var/data/pulsepoint`, `STORAGE_MODE=persistent-disk` দাও। Disk লাগানোর আগের temporary data নিজে থেকে migrate হবে না। একটি service instance ব্যবহার করবে; এই JSON storage multi-instance database নয়।

Current plan/price Render-এর dashboard-এ দেখে নাও। এই package বাইরের MongoDB/Postgres account ছাড়াই disk-এ data রাখে।

### Environment variables

Render service-এর **Environment → Add Environment Variable**:

| Key | Value |
|---|---|
| `NODE_ENV` | `production` |
| `JWT_SECRET` | অন্তত 32 random characters; নিচের command দিয়ে generate করো |
| `FRONTEND_ORIGIN` | `https://dynamicop-art.github.io` |
| `STAFF_EMAIL` | তোমার পছন্দের staff login email |
| `STAFF_PASSWORD` | অন্তত 12-character unique strong password |
| `STAFF_HOSPITAL_IDS` | `kolaghat-rural` |
| `STORAGE_MODE` | `ephemeral-demo` অথবা `persistent-disk` |
| `DATA_DIR` | শুধু persistent disk নিলে `/var/data/pulsepoint`; free demo-তে omit করো |

CORS origin-এ `/pulsepoint/` দেবে না; origin শুধু scheme + hostname। Render-এর `PORT` নিজে set করা দরকার নেই।

Computer-এ Node থাকলে secret বানাও:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Secret/password শুধু Render environment-এ থাকবে; GitHub, `config.js`, screenshot বা chat-এ নয়। Staff role browser থেকে বেছে নেওয়া যায় না। Public registration সবসময় citizen account তৈরি করে।

একই trusted staff account-কে একাধিক sample hospital assign করতে চাইলে comma-separated IDs:
`kolaghat-rural,ktpp-medical,shusrusha-seva,apollo-clinic,tamluk-hospital`

**Create Web Service / Deploy** চাপো। Logs-এ `PulsePoint API listening` এলে Render-এর দেওয়া URL copy করো।

## 4. Frontend-কে backend URL দাও

ধরা যাক Render তোমাকে দিয়েছে `https://YOUR-SERVICE.onrender.com`। এটা placeholder; নিজের actual URL ব্যবহার করবে।

প্রথমে browser-এ খোলো:
`https://YOUR-SERVICE.onrender.com/api/health`

JSON-এ `"status":"ONLINE"` থাকতে হবে।

GitHub repository-তে `config.js` edit করে সম্পূর্ণ contents দাও:

```javascript
window.PULSEPOINT_CONFIG = {
  API_BASE_URL: 'https://YOUR-SERVICE.onrender.com/api'
};
```

Commit করো → Actions green tick হওয়া পর্যন্ত অপেক্ষা করো → website-এ **Ctrl + Shift + R**। উপরে **Backend connected** দেখাবে। এই URL public configuration, secret নয়।

## 5. End-to-end test করো

1. **Account portal:** email এবং minimum 12-character password দিয়ে **Create patient account**।
2. Patient photo upload করো। এটি signed-in account-এ backend-এ save হবে।
3. Request form পূরণ করে **Save request**। Unique request ID দেখাবে। এটি শুধু record; hospital/ambulance-এ dispatch নয়।
4. **Sign out** করে Render-এ দেওয়া staff email/password দিয়ে **Sign in**।
5. Assigned hospital dropdown-এ hospital দেখাবে; inventory বদলে **Save inventory**।
6. দ্বিতীয় browser/device-এ website খুলে **Refresh data** চাপো। Updated inventory দেখতে পাবে। এটি automatic push/live hospital feed নয়।
7. Staff নিজের assigned hospital-এর doctor photo বদলাতে পারবে। অন্য hospital edit backend reject করবে।
8. নিজের photo আছে কি না verify করতে sign out এবং sign in করো। Page reload-এ session ইচ্ছা করে শেষ হয়; token শুধু memory-তে থাকে।
9. Persistent disk ব্যবহার করলে Render manual redeploy দিয়ে data থাকে কি না verify করো। Free mode-এ persistence আশা করবে না।

## 6. নিজের computer-এ চালাতে চাইলে

Node.js 24 এবং Python install থাকা দরকার। দুটি terminal খোলো।

Terminal 1, extracted `pulsepoint/backend` folder-এ:

```bash
npm ci
```

`.env.example` copy করে `.env` নাম দাও; JWT secret এবং staff credentials বদলাও। তারপর:

```bash
npm start
```

Terminal 2, extracted `pulsepoint` root folder-এ:

```bash
python -m http.server 8000
```

খোলো http://localhost:8000 । Original `config.js` localhost-এ API `http://localhost:5000/api` ব্যবহার করে। Render URL দিয়ে file replace করে ফেললে local test-এর জন্য API_BASE_URL আবার localhost URL করো। `index.html` double-click করে `file://` থেকে চালাবে না।

Backend test:

```bash
cd backend
npm test
```

## 7. সমস্যা হলে

| সমস্যা | কী দেখবে |
|---|---|
| Backend not configured | `config.js`-এ actual Render URL + `/api` আছে? |
| Cannot reach backend | health URL খুলছে? Render service live? CORS origin exact? |
| প্রথম request timeout | Free service ঘুমিয়ে থাকলে health URL খুলে প্রায় এক মিনিট অপেক্ষা করে Refresh data |
| Render build failed | Root Directory `backend`, build `npm ci --omit=dev`, package-lock uploaded? |
| JWT secret error | Secret অন্তত 32 characters? Env save করে redeploy করেছ? |
| Incorrect email/password | Staff credentials Render env থেকে; patient আগে register করতে হবে |
| Staff editor locked | Server-issued staff account দিয়ে login করো |
| This hospital is not assigned | `STAFF_HOSPITAL_IDS` ঠিক করো, redeploy এবং sign in করো |
| নতুন UI দেখা যাচ্ছে না | Actions status, Pages source GitHub Actions, hard refresh |
| Data হারিয়ে গেছে | Free ephemeral mode? Persistent disk attached এবং DATA_DIR mount-এর ভিতরে? |
| Photo save হচ্ছে না | আগে login; JPG/PNG/WEBP 8 MB-এর নিচে; frontend resize করে upload করে |

## 8. এই build-এর scope

Connected prototype: real password verification, hashed passwords, expiring JWT, staff hospital authorization, disk-backed inventory/requests/photos, CORS allowlist, login throttling এবং API error states আছে। Requests শুধুমাত্র account owner API দিয়ে পড়তে পারে। Hospital listing/doctor photos public directory data; নিজের account photo private API দিয়ে পাওয়া যায়।

Hospital/doctor/contact/stock/organ data supplied sample dataset থেকে নেওয়া—verified live information নয়। Maps/directions browser থেকে Google Maps খোলে; hospital partnership, verified resource feed, ambulance dispatch, SMS/email delivery নেই। Real patient records বা actual emergency service হিসেবে launch করার আগে production database, operational access control, monitoring, recovery, verified hospital onboarding এবং প্রয়োজনীয় privacy review লাগবে। Public registration-এ email verification/password recovery এখনও নেই।

## Official references (checked 25 September 2026)

- GitHub Pages: https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages
- Pages setup: https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site
- Render Express: https://render.com/docs/deploy-node-express-app
- Render free limits: https://render.com/docs/free
- Persistent disks: https://render.com/docs/disks
