import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext.jsx';
import { getEditionDetails, getUserEditions, saveUserEdition } from '../services/api.js';
import { formatBackendEdition } from '../utils/editionAdapter.js';
import {
  getEditionStorageKey,
  getStoredEditionIds,
  saveStoredEditionIds,
  clearStoredEditionIds,
} from '../utils/editionStorage.js';

export { getEditionStorageKey };

const EditionContext = createContext(null);

export function EditionProvider({ children }) {
  let user = null;
  try {
    const auth = useAuth();
    user = auth?.user;
  } catch {
    // Graceful fallback when rendered outside AuthProvider (e.g. testing)
  }
  const userId = user?.id || 'guest';

  // Available editions collection: ONLY editions scanned via QR or uploaded via PDF
  const [availableEditions, setAvailableEditions] = useState([]);
  const [selectedEdition, setSelectedEdition] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // Restore saved user editions strictly from backend on mount / user change
  useEffect(() => {
    let isMounted = true;

    // Immediately clear previous user's in-memory editions on logout or account switch
    setAvailableEditions([]);
    setSelectedEdition(null);

    if (!user?.id) {
      setIsLoading(false);
      setIsInitialized(true);
      return;
    }

    async function restoreSavedEditions() {
      setIsLoading(true);
      try {
        let restored = [];
        let backendResponded = false;

        // 1. Primary: Fetch the authenticated user's acquired editions from the backend
        try {
          const userEditionsResp = await getUserEditions();
          if (userEditionsResp.ok && Array.isArray(userEditionsResp.data?.data)) {
            backendResponded = true;
            restored = userEditionsResp.data.data.map(formatBackendEdition);
          }
        } catch (backendErr) {
          console.warn('Backend user editions fetch notice:', backendErr);
        }

        // 2. Fallback ONLY if backend request failed (offline resilience), never when backend authoritatively returned 0
        if (!backendResponded && restored.length === 0) {
          const savedIds = typeof window !== 'undefined' ? getStoredEditionIds(userId) : [];
          if (Array.isArray(savedIds) && savedIds.length > 0) {
            const editionPromises = savedIds.map(async (id) => {
              try {
                const resp = await getEditionDetails(id);
                if (resp.ok && resp.data?.data) {
                  return formatBackendEdition(resp.data.data);
                }
              } catch (err) {
                console.warn(`Failed to restore edition ${id}:`, err);
              }
              return null;
            });

            restored = (await Promise.all(editionPromises)).filter(Boolean);
          }
        }

        if (isMounted) {
          setAvailableEditions(restored);
          if (restored.length > 0) {
            setSelectedEdition((prev) => {
              if (prev && restored.some((e) => e.id === prev.id)) {
                return prev;
              }
              return restored[0];
            });
            if (typeof window !== 'undefined') {
              saveStoredEditionIds(
                userId,
                restored.map((e) => e.id)
              );
            }
          } else {
            setSelectedEdition(null);
            if (typeof window !== 'undefined' && backendResponded) {
              saveStoredEditionIds(userId, []);
            }
          }
        }
      } catch (err) {
        console.error('Error restoring saved editions:', err);
        if (isMounted) {
          setAvailableEditions([]);
          setSelectedEdition(null);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
          setIsInitialized(true);
        }
      }
    }

    restoreSavedEditions();

    return () => {
      isMounted = false;
    };
  }, [user?.id, userId]);

  // Add an edition to the available collection (e.g. after QR scan or PDF upload)
  const addAvailableEdition = useCallback(
    (editionToAdd, source = 'qr_scan') => {
      if (!editionToAdd || !editionToAdd.id) return;

      setAvailableEditions((prev) => {
        // Prevent duplicate entries
        const exists = prev.some((ed) => ed.id === editionToAdd.id);
        const updated = exists
          ? prev.map((ed) => (ed.id === editionToAdd.id ? editionToAdd : ed))
          : [editionToAdd, ...prev];

        // Persist updated list of IDs locally
        if (typeof window !== 'undefined') {
          saveStoredEditionIds(
            userId,
            updated.map((e) => e.id)
          );
        }

        return updated;
      });

      setSelectedEdition(editionToAdd);

      // Persist association to backend database
      saveUserEdition(editionToAdd.id, source).catch((err) => {
        console.warn('Could not persist edition association to backend:', err);
      });
    },
    [userId]
  );

  // Switch between available editions by ID
  const setEditionById = useCallback(
    async (id) => {
      // First check in already loaded availableEditions
      const found = availableEditions.find((ed) => ed.id === id);
      if (found && found.articles && found.articles.length > 0) {
        setSelectedEdition(found);
        return;
      }

      // If not fully loaded, fetch full details with articles
      setIsLoading(true);
      try {
        const resp = await getEditionDetails(id);
        if (resp.ok && resp.data?.data) {
          const fullEdition = formatBackendEdition(resp.data.data);
          addAvailableEdition(fullEdition);
        } else if (found) {
          setSelectedEdition(found);
        }
      } catch (err) {
        console.error('Error fetching edition by ID:', err);
        if (found) {
          setSelectedEdition(found);
        }
      } finally {
        setIsLoading(false);
      }
    },
    [availableEditions, addAvailableEdition]
  );

  // Clear available editions (used for test resets or user logout)
  const clearAvailableEditions = useCallback(() => {
    setAvailableEditions([]);
    setSelectedEdition(null);
    if (typeof window !== 'undefined') {
      clearStoredEditionIds(userId);
    }
  }, [userId]);

  // Derived articles: actual database-backed articles from the selected edition
  const currentEditionArticles =
    selectedEdition?.articles && selectedEdition.articles.length > 0
      ? selectedEdition.articles
      : [];

  return (
    <EditionContext.Provider
      value={{
        selectedEdition,
        setSelectedEdition,
        availableEditions,
        allEditions: availableEditions, // Alias for backwards compatibility with existing UI
        addAvailableEdition,
        setEditionById,
        clearAvailableEditions,
        currentEditionArticles,
        isLoading,
        isInitialized,
      }}
    >
      {children}
    </EditionContext.Provider>
  );
}

export function useEdition() {
  const context = useContext(EditionContext);
  if (!context) {
    throw new Error('useEdition must be used within an EditionProvider');
  }
  return context;
}
