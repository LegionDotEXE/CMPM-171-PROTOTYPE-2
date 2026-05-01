// Module-level "bank" of session state. Survives scene shutdowns; cleared on page refresh.

const target = {
  hackedCardIds: new Set(),

  // Ignores non-numeric input so junk callers can't corrupt the store.
  recordHack(profileId) {
    const numericId = Number(profileId);
    if (!Number.isFinite(numericId)) return;
    this.hackedCardIds.add(numericId);
  },

  // Returns a copy so callers can't mutate the internal Set.
  getHackedCardIDs() {
    return Array.from(this.hackedCardIds);
  },

  clearHacks() {
    this.hackedCardIds.clear();
  },
};

// Proxy guards bulk writes like `PersistenceManager.hackedCardIds = [1, 2, 3]`: invalid input is
// silently dropped and we always return true so strict-mode callers never see a TypeError.
export const PersistenceManager = new Proxy(target, {
  set(innerTarget, prop, value) {
    if (prop !== "hackedCardIds") return true;
    if (!Array.isArray(value)) return true;
    value.forEach((id) => {
      const numericId = Number(id);
      if (Number.isFinite(numericId)) innerTarget.hackedCardIds.add(numericId);
    });
    return true;
  },
});
