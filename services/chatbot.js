require('dotenv').config();

const { Client, GatewayIntentBits, REST, Routes } = require('discord.js');
const { constructDungeon, startTheAdventure, processPlayerResponse } = require('./openai');

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

const commands = [
  {
    name: 'start',
    type: 1, // CHAT_INPUT
    description: 'Start a new D&D game!',
  },
  {
    name: 'action',
    type: 1, // CHAT_INPUT
    description: 'Send an action to the DM.',
    options: [
      {
        name: 'description',
        type: 3, // STRING
        description: 'Describe the action you want to take',
        required: true,
      },
    ],
  },
];

const rest = new REST({ version: '10' }).setToken(TOKEN);

async function registerCommands() {
  try {
    console.log('Started refreshing application (/) commands.');
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
    console.log('Successfully reloaded application (/) commands.');
  } catch (error) {
    console.error(error);
  }
}

try {
  console.log('Started refreshing application (/) commands.');
  registerCommands();
  console.log('Successfully reloaded application (/) commands.');
} catch (error) {
  console.error(error);
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const userSessions = {};

const SERVER_URL = 'https://dungeonmaister.azurewebsites.net'; // Replace with your server's URL

client.on('ready', () => {
  console.log(`Logged in as ${client.user.tag}!`);
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const userId = interaction.user.id; 

  await interaction.deferReply();

  try {
    if (interaction.commandName === 'start') {
      const [dungeon, sessionId] = await constructDungeon(); 
      userSessions[userId] = sessionId;
      const result = await startTheAdventure(dungeon, sessionId); 
      await interaction.editReply(result.response);
    } else if (interaction.commandName === 'action') {
      const playerAction = interaction.options.getString('description');
      console.log("the player action", playerAction);
      const sessionId = userSessions[userId];
      console.log("sessionId", sessionId);
      if (!sessionId) {
        await interaction.editReply("You haven't started a game yet. Use the /start command first.");
        return;
      }
      const result = await processPlayerResponse(playerAction, sessionId);
      console.log("result", result);
      const combinedResponse = `**${interaction.user.username}**: ${playerAction}\n\n${result.response}`;
      await interaction.editReply(combinedResponse);
      console.log("result.response", result.response);
    }
  } catch (error) {
    console.error("Error handling interaction:", error);
    await interaction.editReply("There was an error processing your command.");
  }
});

const startBot = () => {
  client.login(process.env.TOKEN);
};

module.exports = {
  startBot
}