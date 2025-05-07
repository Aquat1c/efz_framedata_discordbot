const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs = require('fs').promises;
const path = require('path');

const charactersDir = path.join(__dirname, '..', 'characters');
const testCharactersDir = path.join(__dirname, '..', 'test', 'characters');

// Read and cache character data on startup
let allCharacterData = [];

// Load from main characters directory
async function loadCharacterData() {
  try {
    // Track loaded character names to avoid duplicates
    const loadedCharacters = new Set();
    allCharacterData = [];

    // Function to load from a directory
    const loadFromDir = async (dirPath) => {
      try {
        const files = await fs.readdir(dirPath).catch(() => []);
        
        for (const file of files) {
          if (file.endsWith('.json')) {
            try {
              const filePath = path.join(dirPath, file);
              const raw = await fs.readFile(filePath, 'utf8');
              const data = JSON.parse(raw);
              
              // Get character name (normalize it for comparison)
              const characterName = (data.character || data.name || '').toLowerCase();
              
              // Skip if already loaded or invalid
              if (!characterName || loadedCharacters.has(characterName)) continue;
              
              // Add to loaded set
              loadedCharacters.add(characterName);
              
              // Add to character data array
              allCharacterData.push(data);
            } catch (e) {
              console.warn(`Failed to load ${file}: ${e.message}`);
            }
          }
        }
      } catch (err) {
        console.error(`Failed to read directory: ${err.message}`);
      }
    };

    // Load from main characters directory
    await loadFromDir(charactersDir);
    
    // Load from test characters directory
    await loadFromDir(testCharactersDir);
    
    console.log(`Loaded ${allCharacterData.length} characters`);
  } catch (err) {
    console.error(`Failed to read characters directories: ${err.message}`);
  }
}

loadCharacterData();

// Fix the function that creates the button rows
function splitButtonsIntoRows(buttons, maxButtonsPerRow = 5) {
  const rows = [];
  if (!buttons || buttons.length === 0) return rows;
  
  for (let i = 0; i < buttons.length; i += maxButtonsPerRow) {
    const row = new ActionRowBuilder();
    const rowButtons = buttons.slice(i, i + maxButtonsPerRow);
    if (rowButtons.length > 0) { // Make sure we have at least one button
      row.addComponents(...rowButtons);
      rows.push(row);
    }
  }
  return rows;
}

// Update the createUniqueId function to ensure uniqueness
function createUniqueId(baseId) {
  // Add a timestamp plus random string to ensure uniqueness
  return `${baseId}:${Date.now()}:${Math.random().toString(36).substring(2, 8)}`;
}

function truncateText(text, maxLength = 1000) {
  if (!text || text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + "...";
}

// Helper function to find a move by name or input
function findMoveByNameOrInput(character, searchValue) {
  const results = [];
  const searchLower = searchValue.toLowerCase();
  
  // First, check if the search value looks like an input notation
  const isInputNotation = /^[1-9]+.*\*?$|^j\..*$|^\d+\w$/.test(searchValue);
  
  // If character has movelists (new format)
  if (character.movelists && Array.isArray(character.movelists)) {
    // First try to find exact input matches
    if (isInputNotation) {
      for (let mlIndex = 0; mlIndex < character.movelists.length; mlIndex++) {
        const movelist = character.movelists[mlIndex];
        if (movelist.moves) {
          for (const move of movelist.moves) {
            if (move && move.input && move.input.toLowerCase() === searchLower) {
              results.push({
                move,
                section: { name: "Moves" },
                moveList: movelist,
                moveListId: mlIndex
              });
              // Don't return yet - we want to search all movelists
            }
          }
        }
      }
      
      // If we found input matches, return them
      if (results.length > 0) {
        return results;
      }
    }
    
    // Then try exact move name matches
    for (let mlIndex = 0; mlIndex < character.movelists.length; mlIndex++) {
      const movelist = character.movelists[mlIndex];
      if (movelist.moves) {
        for (const move of movelist.moves) {
          // For special moves that begin with "Costume", also match by their input
          if (move && move.moveName && move.moveName.startsWith("Costume") && move.input) {
            // If searching for an input like "236*", prioritize this
            if (move.input.toLowerCase() === searchLower) {
              results.push({
                move,
                section: { name: "Moves" },
                moveList: movelist,
                moveListId: mlIndex
              });
              continue;
            }
            
            // Use the input notation as an alternative identifier
            const inputBase = move.input.split(/[*~]/)[0]; // Get base input like "236" from "236*"
            if (inputBase.toLowerCase() === searchLower) {
              results.push({
                move,
                section: { name: "Moves" },
                moveList: movelist,
                moveListId: mlIndex
              });
              continue;
            }
          }
          
          // Normal exact move name match
          if (move && move.moveName && move.moveName.toLowerCase() === searchLower) {
            results.push({
              move,
              section: { name: "Moves" },
              moveList: movelist,
              moveListId: mlIndex
            });
          }
        }
      }
    }
    
    // If we have exact matches, return them
    if (results.length > 0) {
      return results;
    }
    
    // Only if no exact matches were found, try partial matches
    for (let mlIndex = 0; mlIndex < character.movelists.length; mlIndex++) {
      const movelist = character.movelists[mlIndex];
      if (movelist.moves) {
        for (const move of movelist.moves) {
          // For special moves with "Costume" prefix, prioritize input matching
          if (move && move.moveName && move.moveName.startsWith("Costume") && move.input) {
            if (move.input.toLowerCase().includes(searchLower)) {
              if (!results.some(r => r.move === move)) {
                results.push({
                  move,
                  section: { name: "Moves" },
                  moveList: movelist,
                  moveListId: mlIndex
                });
              }
              continue;
            }
          }
          
          // Partial move name match
          if (move && move.moveName && move.moveName.toLowerCase().includes(searchLower)) {
            if (!results.some(r => r.move === move)) {
              results.push({
                move,
                section: { name: "Moves" },
                moveList: movelist,
                moveListId: mlIndex
              });
            }
          }
          // Partial input match
          else if (move && move.input && move.input.toLowerCase().includes(searchLower)) {
            if (!results.some(r => r.move === move)) {
              results.push({
                move,
                section: { name: "Moves" },
                moveList: movelist,
                moveListId: mlIndex
              });
            }
          }
        }
      }
    }
  }
  
  return results;
}

// Special function to handle Nayuki's moves
function handleNayukiMoves(character, moveName) {
  // Only process for Nayuki (asleep)
  if (character.name !== "Nayuki Minase (asleep)") return null;
  
  const searchLower = moveName.toLowerCase();
  
  // Special handling for Nayu-chan Kick (623) vs Nayu Leap (6B)
  if (searchLower.includes("nayu-chan") || 
      searchLower.includes("kick") || 
      searchLower === "623*" || 
      searchLower === "623c" || 
      searchLower === "623a" || 
      searchLower === "623b") {
    const allMoves = character.movelists[0].moves;
    const kickMove = allMoves.find(move => 
      (move.input === "623*" || move.moveName === "Nayu-chan Kick")
    );
    
    if (kickMove) {
      return {
        move: kickMove,
        section: { name: "Moves" },
        moveList: character.movelists[0],
        moveListId: 0
      };
    }
  }
  
  // Special handling for Zzz~ (214*) stance
  if (searchLower.includes("zzz") || searchLower.includes("214")) {
    const allMoves = character.movelists[0].moves;
    const stanceMove = allMoves.find(move => move.input === "214*" || move.moveName === "Zzz~");
    
    if (stanceMove) {
      return {
        move: stanceMove,
        section: { name: "Moves" },
        moveList: character.movelists[0],
        moveListId: 0
      };
    }
  }
  
  // Special handling for Rolling~ (41236*) 
  if (searchLower.includes("rolling") || searchLower.includes("41236")) {
    const allMoves = character.movelists[0].moves;
    const rollingMove = allMoves.find(move => move.input === "41236*" || move.moveName === "Rolling~");
    
    if (rollingMove) {
      return {
        move: rollingMove,
        section: { name: "Moves" },
        moveList: character.movelists[0],
        moveListId: 0
      };
    }
  }
  
  return null;
}

// Helper function to handle different data structures
function getMovesFromCharacter(character, moveListId = null) {
  // Check if character has moveLists structure with options
  if (character.moveLists && character.moveLists.options && Array.isArray(character.moveLists.options)) {
    const moveList = moveListId !== null 
      ? character.moveLists.options.find(ml => ml.id === parseInt(moveListId))
      : character.moveLists.options[0];
    
    if (moveList && moveList.sections) {
      return moveList.sections.flatMap(section => 
        section.moves.map(move => ({
          move,
          section,
          moveList
        }))
      );
    }
  } 
  // Check if character has sections directly
  else if (character.sections && Array.isArray(character.sections)) {
    return character.sections.flatMap(section => 
      section.moves.filter(Boolean).map(move => ({
        move,
        section,
        moveList: null
      }))
    );
  }
  // Check if character has movelists array (new format)
  else if (character.movelists && Array.isArray(character.movelists)) {
    const moveList = moveListId !== null 
      ? character.movelists[parseInt(moveListId)]
      : character.movelists[0];
    
    if (moveList && moveList.moves) {
      return moveList.moves.filter(Boolean).map(move => ({
        move,
        section: { name: "Moves" },
        moveList
      }));
    }
  }
  
  return [];
}

// Helper function to create an embed for a move
function createMoveEmbed(character, move, section, moveListName = null, version = 0) {
  const colorMap = {
    0: 0x4287f5, // Blue
    1: 0xf54242, // Red
    2: 0x42f54e, // Green
    3: 0xf5d442  // Yellow
  };
  
  const characterName = character.character || character.name;
  const moveName = move.name || move.moveName;
  
  const embed = new EmbedBuilder()
    .setTitle(`${characterName} - ${moveName}`)
    .setColor(colorMap[version % Object.keys(colorMap).length]);
    
  if (character.icon) {
    embed.setThumbnail(character.icon);
  }
  
  // Show parent move if applicable
  if (move.parentMove) {
    const parentName = move.parentMove.name || move.parentMove.moveName;
    const parentInput = move.parentMove.input || "";
    embed.setDescription(`*Follow-up of: ${parentName}${parentInput ? ` (${parentInput})` : ''}*`);
  }
  // Only add movelist name if character has multiple movelists
  else if (moveListName && hasMultipleMoveLists(character)) {
    embed.setDescription(`**${moveListName}**`);
  }
  
  // Add input if available
  if (move.input && move.input.trim()) {
    embed.addFields({ name: 'Input', value: move.input.trim() });
  }
  
  // Handle move variations
  let hasVersions = false;
  let versionCount = 1;
  let currentVersionObj = null;
  let versionLabels = [];
  let isBaseMove = true;
  
  if (move.variations && move.variations.length > 0) {
    hasVersions = true;
    versionCount = move.variations.length + 1; // +1 for base move
    
    // Create version labels, starting with "Base Move" for version 0
    versionLabels = ["Base Move", ...move.variations.map(v => v.version || '')];
    
    // If version is 0, show the base move info
    if (version === 0) {
      isBaseMove = true;
      
      // Add damage if available for base move
      if (move.damage && move.damage !== "/" && move.damage !== "") {
        embed.addFields({ name: 'Damage', value: move.damage.toString() });
      }
      
      // Add frame data for base move
      if (move.framedata) {
        let frameDataText = '';
        for (const [key, value] of Object.entries(move.framedata)) {
          if (!value || value === '' || value === '/' || value === '-') continue;
          frameDataText += `**${key}**: ${value}\n`;
        }
        
        if (frameDataText) {
          embed.addFields({ name: 'Frame Data', value: frameDataText });
        }
      }
      
      // Add properties/notes for base move
      if (move.properties && Array.isArray(move.properties) && move.properties.length > 0) {
        let notesText = move.properties.join('\n\n');
        if (notesText.length > 1000) {
          notesText = truncateText(notesText, 1000);
        }
        embed.addFields({ name: 'Notes', value: notesText });
      }
      
      // Use base move image
      move.currentImage = move.image;
    } else {
      // Show a follow-up/variation
      isBaseMove = false;
      const variationIndex = version - 1; // Adjust index since 0 is base move
      
      if (variationIndex >= 0 && variationIndex < move.variations.length) {
        currentVersionObj = move.variations[variationIndex];
        
        // Add damage if available
        if (currentVersionObj.damage) {
          embed.addFields({ name: 'Damage', value: currentVersionObj.damage });
        }
        
        // Add frame data if available
        if (currentVersionObj.framedata) {
          let frameDataText = '';
          for (const [key, value] of Object.entries(currentVersionObj.framedata)) {
            if (!value || value === '' || value === '/' || value === '-') continue;
            frameDataText += `**${key}**: ${value}\n`;
          }
          
          if (frameDataText) {
            embed.addFields({ name: 'Frame Data', value: frameDataText });
          }
        }
        
        // Add version-specific notes
        if (currentVersionObj.notes) {
          const notesText = truncateText(currentVersionObj.notes, 1000);
          embed.addFields({ name: 'Notes', value: notesText });
        }
        
        // Use variant-specific image if available
        if (currentVersionObj.image) {
          move.currentImage = currentVersionObj.image;
        }
      }
    }
  } else {
    // Handle other move formats (data array, etc.)
    if (move.data && Array.isArray(move.data) && move.data.length > 1) {
      hasVersions = true;
      versionCount = move.data.length;
      
      // Create version labels (A, B, C) or use Version if specified
      versionLabels = move.data.map((data, idx) => {
        if (data.Version) return data.Version;
        if (idx < 3) return ['A', 'B', 'C'][idx];
        return `Version ${idx+1}`;
      });
      
      // Use the specified version
      const dataToUse = move.data[version < versionCount ? version : 0];
      
      // Extract damage
      if (dataToUse.Damage) {
        embed.addFields({ name: 'Damage', value: dataToUse.Damage });
      }
      
      // Extract frame data
      let frameDataText = '';
      for (const [key, value] of Object.entries(dataToUse)) {
        if (key === 'Damage' || key === 'Version' || !value || value === '/' || value === '-' || value === '') continue;
        frameDataText += `**${key}**: ${value}\n`;
      }
      
      if (frameDataText) {
        embed.addFields({ name: 'Frame Data', value: frameDataText });
      }
      
      // Extract notes if present
      if (move.versionNotes && move.versionNotes[versionLabels[version]]) {
        const notesText = truncateText(move.versionNotes[versionLabels[version]][0], 1000);
        embed.addFields({ name: 'Notes', value: notesText });
      } else if (move.notes && move.notes.length > 0) {
        const notesText = truncateText(move.notes[0], 1000);
        embed.addFields({ name: 'Notes', value: notesText });
      }
    } else {
      // Handle regular move without variations
      
      // Extract damage first if available
      if (move.damage) {
        embed.addFields({ name: 'Damage', value: move.damage.toString() });
      }
      
      // Collect non-empty frame data
      if (move.framedata) {
        let frameDataText = '';
        for (const [key, value] of Object.entries(move.framedata)) {
          if (!value || value === '' || value === '/' || value === '-') continue;
          frameDataText += `**${key}**: ${value}\n`;
        }
        
        if (frameDataText) {
          embed.addFields({ name: 'Frame Data', value: frameDataText });
        }
      }
      
      // Add notes/properties if they exist
      if (move.properties && Array.isArray(move.properties) && move.properties.length > 0) {
        const notesText = truncateText(move.properties[0], 1000);
        embed.addFields({ name: 'Notes', value: notesText });
      }
    }
  }
  
  // Add move image if available
  if (move.currentImage || move.image) {
    embed.setImage(move.currentImage || move.image);
  }
  
  // Add footer with character info and version
  let versionLabel = '';
  if (hasVersions) {
    if (isBaseMove) {
      versionLabel = 'Base Move';
    } else if (versionLabels[version]) {
      versionLabel = versionLabels[version];
    } else {
      versionLabel = version < 3 ? ['A', 'B', 'C'][version] : `Version ${version+1}`;
    }
  }
  
  // Add follow-up information if available
  if (move.followUps && move.followUps.length > 0) {
    let followUpText = move.followUps.map(followUp => {
      return `• ${followUp.name || followUp.moveName}${followUp.input ? ` (${followUp.input})` : ''}`;
    }).join('\n');
    
    if (followUpText.length > 1024) {
      followUpText = followUpText.substring(0, 1020) + '...';
    }
    
    embed.addFields({ name: 'Follow-ups', value: followUpText });
  }
  
  embed.setFooter({ 
    text: `${characterName} | Move: ${moveName}${versionLabel ? ` | Version: ${versionLabel}` : ''}` 
  });
  
  return { 
    embed, 
    hasVersions, 
    versionCount, 
    currentVersion: version,
    versionLabels,
    isBaseMove,
    hasFollowUps: move.followUps && move.followUps.length > 0
  };
}

// Helper function to create an embed for a character overview
function createCharacterEmbed(character) {
  const embed = new EmbedBuilder()
    .setTitle(character.character || character.name)
    .setColor(0x4287f5)
    .setFooter({ text: 'EFZ Character Information' });
  
  if (character.icon) {
    embed.setThumbnail(character.icon);
  }
  
  let movelistText = '';
  const hasMultipleLists = hasMultipleMoveLists(character);
  
  // Handle multiple movelists (old format)
  if (character.moveLists && character.moveLists.options && Array.isArray(character.moveLists.options)) {
    character.moveLists.options.forEach((option, idx) => {
      // Only add movelist name if there are multiple movelists
      if (hasMultipleLists) {
        movelistText += `**${option.name || `Movelist ${idx+1}`}**\n`;
      }
      
      if (option.sections) {
        option.sections.forEach(section => {
          if (section.moves && section.moves.length > 0) {
            if (section.name && section.name.toLowerCase() !== 'moves') {
              movelistText += `*${section.name}*\n`;
            }
            
            section.moves.forEach(move => {
              if (move && (move.name || move.moveName)) { // Only include moves with names
                const moveName = move.name || move.moveName;
                const damage = move.damage || (move.data && move.data[0] && move.data[0].Damage) || '';
                
                movelistText += `• ${moveName}${damage ? ` (${damage})` : ''}\n`;
              }
            });
            
            movelistText += '\n';
          }
        });
      }
      
      movelistText += hasMultipleLists ? '\n' : '';
    });
  }
  // Handle sections directly (old format)
  else if (character.sections && Array.isArray(character.sections)) {
    character.sections.forEach(section => {
      if (section.moves && section.moves.length > 0) {
        if (section.name && section.name.toLowerCase() !== 'moves') {
          movelistText += `**${section.name}**\n`;
        }
        
        section.moves.forEach(move => {
          if (move && (move.name || move.moveName)) { // Only include moves with names
            const moveName = move.name || move.moveName;
            const damage = move.damage || (move.data && move.data[0] && move.data[0].Damage) || '';
            
            movelistText += `• ${moveName}${damage ? ` (${damage})` : ''}\n`;
          }
        });
        
        movelistText += '\n';
      }
    });
  }
  // Handle movelists array (new format)
  else if (character.movelists && Array.isArray(character.movelists)) {
    character.movelists.forEach((movelist, idx) => {
      // Only add movelist name if there are multiple movelists
      if (hasMultipleLists) {
        movelistText += `**${movelist.name || `Movelist ${idx+1}`}**\n`;
      }
      
      if (movelist.moves) {
        const validMoves = movelist.moves.filter(move => move && move.moveName);
        if (validMoves.length > 0) {
          validMoves.forEach(move => {
            movelistText += `• ${move.moveName}${move.damage ? ` (${move.damage})` : ''}\n`;
          });
          
          movelistText += '\n';
        }
      }
      
      movelistText += hasMultipleLists ? '\n' : '';
    });
  }
  
  if (movelistText) {
    // Split text if it's too long for a single field
    if (movelistText.length > 1024) {
      const parts = splitText(movelistText, 1024);
      for (let i = 0; i < parts.length; i++) {
        embed.addFields({ name: i === 0 ? 'Move List' : `Move List (cont. ${i})`, value: parts[i] });
      }
    } else {
      embed.addFields({ name: 'Move List', value: movelistText });
    }
  }
  
  return embed;
}

// Helper function to split text into chunks
function splitText(text, maxLength) {
  const chunks = [];
  let currentChunk = '';
  
  const lines = text.split('\n');
  for (const line of lines) {
    if (currentChunk.length + line.length + 1 > maxLength) {
      chunks.push(currentChunk);
      currentChunk = line;
    } else {
      currentChunk += (currentChunk ? '\n' : '') + line;
    }
  }
  
  if (currentChunk) {
    chunks.push(currentChunk);
  }
  
  return chunks;
}

// Helper function to check if a character has multiple movelists
function hasMultipleMoveLists(character) {
  if (character.moveLists && character.moveLists.options && character.moveLists.options.length > 1) {
    return true;
  }
  
  if (character.movelists && Array.isArray(character.movelists) && character.movelists.length > 1) {
    return true;
  }
  
  return false;
}

// Helper function to get all movelists from a character
function getMoveLists(character) {
  if (character.moveLists && character.moveLists.options && Array.isArray(character.moveLists.options)) {
    return character.moveLists.options.map((option, idx) => ({
      id: option.id || idx,
      name: option.name || `Movelist ${idx+1}`
    }));
  }
  
  if (character.movelists && Array.isArray(character.movelists)) {
    return character.movelists.map((movelist, idx) => ({
      id: idx,
      name: movelist.name || `Movelist ${idx+1}`
    }));
  }
  
  return [];
}

// Function to find a move in all movelists
function findMoveInAllMoveLists(character, moveName) {
  // First try special handling for Nayuki's moves
  const nayukiMove = handleNayukiMoves(character, moveName);
  if (nayukiMove) {
    return [nayukiMove];
  }
  
  // If character has the new format, use the improved finder
  if (character.movelists && Array.isArray(character.movelists)) {
    return findMoveByNameOrInput(character, moveName);
  }
  
  // For legacy format, keep the original implementation
  const results = [];
  
  // Check old format with moveLists options
  if (character.moveLists && character.moveLists.options && Array.isArray(character.moveLists.options)) {
    character.moveLists.options.forEach(option => {
      if (option.sections) {
        option.sections.forEach(section => {
          if (section.moves) {
            const move = section.moves.find(m => 
              (m.name && m.name === moveName) || 
              (m.moveName && m.moveName === moveName)
            );
            
            if (move) {
              results.push({
                move,
                section,
                moveList: option,
                moveListId: option.id
              });
            }
          }
        });
      }
    });
  }
  
  // Check old format with direct sections
  if (character.sections && Array.isArray(character.sections)) {
    character.sections.forEach(section => {
      if (section.moves) {
        const move = section.moves.find(m => 
          (m.name && m.name === moveName) || 
          (m.moveName && m.moveName === moveName)
        );
        
        if (move) {
          results.push({
            move,
            section,
            moveList: null,
            moveListId: null
          });
        }
      }
    });
  }
  
  return results;
}

// Helper function to load a character
async function loadCharacter(characterName) {
  try {
    if (!characterName) return null;
    
    // Convert to lowercase for case-insensitive matching
    const lcName = characterName.toLowerCase();
    
    // First check if character is in cached data
    const cachedCharacter = allCharacterData.find(
      c => (c.character && c.character.toLowerCase() === lcName) ||
           (c.name && c.name.toLowerCase() === lcName)
    );
    
    if (cachedCharacter) {
      return cachedCharacter;
    }
    
    // Normalize character name for file matching
    const normalizedName = characterName.replace(/\s+/g, '_');
    
    // Try different possible file paths
    const possiblePaths = [
      `${process.cwd()}/characters/${normalizedName}.json`,
      `${process.cwd()}/test/characters/${normalizedName}.json`,
      `${process.cwd()}/../characters/${normalizedName}.json`,
      `c:/Users/Aquatic/Desktop/bot/testing/bot/characters/${normalizedName}.json`,
      `c:/Users/Aquatic/Desktop/bot/testing/bot/test/characters/${normalizedName}.json`
    ];
    
    for (const path of possiblePaths) {
      try {
        const fileData = await fs.readFile(path, 'utf8');
        return JSON.parse(fileData);
      } catch (e) {
        // Try next path
      }
    }
    
    throw new Error(`Character file not found: ${characterName}`);
  } catch (error) {
    console.error(`Error loading character ${characterName}:`, error);
    return null;
  }
}

// Special pre-processing for Nayuki Minase (asleep) moves
function preprocessMove(move, characterName) {
  // Handle special case for Nayuki's 214* move (Zzz~ stance)
  if (characterName === "Nayuki Minase (asleep)" && move) {
    // Check if this is the 214* move
    if (move.input === "214*" || move.moveName === "Zzz~") {
      // Break up the long description into smaller parts
      if (move.properties && Array.isArray(move.properties) && move.properties.length > 0) {
        // Create a simplified combined description
        move.properties = [
          "Nayuki lies down on Keropi, entering her sleep stance.",
          "Has some invincibility frames, making it useful for baiting wakeups and countering.",
          "Multiple follow-ups are available from this stance. While in this stance, Nayuki is low to the ground and able to low profile some projectiles."
        ];
      }
      
      // If this move has variations, truncate their descriptions
      if (move.variations && Array.isArray(move.variations)) {
        // Simplify each variation description to focus on core functionality
        move.variations.forEach((variation, idx) => {
          if (variation.notes && variation.notes.length > 500) {
            // Get first sentence as a summary
            const firstPeriod = variation.notes.indexOf(". ");
            if (firstPeriod > 0 && firstPeriod < 250) {
              variation.notes = variation.notes.substring(0, firstPeriod + 1);
            } else {
              variation.notes = truncateText(variation.notes, 500);
            }
          }
          
          // If the version is missing or unclear, set a clearer name
          if (!variation.version || variation.version === "-") {
            if (idx === 0) variation.version = "214*~A";
            else if (idx === 1) variation.version = "214*~B"; 
            else if (idx === 2) variation.version = "214*~C";
            else if (idx === 3) variation.version = "214*~623A";
            else if (idx === 4) variation.version = "214*~236A";
            else if (idx === 5) variation.version = "214*~2C";
            else if (idx === 6) variation.version = "214*~j.2C";
            else if (idx === 7) variation.version = "214*~5S";
            else if (idx === 8) variation.version = "214*~2S";
            else if (idx === 9) variation.version = "214*~8S";
            else if (idx === 10) variation.version = "214*~4/6S";
            else variation.version = `214*~Option ${idx+1}`;
          }
        });
      }
    }
    
    // Check if this is the Rolling move
    if (move.input === "41236*" || move.moveName === "Rolling~") {
      if (move.variations && Array.isArray(move.variations)) {
        move.variations.forEach((variation, idx) => {
          // Fix unnamed versions
          if (!variation.version || variation.version === "-") {
            if (idx === 0) variation.version = "41236A";
            else if (idx === 1) variation.version = "41236A (Final Hit)";
            else if (idx === 2) variation.version = "41236B";
            else if (idx === 3) variation.version = "41236B (Final Hit)";
            else if (idx === 4) variation.version = "41236C";
            else if (idx === 5) variation.version = "41236C (Middle)";
            else if (idx === 6) variation.version = "41236C (Final Hit)";
            else variation.version = `41236* Option ${idx+1}`;
          }
          
          if (variation.notes && variation.notes.length > 500) {
            variation.notes = truncateText(variation.notes, 500);
          }
        });
      }
    }
    
    // Check if this is the Nayu-chan Kick
    if (move.input === "623*" || move.moveName === "Nayu-chan Kick") {
      if (move.variations && Array.isArray(move.variations)) {
        move.variations.forEach((variation, idx) => {
          // Fix unnamed versions
          if (!variation.version || variation.version === "-") {
            if (idx === 0) variation.version = "623A";
            else if (idx === 1) variation.version = "623B";
            else if (idx === 2) variation.version = "623B (Jam Level 5+)";
            else if (idx === 3) variation.version = "623B (Jam Level 7+)";
            else if (idx === 4) variation.version = "623C";
            else if (idx === 5) variation.version = "623C (Final Hit)";
            else variation.version = `623* Option ${idx+1}`;
          }
          
          if (variation.notes && variation.notes.length > 500) {
            variation.notes = truncateText(variation.notes, 500);
          }
        });
      }
    }
  }
  
  return move;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('character')
    .setDescription('Get move details of a character')
    .addStringOption(option =>
      option.setName('name')
        .setDescription('Character name')
        .setRequired(true)
        .setAutocomplete(true))
    .addStringOption(option =>
      option.setName('move')
        .setDescription('Move name or input')
        .setRequired(false)
        .setAutocomplete(true)),

  async execute(interaction) {
    try {
      const characterName = interaction.options.getString('name');
      const moveInput = interaction.options.getString('move');
      
      if (!characterName) {
        return interaction.reply({ content: "Please specify a character name.", ephemeral: true });
      }
      
      // Load character data
      const character = await loadCharacter(characterName);
      if (!character) {
        return interaction.reply({ content: "Character not found.", ephemeral: true });
      }
      
      // If a move was specified, find and display that move
      if (moveInput) {
        let moveData = null;
        let moveName = moveInput;
        let moveListId = null;
        let version = 0;
        
        // Parse the move input
        try {
          if (moveInput.includes('-')) {
            const parts = moveInput.split('-');
            moveName = parts[0];
            if (parts.length > 1) moveListId = parseInt(parts[1]);
            if (parts.length > 2) version = parseInt(parts[2]);
          }
        } catch (e) {
          console.error("Error parsing move input:", e);
        }
        
        // Special direct handling for Nayuki's problematic moves
        if (character.name === "Nayuki Minase (asleep)") {
          if (moveName.toLowerCase().includes("nayu-chan") || 
              moveName.toLowerCase().includes("kick") ||
              moveName.toLowerCase() === "623*" ||
              moveName.toLowerCase() === "623c" ||
              moveName.toLowerCase() === "623a" ||
              moveName.toLowerCase() === "623b") {
            const allMoves = character.movelists[0].moves;
            const kickMove = allMoves.find(move => 
              move.input === "623*" || move.moveName === "Nayu-chan Kick"
            );
            
            if (kickMove) {
              moveData = {
                move: kickMove,
                section: { name: "Moves" },
                moveList: character.movelists[0],
                moveListId: 0
              };
            }
          }
        }
        
        // Define moveResults outside the if block so it's accessible throughout the function
        let moveResults = [];
        
        if (!moveData) {
          // Find the move in all movelists
          moveResults = findMoveInAllMoveLists(character, moveName);
          
          if (moveResults.length > 0) {
            // If moveListId is specified, find that specific movelist
            const specificMoveData = moveListId !== null 
              ? moveResults.find(result => result.moveListId === moveListId)
              : null;
              
            // Use the specified movelist or the first result
            moveData = specificMoveData || moveResults[0];
          }
        } else {
          // If moveData was set through special handling, we still need moveResults for the buttons
          // Find all instances of this move to provide switching buttons
          moveResults = findMoveInAllMoveLists(character, moveName);
        }
        
        if (moveData) {
          // Preprocess the move if necessary
          moveData.move = preprocessMove(moveData.move, character.name);
          
          // Create embed with version info
          const moveListName = moveData.moveList?.name;
          const result = createMoveEmbed(character, moveData.move, moveData.section, moveListName, version);
          const embed = result.embed;
          
          // Create components array for buttons
          const components = [];
          
          // Add movelist switching buttons if needed
          if (moveResults.length > 1) {
            // Use an array to collect all the buttons first
            const movelistButtons = [];
            
            moveResults.forEach(result => {
              if (result.moveListId !== moveData.moveListId) {
                movelistButtons.push(
                  new ButtonBuilder()
                    .setCustomId(createUniqueId(`character:${characterName}:${result.moveListId}:${moveName}:${version}`))
                    .setLabel(`Switch to ${result.moveList?.name || 'Other Movelist'}`)
                    .setStyle(ButtonStyle.Secondary)
                );
              }
            });
            
            // Then split them into rows properly
            if (movelistButtons.length > 0) {
              const movelistRows = splitButtonsIntoRows(movelistButtons);
              components.push(...movelistRows);
            }
          }
          
          // Add version buttons if this move has multiple versions
          if (result.hasVersions && result.versionCount > 1) {
            // Create an array of buttons first
            const versionButtons = [];
            
            // For variations format, add Base Move as version 0
            if (moveData.move.variations && moveData.move.variations.length > 0) {
              // Add Base Move button first
              versionButtons.push(
                new ButtonBuilder()
                  .setCustomId(createUniqueId(`version:${characterName}:${moveData.moveListId}:${moveName}:0`))
                  .setLabel("Base Move")
                  .setStyle(result.currentVersion === 0 ? ButtonStyle.Primary : ButtonStyle.Secondary)
              );
              
              // Add follow-up/variation buttons
              for (let i = 0; i < moveData.move.variations.length; i++) {
                // Actual index is i+1 since 0 is reserved for base move
                const vIdx = i + 1;
                const variation = moveData.move.variations[i];
                
                versionButtons.push(
                  new ButtonBuilder()
                    .setCustomId(createUniqueId(`version:${characterName}:${moveData.moveListId}:${moveName}:${vIdx}`))
                    .setLabel(variation.version || `Follow-up ${i+1}`)
                    .setStyle(result.currentVersion === vIdx ? ButtonStyle.Primary : ButtonStyle.Secondary)
                );
              }
            } else {
              // For other version formats, keep the original logic
              for (let i = 0; i < result.versionCount; i++) {
                const versionLabel = result.versionLabels && result.versionLabels[i] ? 
                                    result.versionLabels[i] : 
                                    (i < 3 ? ['A', 'B', 'C'][i] : `Ver ${i+1}`);
                
                versionButtons.push(
                  new ButtonBuilder()
                    .setCustomId(createUniqueId(`version:${characterName}:${moveData.moveListId}:${moveName}:${i}`))
                    .setLabel(versionLabel)
                    .setStyle(i === result.currentVersion ? ButtonStyle.Primary : ButtonStyle.Secondary)
                );
              }
            }
            
            // Split buttons into multiple rows if needed (max 5 per row)
            const versionRows = splitButtonsIntoRows(versionButtons);
            components.push(...versionRows);
          }

          // Add follow-up buttons if this move has follow-ups
          if (moveData.move.followUps && moveData.move.followUps.length > 0) {
            const followUpButtons = [];
            
            // Add buttons for each follow-up, limiting to 5 per row
            moveData.move.followUps.forEach((followUp, index) => {
              if (index < 25) { // Max 25 follow-up buttons (5 rows x 5 buttons)
                const buttonLabel = (followUp.name || followUp.moveName).substring(0, 80);
                followUpButtons.push(
                  new ButtonBuilder()
                    .setCustomId(createUniqueId(`followup:${characterName}:${moveData.moveListId}:${index}:0`))
                    .setLabel(`${buttonLabel}`)
                    .setStyle(ButtonStyle.Secondary)
                );
              }
            });
            
            // Split follow-up buttons into rows
            const followUpRows = splitButtonsIntoRows(followUpButtons);
            components.push(...followUpRows);
          }

          // If this move is a follow-up itself, add button to go back to parent move
          if (moveData.move.parentMove) {
            const parentName = moveData.move.parentMove.name || moveData.move.parentMove.moveName;
            const backRow = new ActionRowBuilder()
              .addComponents(
                new ButtonBuilder()
                  .setCustomId(createUniqueId(`parent:${characterName}:${moveData.moveListId}:${parentName}`))
                  .setLabel(`⬅️ Back to ${parentName}`)
                  .setStyle(ButtonStyle.Primary)
              );
            
            // Add this row before others
            components.unshift(backRow);
          }
          
          return interaction.reply({ 
            embeds: [embed], 
            components: components.length > 0 ? components : [] 
          });
        } else {
          return interaction.reply({ content: `Move "${moveName}" not found for character "${characterName}".`, ephemeral: true });
        }
      } else {
        // Show character overview
        const embed = createCharacterEmbed(character);
        
        // Add button to cycle through movelists if available
        const components = [];
        if (hasMultipleMoveLists(character)) {
          const movelists = getMoveLists(character);
          if (movelists.length > 1) {
            const row = new ActionRowBuilder()
              .addComponents(
                new ButtonBuilder()
                  .setCustomId(`swap_movelist:${(character.character || character.name).toLowerCase()}:0`)
                  .setLabel(`Swap Movelist (1/${movelists.length})`)
                  .setStyle(ButtonStyle.Primary)
              );
            
            components.push(row);
          }
        }
        
        return interaction.reply({ 
          embeds: [embed],
          components: components.length > 0 ? components : []
        });
      }
    } catch (error) {
      console.error("Error executing character command:", error);
      return interaction.reply({ content: "An error occurred while processing your request.", ephemeral: true });
    }
  },

  async autocomplete(interaction) {
    try {
      const focusedOption = interaction.options.getFocused(true);
      
      if (focusedOption.name === 'name') {
        // Find all character names
        const choices = allCharacterData.map(d => d.character || d.name).filter(Boolean);
        const filtered = choices.filter(c =>
          c.toLowerCase().includes(focusedOption.value.toLowerCase())
        );
        
        await interaction.respond(
          filtered.slice(0, 25).map(choice => ({ 
            name: choice.substring(0, 100), // Truncate to maximum 100 characters
            value: choice 
          }))
        );
        return;
      }
    
      if (focusedOption.name === 'move') {
        const characterName = interaction.options.getString('name');
        if (!characterName) return interaction.respond([]);
        
        // Load character data
        const character = await loadCharacter(characterName);
        if (!character) return interaction.respond([]);
        
        // Array to store all moves
        const allMoves = [];
        
        // Process all movelists
        if (character.moveLists && character.moveLists.options && Array.isArray(character.moveLists.options)) {
          // Old format with moveLists.options
          character.moveLists.options.forEach((option, mlIndex) => {
            if (option.sections) {
              option.sections.forEach(section => {
                if (section.moves) {
                  section.moves.forEach(move => {
                    if (move && (move.name || move.moveName)) {
                      const moveName = move.name || move.moveName;
                      const input = move.input || '';
                      const moveListName = option.name || `Movelist ${mlIndex+1}`;
                      
                      // Create display name but truncate if needed
                      let displayName = input ? 
                        `${moveName} (${input}) - ${moveListName}` : 
                        `${moveName} - ${moveListName}`;
                      
                      // Truncate to stay within Discord's limit
                      if (displayName.length > 100) {
                        displayName = displayName.substring(0, 97) + '...';
                      }
                      
                      allMoves.push({
                        name: displayName,
                        value: `${moveName}-${option.id || mlIndex}`
                      });
                    }
                  });
                }
              });
            }
          });
        } 
        else if (character.sections && Array.isArray(character.sections)) {
          // Old format with direct sections
          character.sections.forEach(section => {
            if (section.moves) {
              section.moves.forEach(move => {
                if (move && (move.name || move.moveName)) {
                  const moveName = move.name || move.moveName;
                  const input = move.input || '';
                  
                  // Create display name but truncate if needed
                  let displayName = input ? `${moveName} (${input})` : moveName;
                  
                  // Truncate to stay within Discord's limit
                  if (displayName.length > 100) {
                    displayName = displayName.substring(0, 97) + '...';
                  }
                  
                  allMoves.push({
                    name: displayName,
                    value: moveName
                  });
                }
              });
            }
          });
        }
        else if (character.movelists && Array.isArray(character.movelists)) {
          // New format with movelists array
          character.movelists.forEach((movelist, mlIndex) => {
            if (movelist.moves) {
              movelist.moves.forEach(move => {
                if (move && move.moveName) {
                  const moveListName = movelist.name || `Movelist ${mlIndex+1}`;
                  
                  // Format display name differently for special moves
                  let displayName;
                  
                  // For special moves that begin with "Costume", prioritize showing the input
                  if (move.moveName.startsWith("Costume") && move.input) {
                    displayName = character.movelists.length > 1 
                      ? `${move.input} - ${move.moveName} - ${moveListName}`
                      : `${move.input} - ${move.moveName}`;
                  } else {
                    // Otherwise keep the normal format
                    displayName = character.movelists.length > 1 
                      ? `${move.moveName}${move.input ? ` (${move.input})` : ''} - ${moveListName}`
                      : `${move.moveName}${move.input ? ` (${move.input})` : ''}`;
                  }
                  
                  // Truncate to stay within Discord's limit
                  if (displayName.length > 100) {
                    displayName = displayName.substring(0, 97) + '...';
                  }
                  
                  // For special moves, set the value to the input notation if it exists
                  const moveValue = (move.moveName.startsWith("Costume") && move.input) 
                    ? `${move.input}-${mlIndex}`  // Use input as the primary identifier
                    : `${move.moveName}-${mlIndex}`; // Otherwise use move name
                  
                  allMoves.push({
                    name: displayName,
                    value: moveValue
                  });
                }
              });
            }
          });
        }
        
        // Filter moves based on search
        const searchValue = focusedOption.value.toLowerCase();
        const filtered = allMoves.filter(choice => 
          choice.name.toLowerCase().includes(searchValue)
        ).slice(0, 25);
        
        await interaction.respond(filtered);
        return;
      }
    } catch (error) {
      console.error("Error in autocomplete:", error);
      await interaction.respond([]);
    }
  },

  // Handler for button interactions from start.js
  async buttonHandler(interaction) {
    try {
      // Handle swap_movelist button
      if (interaction.customId.includes('swap_movelist:')) {
        const parts = interaction.customId.split(':');
        const characterName = parts[1];
        const currentIndex = parseInt(parts[2], 10);
        
        // Load character
        let character = await loadCharacter(characterName);
        if (!character) {
          return interaction.update({ content: 'Error: Character not found', components: [] });
        }
        
        // Get movelists
        const movelists = getMoveLists(character);
        if (movelists.length < 2) {
          return interaction.update({ content: 'This character does not have multiple movelists', components: [] });
        }
        
        // Calculate next movelist index
        const nextIndex = (currentIndex + 1) % movelists.length;
        const nextMovelist = movelists[nextIndex];
        
        // Create embed for the next movelist
        const embed = new EmbedBuilder()
          .setColor(0x5865F2)
          .setTitle(`${character.character || character.name} - ${nextMovelist.name}`)
          .setThumbnail(character.icon || null)
          .setDescription(`Showing moves for ${character.character || character.name} (${nextMovelist.name})`);
        
        // Get moves for this movelist
        const moves = getMovesFromCharacter(character, nextMovelist.id);
        
        if (moves.length > 0) {
          // Group moves into fields
          const moveFields = moves.map(({ move }) => {
            const moveName = move.name || move.moveName;
            const damage = move.damage || 
                          (move.data && move.data[0] && move.data[0].Damage) || 
                          '';
            
            return {
              name: moveName,
              value: damage ? `Damage: ${damage}` : 'No damage data',
              inline: true
            };
          }).slice(0, 25);
          
          if (moveFields.length > 0) {
            embed.addFields(moveFields);
          } else {
            embed.setDescription(`No valid moves found for ${character.character || character.name} in ${nextMovelist.name}`);
          }
        } else {
          embed.setDescription(`No moves found for ${character.character || character.name} in ${nextMovelist.name}`);
        }
        
        // Create button to swap to the next movelist
        const row = new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setCustomId(`swap_movelist:${characterName}:${nextIndex}`)
              .setLabel(`Swap Movelist (${nextIndex + 1}/${movelists.length})`)
              .setStyle(ButtonStyle.Primary)
          );
        
        return interaction.update({ 
          embeds: [embed],
          components: [row],
          content: null
        });
      }
      
      // Handle character: button (for switching specific move movelists)
      if (interaction.customId.includes('character:')) {
        const parts = interaction.customId.split(':');
        // Extract just the important parts, ignoring timestamp and random string
        const characterName = parts[1];
        const moveListIdStr = parts[2]; 
        const moveListId = parseInt(moveListIdStr, 10);
        const moveName = parts[3];
        const version = parseInt(parts[4] || '0');
        
        // Load character
        const character = await loadCharacter(characterName);
        if (!character) {
          return interaction.reply({ content: "Character not found.", ephemeral: true });
        }
        
        // Find move data in the specified movelist
        let moveData = null;
        
        // Find the move in all movelists
        const moveResults = findMoveInAllMoveLists(character, moveName);
        
        // Find specific movelist
        moveData = moveResults.find(result => 
          result.moveListId === moveListId || 
          result.moveListId === moveListIdStr || 
          result.moveListId?.toString() === moveListIdStr
        );
        
        if (moveData) {
          // Preprocess the move if necessary
          moveData.move = preprocessMove(moveData.move, characterName);
          
          // Create embed
          const moveListName = moveData.moveList?.name;
          const result = createMoveEmbed(character, moveData.move, moveData.section, moveListName, version);
          const embed = result.embed;
          
          // Create components array for buttons
          const components = [];
          
          // Add movelist switching buttons if there are multiple movelists
          if (moveResults.length > 1) {
            const movelistRow = new ActionRowBuilder();
            
            moveResults.forEach(result => {
              if (result.moveListId !== moveData.moveListId) {
                movelistRow.addComponents(
                  new ButtonBuilder()
                    .setCustomId(createUniqueId(`character:${characterName}:${result.moveListId}:${moveName}:${version}`))
                    .setLabel(`Switch to ${result.moveList?.name || 'Other Movelist'}`)
                    .setStyle(ButtonStyle.Secondary)
                );
              }
            });
            
            if (movelistRow.components.length > 0) {
              components.push(movelistRow);
            }
          }
          
          // Add version buttons if this move has multiple versions
          if (result.hasVersions && result.versionCount > 1) {
            // Create an array of buttons first
            const versionButtons = [];
            
            // For variations format, add Base Move as version 0
            if (moveData.move.variations && moveData.move.variations.length > 0) {
              // Add Base Move button first
              versionButtons.push(
                new ButtonBuilder()
                  .setCustomId(createUniqueId(`version:${characterName}:${moveData.moveListId}:${moveName}:0`))
                  .setLabel("Base Move")
                  .setStyle(result.currentVersion === 0 ? ButtonStyle.Primary : ButtonStyle.Secondary)
              );
              
              // Add follow-up/variation buttons
              for (let i = 0; i < moveData.move.variations.length; i++) {
                // Actual index is i+1 since 0 is reserved for base move
                const vIdx = i + 1;
                const variation = moveData.move.variations[i];
                
                versionButtons.push(
                  new ButtonBuilder()
                    .setCustomId(createUniqueId(`version:${characterName}:${moveData.moveListId}:${moveName}:${vIdx}`))
                    .setLabel(variation.version || `Follow-up ${i+1}`)
                    .setStyle(result.currentVersion === vIdx ? ButtonStyle.Primary : ButtonStyle.Secondary)
                );
              }
            } else {
              // For other version formats, keep the original logic
              for (let i = 0; i < result.versionCount; i++) {
                const versionLabel = result.versionLabels && result.versionLabels[i] ? 
                                    result.versionLabels[i] : 
                                    (i < 3 ? ['A', 'B', 'C'][i] : `Ver ${i+1}`);
                
                versionButtons.push(
                  new ButtonBuilder()
                    .setCustomId(createUniqueId(`version:${characterName}:${moveData.moveListId}:${moveName}:${i}`))
                    .setLabel(versionLabel)
                    .setStyle(i === result.currentVersion ? ButtonStyle.Primary : ButtonStyle.Secondary)
                );
              }
            }
            
            // Split buttons into multiple rows if needed (max 5 per row)
            const versionRows = splitButtonsIntoRows(versionButtons);
            components.push(...versionRows);
          }
          
          return interaction.update({ 
            embeds: [embed], 
            components: components.length > 0 ? components : [] 
          });
        } else {
          return interaction.reply({ content: "Move not found in that movelist.", ephemeral: true });
        }
      }
      
      // Handle version button (for switching move versions)
      if (interaction.customId.includes('version:')) {
        const parts = interaction.customId.split(':');
        // Extract just the important parts, ignoring timestamp and random string
        const characterName = parts[1];
        const moveListIdStr = parts[2]; 
        const moveListId = parseInt(moveListIdStr, 10);
        const moveName = parts[3];
        const version = parseInt(parts[4] || '0');
        
        // Load character
        const character = await loadCharacter(characterName);
        if (!character) {
          return interaction.reply({ content: "Character not found.", ephemeral: true });
        }
        
        // Find the move in all movelists with more flexible name matching
        const moveResults = findMoveInAllMoveLists(character, moveName);
        
        // If no exact match found, try partial name matching
        if (moveResults.length === 0) {
          const allMovesInCharacter = [];
          
          // Find all moves in the character
          if (character.movelists && Array.isArray(character.movelists)) {
            character.movelists.forEach((movelist, idx) => {
              if (movelist.moves) {
                movelist.moves.forEach(m => {
                  if (m && m.moveName) {
                    allMovesInCharacter.push({
                      move: m,
                      section: { name: "Moves" },
                      moveList: movelist,
                      moveListId: idx
                    });
                  }
                });
              }
            });
          }
          
          // Try to find moves that contain the moveName as a substring
          const partialMatches = allMovesInCharacter.filter(item => 
            item.move.moveName && item.move.moveName.toLowerCase().includes(moveName.toLowerCase())
          );
          
          if (partialMatches.length > 0) {
            moveResults.push(...partialMatches);
          }
        }
        
        // Find specific movelist
        const moveData = moveResults.find(result => 
          result.moveListId === moveListId || 
          result.moveListId === moveListIdStr || 
          result.moveListId?.toString() === moveListIdStr
        );
        
        if (moveData) {
          try {
            // Preprocess the move if necessary
            moveData.move = preprocessMove(moveData.move, characterName);
            
            // Create embed with the specified version
            const moveListName = moveData.moveList?.name;
            const result = createMoveEmbed(character, moveData.move, moveData.section, moveListName, version);
            const embed = result.embed;
            
            // Create components array for buttons
            const components = [];
            
            // Add movelist switching buttons if there are multiple movelists
            if (moveResults.length > 1) {
              const movelistRow = new ActionRowBuilder();
              
              moveResults.forEach(result => {
                if (result.moveListId !== moveData.moveListId) {
                  movelistRow.addComponents(
                    new ButtonBuilder()
                      .setCustomId(createUniqueId(`character:${characterName}:${result.moveListId}:${moveName}:${version}`))
                      .setLabel(`Switch to ${result.moveList?.name || 'Other Movelist'}`)
                      .setStyle(ButtonStyle.Secondary)
                  );
                }
              });
              
              if (movelistRow.components.length > 0) {
                components.push(movelistRow);
              }
            }
            
            // Add version buttons if this move has multiple versions
            if (result.hasVersions && result.versionCount > 1) {
              // Create an array of buttons first
              const versionButtons = [];
              
              // For variations format, add Base Move as version 0
              if (moveData.move.variations && moveData.move.variations.length > 0) {
                // Add Base Move button first
                versionButtons.push(
                  new ButtonBuilder()
                    .setCustomId(createUniqueId(`version:${characterName}:${moveData.moveListId}:${moveName}:0`))
                    .setLabel("Base Move")
                    .setStyle(result.currentVersion === 0 ? ButtonStyle.Primary : ButtonStyle.Secondary)
                );
                
                // Add follow-up/variation buttons
                for (let i = 0; i < moveData.move.variations.length; i++) {
                  // Actual index is i+1 since 0 is reserved for base move
                  const vIdx = i + 1;
                  const variation = moveData.move.variations[i];
                  
                  versionButtons.push(
                    new ButtonBuilder()
                      .setCustomId(createUniqueId(`version:${characterName}:${moveData.moveListId}:${moveName}:${vIdx}`))
                      .setLabel(variation.version || `Follow-up ${i+1}`)
                      .setStyle(result.currentVersion === vIdx ? ButtonStyle.Primary : ButtonStyle.Secondary)
                  );
                }
              } else {
                // For other version formats, keep the original logic
                for (let i = 0; i < result.versionCount; i++) {
                  const versionLabel = result.versionLabels && result.versionLabels[i] ? 
                                      result.versionLabels[i] : 
                                      (i < 3 ? ['A', 'B', 'C'][i] : `Ver ${i+1}`);
                  
                  versionButtons.push(
                    new ButtonBuilder()
                      .setCustomId(createUniqueId(`version:${characterName}:${moveData.moveListId}:${moveName}:${i}`))
                      .setLabel(versionLabel)
                      .setStyle(i === result.currentVersion ? ButtonStyle.Primary : ButtonStyle.Secondary)
                  );
                }
              }
              
              // Split buttons into multiple rows if needed (max 5 per row)
              const versionRows = splitButtonsIntoRows(versionButtons);
              components.push(...versionRows);
            }
            
            return interaction.update({ 
              embeds: [embed], 
              components: components.length > 0 ? components : [] 
            });
          } catch (error) {
            console.error("Error creating version embed:", error);
            return interaction.reply({ content: "An error occurred while switching versions.", ephemeral: true });
          }
        } else {
          return interaction.reply({ content: "Move not found.", ephemeral: true });
        }
      }

      // Handle followup button
      if (interaction.customId.includes('followup:')) {
        const parts = interaction.customId.split(':');
        const characterName = parts[1];
        const moveListIdStr = parts[2];
        const moveListId = parseInt(moveListIdStr, 10);
        const followUpIndex = parseInt(parts[3], 10);
        const version = parseInt(parts[4] || '0', 10);
        
        // Load character
        const character = await loadCharacter(characterName);
        if (!character) {
          return interaction.reply({ content: "Character not found.", ephemeral: true });
        }
        
        // Find the current move
        const moveResults = findMoveInAllMoveLists(character, interaction.message.embeds[0].title.split(' - ')[1]);
        if (moveResults.length === 0) {
          return interaction.reply({ content: "Move not found.", ephemeral: true });
        }
        
        const moveData = moveResults[0];
        const currentMove = moveData.move;
        
        // Get the follow-up
        if (currentMove.followUps && currentMove.followUps.length > followUpIndex) {
          const followUpMove = currentMove.followUps[followUpIndex];
          
          // Create embed for the follow-up
          const result = createMoveEmbed(character, followUpMove, moveData.section, moveData.moveList?.name, version);
          const embed = result.embed;
          
          // Create components for the follow-up
          const components = [];
          
          // Add back button to return to parent move
          const backRow = new ActionRowBuilder()
            .addComponents(
              new ButtonBuilder()
                .setCustomId(createUniqueId(`parent:${characterName}:${moveListId}:${currentMove.name || currentMove.moveName}`))
                .setLabel(`⬅️ Back to ${currentMove.name || currentMove.moveName}`)
                .setStyle(ButtonStyle.Primary)
            );
          components.push(backRow);
          
          // Add version buttons if needed
          if (result.hasVersions && result.versionCount > 1) {
            // Create version buttons (existing code)
            const versionButtons = [];
            
            for (let i = 0; i < result.versionCount; i++) {
              const versionLabel = result.versionLabels && result.versionLabels[i] ? 
                                  result.versionLabels[i] : 
                                  (i < 3 ? ['A', 'B', 'C'][i] : `Ver ${i+1}`);
              
              versionButtons.push(
                new ButtonBuilder()
                  .setCustomId(createUniqueId(`version:${characterName}:${moveListId}:${followUpMove.name}:${i}`))
                  .setLabel(versionLabel)
                  .setStyle(i === result.currentVersion ? ButtonStyle.Primary : ButtonStyle.Secondary)
              );
            }
            
            // Split version buttons into rows
            const versionRows = splitButtonsIntoRows(versionButtons);
            components.push(...versionRows);
          }
          
          // Add follow-up buttons if this follow-up has its own follow-ups
          if (followUpMove.followUps && followUpMove.followUps.length > 0) {
            const nestedFollowUpButtons = [];
            
            followUpMove.followUps.forEach((nestedFollowUp, index) => {
              if (index < 25) {
                const buttonLabel = (nestedFollowUp.name || nestedFollowUp.moveName).substring(0, 80);
                nestedFollowUpButtons.push(
                  new ButtonBuilder()
                    .setCustomId(createUniqueId(`nestedfollowup:${characterName}:${moveListId}:${followUpIndex}:${index}:0`))
                    .setLabel(`${buttonLabel}`)
                    .setStyle(ButtonStyle.Secondary)
                );
              }
            });
            
            // Split nested follow-up buttons into rows
            const nestedFollowUpRows = splitButtonsIntoRows(nestedFollowUpButtons);
            components.push(...nestedFollowUpRows);
          }
          
          return interaction.update({
            embeds: [embed],
            components: components.length > 0 ? components : []
          });
        } else {
          return interaction.reply({ content: "Follow-up not found.", ephemeral: true });
        }
      }

      // Handle parent move button
      if (interaction.customId.includes('parent:')) {
        const parts = interaction.customId.split(':');
        const characterName = parts[1];
        const moveListIdStr = parts[2];
        const moveListId = parseInt(moveListIdStr, 10);
        const parentMoveName = parts.slice(3).join(':'); // Handle names with colons
        
        // Load character
        const character = await loadCharacter(characterName);
        if (!character) {
          return interaction.reply({ content: "Character not found.", ephemeral: true });
        }
        
        // Find the parent move
        const moveResults = findMoveInAllMoveLists(character, parentMoveName);
        if (moveResults.length === 0) {
          return interaction.reply({ content: "Parent move not found.", ephemeral: true });
        }
        
        const moveData = moveResults[0];
        const parentMove = moveData.move;
        
        // Create embed for the parent move
        const result = createMoveEmbed(character, parentMove, moveData.section, moveData.moveList?.name, 0);
        const embed = result.embed;
        
        // Create components for the parent move (similar to existing code)
        // Include follow-up buttons, version buttons, etc.
        
        return interaction.update({
          embeds: [embed],
          components: components.length > 0 ? components : []
        });
      }

      // Handle nested follow-up button (for follow-ups of follow-ups)
      if (interaction.customId.includes('nestedfollowup:')) {
        // Similar to followup handler but navigate through two levels of follow-ups
        // Implementation follows similar pattern
      }
    } catch (error) {
      console.error("Error handling button interaction:", error);
      
      if (!interaction.replied && !interaction.deferred) {
        return interaction.reply({ content: "An error occurred while processing your request.", ephemeral: true });
      }
    }
  }
};