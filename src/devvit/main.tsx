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

// Custom post type for Wheedle game
Devvit.addCustomPostType({
  name: 'Wheedle Game',
  height: 'tall',
  render: (context) => {
    const { useState } = context;
    const [showWebview, setShowWebview] = useState(false);

    // If webview should be shown, render the webview
    if (showWebview) {
      return (
        <webview 
          id="wheedle-game" 
          url="index.html" 
          width="100%" 
          height="100%" 
        />
      );
    }

    // Otherwise, show the game thumbnail that users can click to launch
    return (
      <zstack width="100%" height="100%" onPress={() => setShowWebview(true)}>
        <image
          url="thumbnail.jpg"
          description="Wheedle - The Ultimate Persuasion Game"
          width="100%"
          height="100%"
          resizeMode="cover"
        />
        {/* Optional: Add a subtle play button overlay */}
        <vstack alignment="center middle" width="100%" height="100%">
          <spacer grow />
          <hstack alignment="center middle" backgroundColor="rgba(0,0,0,0.7)" cornerRadius="full" padding="medium">
          </hstack>
          <spacer grow />
        </vstack>
      </zstack>
    );
  },
});

// Menu item to create the custom post
Devvit.addMenuItem({
  label: 'Create Wheedle Game',
  location: 'subreddit',
  forUserType: 'moderator',
  onPress: async (_event, context) => {
    const { reddit, ui } = context;

    try {
      const subreddit = await reddit.getCurrentSubreddit();
      
      // Create the custom post
      const post = await reddit.submitPost({
        title: 'Wheedle - The Ultimate Persuasion Game',
        subredditName: subreddit.name,
        // Use the custom post type
        preview: (
          <zstack width="100%" height="100%">
            <image
              url="thumbnail.jpg"
              description="Wheedle - The Ultimate Persuasion Game"
              width="100%"
              height="100%"
              resizeMode="cover"
            />
            <vstack alignment="center middle" width="100%" height="100%">
              <spacer grow />
              <hstack alignment="center middle" backgroundColor="rgba(0,0,0,0.7)" cornerRadius="full" padding="medium">
                <text color="white" size="large" weight="bold">▶ PLAY</text>
              </hstack>
              <spacer grow />
            </vstack>
          </zstack>
        ),
      });
      
      ui.showToast({ text: 'Wheedle game post created!' });
      ui.navigateTo(post.url);
    } catch (error) {
      if (error instanceof Error) {
        ui.showToast({ text: `Error creating post: ${error.message}` });
      } else {
        ui.showToast({ text: 'Error creating post!' });
      }
    }
  },
});

export default Devvit;