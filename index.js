require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const express = require('express');
const OpenAI = require('openai');

const openai = new OpenAI({
  baseURL: 'https://api.deepseek.com',
  apiKey: process.env.DEEPSEEK_API_KEY
});

if (!process.env.DEEPSEEK_API_KEY || !process.env.DISCORD_TOKEN) {
  console.error("Missing required environment variables: DEEPSEEK_API_KEY or DISCORD_TOKEN");
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
      model: "deepseek-chat",
      messages: history,
      temperature: 0.7,
      max_tokens: 150
    });

    const reply = completion.choices[0].message.content;
    history.push({ role: "assistant", content: reply });

    await message.reply(reply);
  } catch (err) {
    console.error("DeepSeek API Error:");
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
