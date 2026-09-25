try {
  const response = await fetch(
    `${API_BASE_URL}/api/hospitals/nearby?lat=${latitude}&lng=${longitude}&radius=15000&limit=30`
  );

  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const result = await response.json();
  const raw = result.data || [];

  allHospitals = raw.map(normalizeHospital);

  // backend already sorts by distance, but re-sort defensively
  allHospitals.sort(
    (a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity)
  );

  renderFacilityCards(
    allHospitals,
    document.getElementById("hospitalsGrid")
  );

  renderBloodMatrix(allHospitals);

  setStatus(
    allHospitals.length
      ? `✅ Found ${allHospitals.length} hospital(s) near your current location.`
      : "🔍 No hospitals found near your current location."
  );
