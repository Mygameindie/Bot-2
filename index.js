require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const axios = require('axios');
const express = require('express');

if (!process.env.DEEPSEEK_API_KEY || !process.env.DISCORD_TOKEN) {
  console.error("Missing required environment variables: DEEPSEEK_API_KEY or DISCORD_TOKEN");
  process.exit(1);
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

const conversations = new Map();

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  if (!conversations.has(message.author.id)) {
    conversations.set(message.author.id, [
      {
        role: "system",
        content: "You are a friendly and helpful AI assistant. Be concise but engaging in your responses."
      }
    ]);
  }

  const conversationHistory = conversations.get(message.author.id);
  conversationHistory.push({ role: "user", content: message.content });

  if (conversationHistory.length > 10) {
    const systemMessage = conversationHistory.shift();
    conversationHistory.splice(0, conversationHistory.length - 9);
    conversationHistory.unshift(systemMessage);
  }

  try {
    await message.channel.sendTyping();

    const response = await axios.post('https://api.deepseek.com/v1/chat/completions', {
      model: "deepseek-chat",
      messages: conversationHistory,
      temperature: 0.7,
      max_tokens: 150
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    const reply = response.data.choices[0].message.content;

    conversationHistory.push({ role: "assistant", content: reply });
    await message.reply(reply);
  } catch (error) {
    console.error('DeepSeek API Error:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('Message:', error.message);
    }
    await message.reply("I encountered an error processing your message. Please try again later.");
  }
});

client.on('error', (error) => console.error('Discord Client Error:', error));

const app = express();
app.get('/health', (req, res) => res.status(200).json({ status: 'ok' }));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Web server running on port ${PORT}`));

client.login(process.env.DISCORD_TOKEN);