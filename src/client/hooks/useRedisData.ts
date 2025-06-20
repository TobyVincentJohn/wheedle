import { useEffect, useState } from 'react';
import { GameSession } from '../../shared/types/session';
import { AIGameData } from '../../shared/types/aiGame';
import { UserDetails } from '../../shared/types/user';

interface RedisData {
  session?: GameSession | null;
  aiGameData?: AIGameData | null;
  userData?: UserDetails | null;
  loading: boolean;
  error: string | null;
}

interface SessionsRedisData {
  publicSessions: GameSession[];
  currentSession: GameSession | null;
  userData: UserDetails | null;
  loading: boolean;
  error: string | null;
}

export const useRedisData = (sessionId: string | null, userId: string | null) => {
  const [data, setData] = useState<RedisData>({
    loading: true,
    error: null
  });

  useEffect(() => {
    let mounted = true;
    const pollInterval = 1000; // Poll every second

    const fetchData = async () => {
      if (!sessionId) {
        if (mounted) {
          setData(prev => ({ ...prev, loading: false }));
        }
        return;
      }

      try {
        const response = await fetch(`/api/redis-data/${sessionId}`);
        const result = await response.json();

        if (mounted) {
          if (result.status === 'success') {
            setData({
              ...result.data,
              loading: false,
              error: null
            });
          } else {
            setData(prev => ({
              ...prev,
              loading: false,
              error: result.message || 'Failed to fetch Redis data'
            }));
          }
        }
      } catch (error) {
        if (mounted) {
          setData(prev => ({
            ...prev,
            loading: false,
            error: 'Failed to fetch Redis data'
          }));
        }
      }
    };

    // Initial fetch
    fetchData();

    // Set up polling
    const interval = setInterval(fetchData, pollInterval);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [sessionId]);

  return data;
};

export const useSessionsRedisData = () => {
  const [data, setData] = useState<SessionsRedisData>({
    publicSessions: [],
    currentSession: null,
    userData: null,
    loading: true,
    error: null
  });

  useEffect(() => {
    let mounted = true;
    const pollInterval = 1000; // Poll every second

    const fetchData = async () => {
      try {
        const response = await fetch('/api/redis-data/sessions/all');
        const result = await response.json();

        if (mounted) {
          if (result.status === 'success') {
            setData({
              ...result.data,
              loading: false,
              error: null
            });
          } else {
            setData(prev => ({
              ...prev,
              loading: false,
              error: result.message || 'Failed to fetch sessions data'
            }));
          }
        }
      } catch (error) {
        if (mounted) {
          setData(prev => ({
            ...prev,
            loading: false,
            error: 'Failed to fetch sessions data'
          }));
        }
      }
    };

    // Initial fetch
    fetchData();

    // Set up polling
    const interval = setInterval(fetchData, pollInterval);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  return data;
}; 