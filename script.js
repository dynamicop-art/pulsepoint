// PulsePoint Emergency Care - Core Application Script
(function() {
  'use strict';

  // State Management
  const STATE = {
    user: {
      name: 'Guest Citizen',
      role: 'citizen',
      isLoggedIn: false
    },
    userCoordinates: null,
    activeHospitalId: 'kolaghat-rural',
    hospitals: [
      {
        id: 'kolaghat-rural',
        name: 'Kolaghat Rural Hospital',
        category: 'Government Trauma Care',
        lat: 22.4285,
        lng: 87.8715,
        address: 'Kolaghat Block Hospital Rd, Purba Medinipur, WB',
        phone: '+91 3228 255222',
        emergencyLine: '03228-255222',
        distanceKm: 1.2,
        icuBeds: 6,
        ventilators: 4,
        generalBeds: 45,
        rating: 4.6,
        bloodStock: { 'O-': 6, 'O+': 18, 'A+': 12, 'B+': 16, 'AB+': 8 },
        organs: [
          { organ: 'Cornea Tissue (Eye)', count: 2, status: 'Matching Ready' },
          { organ: 'Kidney Recipient List', count: 1, status: 'Donor Matching' }
        ],
        doctors: [
          { name: 'Dr. Debabrata Sen', spec: 'Trauma', designation: 'Emergency Surgery Lead', status: 'On Duty' },
          { name: 'Dr. Priyanka Maiti', spec: 'Cardiology', designation: 'Critical Care Cardiologist', status: 'On Duty' },
          { name: 'Dr. Subhash Bose', spec: 'Critical Care', designation: 'Chief Anesthetist', status: 'In ICU' }
        ]
      },
      {
        id: 'ktpp-medical',
        name: 'KTPP Medical Unit',
        category: 'Thermal Power Township Hospital',
        lat: 22.4168,
        lng: 87.8824,
        address: 'KTPP Township Campus, Mecheda Sector, WB',
        phone: '+91 3228 250100',
        emergencyLine: '03228-250100',
        distanceKm: 2.8,
        icuBeds: 4,
        ventilators: 2,
        generalBeds: 30,
        rating: 4.4,
        bloodStock: { 'O-': 3, 'O+': 12, 'A+': 9, 'B+': 11, 'AB+': 4 },
        organs: [
          { organ: 'Cornea Tissue (Eye)', count: 1, status: 'Harvesting Ready' }
        ],
        doctors: [
          { name: 'Dr. Anirban Ghosh', spec: 'Trauma', designation: 'Industrial Emergency Specialist', status: 'On Duty' },
          { name: 'Dr. Sharmila Das', spec: 'Critical Care', designation: 'General Medicine Lead', status: 'On Duty' }
        ]
      },
      {
        id: 'shusrusha-seva',
        name: 'Shusrusha Shishu Seva Niketan',
        category: 'Specialized Maternity & Pediatric Care',
        lat: 22.4350,
        lng: 87.8680,
        address: 'National Highway 6 Crossing, Kolaghat, WB',
        phone: '+91 98321 44550',
        emergencyLine: '+91 98321 44550',
        distanceKm: 1.8,
        icuBeds: 8, // NICU/PICU
        ventilators: 5,
        generalBeds: 40,
        rating: 4.7,
        bloodStock: { 'O-': 4, 'O+': 15, 'A+': 14, 'B+': 20, 'AB+': 7 },
        organs: [],
        doctors: [
          { name: 'Dr. Kakali Roy', spec: 'Pediatrics', designation: 'Senior Neonatologist', status: 'On Duty' },
          { name: 'Dr. Rajib Mukherjee', spec: 'Pediatrics', designation: 'Pediatric Surgeon', status: 'On Duty' }
        ]
      },
      {
        id: 'apollo-clinic',
        name: 'Apollo Hospital & Emergency Clinic',
        category: 'Multi-Specialty Private Clinic',
        lat: 22.4310,
        lng: 87.8760,
        address: 'Near Old Bus Stand, Kolaghat Main Road, WB',
        phone: '+91 3228 256888',
        emergencyLine: '03228-256888',
        distanceKm: 2.1,
        icuBeds: 5,
        ventilators: 3,
        generalBeds: 25,
        rating: 4.5,
        bloodStock: { 'O-': 2, 'O+': 10, 'A+': 8, 'B+': 14, 'AB+': 5 },
        organs: [
          { organ: 'Liver Registry Check', count: 1, status: 'Crossmatch Waitlist' }
        ],
        doctors: [
          { name: 'Dr. S. K. Bhattacharya', spec: 'Cardiology', designation: 'Interventional Cardiologist', status: 'On Duty' },
          { name: 'Dr. Tanmoy Samanta', spec: 'Trauma', designation: 'Orthopedic Trauma Surgeon', status: 'On Duty' }
        ]
      },
      {
        id: 'tamluk-hospital',
        name: 'Tamluk Super-Speciality Hospital',
        category: 'District Apex Referral Centre',
        lat: 22.2986,
        lng: 87.9285,
        address: 'Tamluk District Headquarter, Purba Medinipur, WB',
        phone: '+91 3228 266001',
        emergencyLine: '03228-266001',
        distanceKm: 14.5,
        icuBeds: 24,
        ventilators: 16,
        generalBeds: 180,
        rating: 4.8,
        bloodStock: { 'O-': 14, 'O+': 45, 'A+': 38, 'B+': 52, 'AB+': 22 },
        organs: [
          { organ: 'Kidney Matched Donors', count: 3, status: 'Green Corridor Ready' },
          { organ: 'Cornea Bank', count: 6, status: 'Immediate Allocation' }
        ],
        doctors: [
          { name: 'Dr. Manas Chakraborty', spec: 'Trauma', designation: 'Chief Trauma Director', status: 'In Surgery' },
          { name: 'Dr. Sujata Mukherjee', spec: 'Cardiology', designation: 'Cath Lab Director', status: 'On Duty' },
          { name: 'Dr. Arnab Nandi', spec: 'Critical Care', designation: 'ICU Head', status: 'On Duty' }
        ]
      }
    ],
    audioContext: null,
    sirenOscillator: null,
    isSirenPlaying: false
  };

  // Helper Functions
  function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Radius of earth in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return parseFloat((R * c).toFixed(1));
  }

  function getActiveHospital() {
    return STATE.hospitals.find(h => h.id === STATE.activeHospitalId) || STATE.hospitals[0];
  }

  // Audio Siren Synthesis
  function toggleSiren() {
    const btn = document.getElementById('btnPlaySiren');
    const label = document.getElementById('sirenLabel');

    if (!STATE.isSirenPlaying) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!STATE.audioContext) {
        STATE.audioContext = new AudioContext();
      }

      const osc = STATE.audioContext.createOscillator();
      const gain = STATE.audioContext.createGain();

      osc.type = 'sawtooth';
      gain.gain.setValueAtTime(0.15, STATE.audioContext.currentTime);

      const now = STATE.audioContext.currentTime;
      osc.frequency.setValueAtTime(650, now);
      osc.frequency.linearRampToValueAtTime(950, now + 0.4);

      // Simple periodic modulation
      const lfo = STATE.audioContext.createOscillator();
      lfo.frequency.value = 2.5; // 2.5 Hz wail
      const lfoGain = STATE.audioContext.createGain();
      lfoGain.gain.value = 300;
      lfo.connect(osc.frequency);
      lfo.start();

      osc.connect(gain);
      gain.connect(STATE.audioContext.destination);
      osc.start();

      STATE.sirenOscillator = { osc, lfo, gain };
      STATE.isSirenPlaying = true;
      btn.classList.add('btn-blue');
      btn.classList.remove('btn-blue-outline');
      label.textContent = 'Mute Siren';
    } else {
      if (STATE.sirenOscillator) {
        STATE.sirenOscillator.osc.stop();
        STATE.sirenOscillator.lfo.stop();
      }
      STATE.isSirenPlaying = false;
      btn.classList.remove('btn-blue');
      btn.classList.add('btn-blue-outline');
      label.textContent = 'Emergency Siren';
    }
  }

  // Render Map Card & Controls
  function renderMapControls() {
    const pillsContainer = document.getElementById('mapTargetPills');
    pillsContainer.innerHTML = STATE.hospitals.map(h => `
      <button class="pill ${h.id === STATE.activeHospitalId ? 'active' : ''}" data-id="${h.id}">
        <i class="fa-solid fa-location-pin"></i> ${h.name.split(' ')[0]}
      </button>
    `).join('');

    pillsContainer.querySelectorAll('.pill').forEach(btn => {
      btn.addEventListener('click', () => {
        STATE.activeHospitalId = btn.getAttribute('data-id');
        updateMapView();
        renderMapControls();
        renderInspector();
      });
    });
  }

  function updateMapView() {
    const hosp = getActiveHospital();
    const iframe = document.getElementById('googleMapIframe');
    const query = encodeURIComponent(`${hosp.name}, ${hosp.address}`);
    iframe.src = `https://maps.google.com/maps?q=${query}&t=&z=14&ie=UTF8&iwloc=&output=embed`;

    const sideCard = document.getElementById('activeMapHospitalCard');
    sideCard.innerHTML = `
      <div>
        <div class="badge badge-green mb-2"><i class="fa-solid fa-map-pin"></i> Targeted On Map</div>
        <h3 style="font-size: 17px; margin-top: 6px; font-weight:800; color:var(--slate-900);">${hosp.name}</h3>
        <p style="font-size: 12px; color:var(--slate-600); margin-top: 4px;">${hosp.address}</p>
        
        <div class="bed-telemetry-row" style="margin: 16px 0;">
          <div>
            <div class="bed-stat-val text-blue">${hosp.icuBeds}</div>
            <div class="bed-stat-lbl">ICU Free</div>
          </div>
          <div>
            <div class="bed-stat-val text-green">${hosp.ventilators}</div>
            <div class="bed-stat-lbl">Ventilators</div>
          </div>
          <div>
            <div class="bed-stat-val">${hosp.distanceKm} km</div>
            <div class="bed-stat-lbl">Distance</div>
          </div>
        </div>
      </div>

      <div style="display:flex; flex-direction:column; gap:8px;">
        <a href="https://www.google.com/maps/dir/?api=1&destination=${hosp.lat},${hosp.lng}" 
           target="_blank" 
           class="btn btn-green btn-block">
          <i class="fa-solid fa-diamond-turn-right"></i> Open Google GPS Navigation
        </a>
        <a href="tel:${hosp.phone}" class="btn btn-blue-outline btn-block">
          <i class="fa-solid fa-phone-volume"></i> Call Desk: ${hosp.phone}
        </a>
      </div>
    `;
  }

  // Render Hospitals Directory
  function renderHospitals() {
    const grid = document.getElementById('hospitalsGrid');
    const searchVal = (document.getElementById('hospitalSearch').value || '').toLowerCase();
    const filterType = document.getElementById('filterType').value;

    let filtered = STATE.hospitals.filter(h => {
      const matchSearch = h.name.toLowerCase().includes(searchVal) || h.address.toLowerCase().includes(searchVal);
      if (!matchSearch) return false;

      if (filterType === 'icu') return h.icuBeds > 0;
      if (filterType === 'vent') return h.ventilators > 0;
      if (filterType === 'govt') return h.category.toLowerCase().includes('govt') || h.category.toLowerCase().includes('rural') || h.category.toLowerCase().includes('district');
      return true;
    });

    grid.innerHTML = filtered.map(h => `
      <div class="hospital-card">
        <div>
          <div class="hospital-card-header">
            <div>
              <h3>${h.name}</h3>
              <span class="badge badge-slate" style="margin-top:4px;">${h.category}</span>
            </div>
            <span class="distance-badge"><i class="fa-solid fa-route"></i> ${h.distanceKm} km</span>
          </div>

          <div class="hospital-meta" style="margin: 12px 0;">
            <div><i class="fa-solid fa-location-dot text-blue"></i> ${h.address}</div>
            <div><i class="fa-solid fa-phone text-green"></i> ${h.phone}</div>
          </div>

          <div class="bed-telemetry-row">
            <div>
              <div class="bed-stat-val text-blue">${h.icuBeds}</div>
              <div class="bed-stat-lbl">ICU Beds</div>
            </div>
            <div>
              <div class="bed-stat-val text-green">${h.ventilators}</div>
              <div class="bed-stat-lbl">Ventilators</div>
            </div>
            <div>
              <div class="bed-stat-val">${h.generalBeds}</div>
              <div class="bed-stat-lbl">General</div>
            </div>
          </div>
        </div>

        <div class="hospital-card-actions">
          <button class="btn btn-green btn-inspect" data-id="${h.id}" style="flex:1;">
            <i class="fa-solid fa-magnifying-glass-plus"></i> Inspect
          </button>
          <a href="https://www.google.com/maps/dir/?api=1&destination=${h.lat},${h.lng}" target="_blank" class="btn btn-dark" title="Directions">
            <i class="fa-solid fa-directions"></i>
          </a>
          <a href="tel:${h.phone}" class="btn btn-blue" title="Call Emergency Desk">
            <i class="fa-solid fa-phone"></i>
          </a>
        </div>
      </div>
    `).join('');

    grid.querySelectorAll('.btn-inspect').forEach(btn => {
      btn.addEventListener('click', () => {
        STATE.activeHospitalId = btn.getAttribute('data-id');
        updateMapView();
        renderMapControls();
        renderInspector();
        document.getElementById('section-inspector').scrollIntoView({ behavior: 'smooth' });
      });
    });
  }

  // Render Section 4: Detailed Facility Inspector (Zero Popups)
  function renderInspector() {
    const hosp = getActiveHospital();
    const container = document.getElementById('inspectorCard');

    const doctorsList = hosp.doctors.map(d => `
      <div style="background:var(--slate-100); padding:10px; border-radius:6px; font-size:12.5px;">
        <strong>${d.name}</strong> - <span style="color:var(--slate-600);">${d.designation}</span>
        <div style="margin-top:4px;"><span class="badge badge-green">${d.status}</span></div>
      </div>
    `).join('') || '<p style="font-size:12px; color:var(--slate-600);">No specific specialist roster published for this wing.</p>';

    const organsList = hosp.organs.map(o => `
      <div style="background:var(--light-green); padding:8px 12px; border-radius:6px; font-size:12px; margin-bottom:6px; display:flex; justify-content:space-between;">
        <strong><i class="fa-solid fa-check"></i> ${o.organ} (${o.count})</strong>
        <span>${o.status}</span>
      </div>
    `).join('') || '<p style="font-size:12px; color:var(--slate-600);">No transplant registry harvest unit stationed here.</p>';

    container.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:12px; margin-bottom:16px;">
        <div>
          <span class="badge badge-blue mb-1"><i class="fa-solid fa-hospital-user"></i> Active Selected Inspection</span>
          <h3 style="font-size:20px; font-weight:800; color:var(--slate-900); margin-top:4px;">${hosp.name}</h3>
          <p style="font-size:13px; color:var(--slate-600);">${hosp.address} | <strong>Emergency Desk:</strong> ${hosp.emergencyLine}</p>
        </div>
        <div style="display:flex; gap:8px;">
          <a href="https://www.google.com/maps/dir/?api=1&destination=${hosp.lat},${hosp.lng}" target="_blank" class="btn btn-green">
            <i class="fa-solid fa-diamond-turn-right"></i> Direct GPS Route
          </a>
          <a href="tel:${hosp.phone}" class="btn btn-blue">
            <i class="fa-solid fa-phone"></i> Call Facility
          </a>
        </div>
      </div>

      <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:12px; margin-bottom:20px;">
        <div style="background:var(--light-blue); border:1px solid var(--primary-blue); padding:12px; border-radius:8px;">
          <div style="font-size:24px; font-weight:800; color:var(--dark-blue);">${hosp.icuBeds}</div>
          <div style="font-size:12px; font-weight:700; color:var(--dark-blue);">Critical ICU Beds Open</div>
        </div>
        <div style="background:var(--light-green); border:1px solid var(--primary-green); padding:12px; border-radius:8px;">
          <div style="font-size:24px; font-weight:800; color:var(--dark-green);">${hosp.ventilators}</div>
          <div style="font-size:12px; font-weight:700; color:var(--dark-green);">Active Oxygen Ventilators</div>
        </div>
        <div style="background:var(--slate-100); border:1px solid var(--slate-200); padding:12px; border-radius:8px;">
          <div style="font-size:24px; font-weight:800; color:var(--slate-900);">${hosp.generalBeds}</div>
          <div style="font-size:12px; font-weight:700; color:var(--slate-700);">General Admission Beds</div>
        </div>
        <div style="background:var(--slate-100); border:1px solid var(--slate-200); padding:12px; border-radius:8px;">
          <div style="font-size:24px; font-weight:800; color:var(--slate-900);">${hosp.bloodStock['O-']} Units</div>
          <div style="font-size:12px; font-weight:700; color:var(--slate-700);">O- Universal Blood Units</div>
        </div>
      </div>

      <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px;">
        <div>
          <h4 style="font-size:14px; font-weight:700; margin-bottom:8px;"><i class="fa-solid fa-user-doctor text-green"></i> On-Duty Specialist Roster</h4>
          <div style="display:flex; flex-direction:column; gap:8px;">
            ${doctorsList}
          </div>
        </div>
        <div>
          <h4 style="font-size:14px; font-weight:700; margin-bottom:8px;"><i class="fa-solid fa-dna text-blue"></i> Organ & Tissue Bank</h4>
          <div>
            ${organsList}
          </div>
        </div>
      </div>
    `;
  }

  // Render Blood & Organ Section
  function renderBloodAndOrgans() {
    // Summary Chips
    const chipsContainer = document.getElementById('bloodSummaryChips');
    const totalStock = { 'O-': 0, 'O+': 0, 'A+': 0, 'B+': 0, 'AB+': 0 };
    STATE.hospitals.forEach(h => {
      Object.keys(totalStock).forEach(type => {
        totalStock[type] += (h.bloodStock[type] || 0);
      });
    });

    chipsContainer.innerHTML = Object.keys(totalStock).map(type => `
      <div class="blood-chip ${totalStock[type] < 15 ? 'critical' : ''}">
        <strong>${type}</strong>
        <span>${totalStock[type]} Total Units</span>
      </div>
    `).join('');

    // Table
    const tbody = document.getElementById('bloodTableBody');
    tbody.innerHTML = STATE.hospitals.map(h => `
      <tr>
        <td><strong>${h.name}</strong></td>
        <td><span class="badge ${h.bloodStock['O-'] < 4 ? 'badge-blue' : 'badge-green'}">${h.bloodStock['O-']}</span></td>
        <td>${h.bloodStock['O+']}</td>
        <td>${h.bloodStock['A+']}</td>
        <td>${h.bloodStock['B+']}</td>
        <td>${h.bloodStock['AB+']}</td>
        <td><a href="tel:${h.phone}" class="btn btn-sm btn-green"><i class="fa-solid fa-phone"></i> Call</a></td>
      </tr>
    `).join('');

    // Organ List
    const organContainer = document.getElementById('organListContainer');
    const allOrgans = [];
    STATE.hospitals.forEach(h => {
      (h.organs || []).forEach(o => {
        allOrgans.push({ ...o, hospitalName: h.name });
      });
    });

    organContainer.innerHTML = allOrgans.map(o => `
      <div class="organ-item">
        <div>
          <strong>${o.organ} (${o.count} Available)</strong>
          <p style="font-size:11px; color:var(--slate-600); margin:0;">Facility: ${o.hospitalName}</p>
        </div>
        <span class="badge badge-green">${o.status}</span>
      </div>
    `).join('');
  }

  // Render Doctors Directory
  function renderDoctors(selectedSpec = 'all') {
    const grid = document.getElementById('doctorsGrid');
    const allDoctors = [];
    STATE.hospitals.forEach(h => {
      (h.doctors || []).forEach(d => {
        allDoctors.push({ ...d, hospitalName: h.name, hospitalPhone: h.phone });
      });
    });

    let filtered = allDoctors;
    if (selectedSpec !== 'all') {
      filtered = allDoctors.filter(d => d.spec === selectedSpec);
    }

    grid.innerHTML = filtered.map(d => `
      <div class="doctor-card">
        <div class="doctor-info-top">
          <div class="doctor-avatar"><i class="fa-solid fa-user-doctor"></i></div>
          <div class="doctor-name-title">
            <h4>${d.name}</h4>
            <span>${d.designation}</span>
          </div>
        </div>
        <div>
          <div style="font-size:12px; color:var(--slate-600); margin-bottom:4px;">
            <i class="fa-solid fa-hospital"></i> ${d.hospitalName}
          </div>
          <span class="badge badge-green">${d.status}</span>
        </div>
        <a href="tel:${d.hospitalPhone}" class="btn btn-sm btn-green btn-block">
          <i class="fa-solid fa-phone"></i> Casualty Ext: ${d.hospitalPhone}
        </a>
      </div>
    `).join('');
  }

  // Populate Staff Hospital Dropdown
  function populateStaffDropdown() {
    const select = document.getElementById('staffSelectHospital');
    select.innerHTML = STATE.hospitals.map(h => `<option value="${h.id}">${h.name}</option>`).join('');
    syncStaffInputs();
  }

  function syncStaffInputs() {
    const hospId = document.getElementById('staffSelectHospital').value;
    const hosp = STATE.hospitals.find(h => h.id === hospId);
    if (!hosp) return;

    document.getElementById('staffIcuBeds').value = hosp.icuBeds;
    document.getElementById('staffVentilators').value = hosp.ventilators;
    document.getElementById('staffGeneralBeds').value = hosp.generalBeds;
    document.getElementById('staffONegUnits').value = hosp.bloodStock['O-'] || 0;
    document.getElementById('staffABPosUnits').value = hosp.bloodStock['AB+'] || 0;
  }

  // Geolocation Setup
  function initGeolocation() {
    const banner = document.getElementById('gpsStatusMessage');
    banner.textContent = 'Acquiring GPS coordinates from browser...';

    if (!navigator.geolocation) {
      banner.textContent = 'Geolocation is not supported by your browser.';
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        STATE.userCoordinates = { lat: latitude, lng: longitude };
        banner.innerHTML = `<i class="fa-solid fa-check"></i> GPS Located: (${latitude.toFixed(4)}, ${longitude.toFixed(4)}). Distances and route times updated.`;

        // Recalculate hospital distances
        STATE.hospitals.forEach(h => {
          h.distanceKm = calculateDistance(latitude, longitude, h.lat, h.lng);
        });

        // Re-sort by closest
        STATE.hospitals.sort((a, b) => a.distanceKm - b.distanceKm);

        renderHospitals();
        renderMapControls();
        updateMapView();
        renderInspector();
      },
      (err) => {
        banner.textContent = 'Unable to retrieve location (permission denied or timeout). Using default Kolaghat center point.';
      }
    );
  }

  // Event Listeners Setup
  function setupEventListeners() {
    // Siren
    document.getElementById('btnPlaySiren').addEventListener('click', toggleSiren);

    // Strobe Alert
    document.getElementById('btnStrobe').addEventListener('click', () => {
      document.body.classList.toggle('strobe-alert');
      const btn = document.getElementById('btnStrobe');
      if (document.body.classList.contains('strobe-alert')) {
        btn.classList.add('btn-blue');
        btn.classList.remove('btn-blue-outline');
      } else {
        btn.classList.remove('btn-blue');
        btn.classList.add('btn-blue-outline');
      }
    });

    // GPS Button
    document.getElementById('btnGpsCalc').addEventListener('click', initGeolocation);

    // Copy SOS Dispatch Link
    document.getElementById('btnShareSms').addEventListener('click', () => {
      const activeHosp = getActiveHospital();
      const text = `EMERGENCY SOS: Heading to ${activeHosp.name}. Contact: ${activeHosp.emergencyLine}. Location: https://maps.google.com/?q=${activeHosp.lat},${activeHosp.lng}`;
      navigator.clipboard.writeText(text).then(() => {
        alert('Copied Emergency Dispatch Message to Clipboard:\n\n' + text);
      }).catch(() => {
        alert('Emergency Info: ' + text);
      });
    });

    // Search & Filter
    document.getElementById('hospitalSearch').addEventListener('input', renderHospitals);
    document.getElementById('filterType').addEventListener('change', renderHospitals);

    // Doctor Filters
    document.getElementById('doctorFilterPills').querySelectorAll('.pill').forEach(btn => {
      btn.addEventListener('click', () => {
        document.getElementById('doctorFilterPills').querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        renderDoctors(btn.getAttribute('data-spec'));
      });
    });

    // Requisition Form
    document.getElementById('requisitionForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const name = document.getElementById('reqName').value;
      const item = document.getElementById('reqItem').value;
      const units = document.getElementById('reqUnits').value;
      const hospital = document.getElementById('reqHospital').value;
      const notice = document.getElementById('requisitionNotice');

      notice.innerHTML = `<span style="color:var(--dark-green);"><i class="fa-solid fa-circle-check"></i> Requisition broadcasted to state pool for ${units}x ${item} for patient ${name} at ${hospital}.</span>`;
      setTimeout(() => { notice.innerHTML = ''; }, 6000);
      e.target.reset();
    });

    // Auth Demo Fill Buttons
    document.getElementById('btnFillPatient').addEventListener('click', () => {
      document.getElementById('authEmail').value = 'citizen.kolaghat@gmail.com';
      document.getElementById('authRole').value = 'citizen';
    });

    document.getElementById('btnFillStaff').addEventListener('click', () => {
      document.getElementById('authEmail').value = 'emt.officer@wbhealth.gov.in';
      document.getElementById('authRole').value = 'staff';
    });

    // Auth Form Submit
    document.getElementById('authForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const email = document.getElementById('authEmail').value;
      const role = document.getElementById('authRole').value;
      const notice = document.getElementById('authNotice');

      STATE.user.isLoggedIn = true;
      STATE.user.name = email.split('@')[0];
      STATE.user.role = role;

      document.getElementById('userStatusText').textContent = `${STATE.user.name} (${role === 'staff' ? 'Hospital EMT' : 'Citizen'})`;
      document.getElementById('activeRoleTag').textContent = `Role: ${role.toUpperCase()}`;

      if (role === 'staff') {
        document.getElementById('staffLockBadge').className = 'badge badge-green';
        document.getElementById('staffLockBadge').innerHTML = '<i class="fa-solid fa-unlock"></i> Editor Unlocked';
        document.getElementById('btnStaffBroadcast').disabled = false;
      } else {
        document.getElementById('staffLockBadge').className = 'badge badge-blue';
        document.getElementById('staffLockBadge').innerHTML = '<i class="fa-solid fa-lock"></i> Staff Login Required';
        document.getElementById('btnStaffBroadcast').disabled = true;
      }

      notice.innerHTML = `<span style="color:var(--dark-green);"><i class="fa-solid fa-circle-check"></i> Logged in successfully as ${role.toUpperCase()}.</span>`;
      setTimeout(() => { notice.innerHTML = ''; }, 4000);
    });

    // Staff Dropdown Change
    document.getElementById('staffSelectHospital').addEventListener('change', syncStaffInputs);

    // Staff Broadcast Update Form
    document.getElementById('staffUpdateForm').addEventListener('submit', (e) => {
      e.preventDefault();
      if (STATE.user.role !== 'staff') {
        alert('You must be logged in as Hospital Staff / Medical Officer to update live telemetry.');
        return;
      }

      const hospId = document.getElementById('staffSelectHospital').value;
      const hosp = STATE.hospitals.find(h => h.id === hospId);
      if (!hosp) return;

      hosp.icuBeds = parseInt(document.getElementById('staffIcuBeds').value, 10);
      hosp.ventilators = parseInt(document.getElementById('staffVentilators').value, 10);
      hosp.generalBeds = parseInt(document.getElementById('staffGeneralBeds').value, 10);
      hosp.bloodStock['O-'] = parseInt(document.getElementById('staffONegUnits').value, 10);
      hosp.bloodStock['AB+'] = parseInt(document.getElementById('staffABPosUnits').value, 10);

      const notice = document.getElementById('staffNotice');
      notice.innerHTML = `<span style="color:var(--dark-green);"><i class="fa-solid fa-tower-broadcast"></i> Telemetry for ${hosp.name} successfully updated across the regional grid!</span>`;
      setTimeout(() => { notice.innerHTML = ''; }, 5000);

      // Re-render affected sections
      renderHospitals();
      renderBloodAndOrgans();
      renderInspector();
      updateMapView();
    });
  }

  // Initialization
  function init() {
    renderMapControls();
    updateMapView();
    renderHospitals();
    renderInspector();
    renderBloodAndOrgans();
    renderDoctors('all');
    populateStaffDropdown();
    setupEventListeners();
  }

  window.addEventListener('DOMContentLoaded', init);
})();
