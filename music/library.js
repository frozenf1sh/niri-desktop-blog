import { resolveMonsterSiren } from "./adapters/monster-siren.js";

const directory = "../assets/music/";
const files = import.meta.glob("../assets/music/**/*.{mp3,m4a,aac,ogg,opus,wav,flac,webm,MP3,M4A,AAC,OGG,OPUS,WAV,FLAC,WEBM}", {
  eager: true, import: "default", query: "?url",
});
const resources = import.meta.glob("../assets/music/**/*.json", { eager: true, import: "default" });
const adapters = {
  local: async (resource) => ({ title: resource.title, source: resource.source }),
  "monster-siren": resolveMonsterSiren,
};
const order = new Intl.Collator("zh-CN", { numeric: true });

function describe(path, resource) {
  const id = path.slice(directory.length);
  const fileName = id.split("/").at(-1);
  return { ...resource, id, folder: id.includes("/") ? id.slice(0, id.lastIndexOf("/")) : "", fileName: resource.title ?? fileName };
}

export const tracks = [
  ...Object.entries(files).map(([path, source]) => describe(path, { type: "local", title: path.split("/").at(-1).replace(/\.[^.]+$/, ""), source })),
  ...Object.entries(resources).map(([path, resource]) => describe(path, resource)),
].sort((a, b) => order.compare(a.id, b.id));

export function resolveResource(resource) {
  const adapter = adapters[resource.type];
  if (!adapter) throw new Error(`Unknown music resource type: ${resource.type}`);
  return adapter(resource);
}
