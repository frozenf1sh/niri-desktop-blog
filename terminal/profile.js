import { profile } from "../profile.js";

export { profile };

export const banner = String.raw`  __      _ _
 / _| ___| (_)_  __
| |_ / _ \ | \ \/ /
|  _|  __/ | |>  <
|_|  \___|_|_/_/\_\
`.trimEnd();

export const welcomeCommands = [
  `kubectl describe pod ${profile.username}`,
  "cat interests.json",
];
