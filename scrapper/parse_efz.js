const axios = require("axios");
const cheerio = require("cheerio");
const fs = require("fs");
const path = require("path");

const BASE_URL = "https://wiki.gbl.gg";
const CHARACTER_LIST_URL = `${BASE_URL}/w/Eternal_Fighter_Zero`;
const OUTPUT_DIR = path.join(__dirname, "/characters");
const MIN_FILE_SIZE = 2 * 1024; // 2KB minimum file size

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

async function getAllCharacters() {
  try {
    const res = await axios.get(CHARACTER_LIST_URL);
    const $ = cheerio.load(res.data);

    // Find the character list - typically in a table with character links
    const characterLinks = [];
    
    // Look for character links in the "Characters" section
    const headers = $("h2, h3").filter((i, el) => {
      return $(el).text().trim().match(/characters/i);
    });

    if (headers.length > 0) {
      // Get the next element after the header (usually a div or table)
      const nextElement = headers.first().next();
      
      // Find all links in this section that point to character pages
      nextElement.find("a").each((i, el) => {
        const href = $(el).attr("href");
        if (href && href.startsWith("/w/Eternal_Fighter_Zero/") && !href.includes("#")) {
          const characterName = href.split("/").pop();
          if (characterName && !characterLinks.includes(characterName)) {
            characterLinks.push(characterName);
          }
        }
      });
    }

    // Fallback if no characters found in headers
    if (characterLinks.length === 0) {
      $("a").each((i, el) => {
        const href = $(el).attr("href");
        if (href && href.startsWith("/w/Eternal_Fighter_Zero/") && !href.includes("#")) {
          const characterName = href.split("/").pop();
          if (characterName && !characterLinks.includes(characterName) && 
              !characterName.match(/game_mechanics|system|eternal_fighter_zero/i)) {
            characterLinks.push(characterName);
          }
        }
      });
    }

    return characterLinks;
  } catch (error) {
    console.error("Error fetching character list:", error.message);
    return [];
  }
}

async function parseCharacter(characterName) {
  const url = `${BASE_URL}/w/Eternal_Fighter_Zero/${characterName}`;
  
  try {
    const res = await axios.get(url);
    const $ = cheerio.load(res.data);

    // Extract character name from page
    const fullTitle = $("span.mw-page-title-main").first().text().trim();
    const displayName = fullTitle.replace("Eternal Fighter Zero/", "");

    // Extract character icon
    const characterIcon = $("img").filter((i, el) => {
      return $(el).attr("alt")?.includes("CSS.png");
    }).first();
    const characterIconUrl = characterIcon.length ? BASE_URL + characterIcon.attr("src") : null;

    // Initialize character data structure with proper movelists array
    const output = {
      name: displayName,
      icon: characterIconUrl,
      movelists: []
    };

    // Check for multiple moveset headers
    const movelistHeaders = $("h2, h3").filter((i, el) => {
      const text = $(el).text().trim().toLowerCase();
      return text.includes("mode") || text.includes("movelist") || 
             text.includes("-mode") || text.includes("style");
    });

    // If we found potential movelist headers, process by headers
    let movelistSections = [];
    
    // Check if this is the special case for toggle-based movelists
    const moveListToggles = $(".movelist-toggles").first();
    let hasToggleMovelists = moveListToggles.length > 0;

    // Initialize movelists
    const movelistData = [];
    
    if (hasToggleMovelists) {
      // Handle toggle-based movelists
      moveListToggles.find(".movelist-toggle-button").each((i, el) => {
        movelistData.push({
          name: $(el).text().trim() || `Movelist ${i+1}`,
          sections: []
        });
      });
    } else if (movelistHeaders.length > 1) {
      // Handle header-based movelists
      movelistHeaders.each((i, el) => {
        movelistData.push({
          name: $(el).text().trim(),
          sections: []
        });
      });
    } else {
      // Single movelist
      movelistData.push({
        name: "Moves",
        sections: []
      });
    }

    // Process the content based on the detected structure
    if (hasToggleMovelists) {
      // For toggle-based movelists, we need to identify which sections belong to which movelist
      let currentSection = null;
      let currentMove = null;
      let isFollowUp = false;
      let currentMovelistIdx = 0; // Default to first movelist
      
      // First, determine the active movelist
      moveListToggles.find(".movelist-toggle-button").each((i, el) => {
        if ($(el).hasClass("movelist-toggle-on")) {
          currentMovelistIdx = i;
        }
      });

      // Now process all sections and assign to appropriate movelist
      $("h2, h3, table.wikitable").each((i, el) => {
        const tag = el.tagName.toLowerCase();

        if (tag === "h2" || tag === "h3") {
          const text = $(el).text().trim();
          if (!text) return;
          
          // Create new section
          currentSection = {
            name: text,
            moves: []
          };
          
          // Check if this is a new movelist section header
          const isNewMovelist = movelistHeaders.filter((i, header) => $(header).text() === text).length > 0;
          
          if (isNewMovelist && movelistHeaders.length > 1) {
            // Find which movelist this belongs to
            movelistHeaders.each((idx, header) => {
              if ($(header).text() === text) {
                currentMovelistIdx = idx;
              }
            });
          }
          
          // Add this section to the current movelist
          if (movelistData[currentMovelistIdx]) {
            movelistData[currentMovelistIdx].sections.push(currentSection);
          }
          
          currentMove = null;
          isFollowUp = false;
        }

        if (tag === "table") {
          processTable($, el, currentSection, currentMove, isFollowUp, movelistData[currentMovelistIdx]);
        }
      });
    } else {
      // For simple movelists or header-based movelists
      let currentSection = null;
      let currentMove = null;
      let isFollowUp = false;
      let currentMovelistIdx = 0;

      $("h2, h3, table.wikitable").each((i, el) => {
        const tag = el.tagName.toLowerCase();

        if (tag === "h2" || tag === "h3") {
          const text = $(el).text().trim();
          if (!text) return;
          
          // Check if this is a movelist header
          const isMovelist = movelistHeaders.filter((i, header) => $(header).text() === text).length > 0;
          
          if (isMovelist && movelistHeaders.length > 1) {
            // This is a new movelist section
            movelistHeaders.each((idx, header) => {
              if ($(header).text() === text) {
                currentMovelistIdx = idx;
              }
            });
            
            // Skip creating a section for the movelist header itself
            return;
          }
          
          // Create section
          currentSection = {
            name: text,
            moves: []
          };
          
          // Add to current movelist
          if (movelistData[currentMovelistIdx]) {
            movelistData[currentMovelistIdx].sections.push(currentSection);
          } else {
            // Fallback to first movelist if something went wrong
            movelistData[0].sections.push(currentSection);
          }
          
          currentMove = null;
          isFollowUp = false;
        }

        if (tag === "table") {
          // Check if this is a follow-up header table
          const followUpHeader = $(el).find("big").text().trim().includes("Follow-ups");
          
          if (followUpHeader) {
            // This is a follow-up header table - process all follow-up moves
            const followUpTable = $(el).next("table");
            if (followUpTable.length) {
              processFollowUpTable($, followUpTable, currentSection, currentMove);
            }
            return;
          }

          // Regular move table processing
          if ($(el).find("big").length > 0) {
            const moveName = $(el).find("big").first().text().trim();

            // Check if this is a follow-up move (starts with "→")
            const isNewFollowUp = moveName.startsWith("→");
            
            if (!isNewFollowUp && !isFollowUp) {
              currentMove = null; // Reset for new main move
            }

            // Extract input information
            const smallTags = $(el).find("th").first().find("small");
            let moveInput = smallTags.length ? smallTags.last().text().trim() : null;
            
            // Check if the input contains button variations (e.g., "236*" where * = A, B, C)
            let hasButtonVariations = false;
            if (moveInput && moveInput.includes("*")) {
                hasButtonVariations = true;
                moveInput = moveInput.replace("*", ""); // Remove the * for a cleaner display
            }

            // Image
            const imageEl = $(el).find("img").first();
            const imageUrl = imageEl.length ? BASE_URL + imageEl.attr("src") : null;

            // Inner frame data table
            const dataTable = $(el).find("table").first();
            const { headers, rows, notes } = processDataTable($, dataTable);

            // Process notes and identify version-specific notes
            const { cleanedNotes, versionNotes } = extractVersionNotes($, el, rows.length);

            // Create the base move object
            const move = {
              name: moveName,
              input: moveInput,
              image: imageUrl,
              data: rows,
              notes: cleanedNotes,
              versionNotes: versionNotes,
              followUps: []
            };

            if (isNewFollowUp && currentMove) {
              // This is a follow-up to the current move
              currentMove.followUps.push(move);
              isFollowUp = true;
            } else {
              // This is a new main move
              if (currentSection) {
                currentSection.moves.push(move);
                currentMove = move;
                isFollowUp = false;
              }
            }
          }
        }
      });
    }

    // Filter empty movelists and sections
    const filteredMovelists = movelistData.map(movelist => {
      // Filter sections with no moves
      movelist.sections = movelist.sections.filter(section => section.moves.length > 0);
      return movelist;
    }).filter(movelist => movelist.sections.length > 0);

    // Assign to output
    output.movelists = filteredMovelists;

    // Convert the output to a Discord bot-friendly format
    const botFormatOutput = {
      name: displayName,
      icon: characterIconUrl,
      movelists: filteredMovelists.map(movelist => ({
        name: movelist.name,
        moves: movelist.sections.flatMap(section => 
          section.moves.map(move => {
            // Get version count - check if the move has multiple versions
            const versionCount = move.data.length;
            let moveVariations = [];
            
            // Check if this move has multiple distinct versions (A, B, C)
            // This includes checking for * in the input or multiple data rows
            const hasVariations = 
              (move.input && (move.input.includes('*') || move.input.includes('/'))) ||
              versionCount > 1 || 
              Object.keys(move.versionNotes || {}).length > 0;
            
            // If there are variations, create a variation for each
            if (hasVariations) {
              // First check if we have explicit versions in the data
              if (versionCount > 1) {
                moveVariations = move.data.map((data, idx) => {
                  // Determine the version label
                  let versionLabel = data.Version || `Version ${idx + 1}`;
                  if (!data.Version && idx < 3) {
                    versionLabel = ['A', 'B', 'C'][idx];
                  }
                  
                  // Get version-specific notes
                  const versionNote = move.versionNotes && move.versionNotes[versionLabel] 
                    ? move.versionNotes[versionLabel][0] 
                    : null;
                    
                  return {
                    version: versionLabel,
                    damage: data.Damage || "",
                    framedata: {
                      guard: data.Guard || "",
                      startup: data['Startup ¹ ²'] || data.Startup || "",
                      active: data.Active || "",
                      recovery: data.Recovery || "",
                      advHit: data['Adv Hit'] || "",
                      advBlock: data['Adv Block'] || "",
                      cancel: data.Cancel || ""
                    },
                    notes: versionNote || (move.notes && move.notes[0] ? move.notes[0] : "")
                  };
                });
              } 
              // If we have version notes but not multiple data entries, create variations from notes
              else if (move.versionNotes && Object.keys(move.versionNotes).length > 0) {
                moveVariations = Object.entries(move.versionNotes).map(([version, notes]) => {
                  return {
                    version: version,
                    damage: move.data[0]?.Damage || "",
                    framedata: {
                      guard: move.data[0]?.Guard || "",
                      startup: move.data[0]?.['Startup ¹ ²'] || move.data[0]?.Startup || "",
                      active: move.data[0]?.Active || "",
                      recovery: move.data[0]?.Recovery || "",
                      advHit: move.data[0]?.['Adv Hit'] || "",
                      advBlock: move.data[0]?.['Adv Block'] || "",
                      cancel: move.data[0]?.Cancel || ""
                    },
                    notes: notes[0] || ""
                  };
                });
              }
              // Otherwise if the input indicates variations (like 236*), create default A,B,C variations 
              else if (move.input && (move.input.includes('*') || move.input.includes('/'))) {
                // For moves with inputs like "236*" which indicate A,B,C versions but data isn't split
                moveVariations = ['A', 'B', 'C'].map(version => {
                  // Try to find a specific note for this version
                  let versionNote = "";
                  if (move.notes && move.notes.length > 0) {
                    // Look for version-specific notes in general notes
                    for (const note of move.notes) {
                      if (note.startsWith(`${version}:`) || note.startsWith(`Version ${version}:`)) {
                        versionNote = note.replace(/^(A:|B:|C:|Version [ABC]:)/i, '').trim();
                        break;
                      }
                    }
                    
                    // If no specific note found, use the first general note
                    if (!versionNote) {
                      versionNote = move.notes[0];
                    }
                  }
                  
                  return {
                    version: version,
                    damage: move.data[0]?.Damage || "",
                    framedata: {
                      guard: move.data[0]?.Guard || "",
                      startup: move.data[0]?.['Startup ¹ ²'] || move.data[0]?.Startup || "",
                      active: move.data[0]?.Active || "",
                      recovery: move.data[0]?.Recovery || "",
                      advHit: move.data[0]?.['Adv Hit'] || "",
                      advBlock: move.data[0]?.['Adv Block'] || "",
                      cancel: move.data[0]?.Cancel || ""
                    },
                    notes: versionNote
                  };
                });
              }
            }
            
            // Base move data
            const baseMoveData = {
              moveName: move.name,
              input: move.input || "",
              image: move.image || "",
              damage: move.data[0]?.Damage || "",
              framedata: {
                guard: move.data[0]?.Guard || "",
                startup: move.data[0]?.['Startup ¹ ²'] || move.data[0]?.Startup || "",
                active: move.data[0]?.Active || "",
                recovery: move.data[0]?.Recovery || "",
                advHit: move.data[0]?.['Adv Hit'] || "",
                advBlock: move.data[0]?.['Adv Block'] || "",
                cancel: move.data[0]?.Cancel || ""
              },
              properties: Array.isArray(move.notes) ? move.notes : 
                        (typeof move.notes === "object" ? Object.values(move.notes).flat() : [])
            };
            
            // If we have variations, include them
            if (moveVariations.length > 0) {
              baseMoveData.variations = moveVariations;
            }
            
            return baseMoveData;
          })
        )
      }))
    };

    // Generate JSON content
    const jsonContent = JSON.stringify(botFormatOutput, null, 2);
    
    // Calculate estimated file size
    const fileSize = Buffer.byteLength(jsonContent, 'utf8');
    
    // Check if file size is adequate
    if (fileSize < MIN_FILE_SIZE) {
      console.log(`⚠️ Warning: Generated file for ${displayName} is too small (${fileSize} bytes), likely incomplete. Skipping.`);
      return false;
    }

    // Save JSON
    const filename = `${displayName.replace(/\s+/g, "_")}.json`;
    const filePath = path.join(OUTPUT_DIR, filename);
    fs.writeFileSync(filePath, jsonContent);
    
    // Verify the file was created successfully and has adequate content
    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      
      if (stats.size < MIN_FILE_SIZE) {
        console.log(`⚠️ Warning: Saved file for ${displayName} is too small (${stats.size} bytes). Removing...`);
        fs.unlinkSync(filePath);
        return false;
      }
      
      console.log(`✅ Saved: ${filename} (${stats.size} bytes)`);
      return true;
    } else {
      console.log(`❌ Failed to save file for ${displayName}`);
      return false;
    }
  } catch (error) {
    console.error(`❌ Error parsing ${characterName}:`, error.message);
    return false;
  }
}

// Modify this function to better recognize follow-up tables
function processTable($, table, currentSection, currentMove, isFollowUp, currentMovelist) {
  // Check if this is a follow-up header table
  const followUpHeader = $(table).find("big").text().trim().includes("Follow-ups");
  
  if (followUpHeader) {
    // Find all possible follow-up tables that come after this header
    let followUpTable = $(table).next("table");
    if (followUpTable.length) {
      processFollowUpTable($, followUpTable, currentSection, currentMove);
    }
    
    // Look for additional follow-up tables
    // This handles multiple follow-up sections from the same move
    let nextElement = $(table).next();
    let checkCount = 0; // Limit how far we look to avoid processing unrelated tables
    
    while (nextElement.length && checkCount < 10) { // Increased from 5 to 10
      // Check if this is a table or might be a header to another follow-up section
      if (nextElement.is('table')) {
        // Check if this is a follow-up table without a header
        if (!nextElement.find('big').text().includes('Follow-ups')) {
          processFollowUpTable($, nextElement, currentSection, currentMove);
        }
      } else if (nextElement.is('h3, h4, h5') && nextElement.text().includes('Follow-up')) {
        // This is a header for another follow-up section, check the table after it
        const nextFollowUpTable = nextElement.next('table');
        if (nextFollowUpTable.length) {
          processFollowUpTable($, nextFollowUpTable, currentSection, currentMove);
        }
      }
      nextElement = nextElement.next();
      checkCount++;
    }
    
    // Special handling for multi-level follow-ups (like for Doppel Nanase)
    // Look for tables with similar names that might be additional follow-up sections
    $("table").each((i, otherTable) => {
      const tableHeader = $(otherTable).find("big").first().text().trim();
      if (currentMove && tableHeader.includes(currentMove.moveName) && tableHeader.includes("Follow-up")) {
        // This is another table related to the current move's follow-ups
        processFollowUpTable($, $(otherTable).next("table"), currentSection, currentMove);
      }
    });
    
    return;
  }

  // Regular move table processing
  if ($(table).find("big").length > 0) {
    const moveName = $(table).find("big").first().text().trim();

    // Check if this is a follow-up move (starts with "→" or contains specific follow-up indicators)
    const isNewFollowUp = moveName.startsWith("→") || 
                          moveName.includes("Follow-up") ||
                          moveName.includes("~");
    
    if (!isNewFollowUp && !isFollowUp) {
      currentMove = null; // Reset for new main move
    }

    // Extract input information
    const smallTags = $(table).find("th").first().find("small");
    const moveText = $(table).find("th").first().text().trim();
    let moveInput = smallTags.length ? smallTags.last().text().trim() : null;
    
    // Special handling for moves that include input notation in their name like "41236*~236A"
    if (!moveInput && moveText.includes('~')) {
      const inputMatch = moveText.match(/(\d+\*?~\d+[ABC])/);
      if (inputMatch) {
        moveInput = inputMatch[1];
      }
    }
    
    // Check if the input contains button variations (e.g., "236*" where * = A, B, C)
    let hasButtonVariations = false;
    if (moveInput && moveInput.includes("*")) {
        hasButtonVariations = true;
        moveInput = moveInput.replace("*", ""); // Remove the * for a cleaner display
    }

    // Find all images in the move table - sometimes there are multiple
    const imageElements = $(table).find("img");
    let moveImages = [];
    
    imageElements.each((i, img) => {
      const src = $(img).attr("src");
      if (src) {
        moveImages.push(BASE_URL + src);
      }
    });
    
    // Use the first image as the main image
    const imageUrl = moveImages.length > 0 ? moveImages[0] : null;

    // Inner frame data table
    const dataTable = $(table).find("table").first();
    const { headers, rows, notes } = processDataTable($, dataTable);

    // Process notes and identify version-specific notes
    const { cleanedNotes, versionNotes } = extractVersionNotes($, table, rows.length);

    // Determine the parent move if this is a follow-up
    let parentMove = null;
    if (isNewFollowUp && currentMove) {
      parentMove = currentMove;
    }

    // Create the base move object
    const move = {
      name: moveName,
      input: moveInput,
      image: imageUrl,
      additionalImages: moveImages.length > 1 ? moveImages.slice(1) : [], 
      data: rows,
      notes: cleanedNotes,
      versionNotes: versionNotes,
      followUps: [],
      parentMove: parentMove  // Track parent move for follow-ups
    };

    if (isNewFollowUp && currentMove) {
      // This is a follow-up to the current move
      currentMove.followUps.push(move);
      isFollowUp = true;
    } else {
      // This is a new main move
      if (currentSection) {
        currentSection.moves.push(move);
        currentMove = move;
        isFollowUp = false;
      }
    }
    
    // Look for additional followup details after this table
    // Sometimes followups are in separate tables after the main move
    let nextElement = $(table).next();
    let checkCount = 0;
    
    while (nextElement.length && checkCount < 10) {
      // If the next element is a ul list, it might contain additional notes for this move
      if (nextElement.is('ul')) {
        const additionalNotes = [];
        nextElement.find('li').each((i, li) => {
          const noteText = $(li).text().trim();
          if (noteText) additionalNotes.push(noteText);
        });
        
        if (additionalNotes.length > 0) {
          move.notes = move.notes.concat(additionalNotes);
        }
      }
      // If we find a table that's specifically related to follow-ups for this move
      else if (nextElement.is('table') && 
              (nextElement.find('big').text().includes(move.name) || 
               nextElement.find('big').text().includes('Follow-up'))) {
        processFollowUpTable($, nextElement, currentSection, move);
      }
      
      nextElement = nextElement.next();
      checkCount++;
    }
    
    // Special handling for sequence-based moves like 41236*~236A~236B
    // These should be represented as follow-ups of follow-ups
    if (moveInput && moveInput.includes('~')) {
      const inputParts = moveInput.split('~');
      if (inputParts.length > 1) {
        // This move is part of a sequence
        // We need to find the parent move based on the first part of the sequence
        const parentInputBase = inputParts[0];
        
        // Look through all existing moves to find a potential parent
        let possibleParent = null;
        
        // Check in current section
        if (currentSection && currentSection.moves) {
          for (const potentialParent of currentSection.moves) {
            if (potentialParent.input === parentInputBase || 
                (potentialParent.input && potentialParent.input.startsWith(parentInputBase))) {
              possibleParent = potentialParent;
              break;
            }
            
            // Check follow-ups of this move
            if (potentialParent.followUps) {
              for (const followUp of potentialParent.followUps) {
                if (followUp.input === parentInputBase || 
                    (followUp.input && followUp.input.startsWith(parentInputBase))) {
                  possibleParent = followUp;
                  break;
                }
              }
              if (possibleParent) break;
            }
          }
        }
        
        // If we found a parent, add this move as a follow-up
        if (possibleParent && !isNewFollowUp) {
          possibleParent.followUps.push(move);
          move.parentMove = possibleParent;
          // Don't add this move directly to the section as it's now a follow-up
          currentSection.moves = currentSection.moves.filter(m => m !== move);
        }
      }
    }
  }
}

// Enhanced function to process follow-up tables
function processFollowUpTable($, table, currentSection, parentMove) {
  if (!table.length || !parentMove) return;

  // Look for all follow-up entries in the table
  // Each row typically represents a different follow-up
  const rows = table.find('tr');
  
  rows.each((rowIndex, row) => {
    const cells = $(row).find('td');
    if (cells.length === 0) return; // Skip header rows
    
    // Process the follow-up move from this row
    const nameCell = cells.first();
    
    // Extract name, input and image
    const nameElement = nameCell.find('big, b, strong');
    const inputElement = nameCell.find('small');
    const imageElement = nameCell.find('img');
    
    let followUpName = '';
    
    // Try different ways to get the follow-up name
    if (nameElement.length) {
      followUpName = nameElement.text().trim();
    } else {
      // Look for the first text node that might contain the name
      const cellText = nameCell.contents().filter(function() {
        return this.nodeType === 3; // Text nodes
      }).first().text().trim();
      
      if (cellText) {
        followUpName = cellText;
      }
    }
    
    // If no name found, skip this row
    if (!followUpName) return;
    
    // Get input notation
    const followUpInput = inputElement.length ? inputElement.text().trim() : '';
    
    // Look for image both in the main cell and within any divs
    let followUpImage = null;
    if (imageElement.length) {
      followUpImage = BASE_URL + imageElement.attr('src');
    } else {
      // Try to find image in nested divs
      const nestedImg = nameCell.find('div img').first();
      if (nestedImg.length) {
        followUpImage = BASE_URL + nestedImg.attr('src');
      }
    }
    
    // Extract frame data from other cells
    const frameData = {};
    cells.each((cellIndex, cell) => {
      if (cellIndex === 0) return; // Skip name cell
      
      const headerText = $(table).find('tr').first().find('th').eq(cellIndex).text().trim();
      const cellText = $(cell).text().trim();
      
      if (headerText && cellText) {
        frameData[headerText] = cellText;
      }
    });
    
    // Look for notes in the next row
    let notes = [];
    const nextRow = $(row).next('tr');
    if (nextRow.length) {
      const notesCell = nextRow.find('td[colspan]');
      if (notesCell.length) {
        // Extract text notes
        notes.push(notesCell.text().trim());
        
        // Also collect bullet points
        notesCell.find('ul li, ol li').each((_, li) => {
          notes.push($(li).text().trim());
        });
      }
    }
    
    // Create the follow-up move object
    const followUpMove = {
      name: followUpName,
      input: followUpInput,
      image: followUpImage,
      data: [frameData],
      notes: notes,
      versionNotes: {},
      followUps: [],
      parentMove: parentMove // Set the parent move
    };
    
    // Add the follow-up to the parent move
    parentMove.followUps.push(followUpMove);
    
    // Check for subsequent follow-ups (like 41236*~236A~236A~236236B)
    // This handles multi-level follow-up chains
    $("table").each((i, otherTable) => {
      const tableHeader = $(otherTable).find("big").first().text().trim();
      if (tableHeader.includes(followUpName) && tableHeader.includes("Follow-up")) {
        // This is another table related to this follow-up
        processFollowUpTable($, $(otherTable).next("table"), currentSection, followUpMove);
      }
    });
  });
}

// Helper function to process a single table
function processDataTable($, table) {
  const headers = [];
  const rows = [];
  let notes = [];

  table.find("tr").each((i, row) => {
    const cellCount = $(row).find("td, th").length;
    const colSpan = parseInt($(row).find("td").attr("colspan")) || 0;

    if (colSpan >= 5 || cellCount === 1) {
      // This is likely the notes row
      const noteText = $(row).text().trim();
      if (noteText) notes.push(noteText);
      return;
    }

    const cells = $(row).find("th, td").map((_, cell) => {
      const text = $(cell).text().trim();
      // Handle cells with line breaks (like version names)
      return text.replace(/\n/g, ' ');
    }).get();

    if (i === 0) {
      headers.push(...cells);
    } else {
      const rowData = {};
      cells.forEach((val, idx) => {
        const header = headers[idx] || `col${idx}`;
        // Clean up the values
        rowData[header] = val.replace(/\s+/g, ' ').trim();
      });
      rows.push(rowData);
    }
  });

  return { headers, rows, notes };
}

// Extract version-specific notes and clean general notes
function extractVersionNotes($, moveTable, versionCount) {
  const allNotes = [];
  const versionNotes = {};
  const generalNotes = [];
  
  // Get notes from the data table
  const dataTable = $(moveTable).find("table").first();
  dataTable.find("tr").each((i, row) => {
    const cellCount = $(row).find("td, th").length;
    const colSpan = parseInt($(row).find("td").attr("colspan")) || 0;

    if (colSpan >= 5 || cellCount === 1) {
      const noteText = $(row).text().trim();
      if (noteText) allNotes.push(noteText);
    }
  });

  // Notes from ul lists after the table
  $(moveTable).find("ul li").each((i, li) => {
    const noteText = $(li).text().trim();
    if (noteText) allNotes.push(noteText);
  });

  // Process notes to categorize them by version
  allNotes.forEach(note => {
    const versionMatch = note.match(/^(A:|B:|C:|Version A:|Version B:|Version C:)/i);
    if (versionMatch) {
      const version = versionMatch[0].charAt(0).toUpperCase();
      if (!versionNotes[version]) versionNotes[version] = [];
      versionNotes[version].push(note.replace(/^(A:|B:|C:|Version A:|Version B:|Version C:)/i, '').trim());
    } else {
      generalNotes.push(note);
    }
  });

  // Clean up notes and remove duplicates
  const cleanedNotes = [...new Set(generalNotes)]
    .map(note => note.replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim())
    .filter(note => note.length > 0);
  
  return { cleanedNotes, versionNotes };
}

// Helper function to clean up small files from previous runs
async function cleanupSmallFiles() {
  console.log("Checking for and cleaning up small/incomplete files...");
  
  try {
    const files = fs.readdirSync(OUTPUT_DIR);
    let cleanedCount = 0;
    
    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      
      const filePath = path.join(OUTPUT_DIR, file);
      const stats = fs.statSync(filePath);
      
      if (stats.size < MIN_FILE_SIZE) {
        console.log(`Removing small file: ${file} (${stats.size} bytes)`);
        fs.unlinkSync(filePath);
        cleanedCount++;
      }
    }
    
    if (cleanedCount > 0) {
      console.log(`Cleaned up ${cleanedCount} small/incomplete files.`);
    } else {
      console.log("No small files found to clean up.");
    }
  } catch (error) {
    console.error("Error cleaning up files:", error.message);
  }
}

async function main() {
  // First, clean up any small files from previous runs
  await cleanupSmallFiles();
  
  console.log("Fetching character list...");
  const characters = await getAllCharacters();
  
  if (characters.length === 0) {
    console.log("No characters found. Please check the wiki page structure.");
    return;
  }

  console.log(`Found ${characters.length} characters to parse:`);
  console.log(characters.join(", "));

  // Process each character sequentially with delay to avoid rate limiting
  let successCount = 0;
  let failCount = 0;
  
  for (const character of characters) {
    console.log(`\nParsing ${character}...`);
    const success = await parseCharacter(character);
    
    if (success) {
      successCount++;
    } else {
      failCount++;
    }
    
    await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay
  }

  console.log("\nFinished processing all characters!");
  console.log(`✅ Success: ${successCount} characters`);
  console.log(`❌ Failed: ${failCount} characters`);
  
  // Final cleanup of any small files that might have been created
  await cleanupSmallFiles();
}

main().catch(console.error);