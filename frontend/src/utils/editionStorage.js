/**
 * The Daily Voice - Available Editions Local Storage Helpers
 * Manages user-scoped available editions persisted across browser sessions.
 */

export const EDITION_STORAGE_PREFIX = 'dailyvoice_available_editions_';

/**
 * Returns the storage key for a user (or guest).
 * @param {string|null|undefined} userId
 * @returns {string}
 */
export function getEditionStorageKey(userId) {
  return `${EDITION_STORAGE_PREFIX}${userId || 'guest'}`;
}

/**
 * Retrieves the list of available edition IDs from storage.
 * @param {string|null|undefined} userId
 * @param {Storage} [storage=localStorage]
 * @returns {string[]}
 */
export function getStoredEditionIds(userId, storage = typeof localStorage !== 'undefined' ? localStorage : null) {
  if (!storage) return [];
  try {
    const raw = storage.getItem(getEditionStorageKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn('Failed to parse stored edition IDs:', err);
    return [];
  }
}

/**
 * Saves a list of edition IDs to storage for the given user.
 * @param {string|null|undefined} userId
 * @param {string[]} editionIds
 * @param {Storage} [storage=localStorage]
 */
export function saveStoredEditionIds(userId, editionIds, storage = typeof localStorage !== 'undefined' ? localStorage : null) {
  if (!storage) return;
  try {
    const key = getEditionStorageKey(userId);
    const uniqueIds = Array.from(new Set(editionIds.filter(Boolean)));
    storage.setItem(key, JSON.stringify(uniqueIds));
  } catch (err) {
    console.warn('Failed to persist edition IDs:', err);
  }
}

/**
 * Adds an edition ID to storage without duplicates, placing the newly added ID at the front.
 * @param {string|null|undefined} userId
 * @param {string} editionId
 * @param {Storage} [storage=localStorage]
 * @returns {string[]} Updated list of edition IDs
 */
export function addEditionIdToStorage(userId, editionId, storage = typeof localStorage !== 'undefined' ? localStorage : null) {
  if (!editionId) return getStoredEditionIds(userId, storage);
  const existing = getStoredEditionIds(userId, storage);
  const filtered = existing.filter((id) => id !== editionId);
  const updated = [editionId, ...filtered];
  saveStoredEditionIds(userId, updated, storage);
  return updated;
}

/**
 * Removes an edition ID from storage.
 * @param {string|null|undefined} userId
 * @param {string} editionId
 * @param {Storage} [storage=localStorage]
 * @returns {string[]} Updated list of edition IDs
 */
export function removeEditionIdFromStorage(userId, editionId, storage = typeof localStorage !== 'undefined' ? localStorage : null) {
  const existing = getStoredEditionIds(userId, storage);
  const updated = existing.filter((id) => id !== editionId);
  saveStoredEditionIds(userId, updated, storage);
  return updated;
}

/**
 * Clears all stored edition IDs for the given user.
 * @param {string|null|undefined} userId
 * @param {Storage} [storage=localStorage]
 */
export function clearStoredEditionIds(userId, storage = typeof localStorage !== 'undefined' ? localStorage : null) {
  if (!storage) return;
  try {
    storage.removeItem(getEditionStorageKey(userId));
  } catch {
    // Ignore clear error
  }
}
