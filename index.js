const { Client, Events, GatewayIntentBits } = require('discord.js');
const { handleCasino }    = require('./casino/handler');
const { handleMeal }      = require('./meal/handler');
const { handleScheduler, initScheduler } = require('./scheduler/handler');

const token  = process.env.DISCORD_TOKEN;
const client = new Client({ intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
]});

client.once(Events.ClientReady, readyClient => {
    console.log(`Ready! Logged in as ${readyClient.user.tag}`);
    initScheduler();
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    if (await handleCasino(message))   return;
    if (await handleScheduler(message)) return;
    await handleMeal(message);
});

client.login(token);
