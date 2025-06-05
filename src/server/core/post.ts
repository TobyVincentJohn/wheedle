import { Context } from '@devvit/public-api';
import { getWordOfTheDay } from './words';
import { RedisClient } from '@devvit/redis';

type PostConfig = {
  wordOfTheDay: string;
};

const getPostConfigKey = (postId: string) => `post_config:${postId}` as const;

export const postConfigMaybeGet = async ({
  redis,
  postId,
}: {
  redis: Context['redis'] | RedisClient;
  postId: string;
}): Promise<PostConfig | undefined> => {
  const config = await redis.get(getPostConfigKey(postId));
  return config ? JSON.parse(config) : undefined;
};

export const postConfigGet = async ({
  redis,
  postId,
}: {
  redis: Context['redis'] | RedisClient;
  postId: string;
}): Promise<PostConfig> => {
  const config = await postConfigMaybeGet({ redis, postId });
  if (!config) throw new Error('Post config not found');
  return config;
};

export const postConfigSet = async ({
  redis,
  postId,
  config,
}: {
  redis: Context['redis'];
  postId: string;
  config: Partial<PostConfig>;
}): Promise<void> => {
  await redis.set(getPostConfigKey(postId), JSON.stringify(config));
};

export const postConfigNew = async ({
  redis,
  postId,
}: {
  redis: Context['redis'] | RedisClient;
  postId: string;
}): Promise<void> => {
  const wordOfTheDay = getWordOfTheDay();

  if (!wordOfTheDay) {
    throw new Error('No word of the day found');
  }

  await redis.set(getPostConfigKey(postId), JSON.stringify({ wordOfTheDay } satisfies PostConfig));
};
