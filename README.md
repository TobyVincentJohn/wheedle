## 🎮 Wheedle - The Ultimate Reddit Persuasion Game

Welcome to Wheedle, a retro-style Reddit game where your words are worth their weight in gold! 🪙

### 🎯 Game Concept

In Wheedle, players enter a high-stakes battle of wit and persuasion. Here's how it works:

1. 💰 **Buy-in**: Players start by contributing their Reddit coins to the prize pool
2. 🎭 **The Challenge**: Convince our retro-styled AI judge that you're the most deserving of the total prize
3. 🤖 **AI Judge**: Our impartial AI evaluates each player's case based on creativity, humor, and persuasiveness
4. 🏆 **Winner Takes All**: The most convincing player walks away with everyone's coins!

### 🌟 Features

- Retro-style UI reminiscent of classic text adventures
- Real-time interaction with our quirky AI judge
- Secure coin handling through Reddit's platform
- Fair and transparent judging system
- Multiple players can join each game session

### 🎲 How to Play

1. Find an active game post in the subreddit
2. Comment with `!join` to enter (requires coin buy-in)
3. Once the game starts, make your case to the AI judge
4. The AI will interact with players and eventually crown a winner

### 🛠️ Development Setup

This game is built using Reddit's Devvit platform. To set up the development environment:

## Getting Started

This template is made specifically to work with **Bolt.new**.
Click the button below to open this template directly in Bolt:

<a href="https://bolt.new/github.com/reddit/devvit-bolt-starter-experimental"><img src="docs-img/open-in-bolt-2x.png" heigh="36px" width="199px" alt="Open in Bolt"></a>

### Step 1: Login

In bolt terminal, run

```
npm run login
```

This will authenticate with Reddit. You will be prompted to follow a link and paste an authentication code.
Paste that authentication code in your **terminal window** in Bolt, then press `<Enter>`.

### Step 2: App Initialization

In bolt terminal, run

```
npm run devvit:init
```

This will get your app set up with Devvit. You will be prompted to follow a link and paste an authentication code. Paste that authentication code in your **terminal window** in Bolt, then press `<Enter>`.

### Step 3: Playtest subreddit

Create a test subreddit on Reddit by clicking the **"Create a Community"** button in the left-side navigation. Once created, update the subreddit name in `package.json`, replacing `YOUR_SUBREDDIT_NAME` with your new subreddit's name.

### Known limitations

- **Only test on your subreddit:** Your app's backend requests will not work on Bolt's preview window. Test your app in your subreddit where backend code will work.
- **Use Reddit's backend:** Devvit provides a free scalable backend with Redis database for key-value storage.
- **This is experimental:** For support, [join our Discord](https://discord.com/invite/Cd43ExtEFS) and ask questions in **#devvit-vibe-coding**

### 🔒 Security Note

All coin transactions are handled securely through Reddit's platform. The game uses Reddit's built-in coin system to ensure fair play and secure transactions.

### 🤝 Contributing

Feel free to contribute to this project! Whether it's improving the AI judge, enhancing the retro UI, or adding new features, all contributions are welcome.

### 📜 License

BSD-3-Clause
