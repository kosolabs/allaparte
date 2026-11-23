import { loadEngine } from "@viritura/score-engine";

export function scoreEngine() {
  return loadEngine({ assetBaseUrl: "/score-engine/" });
}
