(() => {
  "use strict";

  const API_BASE = (
    window.PULSEPOINT_CONFIG?.API_BASE_URL ||
    "https://pulsepoint-api-x7fp.onrender.com/api"
  ).replace(/\/+$/, "");

  const $ = id => document.getElementById(id);
  const CACHE_PREFIX = "pulsepoint_hospital_search_v3:";
  const CACHE_TTL = 10 * 60 * 1000;
  const REQUEST_TIMEOUT = 65000;

  let hospitals = [];
  let originalHospitals = [];
  let directoryHospitals = [];
  let activeController = null;

  function api(path) {
    return `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;
  }

  function esc(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function num(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  function normalize(h) {
    const stock = h?.bloodStock && typeof h.bloodStock === "object"
      ? h.bloodStock
      : null;

    const bloodAvailable = Array.isArray(h?.bloodAvailable)
      ? h.bloodAvailable
      : [];

    return {
      id: h?.id || h?._id || h?.name || `hospital-${Math.random()}`,
      name: h?.name || "Unnamed hospital",
      address: h?.address || h?.location || "Address not reported",
      category: h?.category || "Hospital",
      phone: h?.phone || h?.contact || h?.emergencyLine || "",
      website: h?.website || "",
      lat: num(h?.lat ?? h?.latitude),
      lng: num(h?.lng ?? h?.longitude),
      distanceKm: num(h?.distanceKm),
      availableBeds: num(h?.availableBeds ?? h?.generalBeds),
      totalBeds: num(h?.totalBeds),
      icuBeds: num(h?.icuBeds),
      ventilators: num(h?.ventilators),
      bloodStock: stock,
      bloodTypes: stock
        ? Object.keys(stock).filter(k => Number(stock[k]) > 0)
        : bloodAvailable,
      doctors: Array.isArray(h?.doctors) ? h.doctors : [],
      organs: Array.isArray(h?.organs) ? h.organs : [],
      source: h?.source || "database",
      cachedLocationOnly: Boolean(h?.cachedLocationOnly)
    };
  }

  function setStatus(text) {
    const el = $("gpsStatusMessage");
    if (el) el.textContent = text;
  }

  function setBackendStatus(text) {
    const el = $("backendStatus");
    if (el) el.textContent = text;
  }

  function cacheKey(key) {
    return CACHE_PREFIX + String(key || "").trim().toLowerCase();
  }

  function saveCache(key, list) {
    if (!Array.isArray(list) || !list.length) return;
    try {
      sessionStorage.setItem(
        cacheKey(key),
        JSON.stringify({ time: Date.now(), data: list })
      );
    } catch (_) {}
  }

  function readCache(key) {
    try {
      const raw = sessionStorage.getItem(cacheKey(key));
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed?.data)) return null;
      return {
        data: parsed.data,
        ageMs: Date.now() - Number(parsed.time || 0),
        fresh: Date.now() - Number(parsed.time || 0) < CACHE_TTL
      };
    } catch (_) {
      return null;
    }
  }

  function cachedLocationsOnly(list) {
    return (list || []).map(item => normalize({
      ...item,
      availableBeds: null,
      generalBeds: null,
      totalBeds: null,
      icuBeds: null,
      ventilators: null,
      bloodStock: null,
      bloodAvailable: [],
      cachedLocationOnly: true,
      source: "cache-location"
    }));
  }

  function loading(message) {
    const box = $("hospitalsGrid");
    if (!box) return;
    box.innerHTML = `
      <div style="grid-column:1/-1;text-align:center;padding:28px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:14px;color:#166534;">
        <i class="fa-solid fa-spinner fa-spin"></i>
        <strong>${esc(message)}</strong>
      </div>`;
  }

  function problem(title, message) {
    const box = $("hospitalsGrid");
    if (!box) return;
    box.innerHTML = `
      <div style="grid-column:1/-1;text-align:center;padding:28px;background:#fff7ed;border:1px solid #fed7aa;border-radius:14px;color:#9a3412;">
        <i class="fa-solid fa-triangle-exclamation"></i><br>
        <strong>${esc(title)}</strong><br>
        <span style="font-size:.86rem">${esc(message)}</span>
      </div>`;
    renderMapButtons([]);
  }

  function bed(value) {
    return value == null
      ? '<span style="font-size:.82rem;color:#64748b">Not reported</span>'
      : esc(value);
  }

  function directionsUrl(h) {
    const destination = h.lat != null && h.lng != null
      ? `${h.lat},${h.lng}`
      : `${h.name} ${h.address}`;
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
  }

  function inventoryBadge(h) {
    if (h.cachedLocationOnly) {
      return '<span style="background:#fef3c7;color:#92400e;font-size:.72rem;font-weight:800;padding:5px 8px;border-radius:999px">Saved location · live availability unverified</span>';
    }

    const reported =
      h.availableBeds != null ||
      h.icuBeds != null ||
      h.ventilators != null ||
      h.bloodStock != null;

    return reported
      ? '<span style="background:#dcfce7;color:#166534;font-size:.72rem;font-weight:800;padding:5px 8px;border-radius:999px">Inventory reported</span>'
      : '<span style="background:#fff7ed;color:#9a3412;font-size:.72rem;font-weight:800;padding:5px 8px;border-radius:999px">Availability not reported</span>';
  }

  function renderHospitals(list) {
    const box = $("hospitalsGrid");
    if (!box) return;
    box.innerHTML = "";

    if (!list.length) {
      problem(
        "No mapped hospitals found",
        "Try another nearby town/city or use your current location."
      );
      return;
    }

    const grid = document.createElement("div");
    grid.style.cssText = "display:grid;grid-template-columns:repeat(auto-fit,minmax(290px,1fr));gap:16px;width:100%";

    list.forEach(h => {
      const card = document.createElement("article");
      card.className = "hospital-card";
      card.dataset.hospitalId = h.id;

      card.innerHTML = `
        <div class="hospital-card-header" style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start">
          <div>
            <h3 style="margin-bottom:5px">${esc(h.name)}</h3>
            <div class="hospital-meta"><i class="fa-solid fa-location-dot"></i> ${esc(h.address)}</div>
          </div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end">
            ${h.distanceKm != null ? `<span style="background:#e0f2fe;color:#075985;font-size:.72rem;font-weight:800;padding:5px 8px;border-radius:999px">${h.distanceKm.toFixed(1)} km</span>` : ""}
            ${inventoryBadge(h)}
          </div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:15px 0">
          <div style="padding:10px;border-radius:10px;background:#f0fdf4;border:1px solid #bbf7d0">
            <div style="font-size:.72rem;color:#166534;font-weight:700">GENERAL</div>
            <div style="font-size:1.1rem;font-weight:800;color:#15803d">${bed(h.availableBeds)}</div>
          </div>
          <div style="padding:10px;border-radius:10px;background:#fff7ed;border:1px solid #fed7aa">
            <div style="font-size:.72rem;color:#9a3412;font-weight:700">ICU</div>
            <div style="font-size:1.1rem;font-weight:800;color:#c2410c">${bed(h.icuBeds)}</div>
          </div>
          <div style="padding:10px;border-radius:10px;background:#eff6ff;border:1px solid #bfdbfe">
            <div style="font-size:.72rem;color:#1e40af;font-weight:700">VENTILATOR</div>
            <div style="font-size:1.1rem;font-weight:800;color:#1d4ed8">${bed(h.ventilators)}</div>
          </div>
        </div>

        <div style="font-size:.8rem;color:#64748b;margin-bottom:12px">
          <i class="fa-solid fa-circle-info"></i>
          ${h.source === "openstreetmap"
            ? "Location from OpenStreetMap. Availability appears only when reported to PulsePoint."
            : "Hospital information matched with PulsePoint inventory."}
        </div>

        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <a class="btn btn-green" href="${directionsUrl(h)}" target="_blank" rel="noopener" style="flex:1;justify-content:center">
            <i class="fa-solid fa-route"></i> Directions
          </a>
          ${h.phone
            ? `<a class="btn btn-emergency" href="tel:${esc(h.phone)}" style="flex:1;justify-content:center"><i class="fa-solid fa-phone"></i> Call</a>`
            : `<button class="btn btn-blue-outline" disabled style="flex:1;opacity:.55"><i class="fa-solid fa-phone-slash"></i> No phone</button>`}
        </div>`;

      card.addEventListener("click", event => {
        if (event.target.closest("a,button")) return;
        updateMap(h);
      });

      grid.appendChild(card);
    });

    box.appendChild(grid);
    renderMapButtons(list);
    updateMap(list[0]);
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

    const card = $("activeMapHospitalCard");
    if (card) {
      card.innerHTML = `
        <span class="badge badge-green">Selected hospital</span>
        <h3 style="margin:10px 0 6px">${esc(h.name)}</h3>
        <p style="color:#64748b"><i class="fa-solid fa-location-dot"></i> ${esc(h.address)}</p>
        ${h.distanceKm != null ? `<p><strong>${h.distanceKm.toFixed(1)} km</strong> away</p>` : ""}
        <a class="btn btn-green btn-block" target="_blank" rel="noopener" href="${directionsUrl(h)}">
          <i class="fa-solid fa-diamond-turn-right"></i> Open directions
        </a>`;
    }
  }

  function renderMapButtons(list) {
    const wrap = $("mapTargetPills");
    if (!wrap) return;
    wrap.innerHTML = "";

    list.slice(0, 6).forEach(h => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "pill";
      button.textContent = h.distanceKm != null
        ? `${h.name} · ${h.distanceKm.toFixed(1)} km`
        : h.name;
      button.addEventListener("click", () => updateMap(h));
      wrap.appendChild(button);
    });
  }

  function renderBlood(list) {
    const body = $("bloodTableBody");
    if (!body) return;
    body.innerHTML = "";

    list.forEach(h => {
      const stock = h.bloodStock || {};
      const value = group => {
        if (h.bloodStock) {
          const n = Number(stock[group] || 0);
          return n > 0 ? `✅ ${n}` : "—";
        }
        return h.bloodTypes.includes(group) ? "✅ Available" : "—";
      };

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${esc(h.name)}</td>
        <td>${value("O-")}</td>
        <td>${value("O+")}</td>
        <td>${value("A+")}</td>
        <td>${value("B+")}</td>
        <td>${value("AB+")}</td>
        <td>${h.phone ? `<a href="tel:${esc(h.phone)}">${esc(h.phone)}</a>` : "Not reported"}</td>`;
      body.appendChild(tr);
    });
  }


  function renderDoctors(spec = "all") {
    const grid = $("doctorsGrid");
    if (!grid) return;

    const rows = [];
    directoryHospitals.forEach(h => {
      (h.doctors || []).forEach(d => {
        rows.push({
          ...d,
          hospital: h.name
        });
      });
    });

    const visible = rows.filter(d =>
      spec === "all" || String(d.spec || "").toLowerCase() === String(spec).toLowerCase()
    );

    if (!visible.length) {
      grid.innerHTML = '<div style="grid-column:1/-1;padding:18px;border:1px solid #e2e8f0;border-radius:12px;color:#64748b;background:#f8fafc">No verified specialist schedule is currently reported for this filter.</div>';
      return;
    }

    grid.innerHTML = visible.map(d => `
      <article class="card card-clean">
        <div class="card-header">
          <h3><i class="fa-solid fa-user-doctor text-green"></i> ${esc(d.name || "Doctor")}</h3>
          <span class="badge badge-green">${esc(d.status || "Reported")}</span>
        </div>
        <p><strong>${esc(d.spec || "Specialist")}</strong></p>
        <p style="color:#64748b">${esc(d.designation || "")}</p>
        <p style="font-size:.82rem;color:#64748b"><i class="fa-solid fa-hospital"></i> ${esc(d.hospital || "")}</p>
      </article>
    `).join("");
  }

  function filtered() {
    const filter = $("filterType")?.value || "all";
    return hospitals.filter(h => {
      if (filter === "icu") return (h.icuBeds ?? 0) > 0;
      if (filter === "vent") return (h.ventilators ?? 0) > 0;
      if (filter === "govt") {
        return /(government|govt|rural hospital|district hospital|medical college)/i
          .test(`${h.name} ${h.address} ${h.category}`);
      }
      return true;
    });
  }

  function refresh() {
    const list = filtered();
    renderHospitals(list);
    renderBlood(list);

    window.dispatchEvent(new CustomEvent("pulsepoint:hospitals-updated", {
      detail: { hospitals: hospitals.map(h => ({ ...h })) }
    }));
  }

  function history() {
    try {
      return JSON.parse(localStorage.getItem("pulsepoint_recent_searches") || "[]");
    } catch (_) {
      return [];
    }
  }

  function saveHistory(query) {
    const q = String(query || "").trim();
    if (!q) return;
    const next = [q, ...history().filter(x => x.toLowerCase() !== q.toLowerCase())].slice(0, 5);
    localStorage.setItem("pulsepoint_recent_searches", JSON.stringify(next));
    renderHistory();
  }

  function renderHistory() {
    const input = $("hospitalSearch");
    if (!input) return;

    let box = $("pulsepointRecentSearches");
    if (!box) {
      box = document.createElement("div");
      box.id = "pulsepointRecentSearches";
      box.style.cssText = "width:100%;display:flex;gap:7px;flex-wrap:wrap;margin-top:8px;align-items:center";
      input.closest(".filter-controls")?.insertAdjacentElement("afterend", box);
    }

    const items = history();
    box.innerHTML = items.length
      ? '<span style="font-size:.76rem;color:#64748b;font-weight:700">Recent:</span>'
      : "";

    items.forEach(q => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "pill";
      b.style.fontSize = ".75rem";
      b.textContent = q;
      b.addEventListener("click", () => {
        input.value = q;
        searchArea(q);
      });
      box.appendChild(b);
    });
  }

  function updateLocationLabel(label) {
    document.querySelectorAll(".location-tag").forEach(el => {
      el.innerHTML = `<i class="fa-solid fa-location-dot"></i> ${esc(label)}`;
    });

    const subtitle = $("section-map")?.querySelector(".section-title p");
    if (subtitle) subtitle.textContent = `Hospitals discovered around ${label}.`;
  }

  async function fetchJson(url, { timeout = REQUEST_TIMEOUT, retries = 1, signal = null } = {}) {
    let lastError = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
      const controller = new AbortController();
      let timedOut = false;
      let forwardAbort = null;

      if (signal) {
        if (signal.aborted) {
          const err = new Error("Cancelled");
          err.code = "CANCELLED";
          throw err;
        }
        forwardAbort = () => controller.abort();
        signal.addEventListener("abort", forwardAbort, { once: true });
      }

      const timer = setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, timeout);

      try {
        const response = await fetch(url, {
          headers: { Accept: "application/json" },
          signal: controller.signal
        });

        let payload = null;
        try { payload = await response.json(); } catch (_) {}

        if (!response.ok) {
          const err = new Error(
            payload?.message || payload?.error || `HTTP ${response.status}`
          );
          err.status = response.status;
          err.code = payload?.code || null;

          const details = String(payload?.details || "");
          if (/map service|overpass|nominatim|temporarily unavailable/i.test(details)) {
            err.code = "MAP_SERVICE_UNAVAILABLE";
          }
          throw err;
        }

        return payload || {};
      } catch (error) {
        if (signal?.aborted) {
          const err = new Error("Cancelled");
          err.code = "CANCELLED";
          throw err;
        }

        if (timedOut) {
          lastError = new Error("Request timed out");
          lastError.code = "TIMEOUT";
        } else {
          lastError = error;
        }

        const retryable =
          lastError?.code === "TIMEOUT" ||
          lastError instanceof TypeError ||
          [429, 502, 503, 504].includes(lastError?.status);

        if (!retryable || attempt >= retries) throw lastError;
        await new Promise(resolve => setTimeout(resolve, 900 + attempt * 700));
      } finally {
        clearTimeout(timer);
        if (signal && forwardAbort) {
          signal.removeEventListener("abort", forwardAbort);
        }
      }
    }

    throw lastError || new Error("Request failed");
  }

  function friendly(error) {
    if (error?.code === "MAP_SERVICE_UNAVAILABLE") {
      return "Public map services are temporarily unavailable. Please retry in a moment.";
    }
    if (error?.code === "TIMEOUT") {
      return "Hospital lookup is taking too long. Please retry; backup providers will be tried automatically.";
    }
    if (error?.status === 429) {
      return "The public map service is busy. Wait a few seconds and retry.";
    }
    if ([502, 503, 504].includes(error?.status)) {
      return "The hospital lookup service is temporarily busy. Please retry shortly.";
    }
    return "Hospital search could not complete. Please retry.";
  }

  async function health() {
    setBackendStatus("Connecting to backend…");
    try {
      const result = await fetchJson(api("/health"), { timeout: 55000, retries: 0 });
      setBackendStatus(
        result.status === "ONLINE"
          ? "✅ Hospital discovery connected"
          : "⚠️ Backend responded"
      );
    } catch (_) {
      setBackendStatus("⚠️ Backend is waking up — try Refresh data");
    }
  }

  async function initialLoad() {
    loading("Loading hospital directory…");
    try {
      const result = await fetchJson(api("/hospitals"), { timeout: 55000, retries: 0 });
      hospitals = (result.data || []).map(normalize);
      originalHospitals = [...hospitals];
      directoryHospitals = [...hospitals];
      refresh();
      renderDoctors("all");
    } catch (error) {
      problem("Could not load hospital directory", friendly(error));
    }
  }

  async function searchArea(query) {
    const q = String(query || "").trim();
    if (q.length < 2) {
      setStatus("Enter at least 2 characters, then press Search.");
      return;
    }

    activeController?.abort();
    const controller = new AbortController();
    activeController = controller;
    const cached = readCache(`text:${q}`);

    loading(`Searching hospitals near ${q}…`);
    setStatus(`🔎 Searching near ${q}…`);

    try {
      const result = await fetchJson(
        api(`/hospitals?search=${encodeURIComponent(q)}`),
        { signal: controller.signal, retries: 1 }
      );

      if (controller.signal.aborted) return;

      hospitals = (result.data || [])
        .map(normalize)
        .sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));

      saveHistory(q);
      updateLocationLabel(q);

      if (hospitals.length) {
        saveCache(`text:${q}`, hospitals);
        refresh();
        setStatus(`✅ Found ${hospitals.length} hospital(s) around ${q} — nearest first.`);
      } else {
        problem(
          "No mapped hospitals found",
          `The map service responded normally, but no mapped hospitals were found around ${q}. Try a nearby town/city or Use my location.`
        );
        setStatus(`⚠️ No mapped hospitals were found around ${q}.`);
      }
    } catch (error) {
      if (error?.code === "CANCELLED") return;

      if (cached?.data?.length) {
        hospitals = cachedLocationsOnly(cached.data);
        updateLocationLabel(q);
        refresh();
        const mins = Math.max(1, Math.round(cached.ageMs / 60000));
        setStatus(`⚠️ Live lookup is busy. Showing saved hospital locations from about ${mins} minute(s) ago. Live bed/ICU availability is hidden until refreshed.`);
      } else {
        const message = friendly(error);
        problem("Live hospital lookup unavailable", message);
        setStatus(`⚠️ ${message}`);
      }
    } finally {
      if (activeController === controller) activeController = null;
    }
  }

  async function searchGps() {
    const button = $("btnGpsCalc");
    if (!navigator.geolocation) {
      setStatus("⚠️ This browser does not support location access.");
      return;
    }

    activeController?.abort();
    const oldHtml = button?.innerHTML;
    if (button) {
      button.disabled = true;
      button.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Locating…';
    }

    setStatus("📍 Getting your current location…");

    navigator.geolocation.getCurrentPosition(
      async position => {
        const { latitude, longitude } = position.coords;
        const key = `gps:${latitude.toFixed(3)},${longitude.toFixed(3)}`;
        const cached = readCache(key);
        const controller = new AbortController();
        activeController = controller;

        if (button) {
          button.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Searching hospitals…';
        }

        loading("Finding the nearest hospitals…");
        setStatus("🔎 Searching nearby hospitals…");

        try {
          const result = await fetchJson(
            api(`/hospitals/nearby?lat=${encodeURIComponent(latitude)}&lng=${encodeURIComponent(longitude)}&radius=30000&limit=30`),
            { signal: controller.signal, retries: 1 }
          );

          if (controller.signal.aborted) return;

          hospitals = (result.data || [])
            .map(normalize)
            .filter(h => h.lat != null && h.lng != null)
            .sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));

          if ($("hospitalSearch")) $("hospitalSearch").value = "";
          updateLocationLabel("Your current location");

          if (hospitals.length) {
            saveCache(key, hospitals);
            refresh();
            setStatus(`✅ ${hospitals.length} nearby hospital(s) found — closest first.`);
          } else {
            problem(
              "No mapped hospitals found",
              "The map service responded normally, but no mapped hospitals were found around your current location."
            );
            setStatus("⚠️ No mapped hospitals were found around your current location.");
          }
        } catch (error) {
          if (error?.code === "CANCELLED") return;

          if (cached?.data?.length) {
            hospitals = cachedLocationsOnly(cached.data);
            updateLocationLabel("Your current location");
            refresh();
            const mins = Math.max(1, Math.round(cached.ageMs / 60000));
            setStatus(`⚠️ Live lookup is busy. Showing saved nearby hospital locations from about ${mins} minute(s) ago. Live bed/ICU availability is hidden until refreshed.`);
          } else {
            const message = friendly(error);
            problem("Live hospital lookup unavailable", message);
            setStatus(`⚠️ ${message}`);
          }
        } finally {
          if (activeController === controller) activeController = null;
          if (button) {
            button.disabled = false;
            button.innerHTML = oldHtml;
          }
        }
      },
      error => {
        if (button) {
          button.disabled = false;
          button.innerHTML = oldHtml;
        }

        const messages = {
          1: "Location permission was denied. Allow location access in browser settings.",
          2: "Your current location is unavailable. Try again or search manually.",
          3: "Location detection timed out. Please retry."
        };
        setStatus(`⚠️ ${messages[error.code] || "Could not get your location."}`);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 }
    );
  }

  function ensureSearchButton() {
    const input = $("hospitalSearch");
    if (!input || $("btnHospitalSearch")) return;

    const button = document.createElement("button");
    button.id = "btnHospitalSearch";
    button.type = "button";
    button.className = "btn btn-green";
    button.style.whiteSpace = "nowrap";
    button.innerHTML = '<i class="fa-solid fa-magnifying-glass"></i> Search';
    input.insertAdjacentElement("afterend", button);
  }

  function bind() {
    ensureSearchButton();

    document.querySelectorAll("#doctorFilterPills .pill").forEach(btn => {
      btn.addEventListener("click", () => {
        document.querySelectorAll("#doctorFilterPills .pill").forEach(x => x.classList.remove("active"));
        btn.classList.add("active");
        renderDoctors(btn.dataset.spec || "all");
      });
    });

    $("btnGpsCalc")?.addEventListener("click", event => {
      event.preventDefault();
      event.stopImmediatePropagation();
      searchGps();
    }, true);

    $("btnRefreshData")?.addEventListener("click", event => {
      event.preventDefault();
      event.stopImmediatePropagation();
      health();
      initialLoad();
    }, true);

    $("filterType")?.addEventListener("change", event => {
      event.stopImmediatePropagation();
      refresh();
    }, true);

    const input = $("hospitalSearch");
    const button = $("btnHospitalSearch");

    const run = () => {
      const q = input?.value.trim() || "";
      if (!q) {
        hospitals = [...originalHospitals];
        refresh();
        setStatus("Type an area, then press Search or Enter.");
        return;
      }
      searchArea(q);
    };

    button?.addEventListener("click", run);

    input?.addEventListener("input", event => {
      event.stopImmediatePropagation();

      // No API call while typing. This prevents rate limits from partial text.
      if (!input.value.trim()) {
        activeController?.abort();
        activeController = null;
        hospitals = [...originalHospitals];
        refresh();
        setStatus("Type an area, then press Search or Enter.");
      }
    }, true);

    input?.addEventListener("keydown", event => {
      if (event.key === "Enter") {
        event.preventDefault();
        event.stopImmediatePropagation();
        run();
      }
    }, true);
  }

  window.PulsePointHospitalSearch = {
    getHospitals() {
      return hospitals.map(h => ({ ...h }));
    },
    updateInventoryLocal(id, patch) {
      hospitals = hospitals.map(h => h.id === id ? { ...h, ...patch } : h);
      originalHospitals = originalHospitals.map(h => h.id === id ? { ...h, ...patch } : h);
      refresh();
    },
    reload() {
      return initialLoad();
    },
    search(query) {
      return searchArea(query);
    }
  };

  document.addEventListener("DOMContentLoaded", () => {
    renderHistory();
    bind();
    health();
    initialLoad();
  });
})();
