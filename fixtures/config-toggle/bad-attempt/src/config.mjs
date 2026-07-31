/** BAD ATTEMPT: renamed exported API — breaks callers of getConfig. */
export function loadSettings(key, defaults = {}) {
  if (Object.prototype.hasOwnProperty.call(defaults, key)) {
    return defaults[key];
  }
  return undefined;
}
