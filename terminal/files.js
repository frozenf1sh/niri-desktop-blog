const publicFiles = {
  "interests.json": "interests.json",
};

function resolvePath(path, cwd, home) {
  const expanded = path === "~" || path.startsWith("~/") ? home + path.slice(1) : path;
  const absolute = expanded.startsWith("/") ? expanded : `${cwd}/${expanded}`;
  const segments = [];
  for (const segment of absolute.split("/")) {
    if (segment === "..") segments.pop();
    else if (segment && segment !== ".") segments.push(segment);
  }
  return "/" + segments.join("/");
}

export function createFileSystem({ home, baseUrl, directories = [], entries = {}, fetchFile = fetch }) {
  const resolve = (path, cwd = home) => resolvePath(path, cwd, home);
  const files = new Map(Object.entries({ ...publicFiles, ...entries }).map(([name, entry]) => [resolve(name), entry]));
  const folders = new Set(["/"]);

  function addDirectory(path) {
    let current = path;
    while (current && !folders.has(current)) {
      folders.add(current);
      current = current.slice(0, current.lastIndexOf("/"));
    }
  }

  addDirectory(home);
  for (const name of directories) addDirectory(resolve(name));
  for (const name of files.keys()) addDirectory(name.slice(0, name.lastIndexOf("/")));

  function list(path = ".", cwd = home) {
    const directory = resolve(path, cwd);
    if (!folders.has(directory)) return null;
    const prefix = directory === "/" ? directory : directory + "/";
    const children = [];
    for (const absolute of [...folders, ...files.keys()]) {
      if (!absolute.startsWith(prefix)) continue;
      const name = absolute.slice(prefix.length);
      if (name && !name.includes("/")) children.push({ name, directory: folders.has(absolute) });
    }
    return children;
  }

  return {
    list,
    directory(path, cwd) {
      const absolute = resolve(path, cwd);
      return folders.has(absolute) ? absolute : null;
    },
    completePath(prefix, cwd, foldersOnly = false) {
      if (prefix === "~" || prefix === "." || prefix === "..") return [prefix + "/"];
      const slash = prefix.lastIndexOf("/") + 1;
      const parent = prefix.slice(0, slash);
      return (list(parent || ".", cwd) ?? [])
        .filter(({ directory }) => !foldersOnly || directory)
        .map(({ name, directory }) => parent + name + (directory ? "/" : ""));
    },
    async read(path, cwd) {
      const entry = files.get(resolve(path, cwd));
      if (!entry) return null;
      if (typeof entry === "object") return entry.text;

      const response = await fetchFile(new URL(entry, baseUrl), {
        cache: "no-cache",
        headers: { Accept: "text/plain, application/json" },
      });
      if (response.status === 404) return null;
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.text();
    },
  };
}
