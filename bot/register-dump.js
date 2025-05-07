const { REST, Routes } = require('discord.js');
const { token } = require('./config.json');

// Get the dump command
const command = require('./commands/dump.js');
const commandJson = command.data.toJSON();

// Register it with Discord
const rest = new REST({ version: '10' }).setToken(token);

const clientId = '1368694153017430137';
const guildId = '1343665600588681306';

async function registerCommand() {
    try {
        console.log(`Started registering dump command...`);
        
        await rest.put(
            Routes.applicationGuildCommands(clientId, guildId),
            { body: [commandJson] }
        );
        
        console.log('Dump command registered successfully!');
    } catch (error) {
        console.error(error);
    }
}

registerCommand();