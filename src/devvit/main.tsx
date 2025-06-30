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

export const Preview: Devvit.BlockComponent = () => {
  return (
    <zstack width={'100%'} height={'100%'} alignment="center middle">
      <image
        url="thumbnail.jpg"
        description="Wheedle Game"
        height={'100%'}
        width={'100%'}
        imageHeight={'100%'}
        imageWidth={'100%'}
        resizeMode="cover"
      />
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
        preview: <Preview />,
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