(() => {
  "use strict";

  const btn = document.getElementById("btnPlaySiren");
  const label = document.getElementById("sirenLabel");
  if (!btn) return;

  let audioCtx = null;
  let osc = null;
  let gain = null;
  let timer = null;
  let autoStopTimer = null;
  let running = false;
  let high = false;

  function setUi(on) {
    running = on;
    btn.setAttribute("aria-pressed", String(on));
    if (label) label.textContent = on ? "Stop Siren" : "Emergency Siren";
    const icon = btn.querySelector("i");
    if (icon) icon.className = on ? "fa-solid fa-volume-high" : "fa-solid fa-bullhorn";
  }

  async function startSiren() {
    if (running) return;

    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === "suspended") await audioCtx.resume();

      osc = audioCtx.createOscillator();
      gain = audioCtx.createGain();

      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(700, audioCtx.currentTime);

      gain.gain.setValueAtTime(0.0001, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.18, audioCtx.currentTime + 0.08);

      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();

      timer = setInterval(() => {
        if (!audioCtx || !osc) return;
        high = !high;
        const target = high ? 1100 : 700;
        const now = audioCtx.currentTime;
        osc.frequency.cancelScheduledValues(now);
        osc.frequency.setValueAtTime(osc.frequency.value, now);
        osc.frequency.linearRampToValueAtTime(target, now + 0.32);
      }, 360);

      autoStopTimer = setTimeout(stopSiren, 30000);
      setUi(true);
    } catch (err) {
      console.error("Siren could not start:", err);
      alert("The siren could not start. Make sure your device volume is on and tap again.");
      stopSiren();
    }
  }

  function stopSiren() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
    if (autoStopTimer) {
      clearTimeout(autoStopTimer);
      autoStopTimer = null;
    }

    try {
      if (gain && audioCtx) {
        const now = audioCtx.currentTime;
        gain.gain.cancelScheduledValues(now);
        gain.gain.setValueAtTime(Math.max(gain.gain.value, 0.0001), now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
      }
      if (osc) {
        const oldOsc = osc;
        const oldGain = gain;
        setTimeout(() => {
          try { oldOsc.stop(); } catch (_) {}
          try { oldOsc.disconnect(); } catch (_) {}
          try { oldGain && oldGain.disconnect(); } catch (_) {}
        }, 100);
      }
    } catch (_) {}

    osc = null;
    gain = null;
    setUi(false);
  }

  btn.addEventListener("click", () => {
    running ? stopSiren() : startSiren();
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden && running) stopSiren();
  });

  window.addEventListener("pagehide", stopSiren);
})();
