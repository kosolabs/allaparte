import { loadEngine } from "#viritura/engine";

export function scoreEngine() {
  return loadEngine({ assetBaseUrl: "/score-engine/" });
}
