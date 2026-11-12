import { searchPosts } from "../blog/search.js";

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

async function cat(args, { files, session }) {
  if (args.length !== 1 || !args[0] || args[0] === "--help") return "usage: cat <file>";
  const [path] = args;
  try {
    const text = await files.read(path, session.cwd);
    if (text === null) return { text: `cat: ${path}: No such file or directory`, kind: "error" };
    return { text, kind: path.endsWith(".json") ? "json" : "output" };
  } catch {
    return { text: `cat: ${path}: Input/output error`, kind: "error" };
  }
}

function cd(args, { files, profile, session }) {
  if (args.length > 1 || args[0] === "--help") return "usage: cd [目录]";
  const path = args[0] ?? profile.home;
  const directory = files.directory(path, session.cwd);
  if (!directory) return { text: `cd: ${path}: 找不到目录`, kind: "error" };
  session.cwd = directory;
}

function ls(args, { files, session }) {
  if (args.length > 1 || args[0] === "--help") return "usage: ls [目录]";
  const path = args[0] ?? ".";
  const items = files.list(path, session.cwd);
  if (!items) return { text: `ls: ${path}: 找不到目录`, kind: "error" };
  if (items.length) return { text: items.map(({ name, directory }) => name + (directory ? "/" : "")).join("   "), kind: "directories" };
}

function search(args, { posts }) {
  const matches = searchPosts(posts, args.join(" "));
  return matches.length ? { posts: matches } : "没有匹配的文章";
}

function read(args, { posts }) {
  const value = args.join(" ").trim();
  if (!value || value === "--help") return "usage: read <slug 或标题>";
  const slug = value.split("/").at(-1).replace(/\.md$/i, "").toLocaleLowerCase();
  const post = posts.find((item) => item.slug === slug) ?? posts.find((item) => item.title === value);
  if (!post) return { text: `read: 找不到文章 ${value}`, kind: "error" };
  return { openPost: post.slug };
}

function completePod({ args }, { profile }) {
  if (args.length === 0) return ["describe", "get", "--help"];
  if (args.length === 1 && ["describe", "get"].includes(args[0])) return ["pod", "pods", "po"];
  if (args.length === 2 && ["pod", "pods", "po"].includes(args[1])) return [profile.username];
  return [];
}

function completeArticle({ args, prefix }, { posts }) {
  if (args.length) return [];
  return posts.map(({ slug, title }) => ({
    value: prefix && title.toLocaleLowerCase().startsWith(prefix.toLocaleLowerCase()) ? title : slug,
    label: `${slug} · ${title}`,
  }));
}

function completePath({ args, prefix }, { files, session }) {
  return args.length ? [] : files.completePath(prefix, session.cwd);
}

export const builtInCommands = [
  {
    name: "help", usage: "help", description: "列出命令及其用法",
    run: (_, { definitions }) => definitions.map(({ usage, description }) =>
      description ? `${usage}  ${description}` : usage).join("\n"),
  },
  { name: "ls", usage: "ls [目录]", description: "列出虚拟目录里的文件", run: ls, complete: completePath },
  {
    name: "cd", usage: "cd [目录]", description: "切换虚拟目录", run: cd,
    complete: ({ args, prefix }, { files, session }) => args.length ? [] : files.completePath(prefix, session.cwd, true),
  },
  { name: "pwd", usage: "pwd", description: "显示当前虚拟目录", run: (_, { session }) => session.cwd },
  { name: "whoami", usage: "whoami", description: "显示当前用户名", run: (_, { profile }) => profile.username },
  { name: "date", usage: "date", description: "显示本地日期和时间", run: () => new Date().toLocaleString() },
  { name: "echo", usage: "echo [文字]", description: "输出输入的文字", run: (args) => args.join(" ") },
  { name: "clear", usage: "clear", description: "清空终端输出", run: () => ({ clear: true }) },
  { name: "kubectl", usage: "kubectl <get|describe> pod [name]", description: "查看模拟的 Pod", run: kubectl, complete: completePod },
  { name: "cat", usage: "cat <文件>", description: "显示虚拟文件原文", run: cat, complete: completePath },
  {
    name: "search", usage: "search [关键词]", description: "按标题、摘要或标签查找文章", run: search,
    complete: (_, { posts }) => [...new Set(posts.flatMap(({ tags }) => tags))],
  },
  { name: "read", usage: "read <slug 或标题>", description: "在阅读器中打开文章", run: read, complete: completeArticle },
];
