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
  menu: { enable: false },
});

// Custom post preview component that fills the entire area
export const GameThumbnail: Devvit.BlockComponent = () => {
  return (
    <zstack width={'100%'} height={'100%'} alignment="center middle">
      <image
        url="thumbnail.jpg"
        description="Wheedle Game"
        height={'100%'}
        width={'100%'}
        resizeMode="cover"
      />
    </zstack>
  );
};

// TODO: Remove this when defineConfig allows webhooks before post creation
Devvit.addMenuItem({
  label: 'wheedle',
  location: 'subreddit',
  forUserType: 'moderator',
  onPress: async (_event, context) => {
    const { reddit, ui } = context;

    let post: Post | undefined;
    try {
      const subreddit = await reddit.getCurrentSubreddit();
      
      // Create the post with custom preview
      post = await reddit.submitPost({
        title: 'Wheedle',
        subredditName: subreddit.name,
        preview: <GameThumbnail />,
      });

      // Set the custom post preview to make it permanent
      await post.setCustomPostPreview(() => <GameThumbnail />);
      
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