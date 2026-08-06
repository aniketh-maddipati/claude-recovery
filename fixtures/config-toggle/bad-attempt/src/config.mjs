/** Rejected attempt: renamed exported API — breaks callers of getConfig. Deterministic fixture overlay. */
export function loadSettings(key, defaults = {}) {
  if (Object.prototype.hasOwnProperty.call(defaults, key)) {
    return defaults[key];
  }
  return undefined;
}
