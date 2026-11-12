const publicFiles = {
  "interests.json": "interests.json",
};

export function createFileSystem({ home, baseUrl, entries = publicFiles, fetchFile = fetch }) {
  const files = new Map(Object.entries(entries));
  const homePrefix = `${home}/`;

  return {
    list: () => [...files.keys()],
    async read(path) {
      let name = path;
      if (path.startsWith(homePrefix)) name = path.slice(homePrefix.length);
      else if (path.startsWith("./") || path.startsWith("~/")) name = path.slice(2);

      const relativePath = files.get(name);
      if (!relativePath) return null;
      const response = await fetchFile(new URL(relativePath, baseUrl), {
        cache: "no-cache",
        headers: { Accept: "text/plain, application/json" },
      });
      if (response.status === 404) return null;
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.text();
    },
  };
}
