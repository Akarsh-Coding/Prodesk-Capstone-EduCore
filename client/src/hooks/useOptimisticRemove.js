'use client';

import { useCallback, useState } from 'react';

// Optimistic removal from a list kept in state:
//   1. take a snapshot of the current list and note the item and its position
//   2. remove the item from state IMMEDIATELY (no waiting for the server)
//   3. send the request in the background
//   4. on success: nothing else to do (no refetch, no reload)
//   5. on failure: put the item back at its original position and set an error message
//
// Usage:
//   const { remove, error, clearError } = useOptimisticRemove(courses, setCourses, { action: 'delete', getLabel });
//   remove(course._id, () => coursesApi.remove(course._id));
export function useOptimisticRemove(items, setItems, { action = 'remove', getLabel } = {}) {
  const [error, setError] = useState('');

  const remove = useCallback(
    async (id, request) => {
      setError('');

      // Snapshot of the list as it is right now
      const snapshot = items;
      const index = snapshot.findIndex((item) => item._id === id);
      if (index === -1) return false; // not in the list: nothing to remove
      const removed = snapshot[index];

      // The DOM updates now
      setItems((prev) => prev.filter((item) => item._id !== id));

      try {
        await request();
        return true;
      } catch (err) {
        // Roll back: re-insert ONLY this item at its old position. (Restoring the whole snapshot
        // would also bring back other items the user deleted while this request was in flight.)
        setItems((prev) => {
          if (prev.some((item) => item._id === id)) return prev;
          const next = [...prev];
          next.splice(Math.min(index, next.length), 0, removed);
          return next;
        });
        const label = getLabel ? getLabel(removed) : 'this item';
        setError(`Could not ${action} "${label}". ${err.message}`);
        return false;
      }
    },
    [items, setItems, action, getLabel]
  );

  const clearError = useCallback(() => setError(''), []);

  return { remove, error, clearError };
}
