const details = new Map();
const pending = new Map();
const cachePrefix = "music:monster-siren:";

async function api(path) {
  const response = await fetch(`/music-api/${path}`);
  if (!response.ok) throw new Error(`Music API: ${response.status}`);
  const body = await response.json();
  if (body.code !== 0 || !body.data) throw new Error("Music API returned an error");
  return body.data;
}

async function cached(key, load) {
  try {
    const saved = JSON.parse(localStorage.getItem(cachePrefix + key));
    if (saved && saved.expires > Date.now()) return saved.value;
  } catch { /* Storage can be unavailable. */ }
  const value = await load();
  try { localStorage.setItem(cachePrefix + key, JSON.stringify({ value, expires: Date.now() + 7 * 86400000 })); } catch { /* Cache is optional. */ }
  return value;
}

function mediaUrl(url, kind) {
  if (!url) return "";
  const parsed = new URL(url);
  if (parsed.protocol !== "https:" || parsed.hostname !== "web.hycdn.cn" || !parsed.pathname.startsWith(`/siren/${kind}/`)) throw new Error("Invalid music media URL");
  return `/music-media${parsed.pathname}`;
}

export async function resolveMonsterSiren(resource) {
  const cid = String(resource.cid);
  if (!/^\d+$/.test(cid)) throw new Error("Invalid song ID");
  let song = details.get(cid);
  if (!song || song.expires <= Date.now()) {
    if (!pending.has(cid)) pending.set(cid, api(`song/${cid}`).finally(() => pending.delete(cid)));
    song = { value: await pending.get(cid), expires: Date.now() + 60000 };
    details.set(cid, song);
  }
  const data = song.value;
  if (!data.sourceUrl || !/^\d+$/.test(String(data.albumCid))) throw new Error("Invalid song response");
  const [album, lyrics] = await Promise.all([
    cached(`album:${data.albumCid}`, () => api(`album/${data.albumCid}/detail`)).catch(() => null),
    data.lyricUrl ? cached(`lyrics:${cid}:${data.lyricUrl}`, async () => {
      const response = await fetch(mediaUrl(data.lyricUrl, "lyric"));
      if (!response.ok) throw new Error(`Lyrics unavailable: ${response.status}`);
      return response.text();
    }).catch(() => "") : "",
  ]);
  return { title: data.name, source: data.sourceUrl, cover: album?.coverUrl ? mediaUrl(album.coverUrl, "pic") : "", lyrics };
}
