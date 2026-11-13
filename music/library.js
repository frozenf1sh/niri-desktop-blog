const directory = "../assets/music/";
const files = import.meta.glob("../assets/music/**/*.{mp3,m4a,aac,ogg,opus,wav,flac,webm,MP3,M4A,AAC,OGG,OPUS,WAV,FLAC,WEBM}", {
  eager: true,
  import: "default",
  query: "?url",
});
const order = new Intl.Collator("zh-CN", { numeric: true });

export const tracks = Object.entries(files).map(([path, source]) => {
  const id = path.slice(directory.length);
  const fileName = id.split("/").at(-1);
  return { id, fileName, title: fileName.replace(/\.[^.]+$/, ""), source };
}).sort((a, b) => order.compare(a.id, b.id));
