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
  // Ensure money field exists for existing users
  if (userDetails.money === undefined) {
    userDetails.money = 1000;
  }
  
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