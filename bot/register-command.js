const { REST, Routes } = require('discord.js');
const { token } = require('./config.json');
const fs = require('fs');
const path = require('path');

// Get the RELOAD command
const command = require('./commands/reload.js');
const commandJson = command.data.toJSON();

// Register it with Discord
const rest = new REST({ version: '10' }).setToken(token);

// Use the IDs you provided
const clientId = '1368694153017430137';  // Your Application ID
const guildId = '1343665600588681306';   // Your Server ID

async function registerCommand() {
    try {
        console.log(`Started refreshing the character command`);
        
        // Only register the one command
        await rest.put(
            Routes.applicationGuildCommands(clientId, guildId),
            { body: [commandJson] }
        );
        
        console.log('Character command registered successfully');
    } catch (error) {
        console.error(error);
    }
}

registerCommand();

// Add this to the end of register-command.js after registerCommand()
console.log('Updating command in the running bot...');
try {
    // Get access to the already running client
    const { client } = require('./start.js');
    
    // Clear the command from cache
    delete require.cache[require.resolve('./commands/character.js')];
    
    // Load the command fresh
    const freshCommand = require('./commands/character.js');
    
    // Update in the collection
    client.commands.set(freshCommand.data.name, freshCommand);
    
    console.log('Command updated in the running bot successfully!');
} catch (err) {
    console.error('Failed to update command in the running bot:', err);
}