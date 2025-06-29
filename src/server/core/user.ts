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