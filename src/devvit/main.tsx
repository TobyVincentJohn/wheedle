import { Devvit, Post } from '@devvit/public-api';

// Side effect import to bundle the server. The /index is required for server splitting.
import '../server/index';
import { defineConfig } from '@devvit/server';

Devvit.configure({
   http: true,
  redditAPI: true,  
  redis: true,  
  media: true,  
});

defineConfig({
  name: 'wheedle',
  entry: 'index.html',
  height: 'tall',
  menu: {
    enable: true,
    label: 'Wheedle Game',
    postTitle: 'Wheedle - The Ultimate Persuasion Game',
    preview: <Preview text="🎮 Convince the AI and win the prize! 🎮" />,
  },
});

export const Preview: Devvit.BlockComponent<{ text?: string }> = ({ text = '🎮 Wheedle - The Ultimate Persuasion Game! 🎮' }) => {
  return (
    <zstack width={'100%'} height={'100%'} alignment="center middle" backgroundColor="#1a1a1a">
      <vstack width={'100%'} height={'100%'} alignment="center middle" gap="medium">
        <image
          url="thumbnail.jpg"
          description="Wheedle Game"
          height={'120px'}
          width={'120px'}
          imageHeight={'120px'}
          imageWidth={'120px'}
        />
        <text maxWidth={'90%'} size="large" weight="bold" alignment="center middle" wrap color="#FFD700">
          {text}
        </text>
        <text size="medium" alignment="center middle" color="#ffffff" wrap maxWidth={'85%'}>
          A multiplayer persuasion game where you convince an AI judge to win the prize!
        </text>
      </vstack>
    </zstack>
  );
};

Devvit.addMenuItem({
  label: 'Wheedle Game',
  location: 'subreddit',
  forUserType: 'moderator',
  onPress: async (_event, context) => {
    const { reddit, ui } = context;

    let post: Post | undefined;
    try {
      const subreddit = await reddit.getCurrentSubreddit();
      post = await reddit.submitPost({
        title: 'Wheedle - The Ultimate Persuasion Game',
        subredditName: subreddit.name,
        preview: <Preview text="🎮 Join the game and convince the AI! 🎮" />,
      });
      ui.showToast({ text: 'Created post!' });
      ui.navigateTo(post.url);
    } catch (error) {
      if (post) {
        await post.remove(false);
      }
      if (error instanceof Error) {
        ui.showToast({ text: `Error creating post: ${error.message}` });
      } else {
        ui.showToast({ text: 'Error creating post!' });
      }
    }
  },
});

export default Devvit;