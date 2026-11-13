export function paintRange(input) {
  const progress = 100 * (Number(input.value) - Number(input.min)) / (Number(input.max) - Number(input.min));
  input.style.setProperty("--progress", `${progress}%`);
}

export function readSetting(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(`niri-desktop:${key}`)) ?? fallback;
  } catch {
    return fallback;
  }
}

export function writeSetting(key, value) {
  try {
    localStorage.setItem(`niri-desktop:${key}`, JSON.stringify(value));
  } catch {
    // The desktop still works when browser storage is disabled.
  }
}
