const about = "后端开发，喜欢 Linux、容器和终端";

export const profile = {
  username: "felix",
  name: "Felix",
  hostname: "frozenf1sh.top",
  home: "/home/felix",
  about,
  pod: {
    namespace: "frozenf1sh.top",
    labels: { role: "backend" },
    annotations: { about },
    status: "Running",
  },
};
