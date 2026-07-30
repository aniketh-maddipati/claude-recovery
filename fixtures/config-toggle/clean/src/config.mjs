export function getConfig(key, defaults = {}) {
  if (Object.prototype.hasOwnProperty.call(defaults, key)) {
    return defaults[key];
  }
  return undefined;
}
