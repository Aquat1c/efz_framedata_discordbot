const { Client, GatewayIntentBits, Collection } = require('discord.js');
const { token } = require('./config.json'); // Only token in the config
const fs = require('fs');
const path = require('path');
const { Routes } = require('discord-api-types/v10');
const { REST } = require('@discordjs/rest');

// Initialize the Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions, // ✅ correct name
    GatewayIntentBits.DirectMessages
  ]
});

// Set up command collection
client.commands = new Collection();

// Load command files
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
  const command = require(path.join(commandsPath, file));
  client.commands.set(command.data.name, command);
}

// Register slash commands with Discord API
async function registerCommands(guildIds) {
  const commands = client.commands.map(cmd => cmd.data.toJSON());

  const rest = new REST({ version: '10' }).setToken(token);

  try {
    console.log('Started refreshing application (/) commands.');

    for (const guildId of guildIds) {
      await rest.put(
        Routes.applicationGuildCommands(client.user.id, guildId),
        { body: commands }
      );
      console.log(`Successfully registered commands for guild ${guildId}`);
    }
  } catch (error) {
    console.error('Error registering commands:', error);
  }
}

// When bot is ready
client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);

  const guildIds = client.guilds.cache.map(guild => guild.id);
  console.log('Guilds:', guildIds);

  await registerCommands(guildIds);
});

// Handle all interactions
client.on('interactionCreate', async interaction => {
  // Autocomplete support
  if (interaction.isAutocomplete()) {
    const command = client.commands.get(interaction.commandName);
    if (!command || typeof command.autocomplete !== 'function') return;

    try {
      await command.autocomplete(interaction);
    } catch (err) {
      console.error(`Error handling autocomplete for ${interaction.commandName}:`, err);
    }

    return;
  }

  // Slash command support
  if (interaction.isCommand()) {
    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    try {
      await command.execute(interaction);
    } catch (err) {
      console.error(`Error executing command ${interaction.commandName}:`, err);
      
      // Only reply if the interaction hasn't been replied to
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ 
          content: 'There was an error executing this command!', 
          ephemeral: true 
        });
      }
    }
  }

  // Button interaction support
  if (interaction.isButton()) {
    try {
      // Handle character-related buttons
      if (interaction.customId.includes('character:')) {
        const parts = interaction.customId.split(':');
        // Parts[0] is "character", parts[1] is characterName, parts[2] is moveListId, parts[3] is moveName, parts[4] is version
        // We ignore parts[5] and parts[6] which are timestamp and random string
        
        const characterCommand = require('./commands/character');
        await characterCommand.buttonHandler(interaction);
      }
      else if (interaction.customId.includes('swap_movelist:')) {
        const characterCommand = require('./commands/character');
        await characterCommand.buttonHandler(interaction);
      }
      else if (interaction.customId.includes('version:')) {
        const characterCommand = require('./commands/character');
        await characterCommand.buttonHandler(interaction);
      }
      
      // Add other button handlers as needed
    } catch (err) {
      console.error(`Error handling button interaction ${interaction.customId}:`, err);
      
      // Only reply if the interaction hasn't been replied to yet
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ 
          content: 'There was an error processing this button!', 
          ephemeral: true 
        });
      }
    }
  }
});

// Start bot
client.login(token);
