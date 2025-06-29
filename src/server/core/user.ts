import { RedisClient } from '@devvit/redis';
import { UserDetails } from '../../shared/types/user';

const getUserKey = (userId: string) => `user:${userId}` as const;
const ACTIVE_USERS_LIST_KEY = 'active_users_list' as const;

export const userGet = async ({
  redis,
  userId,
}: {
  redis: RedisClient;
  userId: string;
}): Promise<UserDetails | null> => {
  const data = await redis.get(getUserKey(userId));
  return data ? JSON.parse(data) : null;
};

export const userSet = async ({
  redis,
  userDetails,
}: {
  redis: RedisClient;
  userDetails: UserDetails;
}): Promise<void> => {
  // Store user details
  await redis.set(getUserKey(userDetails.userId), JSON.stringify(userDetails));
  
  // Update active users list
  const activeUsersList = await redis.get(ACTIVE_USERS_LIST_KEY);
  const activeUsers = activeUsersList ? JSON.parse(activeUsersList) as string[] : [];
  
  if (!activeUsers.includes(userDetails.userId)) {
    activeUsers.push(userDetails.userId);
    await redis.set(ACTIVE_USERS_LIST_KEY, JSON.stringify(activeUsers));
  }
};

export const userUpdate = async ({
  redis,
  userId,
  updates,
}: {
  redis: RedisClient;
  userId: string;
  updates: Partial<UserDetails>;
}): Promise<void> => {
  const currentUser = await userGet({ redis, userId });
  if (!currentUser) {
    throw new Error('User not found');
  }
  
  await userSet({
    redis,
    userDetails: {
      ...currentUser,
      ...updates,
      lastActive: Date.now(),
    },
  });
};

export const userDelete = async ({
  redis,
  userId,
}: {
  redis: RedisClient;
  userId: string;
}): Promise<void> => {
  // Delete user details
  await redis.del(getUserKey(userId));
  
  // Remove from active users list
  const activeUsersList = await redis.get(ACTIVE_USERS_LIST_KEY);
  if (activeUsersList) {
    const activeUsers = JSON.parse(activeUsersList) as string[];
    const updatedUsers = activeUsers.filter(id => id !== userId);
    await redis.set(ACTIVE_USERS_LIST_KEY, JSON.stringify(updatedUsers));
  }
};

// Get all active users (active in the last 5 minutes)
export const getActiveUsers = async ({
  redis,
}: {
  redis: RedisClient;
}): Promise<UserDetails[]> => {
  const activeUsersList = await redis.get(ACTIVE_USERS_LIST_KEY);
  if (!activeUsersList) {
    return [];
  }

  const userIds = JSON.parse(activeUsersList) as string[];
  const users: UserDetails[] = [];
  const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
  const updatedUserIds: string[] = [];

  for (const userId of userIds) {
    const user = await userGet({ redis, userId });
    if (user && user.lastActive > fiveMinutesAgo) {
      users.push(user);
      updatedUserIds.push(userId);
    }
  }

  // Update the active users list to remove inactive users
  if (updatedUserIds.length !== userIds.length) {
    await redis.set(ACTIVE_USERS_LIST_KEY, JSON.stringify(updatedUserIds));
  }

  return users;
};

export const incrementUserWins = async ({
  redis,
  userId,
}: {
  redis: RedisClient;
  userId: string;
}): Promise<void> => {
  console.log('[WINS] Attempting to increment wins for userId:', userId);
  const user = await userGet({ redis, userId });
  
  if (user) {
    // Ensure wins field exists and is a number
    if (typeof user.wins !== 'number') {
      user.wins = 0;
    }
    
    const currentWins = user.wins || 0;
    console.log('[WINS] Current wins for', user.username, ':', currentWins);
    console.log('[WINS] Incrementing wins from', currentWins, 'to', currentWins + 1);
    
    await userUpdate({
      redis,
      userId,
      updates: {
        wins: currentWins + 1,
      },
    });
    
    console.log(`[WINS] User ${user.username} wins incremented to ${currentWins + 1}`);
  } else {
    console.error('[WINS] User not found for userId:', userId);
  }
};

export const getLeaderboard = async ({
  redis,
  limit = 10,
}: {
  redis: RedisClient;
  limit?: number;
}): Promise<UserDetails[]> => {
  console.log('[LEADERBOARD] Starting to fetch leaderboard with limit:', limit);
  
  const activeUsersList = await redis.get(ACTIVE_USERS_LIST_KEY);
  if (!activeUsersList) {
    console.log('[LEADERBOARD] No active users list found');
    return [];
  }

  const userIds = JSON.parse(activeUsersList) as string[];
  console.log('[LEADERBOARD] Found', userIds.length, 'user IDs in active list');
  
  const users: UserDetails[] = [];

  for (const userId of userIds) {
    const user = await userGet({ redis, userId });
    if (user) {
      // Ensure wins field exists and is a number
      if (typeof user.wins !== 'number') {
        user.wins = 0;
      }
      users.push(user);
      console.log('[LEADERBOARD] Added user:', user.username, 'with', user.wins, 'wins');
    }
  }

  // Sort users by wins in descending order
  const sortedUsers = users.sort((a, b) => (b.wins || 0) - (a.wins || 0));
  
  console.log('[LEADERBOARD] Sorted users by wins:');
  sortedUsers.forEach((user, index) => {
    console.log(`[LEADERBOARD] ${index + 1}. ${user.username}: ${user.wins || 0} wins`);
  });

  const result = sortedUsers.slice(0, limit);
  console.log('[LEADERBOARD] Returning', result.length, 'users');
  return result;
};