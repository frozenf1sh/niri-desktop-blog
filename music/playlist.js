export const playbackModes = ["sequence", "repeat-one", "shuffle"];

export function createPlaylist(tracks, initialMode, random = Math.random) {
  let current = tracks[0] ?? null;
  let mode = playbackModes.includes(initialMode) ? initialMode : "sequence";
  let upcoming = [];
  let history = [];

  function choose(track) {
    current = track;
    upcoming = [];
    history = [];
    return current;
  }

  function advance(direction, ended = false) {
    if (!current) return null;
    if (ended && mode === "repeat-one") return current;
    if (mode === "shuffle" && tracks.length > 1) {
      if (direction < 0) {
        const previous = history.pop();
        if (previous) {
          upcoming.unshift(current);
          current = previous;
        }
        return current;
      }
      if (!upcoming.length) {
        upcoming = tracks.filter((track) => track !== current);
        for (let i = upcoming.length - 1; i > 0; i--) {
          const j = Math.floor(random() * (i + 1));
          [upcoming[i], upcoming[j]] = [upcoming[j], upcoming[i]];
        }
      }
      history.push(current);
      if (history.length > 100) history.shift();
      current = upcoming.shift();
      return current;
    }
    const next = tracks.indexOf(current) + direction;
    if (ended && mode === "sequence" && next === tracks.length) return null;
    current = tracks[(next + tracks.length) % tracks.length];
    return current;
  }

  return {
    get current() { return current; },
    get mode() { return mode; },
    setMode(value) {
      if (!playbackModes.includes(value) || value === mode) return;
      mode = value;
      choose(current);
    },
    select(id) {
      const track = tracks.find((item) => item.id === id);
      return track ? choose(track) : null;
    },
    advance,
  };
}
