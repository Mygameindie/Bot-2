require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const express = require('express');
const OpenAI = require('openai');

// Initialize DeepSeek API via OpenAI-compatible SDK
const openai = new OpenAI({
  baseURL: 'https://api.deepseek.com',
  apiKey: process.env.DEEPSEEK_API_KEY
});

// Check required environment variables
if (!process.env.DEEPSEEK_API_KEY || !process.env.DISCORD_TOKEN) {
  console.error("Missing required environment variables: DEEPSEEK_API_KEY or DISCORD_TOKEN");
  process.exit(1);
}

// Set up Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// Per-user conversation tracking
const conversations = new Map();

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  const userId = message.author.id;

  if (!conversations.has(userId)) {
    conversations.set(userId, [
      {
        role: "system",
        content: "You are a helpful assistant."
      }
    ]);
  }

  const history = conversations.get(userId);
  history.push({ role: "user", content: message.content });

  // Trim messages: keep system + last 10
  if (history.length > 11) {
    const systemMsg = history.shift();
    history.splice(0, history.length - 10);
    history.unshift(systemMsg);
  }

  try {
    await message.channel.sendTyping();

    const completion = await openai.chat.completions.create({
      model: "deepseek-chat",
      messages: history,
      temperature: 0.7,
      max_tokens: 150
    });

    const reply = completion.choices[0].message.content;
    history.push({ role: "assistant", content: reply });

    await message.reply(reply);
  } catch (err) {
    console.error("DeepSeek API Error:", err);
    await message.reply("There was an error while processing your message.");
  }
});

// Health check endpoint
const app = express();
app.get('/health', (_, res) => res.json({ status: 'ok' }));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Web server running on port ${PORT}`));

// Start Discord bot
client.login(process.env.DISCORD_TOKEN);