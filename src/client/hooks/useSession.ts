import { useState, useEffect, useCallback } from 'react';
import { GameSession } from '../../shared/types/session';

export const useSession = () => {
  const [currentSession, setCurrentSession] = useState<GameSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCurrentSession = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/sessions/current');
      const data = await response.json();
      
      if (data.status === 'success') {
        setCurrentSession(data.data);
      } else {
        setCurrentSession(null);
      }
    } catch (err) {
      setError('Failed to fetch current session');
      setCurrentSession(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const createSession = useCallback(async (maxPlayers?: number) => {
  }
  )
  const createSession = useCallback(async (maxPlayers?: number, isPrivate?: boolean) => {
    try {
      const response = await fetch('/api/sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ maxPlayers, isPrivate }),
      });
      const data = await response.json();
      
      if (data.status === 'success') {
        setCurrentSession(data.data);
        return data.data;
      } else {
        throw new Error(data.message || 'Failed to create session');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create session');
      throw err;
    }
  }, []);

  const joinSession = useCallback(async (sessionId: string) => {
    try {
      const response = await fetch(`/api/sessions/${sessionId}/join`, {
        method: 'POST',
      });
      const data = await response.json();
      
      if (data.status === 'success') {
        setCurrentSession(data.data);
        return data.data;
      } else {
        throw new Error(data.message || 'Failed to join session');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join session');
      throw err;
    }
  }, []);

  const leaveSession = useCallback(async (sessionId: string) => {
    try {
      const response = await fetch(`/api/sessions/${sessionId}/leave`, {
        method: 'POST',
      });
      const data = await response.json();
      
      if (data.status === 'success') {
        setCurrentSession(null);
      } else {
        throw new Error(data.message || 'Failed to leave session');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to leave session');
      throw err;
    }
  }, []);

  const startCountdown = useCallback(async (sessionId: string) => {
    try {
      const response = await fetch(`/api/sessions/${sessionId}/start-countdown`, {
        method: 'POST',
      });
      const data = await response.json();
      
      if (data.status === 'success') {
        setCurrentSession(data.data);
        return data.data;
      } else {
        throw new Error(data.message || 'Failed to start countdown');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start countdown');
      throw err;
    }
  }, []);

  const startGame = useCallback(async (sessionId: string) => {
    try {
      const response = await fetch(`/api/sessions/${sessionId}/start`, {
        method: 'POST',
      });
      const data = await response.json();
      
      if (data.status === 'success') {
        setCurrentSession(data.data);
        return data.data;
      } else {
        throw new Error(data.message || 'Failed to start game');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start game');
      throw err;
    }
  }, []);

  useEffect(() => {
    fetchCurrentSession();
  }, [fetchCurrentSession]);

  return {
    currentSession,
    loading,
    error,
    createSession,
    joinSession,
    leaveSession,
    startCountdown,
    startGame,
    refreshSession: fetchCurrentSession,
  };
};