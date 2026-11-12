import { readRoute, routePath } from "./routes.js";

export function connectNavigation({ base, capture, display }) {
  const views = new Map();
  let nextEntry = 0;
  const newEntry = () => `${performance.timeOrigin}:${nextEntry++}`;
  let entry = newEntry();

  history.scrollRestoration = "manual";
  history.replaceState({ ...history.state, desktopEntry: entry }, "");

  window.addEventListener("popstate", (event) => {
    views.set(entry, capture());
    entry = event.state?.desktopEntry ?? newEntry();
    if (!event.state?.desktopEntry) history.replaceState({ ...history.state, desktopEntry: entry }, "");

    const route = readRoute(location.pathname, base.pathname) ?? { workspace: "home" };
    const snapshot = views.get(entry);
    display(route, { snapshot, revealArticle: !snapshot && Boolean(route.slug) });
  });

  return function navigate(route, options = {}) {
    const url = new URL(routePath(route), base);
    if (url.href !== location.href) {
      views.set(entry, capture(options.origin));
      entry = newEntry();
      history.pushState({ desktopEntry: entry }, "", url);
    }
    display(route, options);
  };
}
