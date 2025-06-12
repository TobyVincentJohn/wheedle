import { useState, useEffect, useCallback } from 'react';
import { UserDetails } from '../../shared/types/user';

export const useUser = () => {
  const [user, setUser] = useState<UserDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUser = useCallback(async () => {
    try {
      const response = await fetch('/api/users/current');
      const data = await response.json();
      
      if (data.status === 'success') {
        setUser(data.data);
      } else {
        // If user doesn't exist, create a new user
        const createResponse = await fetch('/api/users', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            lastActive: Date.now()
          }),
        });
        const createData = await createResponse.json();
        if (createData.status === 'success') {
          setUser(createData.data);
        } else {
          setError('Failed to create user');
        }
      }
    } catch (err) {
      setError('Failed to fetch user');
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch('/api/users/current', { method: 'DELETE' });
      setUser(null);
      // Refetch to create a new user with Reddit username
      await fetchUser();
    } catch (err) {
      setError('Failed to logout');
    }
  }, [fetchUser]);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  return { user, loading, error, logout };
}; 