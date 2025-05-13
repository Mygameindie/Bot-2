require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const express = require('express');
const OpenAI = require('openai');

// Configure OpenRouter (OpenAI-compatible SDK) with required headers
const openai = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
  defaultHeaders: {
    'HTTP-Referer': 'https://render.com', // or your own domain
    'X-Title': 'discord-deepseek-bot'
  }
});

if (!process.env.OPENROUTER_API_KEY || !process.env.DISCORD_TOKEN) {
  console.error("Missing environment variables.");
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

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

  if (history.length > 11) {
    const systemMsg = history.shift();
    history.splice(0, history.length - 10);
    history.unshift(systemMsg);
  }

  try {
    await message.channel.sendTyping();

    const completion = await openai.chat.completions.create({
      model: "deepseek-ai/deepseek-chat",
      messages: history,
      temperature: 0.7,
      max_tokens: 150
    });

    const reply = completion.choices[0].message.content;
    history.push({ role: "assistant", content: reply });

    await message.reply(reply);
  } catch (err) {
    console.error("OpenRouter/DeepSeek API Error:");
    if (err.response) {
      console.error("Status Code:", err.response.status);
      console.error("Response Data:", JSON.stringify(err.response.data, null, 2));
    } else {
      console.error("Error Message:", err.message);
    }
    await message.reply("I ran into an error trying to reply. Please try again later.");
  }
});

const app = express();
app.get('/health', (_, res) => res.json({ status: 'ok' }));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Web server running on port ${PORT}`));

client.login(process.env.DISCORD_TOKEN);
