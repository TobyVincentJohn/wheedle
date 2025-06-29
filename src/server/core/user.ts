export const incrementUserWins = async ({
  redis,
  userId,
}: {
  redis: RedisClient;
  userId: string;
  console.log('[LEADERBOARD] Found', userIds.length, 'user IDs in active list');
  
}): Promise<void> => {
  console.log('[LEADERBOARD] Starting to fetch leaderboard with limit:', limit);
  
  console.log('[WINS] Attempting to increment wins for userId:', userId);
  const user = await userGet({ redis, userId });
      // Ensure wins field exists and is a number
      if (typeof user.wins !== 'number') {
        user.wins = 0;
      }
  if (user) {
      console.log('[LEADERBOARD] Added user:', user.username, 'with', user.wins, 'wins');
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
    console.log('[LEADERBOARD] No active users list found');
  }
  console.log('[LEADERBOARD] Sorted users by wins:');
  sortedUsers.forEach((user, index) => {
    console.log(`[LEADERBOARD] ${index + 1}. ${user.username}: ${user.wins || 0} wins`);
  });

    console.error('[WINS] User not found for userId:', userId);
  const result = sortedUsers.slice(0, limit);
  console.log('[LEADERBOARD] Returning', result.length, 'users');
  return result;
};