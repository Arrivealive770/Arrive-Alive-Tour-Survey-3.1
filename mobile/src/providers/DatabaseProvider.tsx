import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { DatabaseService, initializeDatabase, getDatabase } from '@/lib/db/database';

interface DatabaseContextValue {
  db: DatabaseService | null;
  isReady: boolean;
  error: Error | null;
  reinitialize: () => Promise<void>;
}

const DatabaseContext = createContext<DatabaseContextValue>({
  db: null,
  isReady: false,
  error: null,
  reinitialize: async () => {},
});

interface DatabaseProviderProps {
  children: React.ReactNode;
  onReady?: () => void;
  onError?: (error: Error) => void;
}

export function DatabaseProvider({ children, onReady, onError }: DatabaseProviderProps) {
  const [db, setDb] = useState<DatabaseService | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const initialize = useCallback(async () => {
    try {
      setIsReady(false);
      setError(null);

      console.log('[DatabaseProvider] Initializing database...');
      const database = await initializeDatabase();
      setDb(database);
      setIsReady(true);

      console.log('[DatabaseProvider] Database ready');
      onReady?.();
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to initialize database');
      console.error('[DatabaseProvider] Database initialization failed:', error);
      setError(error);
      onError?.(error);
    }
  }, [onReady, onError]);

  const reinitialize = useCallback(async () => {
    // Close existing connection if any
    if (db) {
      await db.close();
    }
    await initialize();
  }, [db, initialize]);

  useEffect(() => {
    initialize();

    // Cleanup on unmount
    return () => {
      const database = getDatabase();
      database.close().catch(console.error);
    };
  }, [initialize]);

  const value: DatabaseContextValue = {
    db,
    isReady,
    error,
    reinitialize,
  };

  return (
    <DatabaseContext.Provider value={value}>
      {children}
    </DatabaseContext.Provider>
  );
}

export function useDatabase(): DatabaseContextValue {
  const context = useContext(DatabaseContext);
  if (context === undefined) {
    throw new Error('useDatabase must be used within a DatabaseProvider');
  }
  return context;
}

export function useDatabaseInstance(): DatabaseService {
  const { db, isReady, error } = useDatabase();

  if (error) {
    throw error;
  }

  if (!isReady || !db) {
    throw new Error('Database is not ready. Make sure DatabaseProvider is initialized.');
  }

  return db;
}

// Hook for waiting until database is ready
export function useDatabaseReady(): boolean {
  const { isReady } = useDatabase();
  return isReady;
}
