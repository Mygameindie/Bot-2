require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const axios = require('axios');
const express = require('express');

// Check for required environment variables
if (!process.env.DEEPSEEK_API_KEY || !process.env.DISCORD_TOKEN) {
  console.error("Missing required environment variables: DEEPSEEK_API_KEY or DISCORD_TOKEN");
  process.exit(1);
}

// Create Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// In-memory conversation history (per user)
const conversations = new Map();

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  const userId = message.author.id;

  // Start new conversation if none exists
  if (!conversations.has(userId)) {
    conversations.set(userId, [
      {
        role: "system",
        content: "You are a friendly and helpful AI assistant. Be concise but engaging in your responses."
      }
    ]);
  }

  const history = conversations.get(userId);
  history.push({ role: "user", content: message.content });

  // Trim history to max 10 messages + system
  if (history.length > 11) {
    const systemMsg = history.shift();
    history.splice(0, history.length - 10);
    history.unshift(systemMsg);
  }

  try {
    await message.channel.sendTyping();

    const response = await axios.post('https://api.deepseek.com/v1/chat/completions', {
      model: "deepseek-chat",
      messages: history,
      temperature: 0.7,
      max_tokens: 150
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    const reply = response.data.choices[0].message.content;
    history.push({ role: "assistant", content: reply });

    await message.reply(reply);
  } catch (err) {
    console.error("DeepSeek API Error:");
    if (err.response) {
      console.error("Status:", err.response.status);
      console.error("Data:", err.response.data);
    } else {
      console.error("Message:", err.message);
    }
    await message.reply("I ran into an error trying to reply. Please try again later.");
  }
});

// Optional health check
const app = express();
app.get('/health', (_, res) => res.json({ status: 'ok' }));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Web server running on port ${PORT}`));

// Login to Discord
client.login(process.env.DISCORD_TOKEN);