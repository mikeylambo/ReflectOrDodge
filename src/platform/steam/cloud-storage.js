// Cloud-save adapter: a Web Shell StorageAdapter (get/set/remove/clear) that
// writes through to local storage AND Steam Cloud, and on read keeps whichever
// copy is newer by the SaveManager envelope's `savedAt`. Local is the source of
// truth when the cloud is unavailable, so the game never blocks on Steam.
const savedAt = (v) => {
  const t = v && typeof v === 'object' && typeof v.savedAt === 'string' ? Date.parse(v.savedAt) : NaN;
  return Number.isNaN(t) ? -Infinity : t;
};

export class SteamCloudStorage {
  constructor(local, bridge, prefix = 'reflect-dodge:') {
    this.local = local;
    this.bridge = bridge;
    this.prefix = prefix;
  }

  async get(key) {
    const local = await this.local.get(key);
    if (!this.bridge.available) return local;
    let cloud = null;
    try { const raw = await this.bridge.cloudRead(this.prefix + key); cloud = raw ? JSON.parse(raw) : null; } catch { cloud = null; }
    if (cloud === null) return local;
    if (local === null || savedAt(cloud) > savedAt(local)) {
      await this.local.set(key, cloud); // adopt the newer cloud copy locally
      return cloud;
    }
    return local;
  }

  async set(key, value) {
    await this.local.set(key, value);
    if (this.bridge.available) { try { await this.bridge.cloudWrite(this.prefix + key, JSON.stringify(value)); } catch { /* offline: local stays canonical */ } }
  }

  async remove(key) {
    await this.local.remove(key);
    if (this.bridge.available) { try { await this.bridge.cloudWrite(this.prefix + key, ''); } catch { /* ignore */ } }
  }

  async clear() { await this.local.clear(); }
}
