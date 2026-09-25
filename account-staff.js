(() => {
  "use strict";

  const API_BASE = (
    window.PULSEPOINT_CONFIG?.API_BASE_URL ||
    "https://pulsepoint-api-x7fp.onrender.com/api"
  ).replace(/\/+$/, "");

  const $ = (id) => document.getElementById(id);
  const TOKEN_KEY = "pulsepoint_auth_token";

  let currentUser = null;
  let currentHospitals = [];

  function api(path) {
    return `${API_BASE}${path.startsWith("/") ? path : "/" + path}`;
  }

  function token() {
    return localStorage.getItem(TOKEN_KEY) || "";
  }

  function setToken(value) {
    if (value) localStorage.setItem(TOKEN_KEY, value);
    else localStorage.removeItem(TOKEN_KEY);
  }

  function authHeaders(extra = {}) {
    return {
      "Content-Type": "application/json",
      ...(token() ? { Authorization: `Bearer ${token()}` } : {}),
      ...extra
    };
  }

  async function request(path, options = {}) {
    const response = await fetch(api(path), {
      ...options,
      headers: authHeaders(options.headers || {})
    });

    let data = {};
    try { data = await response.json(); } catch (_) {}

    if (!response.ok) {
      throw new Error(data.message || data.error || `HTTP ${response.status}`);
    }
    return data;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  // =========================================================
  // MODAL / POPUP SYSTEM
  // =========================================================
  function installUi() {
    const style = document.createElement("style");
    style.textContent = `
      #profilePhotoPreview[hidden],
      #profilePhotoFallback[hidden],
      #btnLogout[hidden],
      #btnRegister[hidden] { display:none !important; }

      .profile-photo-panel { overflow:hidden; }
      .profile-photo { display:block; }

      #staffUpdateForm :is(input,select,button):disabled {
        opacity:.58;
        cursor:not-allowed;
      }

      .staff-locked-note,
      .pp-info-note {
        margin:0 0 12px;
        padding:10px 12px;
        border-radius:10px;
        background:#fff7ed;
        border:1px solid #fed7aa;
        color:#9a3412;
        font-size:.82rem;
        line-height:1.45;
      }

      .pp-auth-guide {
        margin:0 0 13px;
        padding:11px 12px;
        border-radius:11px;
        background:#f0fdf4;
        border:1px solid #bbf7d0;
        color:#166534;
        font-size:.82rem;
        line-height:1.5;
      }

      .pp-modal-backdrop {
        position:fixed;
        inset:0;
        z-index:99999;
        display:grid;
        place-items:center;
        padding:18px;
        background:rgba(15,23,42,.58);
        backdrop-filter:blur(4px);
        -webkit-backdrop-filter:blur(4px);
      }

      .pp-modal-backdrop[hidden] { display:none !important; }

      .pp-modal {
        width:min(440px,100%);
        max-height:min(82vh,680px);
        overflow:auto;
        background:#fff;
        border-radius:18px;
        border:1px solid #dbe7e1;
        box-shadow:0 24px 70px rgba(15,23,42,.28);
        padding:20px;
        animation:ppModalIn .18s ease-out;
      }

      @keyframes ppModalIn {
        from { opacity:0; transform:translateY(9px) scale(.985); }
        to { opacity:1; transform:none; }
      }

      .pp-modal-icon {
        width:48px;
        height:48px;
        display:grid;
        place-items:center;
        border-radius:50%;
        margin-bottom:12px;
        font-size:20px;
      }

      .pp-modal-icon.success { background:#dcfce7; color:#15803d; }
      .pp-modal-icon.error { background:#fee2e2; color:#b91c1c; }
      .pp-modal-icon.info { background:#dbeafe; color:#1d4ed8; }
      .pp-modal-icon.warning { background:#ffedd5; color:#c2410c; }

      .pp-modal h3 {
        margin:0 0 7px;
        color:#0f3d30;
        font-size:1.2rem;
      }

      .pp-modal-message {
        color:#475569;
        font-size:.92rem;
        line-height:1.55;
        white-space:pre-line;
      }

      .pp-modal-highlight {
        margin-top:12px;
        padding:10px 12px;
        border-radius:10px;
        background:#f8fafc;
        border:1px solid #e2e8f0;
        color:#334155;
        font-size:.84rem;
        line-height:1.5;
      }

      .pp-modal-actions {
        display:flex;
        gap:8px;
        flex-wrap:wrap;
        justify-content:flex-end;
        margin-top:18px;
      }

      .pp-modal-actions .btn {
        min-width:105px;
        justify-content:center;
      }

      .pp-request-history {
        margin-top:16px;
        padding:14px;
        border:1px solid #dbe7e1;
        border-radius:13px;
        background:#fbfefc;
      }

      .pp-request-history h4 {
        margin:0 0 10px;
        color:#164e3d;
      }

      .pp-request-item {
        padding:10px 0;
        border-top:1px solid #e5eee9;
        font-size:.82rem;
        color:#475569;
        line-height:1.45;
      }

      .pp-request-item:first-of-type { border-top:0; padding-top:0; }
      .pp-request-id { font-weight:800; color:#0f766e; }
      .pp-request-status {
        display:inline-block;
        margin-top:5px;
        padding:3px 7px;
        border-radius:999px;
        background:#fff7ed;
        color:#9a3412;
        font-weight:700;
        font-size:.72rem;
      }

      .pp-organ-info {
        padding:12px;
        border-radius:12px;
        border:1px solid #dbeafe;
        background:#eff6ff;
        color:#1e3a8a;
        line-height:1.5;
        font-size:.84rem;
      }

      @media(max-width:600px) {
        .pp-modal { border-radius:16px; padding:17px; }
        .pp-modal-actions { display:grid; grid-template-columns:1fr 1fr; }
        .pp-modal-actions .btn { width:100%; min-width:0; }
      }
    `;
    document.head.appendChild(style);

    const modal = document.createElement("div");
    modal.id = "ppModalBackdrop";
    modal.className = "pp-modal-backdrop";
    modal.hidden = true;
    modal.innerHTML = `
      <div class="pp-modal" role="dialog" aria-modal="true" aria-labelledby="ppModalTitle">
        <div id="ppModalIcon" class="pp-modal-icon info">
          <i class="fa-solid fa-circle-info"></i>
        </div>
        <h3 id="ppModalTitle">PulsePoint</h3>
        <div id="ppModalMessage" class="pp-modal-message"></div>
        <div id="ppModalHighlight" class="pp-modal-highlight" hidden></div>
        <div id="ppModalActions" class="pp-modal-actions"></div>
      </div>`;
    document.body.appendChild(modal);

    modal.addEventListener("click", (event) => {
      if (event.target === modal) closeModal();
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !modal.hidden) closeModal();
    });

    ensureAuthGuide();
    ensureRequestHistoryPanel();
    renderOrganInfo();
  }

  function closeModal() {
    const modal = $("ppModalBackdrop");
    if (modal) modal.hidden = true;
  }

  function modalIcon(type) {
    if (type === "success") return "fa-circle-check";
    if (type === "error") return "fa-circle-xmark";
    if (type === "warning") return "fa-triangle-exclamation";
    return "fa-circle-info";
  }

  function openModal({
    title = "PulsePoint",
    message = "",
    type = "info",
    highlight = "",
    actions = null
  } = {}) {
    const backdrop = $("ppModalBackdrop");
    if (!backdrop) return;

    const icon = $("ppModalIcon");
    icon.className = `pp-modal-icon ${type}`;
    icon.innerHTML = `<i class="fa-solid ${modalIcon(type)}"></i>`;

    $("ppModalTitle").textContent = title;
    $("ppModalMessage").textContent = message;

    const hi = $("ppModalHighlight");
    if (highlight) {
      hi.hidden = false;
      hi.innerHTML = highlight;
    } else {
      hi.hidden = true;
      hi.innerHTML = "";
    }

    const actionBox = $("ppModalActions");
    actionBox.innerHTML = "";

    const finalActions = actions || [{
      label: "OK",
      className: "btn btn-green",
      onClick: closeModal
    }];

    finalActions.forEach(action => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = action.className || "btn btn-blue-outline";
      button.textContent = action.label || "OK";
      button.addEventListener("click", () => {
        closeModal();
        action.onClick?.();
      });
      actionBox.appendChild(button);
    });

    backdrop.hidden = false;
    setTimeout(() => actionBox.querySelector("button")?.focus(), 20);
  }

  function showNotice(id, text, ok = false) {
    const el = $(id);
    if (!el) return;
    el.textContent = text;
    el.style.display = text ? "block" : "none";
    el.style.marginTop = "9px";
    el.style.padding = text ? "9px 11px" : "0";
    el.style.borderRadius = "9px";
    el.style.fontSize = ".82rem";
    el.style.background = ok ? "#ecfdf5" : "#fff7ed";
    el.style.color = ok ? "#166534" : "#9a3412";
    el.style.border = ok ? "1px solid #bbf7d0" : "1px solid #fed7aa";
  }

  function ensureAuthGuide() {
    const form = $("authForm");
    if (!form || $("ppAuthGuide")) return;

    const guide = document.createElement("div");
    guide.id = "ppAuthGuide";
    guide.className = "pp-auth-guide";
    guide.innerHTML = `
      <strong>How this works:</strong><br>
      Already registered? Enter email + password and tap <b>Sign in</b>.<br>
      New patient? Enter email + a 12+ character password and tap <b>Create patient account</b>.<br>
      Hospital staff use the credentials configured by the administrator.`;
    form.insertAdjacentElement("beforebegin", guide);
  }

  function ensureRequestHistoryPanel() {
    const form = $("requisitionForm");
    if (!form || $("requestHistoryPanel")) return;

    const panel = document.createElement("div");
    panel.id = "requestHistoryPanel";
    panel.className = "pp-request-history";
    panel.innerHTML = `
      <h4><i class="fa-solid fa-clock-rotate-left"></i> My recent requests</h4>
      <div id="requestHistoryList">Sign in to view your saved requests.</div>`;
    form.insertAdjacentElement("afterend", panel);
  }

  function renderOrganInfo() {
    const box = $("organListContainer");
    if (!box) return;

    box.innerHTML = `
      <div class="pp-organ-info">
        <strong><i class="fa-solid fa-circle-info"></i> No live transplant-registry connection</strong><br>
        PulsePoint can save your internal request for follow-up, but it does not reserve an organ,
        perform donor matching, or notify a transplant centre automatically.
        For a real transplant case, contact the treating hospital's transplant coordinator.
      </div>`;
  }

  // =========================================================
  // PROFILE / ACCOUNT UI
  // =========================================================
  function setProfilePhoto(dataUrl) {
    const img = $("profilePhotoPreview");
    const fallback = $("profilePhotoFallback");
    if (!img || !fallback) return;

    if (dataUrl) {
      img.src = dataUrl;
      img.hidden = false;
      fallback.hidden = true;
    } else {
      img.removeAttribute("src");
      img.hidden = true;
      fallback.hidden = false;
    }

    const badge = $("navUserBadge");
    if (badge) {
      if (dataUrl) {
        badge.classList.add("has-profile-photo");
        badge.style.setProperty("--profile-image", `url("${dataUrl}")`);
      } else {
        badge.classList.remove("has-profile-photo");
        badge.style.removeProperty("--profile-image");
      }
    }
  }

  function setStaffEnabled(enabled) {
    const ids = [
      "staffSelectHospital", "staffIcuBeds", "staffVentilators",
      "staffGeneralBeds", "staffONegUnits", "staffABPosUnits",
      "btnStaffBroadcast"
    ];

    ids.forEach(id => {
      const el = $(id);
      if (el) el.disabled = !enabled;
    });

    const badge = $("staffLockBadge");
    if (badge) {
      badge.innerHTML = enabled
        ? '<i class="fa-solid fa-unlock"></i> Staff Access Active'
        : '<i class="fa-solid fa-lock"></i> Staff Login Required';
      badge.className = enabled ? "badge badge-green" : "badge badge-blue";
    }

    const card = $("staffPortalCard");
    if (!card) return;

    let note = $("staffLockedNote");
    if (!note) {
      note = document.createElement("div");
      note.id = "staffLockedNote";
      note.className = "staff-locked-note";
      card.querySelector(".staff-intro")?.insertAdjacentElement("afterend", note);
    }

    note.hidden = enabled;
    note.innerHTML = '<i class="fa-solid fa-lock"></i> Sign in with an authorized hospital staff account to edit inventory.';
  }

  function updateAccountUi(user) {
    currentUser = user || null;

    const status = $("userStatusText");
    const roleTag = $("activeRoleTag");
    const logout = $("btnLogout");
    const authSubmit = $("btnAuthSubmit");
    const register = $("btnRegister");

    if (currentUser) {
      if (status) {
        status.textContent = `${currentUser.name || currentUser.email} · ${currentUser.role === "staff" ? "Staff" : "Patient"}`;
      }
      if (roleTag) {
        roleTag.textContent = `Role: ${currentUser.role === "staff" ? "Hospital Staff" : "Citizen"}`;
      }
      if (logout) logout.hidden = false;
      if (authSubmit) {
        authSubmit.innerHTML = '<i class="fa-solid fa-check"></i> Signed in';
        authSubmit.disabled = true;
      }
      if (register) register.hidden = true;

      if ($("profilePhotoTitle")) {
        $("profilePhotoTitle").textContent =
          currentUser.role === "staff" ? "Hospital staff profile" : "Citizen / Patient profile";
      }
      if ($("profilePhotoHint")) {
        $("profilePhotoHint").textContent = `Signed in as ${currentUser.email}`;
      }

      setProfilePhoto(currentUser.profilePhoto || "");
      setStaffEnabled(currentUser.role === "staff");
      loadRequestHistory();
    } else {
      if (status) status.textContent = "Guest (Public View)";
      if (roleTag) roleTag.textContent = "Role: Citizen";
      if (logout) logout.hidden = true;
      if (authSubmit) {
        authSubmit.disabled = false;
        authSubmit.innerHTML = '<i class="fa-solid fa-arrow-right-to-bracket"></i> Sign in';
      }
      if (register) register.hidden = false;

      if ($("profilePhotoTitle")) $("profilePhotoTitle").textContent = "Citizen / Patient profile";
      if ($("profilePhotoHint")) $("profilePhotoHint").textContent = "Sign in to save your profile photo and requests.";

      setProfilePhoto("");
      setStaffEnabled(false);
      renderRequestHistory([]);
    }
  }

  // =========================================================
  // HOSPITAL LIST → STAFF + REQUEST HOSPITAL SUGGESTIONS
  // =========================================================
  function populateStaffHospitals(list) {
    currentHospitals = Array.isArray(list) ? list : [];
    const select = $("staffSelectHospital");

    if (select) {
      const previous = select.value;
      select.innerHTML = "";

      if (!currentHospitals.length) {
        const opt = document.createElement("option");
        opt.value = "";
        opt.textContent = "No hospitals loaded";
        select.appendChild(opt);
      } else {
        currentHospitals.forEach(h => {
          const opt = document.createElement("option");
          opt.value = h.id || "";
          opt.textContent = h.distanceKm != null
            ? `${h.name} · ${Number(h.distanceKm).toFixed(1)} km`
            : h.name;
          select.appendChild(opt);
        });

        if (currentHospitals.some(h => h.id === previous)) select.value = previous;
        fillInventoryForm();
      }
    }

    populateRequestHospitalSuggestions();
  }

  function populateRequestHospitalSuggestions() {
    const input = $("reqHospital");
    if (!input) return;

    let datalist = $("pulsepointHospitalSuggestions");
    if (!datalist) {
      datalist = document.createElement("datalist");
      datalist.id = "pulsepointHospitalSuggestions";
      document.body.appendChild(datalist);
      input.setAttribute("list", datalist.id);
    }

    datalist.innerHTML = "";
    currentHospitals.slice(0, 50).forEach(h => {
      const opt = document.createElement("option");
      opt.value = h.name;
      datalist.appendChild(opt);
    });
  }

  function selectedHospital() {
    const id = $("staffSelectHospital")?.value;
    return currentHospitals.find(h => h.id === id) || null;
  }

  function fillInventoryForm() {
    const h = selectedHospital();
    if (!h) return;

    if ($("staffIcuBeds")) $("staffIcuBeds").value = h.icuBeds ?? 0;
    if ($("staffVentilators")) $("staffVentilators").value = h.ventilators ?? 0;
    if ($("staffGeneralBeds")) $("staffGeneralBeds").value = h.availableBeds ?? h.generalBeds ?? 0;
    if ($("staffONegUnits")) $("staffONegUnits").value = Number(h.bloodStock?.["O-"] ?? 0);
    if ($("staffABPosUnits")) $("staffABPosUnits").value = Number(h.bloodStock?.["AB+"] ?? 0);
  }

  async function loadInitialHospitals() {
    if (window.PulsePointHospitalSearch?.getHospitals) {
      const list = window.PulsePointHospitalSearch.getHospitals();
      if (list.length) {
        populateStaffHospitals(list);
        return;
      }
    }

    try {
      const data = await request("/hospitals", { method: "GET" });
      populateStaffHospitals(data.data || []);
    } catch (_) {
      populateStaffHospitals([]);
    }
  }

  // =========================================================
  // AUTH
  // =========================================================
  async function login(event) {
    event.preventDefault();

    const email = $("authEmail")?.value.trim();
    const password = $("authPassword")?.value || "";

    if (!email || !password) {
      showNotice("authNotice", "Enter your email / Medical ID and password.");
      openModal({
        title: "Sign in incomplete",
        message: "Enter both your email / Medical ID and password, then try again.",
        type: "warning"
      });
      return;
    }

    showNotice("authNotice", "Signing in…", true);

    try {
      const data = await request("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password })
      });

      setToken(data.token);
      updateAccountUi(data.user);
      showNotice("authNotice", "Signed in successfully.", true);

      openModal({
        title: "Signed in",
        message: `Welcome ${data.user.name || data.user.email}.`,
        type: "success",
        highlight: `<strong>Account:</strong> ${escapeHtml(data.user.email)}<br><strong>Role:</strong> ${data.user.role === "staff" ? "Hospital Staff" : "Patient / Citizen"}`
      });
    } catch (error) {
      showNotice("authNotice", error.message);
      openModal({
        title: "Sign in failed",
        message: error.message,
        type: "error"
      });
    }
  }

  async function doRegister(email, password) {
    showNotice("authNotice", "Creating patient account…", true);

    try {
      const data = await request("/auth/register", {
        method: "POST",
        body: JSON.stringify({ email, password })
      });

      setToken(data.token);
      updateAccountUi(data.user);
      showNotice("authNotice", "Patient account created and signed in.", true);

      openModal({
        title: "Account created",
        message: "Your patient account has been created and you are now signed in.",
        type: "success",
        highlight: `<strong>${escapeHtml(data.user.email)}</strong><br>You can now save blood / organ requests and a profile photo.`
      });
    } catch (error) {
      showNotice("authNotice", error.message);
      openModal({
        title: "Could not create account",
        message: error.message,
        type: "error"
      });
    }
  }

  function register() {
    const email = $("authEmail")?.value.trim();
    const password = $("authPassword")?.value || "";

    if (!email) {
      openModal({
        title: "Email required",
        message: "Enter your email address first.",
        type: "warning"
      });
      return;
    }

    if (password.length < 12) {
      openModal({
        title: "Password too short",
        message: "Use a password with at least 12 characters, then tap Create patient account again.",
        type: "warning"
      });
      return;
    }

    openModal({
      title: "Create patient account?",
      message: "This will register a new PulsePoint patient account using the email below.",
      type: "info",
      highlight: `<strong>${escapeHtml(email)}</strong>`,
      actions: [
        {
          label: "Cancel",
          className: "btn btn-blue-outline"
        },
        {
          label: "Create account",
          className: "btn btn-green",
          onClick: () => doRegister(email, password)
        }
      ]
    });
  }

  async function restoreSession() {
    if (!token()) {
      updateAccountUi(null);
      return;
    }

    try {
      const data = await request("/auth/me", { method: "GET" });
      updateAccountUi(data.user);
    } catch (_) {
      setToken("");
      updateAccountUi(null);
    }
  }

  function logout() {
    openModal({
      title: "Sign out?",
      message: "You will need to sign in again to save requests or edit hospital inventory.",
      type: "warning",
      actions: [
        { label: "Cancel", className: "btn btn-blue-outline" },
        {
          label: "Sign out",
          className: "btn btn-emergency",
          onClick: () => {
            setToken("");
            updateAccountUi(null);
            showNotice("authNotice", "Signed out.", true);

            setTimeout(() => {
              openModal({
                title: "Signed out",
                message: "You have been signed out safely.",
                type: "success"
              });
            }, 80);
          }
        }
      ]
    });
  }

  // =========================================================
  // PROFILE PHOTO
  // =========================================================
  function resizeImage(file) {
    return new Promise((resolve, reject) => {
      if (!file.type.startsWith("image/")) {
        reject(new Error("Choose a JPG, PNG or WebP image."));
        return;
      }

      const reader = new FileReader();
      reader.onerror = () => reject(new Error("Could not read image."));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error("Could not open image."));
        img.onload = () => {
          const size = 256;
          const canvas = document.createElement("canvas");
          canvas.width = size;
          canvas.height = size;
          const ctx = canvas.getContext("2d");

          const scale = Math.max(size / img.width, size / img.height);
          const w = img.width * scale;
          const h = img.height * scale;
          const x = (size - w) / 2;
          const y = (size - h) / 2;

          ctx.drawImage(img, x, y, w, h);
          resolve(canvas.toDataURL("image/jpeg", 0.78));
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  async function handlePhoto(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!currentUser || !token()) {
      event.target.value = "";
      openModal({
        title: "Sign in required",
        message: "Sign in first, then you can save a profile photo to your account.",
        type: "warning",
        actions: [
          { label: "Close", className: "btn btn-blue-outline" },
          {
            label: "Go to sign in",
            className: "btn btn-green",
            onClick: () => $("section-auth")?.scrollIntoView({ behavior: "smooth" })
          }
        ]
      });
      return;
    }

    try {
      const photo = await resizeImage(file);
      setProfilePhoto(photo);

      const data = await request("/profile", {
        method: "PATCH",
        body: JSON.stringify({ profilePhoto: photo })
      });

      currentUser = data.user;
      setProfilePhoto(currentUser.profilePhoto || "");
      showNotice("authNotice", "Profile photo saved.", true);
    } catch (error) {
      openModal({
        title: "Photo update failed",
        message: error.message,
        type: "error"
      });
    } finally {
      event.target.value = "";
    }
  }

  async function removePhoto() {
    if (!currentUser || !token()) {
      setProfilePhoto("");
      return;
    }

    try {
      const data = await request("/profile", {
        method: "PATCH",
        body: JSON.stringify({ profilePhoto: "" })
      });
      currentUser = data.user;
      setProfilePhoto("");
      showNotice("authNotice", "Profile photo removed.", true);
    } catch (error) {
      openModal({
        title: "Could not remove photo",
        message: error.message,
        type: "error"
      });
    }
  }

  // =========================================================
  // BLOOD / ORGAN REQUESTS
  // =========================================================
  function renderRequestHistory(items) {
    const list = $("requestHistoryList");
    if (!list) return;

    if (!currentUser) {
      list.innerHTML = "Sign in to view your saved requests.";
      return;
    }

    if (!items?.length) {
      list.innerHTML = "No saved requests yet.";
      return;
    }

    list.innerHTML = items.map(r => `
      <div class="pp-request-item">
        <div class="pp-request-id">${escapeHtml(r.id)}</div>
        <strong>${escapeHtml(r.item)}</strong> · ${escapeHtml(r.units)} unit(s)<br>
        ${escapeHtml(r.patientName)} → ${escapeHtml(r.hospital)}
        <br><span class="pp-request-status">${escapeHtml(r.status || "Saved")}</span>
      </div>
    `).join("");
  }

  async function loadRequestHistory() {
    if (!currentUser || !token()) {
      renderRequestHistory([]);
      return;
    }

    try {
      const data = await request("/requests", { method: "GET" });
      renderRequestHistory(data.data || []);
    } catch (_) {
      const list = $("requestHistoryList");
      if (list) list.textContent = "Could not load saved requests.";
    }
  }

  async function submitRequest(event) {
    event.preventDefault();

    if (!currentUser || !token()) {
      openModal({
        title: "Sign in required",
        message: "You need a patient or staff account before this request can be saved.",
        type: "warning",
        actions: [
          { label: "Cancel", className: "btn btn-blue-outline" },
          {
            label: "Go to sign in",
            className: "btn btn-green",
            onClick: () => $("section-auth")?.scrollIntoView({ behavior: "smooth" })
          }
        ]
      });
      return;
    }

    const patientName = $("reqName")?.value.trim();
    const item = $("reqItem")?.value;
    const units = Number($("reqUnits")?.value || 0);
    const hospital = $("reqHospital")?.value.trim();
    const phone = $("reqPhone")?.value.trim();

    if (!patientName || !item || !hospital || !phone || units < 1) {
      openModal({
        title: "Request incomplete",
        message: "Fill in patient name, blood / organ needed, quantity, receiving hospital and contact phone.",
        type: "warning"
      });
      return;
    }

    const button = $("requisitionForm")?.querySelector('button[type="submit"]');
    const oldHtml = button?.innerHTML;

    if (button) {
      button.disabled = true;
      button.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving request…';
    }

    showNotice("requisitionNotice", "Saving request…", true);

    try {
      const data = await request("/requests", {
        method: "POST",
        body: JSON.stringify({
          patientName,
          item,
          units,
          hospital,
          phone
        })
      });

      showNotice("requisitionNotice", `Request saved: ${data.data.id}`, true);
      await loadRequestHistory();

      openModal({
        title: "Request saved",
        message:
          "Your PulsePoint request has been saved successfully.\n\nImportant: this does NOT mean the hospital, blood bank, or transplant centre has been notified.",
        type: "success",
        highlight:
          `<strong>Request ID:</strong> ${escapeHtml(data.data.id)}<br>` +
          `<strong>Need:</strong> ${escapeHtml(data.data.item)} × ${escapeHtml(data.data.units)}<br>` +
          `<strong>Hospital:</strong> ${escapeHtml(data.data.hospital)}<br>` +
          `<strong>Status:</strong> ${escapeHtml(data.data.status)}`,
        actions: [
          { label: "Close", className: "btn btn-blue-outline" },
          {
            label: "Call 108",
            className: "btn btn-emergency",
            onClick: () => { window.location.href = "tel:108"; }
          }
        ]
      });

      $("requisitionForm")?.reset();
      if ($("reqUnits")) $("reqUnits").value = 2;
    } catch (error) {
      showNotice("requisitionNotice", error.message);
      openModal({
        title: "Request not saved",
        message: error.message,
        type: "error"
      });
    } finally {
      if (button) {
        button.disabled = false;
        button.innerHTML = oldHtml;
      }
    }
  }

  // =========================================================
  // STAFF INVENTORY
  // =========================================================
  async function saveInventory(event) {
    event.preventDefault();

    if (!currentUser || currentUser.role !== "staff") {
      openModal({
        title: "Staff access required",
        message: "Only an authorized hospital staff account can change bed, ICU, ventilator, or blood inventory.",
        type: "warning"
      });
      return;
    }

    const h = selectedHospital();
    if (!h?.id) {
      openModal({
        title: "Select a hospital",
        message: "Choose a facility before saving inventory.",
        type: "warning"
      });
      return;
    }

    const bloodStock = {
      ...(h.bloodStock || {}),
      "O-": Number($("staffONegUnits")?.value || 0),
      "AB+": Number($("staffABPosUnits")?.value || 0)
    };

    const payload = {
      name: h.name,
      address: h.address,
      lat: h.lat,
      lng: h.lng,
      generalBeds: Number($("staffGeneralBeds")?.value || 0),
      availableBeds: Number($("staffGeneralBeds")?.value || 0),
      icuBeds: Number($("staffIcuBeds")?.value || 0),
      ventilators: Number($("staffVentilators")?.value || 0),
      bloodStock
    };

    const button = $("btnStaffBroadcast");
    const old = button?.innerHTML;

    if (button) {
      button.disabled = true;
      button.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving…';
    }

    try {
      const data = await request(`/hospitals/${encodeURIComponent(h.id)}/inventory`, {
        method: "PATCH",
        body: JSON.stringify(payload)
      });

      const patch = data.data || payload;
      currentHospitals = currentHospitals.map(x => x.id === h.id ? { ...x, ...patch } : x);
      window.PulsePointHospitalSearch?.updateInventoryLocal?.(h.id, patch);
      showNotice("staffNotice", "Inventory updated successfully.", true);

      openModal({
        title: "Inventory updated",
        message: `${h.name} inventory has been updated in PulsePoint.`,
        type: "success",
        highlight:
          `<strong>General beds:</strong> ${patch.availableBeds ?? patch.generalBeds ?? 0}<br>` +
          `<strong>ICU:</strong> ${patch.icuBeds ?? 0}<br>` +
          `<strong>Ventilators:</strong> ${patch.ventilators ?? 0}`
      });
    } catch (error) {
      showNotice("staffNotice", error.message);
      openModal({
        title: "Inventory update failed",
        message: error.message,
        type: "error"
      });
    } finally {
      if (button) {
        button.disabled = currentUser?.role !== "staff";
        button.innerHTML = old;
      }
    }
  }

  function bind() {
    $("authForm")?.addEventListener("submit", login);
    $("btnRegister")?.addEventListener("click", register);
    $("btnLogout")?.addEventListener("click", logout);
    $("profilePhotoInput")?.addEventListener("change", handlePhoto);
    $("btnRemoveProfilePhoto")?.addEventListener("click", removePhoto);
    $("staffSelectHospital")?.addEventListener("change", fillInventoryForm);
    $("staffUpdateForm")?.addEventListener("submit", saveInventory);
    $("requisitionForm")?.addEventListener("submit", submitRequest);

    window.addEventListener("pulsepoint:hospitals-updated", (event) => {
      populateStaffHospitals(event.detail?.hospitals || []);
    });
  }

  document.addEventListener("DOMContentLoaded", async () => {
    installUi();
    bind();
    setStaffEnabled(false);
    await restoreSession();
    await loadInitialHospitals();
  });
})();
