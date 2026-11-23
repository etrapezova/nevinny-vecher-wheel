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
    const duration = 10900;
    const slowAt = 8700;
    const secondClickAt = 9160;
    const rockAt = 9770;
    const releaseAt = 10420;
    const sector = turn / count;
    const firstClick = target - 2.75 * sector;
    const secondClick = target - 1.8 * sector;
    const brink = target - .73 * sector;
    const glide = (from, to, fraction) => from + (to - from) * fraction ** 2 * (3 - 2 * fraction);
    const rocking = (elapsed) => {
      if (count < 2 || elapsed < rockAt || elapsed >= releaseAt) return 0;
      const fraction = (elapsed - rockAt) / (releaseAt - rockAt);
      return Math.sin(4 * Math.PI * fraction) * Math.sin(Math.PI * fraction);
    };

    return {
      duration,
      slowAt,
      pointerAt: (elapsed) => rocking(elapsed) * 9,
      angleAt(elapsed) {
        if (elapsed >= duration) return target;
        if (count < 2 || elapsed < slowAt) {
          const fraction = Math.max(0, elapsed) / (count < 2 ? duration : slowAt);
          const destination = count < 2 ? target : firstClick;
          return start + (destination - start) * (1 - (1 - fraction) ** 3.1);
        }
        if (elapsed < secondClickAt) {
          return glide(firstClick, secondClick, (elapsed - slowAt) / (secondClickAt - slowAt));
        }
        if (elapsed < rockAt) {
          return glide(secondClick, brink, (elapsed - secondClickAt) / (rockAt - secondClickAt));
        }
        if (elapsed < releaseAt) return brink + .19 * sector * rocking(elapsed);
        return glide(brink, target, (elapsed - releaseAt) / (duration - releaseAt));
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
