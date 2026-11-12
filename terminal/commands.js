const kubectlUsage = "kubectl describe pod <name>\nkubectl get pods [name]";

function kubectl(args, { profile }) {
  const [verb, resource, name] = args;
  if (verb === "--help" && args.length === 1) return kubectlUsage;
  if (!["get", "describe"].includes(verb) || !["po", "pod", "pods"].includes(resource)
      || args.length > 3 || (verb === "describe" && !name)) {
    return `usage: ${kubectlUsage}`;
  }
  if (name && name !== profile.username) return `Error from server (NotFound): pods "${name}" not found`;

  const { pod } = profile;
  if (verb === "get") return `NAME    STATUS\n${profile.username.padEnd(8)}${pod.status}`;

  const fields = [
    ["Name", profile.username],
    ["Namespace", pod.namespace],
    ["Labels", Object.entries(pod.labels).map(([key, value]) => `${key}=${value}`).join(", ")],
    ["Annotations", Object.entries(pod.annotations).map(([key, value]) => `${key}: ${value}`).join(", ")],
    ["Status", pod.status],
  ];
  return fields.map(([key, value]) => `${(key + ":").padEnd(14)}${value}`).join("\n");
}

async function cat(args, { files }) {
  if (args.length !== 1 || !args[0] || args[0] === "--help") return "usage: cat <file>";
  const [path] = args;
  try {
    return await files.read(path) ?? `cat: ${path}: No such file or directory`;
  } catch {
    return `cat: ${path}: Input/output error`;
  }
}

export const builtInCommands = [
  { name: "help", usage: "help", run: (_, { usages }) => usages.join("\n") },
  {
    name: "ls", usage: "ls",
    run: (_, { directories, files }) => ({ text: [...directories, ...files.list()].join("   "), kind: "directories" }),
  },
  { name: "pwd", usage: "pwd", run: (_, { profile }) => profile.home },
  { name: "whoami", usage: "whoami", run: (_, { profile }) => profile.username },
  { name: "date", usage: "date", run: () => new Date().toLocaleString() },
  { name: "echo", usage: "echo [text]", run: (args) => args.join(" ") },
  { name: "clear", usage: "clear", run: () => ({ clear: true }) },
  { name: "kubectl", usage: kubectlUsage, run: kubectl },
  { name: "cat", usage: "cat <file>", run: cat },
];
