import { useState, useEffect, useCallback } from 'react';
import { UserDetails } from '../../shared/types/user';

export const useUser = () => {
  const [user, setUser] = useState<UserDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUser = useCallback(async () => {
    try {
      console.log('🔍 Fetching current user...');
      const response = await fetch('/api/users/current');
      console.log('📡 Response status:', response.status);

      // If user is not found (404), we'll proceed to create one.
      // For other errors, we throw.
      if (!response.ok && response.status !== 404) {
        console.log(`❌ HTTP error! status: ${response.status}`);
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        console.error('❌ Non-JSON response:', text);
        // Don't throw here if it's a 404, as the body might be empty or non-JSON.
        if (response.status !== 404) {
          throw new Error('Server returned non-JSON response');
        }
      }
      
      const data = response.status === 404 ? { status: 'not-found' } : await response.json();
      console.log('📦 User data response:', data);
      
      if (data.status === 'success') {
        console.log('✅ User found:', data.data.username);
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

  const refreshUser = useCallback(async () => {
    try {
      const response = await fetch('/api/users/current');
      const data = await response.json();
      
      if (data.status === 'success') {
        setUser(data.data);
      }
    } catch (err) {
      console.error('Failed to refresh user:', err);
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

  return { user, loading, error, logout, refreshUser };
}; 