(() => {
  const songs = globalThis.VECHER_SONGS;
  const rules = globalThis.VecherWheel;
  const catalog = new Map(songs.map((song) => [song.id, song]));
  const proposers = [...new Set(songs.flatMap((song) => song.authors))]
    .sort((a, b) => a.localeCompare(b, "ru"));
  const $ = (id) => document.getElementById(id);
  const title = $("title");
  const titleSlot = title.parentElement;
  const titleSizes = new Map();
  const canvas = $("wheel");
  const pointer = document.querySelector(".pointer");
  const paint = canvas.getContext("2d");
  const celebration = $("confetti");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const palette = ["#7d359c", "#a63c83", "#4c4ac5", "#337c9f", "#a84b9d", "#5944a9", "#336b9f", "#97487e"];
  const state = rules.restore({ getItem: (key) => localStorage.getItem(key) }, catalog);
  $("proposer-count").textContent = proposers.length;
  $("reaction-count").textContent = globalThis.VECHER_REACTION_COUNT;
  let active = [];
  let angle = 0;
  let spinning = false;
  let showing = state.draws.at(-1) ?? null;
  let previousDrawn = new Set();
  let buyers = [];
  let celebrationFrame = 0;
  let audio;

  function save() {
    try {
      localStorage.setItem(rules.storageKey, JSON.stringify(state));
    } catch {
      $("storage-note").hidden = false;
    }
  }

  function fitTitle() {
    const key = title.textContent;
    if (!titleSizes.has(key)) {
      title.style.fontSize = "";
      if (title.offsetHeight > titleSlot.clientHeight) {
        const baseSize = Number.parseFloat(getComputedStyle(title).fontSize);
        let size = baseSize;
        while (title.offsetHeight > titleSlot.clientHeight && size > baseSize * .45) {
          size *= .86;
          title.style.fontSize = `${size}px`;
        }
      }
      titleSizes.set(key, title.style.fontSize);
    }
    title.style.fontSize = titleSizes.get(key);
  }

  function labelSong(song) {
    $("artist").textContent = song?.artist ?? "";
    title.textContent = song?.title ?? (active.length ? "Что споём?" : "Все песни спеты");
    fitTitle();
  }

  function renderParticipants(highlightNew) {
    const { waiting, drawn } = rules.participantProgress(proposers, state.draws, catalog);
    for (const [group, names] of [["waiting", waiting], ["drawn", drawn]]) {
      $(`${group}-count`).textContent = names.length;
      $(`${group}-empty`).hidden = names.length > 0;
      $(`${group}-people`).replaceChildren(...names.map((name) => {
        const chip = document.createElement("li");
        chip.textContent = name;
        if (highlightNew && group === "drawn" && !previousDrawn.has(name)) chip.classList.add("newly-drawn");
        return chip;
      }));
    }
    previousDrawn = new Set(drawn);
  }

  function render(highlightNew = false) {
    const sungIds = new Set(state.draws.filter((draw) => draw.sung).map((draw) => draw.id));
    active = songs.filter((song) => !sungIds.has(song.id));
    const result = showing && catalog.get(showing.id);
    $("remaining").textContent = active.length;
    $("sung-count").textContent = sungIds.size;
    $("status").textContent = result ? (showing.sung ? "Спели!" : showing.buyer ? "Песня за жетон" : "Выпала песня") : "Розыгрыш";
    labelSong(result);
    $("description").hidden = Boolean(result);
    $("description").textContent = active.length
      ? "Крути колесо и узнай, какая песня прозвучит следующей."
      : "Можно сбросить вечер и сыграть ещё раз.";
    $("result-details").hidden = !result;
    if (result) {
      $("result-authors").textContent = result.authors.join(", ");
      $("result-reactions").textContent = result.reactions;
    }
    renderParticipants(highlightNew);
    buyers = proposers.filter((name) => rules.songsForToken(name, active, state.draws).length > 0);
    $("spin").disabled = !active.length;
    $("buy").disabled = !buyers.length;
    $("spin").textContent = result ? "Крутить ещё" : "Крутить колесо";
    $("sung").hidden = !result || showing.sung;
    $("undo").hidden = !sungIds.size;
    $("reset").disabled = !state.draws.length;
    $("empty").hidden = !!state.draws.length;
    $("history-count").textContent = state.draws.length;
    $("sound").textContent = state.muted ? "Звук выкл." : "Звук вкл.";
    $("sound").setAttribute("aria-pressed", !state.muted);
    $("history").replaceChildren(...state.draws.slice().reverse().map((draw, index) => {
      const song = catalog.get(draw.id);
      const item = document.createElement("li");
      const name = document.createElement("span");
      name.textContent = `${state.draws.length - index}. ${song.artist} · ${song.title}`;
      const status = document.createElement("span");
      status.textContent = draw.buyer
        ? (draw.sung ? "Спели · За жетон" : "За жетон")
        : (draw.sung ? "Спели" : "Выпала");
      item.append(name, status);
      return item;
    }));
    drawWheel();
  }

  function drawWheel() {
    const size = canvas.width;
    const radius = size / 2;
    const count = active.length;
    const tau = Math.PI * 2;
    paint.clearRect(0, 0, size, size);
    paint.save();
    paint.translate(radius, radius);
    paint.beginPath();
    paint.arc(0, 0, radius * 0.995, 0, tau);
    paint.fillStyle = "#271838";
    paint.fill();
    const rim = radius * 0.94;
    for (let index = 0; index < count; index++) {
      const start = -Math.PI / 2 + angle + index / count * tau;
      const end = start + tau / count;
      paint.beginPath();
      paint.moveTo(0, 0);
      paint.arc(0, 0, rim, start, end);
      paint.closePath();
      paint.fillStyle = palette[Math.floor(index * 16 / count) % palette.length];
      paint.fill();
      if (count > 1) {
        paint.beginPath();
        paint.moveTo(radius * 0.26 * Math.cos(start), radius * 0.26 * Math.sin(start));
        paint.lineTo(rim * Math.cos(start), rim * Math.sin(start));
        paint.strokeStyle = "#13092265";
        paint.lineWidth = Math.max(1, radius / 255);
        paint.stroke();
      }
    }
    const glaze = paint.createRadialGradient(0, 0, radius * .15, 0, 0, rim);
    glaze.addColorStop(0, "#100720aa");
    glaze.addColorStop(.65, "#10072000");
    glaze.addColorStop(1, "#f5bbff33");
    paint.beginPath();
    paint.arc(0, 0, rim, 0, tau);
    paint.fillStyle = glaze;
    paint.fill();
    for (let dot = 0; dot < 48; dot++) {
      const point = dot * tau / 48 + angle;
      paint.beginPath();
      paint.arc(radius * .968 * Math.cos(point), radius * .968 * Math.sin(point), radius * .008, 0, tau);
      paint.fillStyle = dot % 4 === 0 ? "#ffeefc" : "#c998e6";
      paint.fill();
    }
    paint.beginPath();
    paint.arc(0, 0, radius * .99, 0, tau);
    paint.strokeStyle = "#d799f5aa";
    paint.lineWidth = radius * .013;
    paint.stroke();
    paint.restore();
  }

  function resize() {
    const pixels = Math.round(canvas.clientWidth * Math.min(devicePixelRatio || 1, 2));
    if (pixels > 0 && canvas.width !== pixels) canvas.width = canvas.height = pixels;
    drawWheel();
  }

  function unlockAudio() {
    if (state.muted) return;
    try {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) return;
      audio ??= new Audio();
      if (audio.state === "suspended") audio.resume().catch(() => {});
    } catch {
      // The draw remains available in browsers without sound.
    }
  }

  function tone(hz, duration, volume, offset = 0) {
    if (state.muted || audio?.state !== "running") return;
    const now = audio.currentTime + offset;
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.frequency.value = hz;
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    oscillator.connect(gain).connect(audio.destination);
    oscillator.start(now);
    oscillator.stop(now + duration);
  }

  function confetti() {
    if (reduced.matches) return;
    cancelAnimationFrame(celebrationFrame);
    const width = celebration.width = window.innerWidth;
    const height = celebration.height = window.innerHeight;
    const context = celebration.getContext("2d");
    const colors = ["#ff8ecb", "#7eeafe", "#f8e7a0", "#a994ff"];
    const pieces = Array.from({ length: 96 }, (_, index) => ({
      x: width * (index % 2 ? .17 : .82),
      y: height * .35,
      vx: (Math.random() - .5) * width * .62,
      vy: -150 - Math.random() * 260,
      rotation: Math.random() * 7,
      color: colors[index % colors.length],
    }));
    const start = performance.now();
    function frame(time) {
      const t = (time - start) / 1000;
      context.clearRect(0, 0, width, height);
      if (t >= 2.15) return;
      context.globalAlpha = Math.min(1, (2.15 - t) * 1.8);
      for (const piece of pieces) {
        context.save();
        context.translate(piece.x + piece.vx * t, piece.y + piece.vy * t + 275 * t * t);
        context.rotate(piece.rotation + t * 3);
        context.fillStyle = piece.color;
        context.fillRect(-4, -3, 8, 5);
        context.restore();
      }
      celebrationFrame = requestAnimationFrame(frame);
    }
    celebrationFrame = requestAnimationFrame(frame);
  }

  function spin() {
    if (spinning || !active.length) return;
    const winner = rules.pickEveningSong(active, state.draws, catalog);
    unlockAudio();
    spinning = true;
    $("spin").disabled = $("buy").disabled = $("reset").disabled = $("undo").disabled = true;
    $("sung").hidden = true;
    $("status").textContent = "Колесо крутится";
    $("result-details").hidden = true;
    $("description").hidden = false;
    $("description").textContent = "Сейчас узнаем, что поём.";
    $("announcement").textContent = "Колесо крутится";
    const start = angle;
    const target = rules.targetAngle(start, active.indexOf(winner), active.length);
    const motion = rules.spinMotion(start, target, active.length);
    const startTime = performance.now();
    let previousIndex = -1;
    let previousTick = 0;
    let slowing = false;
    let pointerTilt = 0;

    function finish() {
      showPick(winner, target);
    }
    if (reduced.matches) {
      finish();
      return;
    }
    function frame(now) {
      const elapsed = now - startTime;
      if (elapsed >= motion.duration) {
        finish();
        return;
      }
      if (!slowing && elapsed >= motion.slowAt) {
        slowing = true;
        $("status").textContent = "Колесо замедляется…";
      }
      angle = motion.angleAt(elapsed);
      const tilt = motion.pointerAt(elapsed);
      if (tilt !== pointerTilt) {
        pointerTilt = tilt;
        pointer.style.setProperty("--pointer-tilt", `${tilt}deg`);
      }
      const index = rules.indexAt(angle, active.length);
      if (index !== previousIndex) {
        if (!slowing || active[index] !== winner) labelSong(active[index]);
        if (now - previousTick >= 57) {
          tone(295 + index % 7 * 25, .047, .025);
          previousTick = now;
        }
        previousIndex = index;
      }
      drawWheel();
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  function showPick(song, target, buyer) {
    angle = rules.wrap(target);
    pointer.style.removeProperty("--pointer-tilt");
    showing = buyer ? { id: song.id, sung: false, buyer } : { id: song.id, sung: false };
    state.draws.push(showing);
    save();
    spinning = false;
    $("undo").disabled = false;
    render(true);
    $("spin").focus();
    const label = buyer ? "Песня за жетон" : "Выпала песня";
    $("announcement").textContent = `${label}: ${song.artist}, ${song.title}`;
    [440, 554, 659].forEach((hz, index) => tone(hz, .28, .075, index * .085));
    confetti();
  }

  function setOptions(select, entries, placeholder) {
    const prompt = new Option(placeholder, "", true, true);
    prompt.disabled = true;
    select.replaceChildren(prompt, ...entries.map(([value, label]) => new Option(label, value)));
  }

  function updatePurchaseSongs() {
    const eligible = rules.songsForToken($("buyer").value, active, state.draws);
    setOptions($("buy-song"), eligible.map((song) => [song.id, `${song.artist} · ${song.title}`]), "Выбрать песню");
    $("buy-song").disabled = !eligible.length;
    $("buy-confirm").disabled = true;
  }

  $("buy").addEventListener("click", () => {
    if (spinning || !buyers.length) return;
    setOptions($("buyer"), buyers.map((name) => [name, name]), "Выбрать участника");
    updatePurchaseSongs();
    $("buy-dialog").showModal();
  });
  $("buyer").addEventListener("change", updatePurchaseSongs);
  $("buy-song").addEventListener("change", () => { $("buy-confirm").disabled = !$("buy-song").value; });
  $("buy-cancel").addEventListener("click", () => $("buy-dialog").close());
  $("buy-form").addEventListener("submit", (event) => {
    event.preventDefault();
    if (spinning || !$("buy-dialog").open) return;
    const buyer = $("buyer").value;
    const songId = $("buy-song").value;
    const song = rules.songsForToken(buyer, active, state.draws).find((candidate) => candidate.id === songId);
    if (!song) return;
    unlockAudio();
    $("buy-dialog").close();
    showPick(song, rules.targetAngle(angle, active.indexOf(song), active.length), buyer);
  });

  $("spin").addEventListener("click", spin);
  $("sung").addEventListener("click", () => {
    if (spinning || !showing || showing.sung) return;
    showing.sung = true;
    angle = 0;
    save();
    render();
    $("spin").focus();
  });
  $("undo").addEventListener("click", () => {
    const lastSung = state.draws.findLast((draw) => draw.sung);
    if (spinning || !lastSung) return;
    lastSung.sung = false;
    showing = lastSung;
    angle = 0;
    save();
    render();
    $("announcement").textContent = "Песня возвращена в колесо";
    $("spin").focus();
  });
  $("reset").addEventListener("click", () => {
    if (!spinning) {
      $("reset-dialog").returnValue = "";
      $("reset-dialog").showModal();
    }
  });
  $("reset-dialog").addEventListener("close", () => {
    if ($("reset-dialog").returnValue !== "reset") return;
    state.draws = [];
    showing = null;
    angle = 0;
    save();
    render();
    $("spin").focus();
  });
  $("sound").addEventListener("click", () => {
    state.muted = !state.muted;
    save();
    unlockAudio();
    $("sound").textContent = state.muted ? "Звук выкл." : "Звук вкл.";
    $("sound").setAttribute("aria-pressed", !state.muted);
  });
  $("fullscreen").hidden = !document.fullscreenEnabled;
  $("fullscreen").addEventListener("click", async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      $("announcement").textContent = "Не удалось перейти на весь экран";
    }
  });
  document.addEventListener("fullscreenchange", () => {
    $("fullscreen").textContent = document.fullscreenElement ? "Выйти из полного экрана" : "На весь экран";
  });
  new ResizeObserver(resize).observe(canvas);
  new ResizeObserver(() => {
    titleSizes.clear();
    fitTitle();
  }).observe(titleSlot);
  render();
  if (showing && !showing.sung) {
    const index = active.findIndex((song) => song.id === showing.id);
    if (index !== -1) angle = rules.wrap(rules.targetAngle(0, index, active.length));
    drawWheel();
  }
})();
