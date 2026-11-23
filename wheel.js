(() => {
  const recovery = [0.5, 0.7, 0.85];
  const turn = Math.PI * 2;
  const wrap = (angle) => ((angle % turn) + turn) % turn;

  function weight(song, history, catalog) {
    const recent = history.slice(-recovery.length).reverse();
    const total = song.authors.reduce((sum, author) => {
      const age = recent.findIndex((draw) => catalog.get(draw.id)?.authors.includes(author));
      return sum + (recovery[age] ?? 1);
    }, 0);
    return (1 + Math.sqrt(song.votes)) * total / song.authors.length;
  }

  function pick(songs, history, catalog, random = Math.random) {
    if (!songs.length) return null;
    const weights = songs.map((song) => weight(song, history, catalog));
    let target = random() * weights.reduce((sum, value) => sum + value, 0);
    for (let index = 0; index < weights.length; index++) {
      target -= weights[index];
      if (target < 0) return songs[index];
    }
    return songs.at(-1);
  }

  function targetAngle(angle, index, count) {
    const center = -turn * (index + 0.5) / count;
    return angle + 6 * turn + wrap(center - angle);
  }

  function indexAt(angle, count) {
    return Math.floor(wrap(-angle) / turn * count);
  }

  function spinMotion(start, target, count) {
    const approach = count > 1 ? 9550 : 10900;
    const pause = count > 1 ? 850 : 0;
    const finalStep = count > 1 ? 500 : 0;
    const nearStop = count > 1 ? target - turn / count : target;
    const duration = approach + pause + finalStep;

    return {
      duration,
      angleAt(elapsed) {
        if (elapsed >= duration) return target;
        if (elapsed < approach) {
          const fraction = Math.max(0, elapsed) / approach;
          return start + (nearStop - start) * (1 - (1 - fraction) ** 3.1);
        }
        if (elapsed < approach + pause) return nearStop;
        const fraction = (elapsed - approach - pause) / finalStep;
        const glide = fraction * fraction * (3 - 2 * fraction);
        return nearStop + (target - nearStop) * glide;
      },
    };
  }

  const storageKey = "nevinny-vecher-wheel-v1";
  const initial = () => ({ draws: [], muted: false });

  function restore(storage, catalog) {
    try {
      const saved = JSON.parse(storage.getItem(storageKey));
      if (!saved || !Array.isArray(saved.draws)) return initial();
      const draws = saved.draws
        .filter((draw) => draw && catalog.has(draw.id) && typeof draw.sung === "boolean")
        .map(({ id, sung }) => ({ id, sung }));
      return { draws, muted: saved.muted === true };
    } catch {
      return initial();
    }
  }

  globalThis.VecherWheel = { weight, pick, targetAngle, indexAt, spinMotion, wrap, storageKey, restore };
})();
