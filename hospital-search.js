(() => {
  "use strict";

  // PulsePoint Hospital Discovery Add-on
  // Works with config.js where API_BASE_URL ends in /api.
  const configured = window.PULSEPOINT_CONFIG?.API_BASE_URL
    || "https://pulsepoint-api-x7fp.onrender.com/api";
  const API_BASE = configured.replace(/\/+$/, "");

  let hospitals = [];
  let originalHospitals = [];
  let searchTimer = null;

  const $ = (id) => document.getElementById(id);

  function api(path) {
    return `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function numberOrNull(v) {
    return typeof v === "number" && Number.isFinite(v) ? v : null;
  }

  function normalizeHospital(h) {
    const stock = h.bloodStock && typeof h.bloodStock === "object"
      ? h.bloodStock
      : null;

    const bloodAvailable = Array.isArray(h.bloodAvailable)
      ? h.bloodAvailable
      : [];

    const bloodTypes = stock
      ? Object.keys(stock).filter((key) => Number(stock[key]) > 0)
      : bloodAvailable;

    return {
      id: h.id || h._id || h.name || crypto.randomUUID?.() || String(Math.random()),
      name: h.name || "Unnamed hospital",
      address: h.address || h.location || "Address not reported",
      category: h.category || "Hospital",
      phone: h.phone || h.contact || h.emergencyLine || "",
      website: h.website || "",
      lat: numberOrNull(h.lat) ?? numberOrNull(h.latitude),
      lng: numberOrNull(h.lng) ?? numberOrNull(h.longitude),
      distanceKm: numberOrNull(h.distanceKm),
      availableBeds: numberOrNull(h.availableBeds) ?? numberOrNull(h.generalBeds),
      totalBeds: numberOrNull(h.totalBeds),
      icuBeds: numberOrNull(h.icuBeds),
      ventilators: numberOrNull(h.ventilators),
      bloodStock: stock,
      bloodTypes,
      emergency: h.emergency ?? null,
      source: h.source || "database"
    };
  }

  function bedValue(value) {
    return value == null
      ? `<span style="font-size:.86rem;color:#64748b;font-weight:700">Not reported</span>`
      : escapeHtml(value);
  }

  function availabilityBadge(h) {
    const hasLiveInventory =
      h.availableBeds != null ||
      h.icuBeds != null ||
      h.ventilators != null ||
      h.bloodStock != null;

    if (hasLiveInventory) {
      return `<span style="background:#dcfce7;color:#166534;font-size:.72rem;font-weight:800;padding:5px 8px;border-radius:999px;">Inventory reported</span>`;
    }

    return `<span style="background:#fff7ed;color:#9a3412;font-size:.72rem;font-weight:800;padding:5px 8px;border-radius:999px;">Availability not reported</span>`;
  }

  function directionsUrl(h) {
    if (h.lat != null && h.lng != null) {
      return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${h.lat},${h.lng}`)}`;
    }
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${h.name} ${h.address}`)}`;
  }

  function renderHospitals(list) {
    const container = $("hospitalsGrid");
    if (!container) return;

    container.innerHTML = "";

    if (!list.length) {
      container.innerHTML = `
        <div style="grid-column:1/-1;text-align:center;padding:28px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:14px;color:#64748b;">
          <strong>No matching hospitals found.</strong><br>
          <span style="font-size:.86rem">Try another area or use your current location.</span>
        </div>`;
      renderMapTargets([]);
      return;
    }

    const grid = document.createElement("div");
    grid.style.cssText =
      "display:grid;grid-template-columns:repeat(auto-fit,minmax(290px,1fr));gap:16px;width:100%;";

    list.forEach((h, index) => {
      const distance = h.distanceKm != null
        ? `<span style="background:#e0f2fe;color:#075985;font-size:.72rem;font-weight:800;padding:5px 8px;border-radius:999px;">${h.distanceKm.toFixed(1)} km</span>`
        : "";

      const callButton = h.phone
        ? `<a class="btn btn-emergency" href="tel:${escapeHtml(h.phone)}" style="flex:1;justify-content:center;">
             <i class="fa-solid fa-phone"></i> Call
           </a>`
        : `<button class="btn btn-blue-outline" disabled style="flex:1;justify-content:center;opacity:.55;">
             <i class="fa-solid fa-phone-slash"></i> Phone unavailable
           </button>`;

      const card = document.createElement("article");
      card.className = "hospital-card";
      card.dataset.hospitalId = h.id;
      card.innerHTML = `
        <div class="hospital-card-header" style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;">
          <div>
            <h3 style="margin-bottom:5px;">${escapeHtml(h.name)}</h3>
            <div class="hospital-meta">
              <i class="fa-solid fa-location-dot"></i>
              ${escapeHtml(h.address)}
            </div>
          </div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end;">
            ${distance}
            ${availabilityBadge(h)}
          </div>
        </div>

        <div class="bed-telemetry-row" style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:15px 0;">
          <div style="padding:10px;border-radius:10px;background:#f0fdf4;border:1px solid #bbf7d0;">
            <div style="font-size:.72rem;color:#166534;font-weight:700;">GENERAL BEDS</div>
            <div style="font-size:1.15rem;font-weight:850;color:#15803d;">${bedValue(h.availableBeds)}</div>
          </div>
          <div style="padding:10px;border-radius:10px;background:#fff7ed;border:1px solid #fed7aa;">
            <div style="font-size:.72rem;color:#9a3412;font-weight:700;">ICU</div>
            <div style="font-size:1.15rem;font-weight:850;color:#c2410c;">${bedValue(h.icuBeds)}</div>
          </div>
          <div style="padding:10px;border-radius:10px;background:#eff6ff;border:1px solid #bfdbfe;">
            <div style="font-size:.72rem;color:#1e40af;font-weight:700;">VENTILATOR</div>
            <div style="font-size:1.15rem;font-weight:850;color:#1d4ed8;">${bedValue(h.ventilators)}</div>
          </div>
        </div>

        <div style="font-size:.82rem;color:#64748b;margin-bottom:12px;">
          <i class="fa-solid fa-circle-info"></i>
          ${h.source === "openstreetmap"
            ? "Hospital location from OpenStreetMap. Bed/ICU status appears only when reported in PulsePoint."
            : "Hospital data matched with PulsePoint inventory."}
        </div>

        <div class="hospital-card-actions" style="display:flex;gap:8px;flex-wrap:wrap;">
          <a class="btn btn-green" href="${directionsUrl(h)}" target="_blank" rel="noopener" style="flex:1;justify-content:center;">
            <i class="fa-solid fa-route"></i> Directions
          </a>
          ${callButton}
        </div>`;

      card.addEventListener("click", (event) => {
        if (event.target.closest("a,button")) return;
        selectHospital(index);
      });

      grid.appendChild(card);
    });

    container.appendChild(grid);
    renderMapTargets(list);

    if (list[0]) updateMap(list[0]);
  }

  function updateMap(h) {
    if (!h) return;

    const iframe = $("googleMapIframe");
    if (iframe) {
      const q = h.lat != null && h.lng != null
        ? `${h.lat},${h.lng}`
        : `${h.name} ${h.address}`;
      iframe.src = `https://maps.google.com/maps?q=${encodeURIComponent(q)}&z=14&output=embed`;
    }

    const side = $("activeMapHospitalCard");
    if (side) {
      side.innerHTML = `
        <span class="badge badge-green">Selected hospital</span>
        <h3 style="margin:10px 0 6px;">${escapeHtml(h.name)}</h3>
        <p style="color:#64748b;margin:0 0 12px;">
          <i class="fa-solid fa-location-dot"></i> ${escapeHtml(h.address)}
        </p>
        ${h.distanceKm != null ? `<p><strong>${h.distanceKm.toFixed(1)} km</strong> from searched location</p>` : ""}
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin:13px 0;">
          <div><strong>${h.availableBeds ?? "—"}</strong><br><small>General</small></div>
          <div><strong>${h.icuBeds ?? "—"}</strong><br><small>ICU</small></div>
          <div><strong>${h.ventilators ?? "—"}</strong><br><small>Ventilator</small></div>
        </div>
        <a class="btn btn-green btn-block" target="_blank" rel="noopener" href="${directionsUrl(h)}">
          <i class="fa-solid fa-diamond-turn-right"></i> Open directions
        </a>`;
    }
  }

  function selectHospital(index) {
    const visible = getFilteredHospitals();
    if (visible[index]) {
      updateMap(visible[index]);
      $("section-map")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function renderMapTargets(list) {
    const wrap = $("mapTargetPills");
    if (!wrap) return;

    wrap.innerHTML = "";
    list.slice(0, 6).forEach((h) => {
      const button = document.createElement("button");
      button.className = "pill";
      button.type = "button";
      button.textContent = h.distanceKm != null
        ? `${h.name} · ${h.distanceKm.toFixed(1)} km`
        : h.name;
      button.addEventListener("click", () => updateMap(h));
      wrap.appendChild(button);
    });
  }

  function renderBloodMatrix(list) {
    const tbody = $("bloodTableBody");
    if (!tbody) return;

    tbody.innerHTML = "";

    list.forEach((h) => {
      const stock = h.bloodStock || {};
      const cell = (group) => {
        if (h.bloodStock) {
          const n = Number(stock[group] || 0);
          return n > 0 ? `✅ ${n}` : "—";
        }
        return h.bloodTypes.includes(group) ? "✅ Available" : "—";
      };

      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${escapeHtml(h.name)}</td>
        <td>${cell("O-")}</td>
        <td>${cell("O+")}</td>
        <td>${cell("A+")}</td>
        <td>${cell("B+")}</td>
        <td>${cell("AB+")}</td>
        <td>${h.phone ? `<a href="tel:${escapeHtml(h.phone)}">${escapeHtml(h.phone)}</a>` : "Not reported"}</td>`;
      tbody.appendChild(row);
    });
  }

  function getFilteredHospitals() {
    const filter = $("filterType")?.value || "all";

    return hospitals.filter((h) => {
      if (filter === "icu") return h.icuBeds != null && h.icuBeds > 0;
      if (filter === "vent") return h.ventilators != null && h.ventilators > 0;
      if (filter === "govt") {
        const text = `${h.name} ${h.address} ${h.category}`.toLowerCase();
        return /(government|govt|rural hospital|district hospital|medical college)/.test(text);
      }
      return true;
    });
  }

  function refreshVisibleData() {
    const filtered = getFilteredHospitals();
    renderHospitals(filtered);
    renderBloodMatrix(filtered);
  }

  function setGpsStatus(text, kind = "") {
    const el = $("gpsStatusMessage");
    if (!el) return;
    el.textContent = text;
    el.dataset.kind = kind;
  }

  function setBackendStatus(text) {
    const el = $("backendStatus");
    if (el) el.textContent = text;
  }

  function setLoading(message) {
    const container = $("hospitalsGrid");
    if (!container) return;

    container.innerHTML = `
      <div style="grid-column:1/-1;text-align:center;padding:28px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:14px;color:#166534;">
        <i class="fa-solid fa-spinner fa-spin"></i>
        <strong>${escapeHtml(message)}</strong>
      </div>`;
  }

  async function fetchJson(url, timeoutMs = 25000) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        headers: { "Accept": "application/json" },
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return await response.json();
    } finally {
      clearTimeout(timeout);
    }
  }

  async function checkHealth() {
    setBackendStatus("Connecting to backend…");

    try {
      const result = await fetchJson(api("/health"), 55000);
      setBackendStatus(
        result.status === "ONLINE"
          ? "✅ Hospital discovery connected"
          : "⚠️ Backend responded"
      );
    } catch (error) {
      console.error(error);
      setBackendStatus("⚠️ Backend is waking up — try Refresh data");
    }
  }

  async function initialLoad() {
    setLoading("Loading hospital directory…");

    try {
      const result = await fetchJson(api("/hospitals"), 55000);
      hospitals = (result.data || []).map(normalizeHospital);
      originalHospitals = [...hospitals];
      refreshVisibleData();
    } catch (error) {
      console.error(error);
      const container = $("hospitalsGrid");
      if (container) {
        container.innerHTML = `
          <div style="grid-column:1/-1;text-align:center;padding:25px;background:#fff7ed;border:1px solid #fed7aa;border-radius:14px;color:#9a3412;">
            Backend may be waking up. Click <strong>Refresh data</strong> after a few seconds.
          </div>`;
      }
    }
  }

  function saveSearchHistory(query) {
    const q = String(query || "").trim();
    if (!q) return;

    let items = [];
    try {
      items = JSON.parse(localStorage.getItem("pulsepoint_recent_searches") || "[]");
    } catch (_) {}

    items = [q, ...items.filter((x) => x.toLowerCase() !== q.toLowerCase())].slice(0, 5);
    localStorage.setItem("pulsepoint_recent_searches", JSON.stringify(items));
    renderHistory();
  }

  function getSearchHistory() {
    try {
      return JSON.parse(localStorage.getItem("pulsepoint_recent_searches") || "[]");
    } catch (_) {
      return [];
    }
  }

  function renderHistory() {
    const input = $("hospitalSearch");
    if (!input) return;

    let box = $("pulsepointRecentSearches");
    if (!box) {
      box = document.createElement("div");
      box.id = "pulsepointRecentSearches";
      box.style.cssText =
        "width:100%;display:flex;gap:7px;flex-wrap:wrap;margin-top:8px;align-items:center;";
      input.closest(".filter-controls")?.insertAdjacentElement("afterend", box);
    }

    const items = getSearchHistory();
    box.innerHTML = items.length
      ? `<span style="font-size:.76rem;color:#64748b;font-weight:700;">Recent:</span>`
      : "";

    items.forEach((query) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "pill";
      button.style.fontSize = ".75rem";
      button.textContent = query;
      button.addEventListener("click", () => {
        input.value = query;
        searchByArea(query);
      });
      box.appendChild(button);
    });
  }

  function updateLocationCopy(label) {
    document.querySelectorAll(".location-tag").forEach((el) => {
      el.innerHTML = `<i class="fa-solid fa-location-dot"></i> ${escapeHtml(label)}`;
    });

    const mapSubtitle = $("section-map")?.querySelector(".section-title p");
    if (mapSubtitle) {
      mapSubtitle.textContent = `Hospitals discovered around ${label}.`;
    }
  }

  async function searchByArea(query) {
    const q = String(query || "").trim();
    if (q.length < 2) return;

    setLoading(`Searching hospitals near ${q}…`);
    setGpsStatus(`🔎 Searching hospitals near ${q}…`);

    try {
      const result = await fetchJson(
        api(`/hospitals?search=${encodeURIComponent(q)}`),
        35000
      );

      hospitals = (result.data || []).map(normalizeHospital)
        .sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));

      saveSearchHistory(q);
      updateLocationCopy(q);
      refreshVisibleData();

      setGpsStatus(
        hospitals.length
          ? `✅ Found ${hospitals.length} hospital(s) near ${q}.`
          : `No hospitals found near ${q}.`
      );

      $("section-hospitals")?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (error) {
      console.error(error);
      setGpsStatus("⚠️ Hospital search failed. Please retry.");
      renderHospitals([]);
    }
  }

  async function searchByGps() {
    const btn = $("btnGpsCalc");

    if (!navigator.geolocation) {
      setGpsStatus("⚠️ This browser does not support location access.");
      return;
    }

    const oldHtml = btn?.innerHTML;
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Locating…`;
    }

    setGpsStatus("📍 Getting your current location…");

    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        const { latitude, longitude } = coords;
        setLoading("Finding the nearest hospitals…");
        setGpsStatus("🔎 Finding hospitals closest to your current location…");

        try {
          const result = await fetchJson(
            api(`/hospitals/nearby?lat=${encodeURIComponent(latitude)}&lng=${encodeURIComponent(longitude)}&radius=30000&limit=30`),
            35000
          );

          hospitals = (result.data || []).map(normalizeHospital)
            .filter((h) => h.lat != null && h.lng != null)
            .sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));

          $("hospitalSearch") && ($("hospitalSearch").value = "");
          updateLocationCopy("Your current location");
          refreshVisibleData();

          setGpsStatus(
            hospitals.length
              ? `✅ ${hospitals.length} nearby hospital(s) found — closest first.`
              : "No hospitals were found in the current search radius."
          );

          $("section-hospitals")?.scrollIntoView({ behavior: "smooth", block: "start" });
        } catch (error) {
          console.error(error);
          setGpsStatus("⚠️ Could not fetch nearby hospitals. Please retry.");
          renderHospitals([]);
        } finally {
          if (btn) {
            btn.disabled = false;
            btn.innerHTML = oldHtml;
          }
        }
      },
      (error) => {
        console.error(error);
        if (btn) {
          btn.disabled = false;
          btn.innerHTML = oldHtml;
        }

        const messages = {
          1: "Location permission was denied. Allow location access in your browser.",
          2: "Your location is currently unavailable.",
          3: "Location request timed out. Please retry."
        };
        setGpsStatus(`⚠️ ${messages[error.code] || "Could not get your location."}`);
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 }
    );
  }

  function bindEvents() {
    const gpsBtn = $("btnGpsCalc");
    if (gpsBtn) {
      gpsBtn.addEventListener("click", (event) => {
        event.stopImmediatePropagation();
        searchByGps();
      }, true);
    }

    const refreshBtn = $("btnRefreshData");
    if (refreshBtn) {
      refreshBtn.addEventListener("click", (event) => {
        event.stopImmediatePropagation();
        checkHealth();
        initialLoad();
      }, true);
    }

    const filter = $("filterType");
    if (filter) {
      filter.addEventListener("change", (event) => {
        event.stopImmediatePropagation();
        refreshVisibleData();
      }, true);
    }

    const search = $("hospitalSearch");
    if (search) {
      search.addEventListener("input", (event) => {
        event.stopImmediatePropagation();
        clearTimeout(searchTimer);
        const q = search.value.trim();

        searchTimer = setTimeout(() => {
          if (!q) {
            hospitals = [...originalHospitals];
            refreshVisibleData();
            return;
          }

          if (q.length >= 2) searchByArea(q);
        }, 700);
      }, true);

      search.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          event.stopImmediatePropagation();
          clearTimeout(searchTimer);
          searchByArea(search.value);
        }
      }, true);
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    renderHistory();
    bindEvents();
    checkHealth();
    initialLoad();
  });
})();
