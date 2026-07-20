import { createDefaultState, normalizeState } from "./domain.js";

const STORAGE_KEY = "fewer.portfolio.v1";
export const MAX_STORED_CHARS = 1_500_000;

export function loadState() {
  try {
    const saved = globalThis.localStorage?.getItem(STORAGE_KEY);
    if (!saved) {
      return { state: createDefaultState(), recovered: false };
    }
    if (saved.length > MAX_STORED_CHARS) {
      throw new Error("Saved portfolio exceeds the local size limit.");
    }
    return { state: normalizeState(JSON.parse(saved)), recovered: false };
  } catch (error) {
    return {
      state: createDefaultState(),
      recovered: true,
      error: error instanceof Error ? error.message : "Saved data could not be read.",
    };
  }
}

export function saveState(state) {
  const serialized = JSON.stringify(normalizeState(state));
  if (serialized.length > MAX_STORED_CHARS) {
    throw new Error("This portfolio is too large for browser storage.");
  }
  globalThis.localStorage?.setItem(STORAGE_KEY, serialized);
}

export function clearState() {
  globalThis.localStorage?.removeItem(STORAGE_KEY);
}
