# EFZ Frame Data Discord Bot

A Discord bot created with Copilot AI for getting information about character moves from the game **Eternal Fighter Zero**.

Most of the information was parsed from the **EFZ Mizumi Wiki** - [wiki.gbl.gg/w/Eternal_Fighter_Zero](https://wiki.gbl.gg/w/Eternal_Fighter_Zero).

---
```markdown
## Features

- **Scrapes Frame Data**: Extracts detailed frame data for all characters in Eternal Fighter Zero using the Mizumi Wiki as the data source.
- **Processes Data for Discord Integration**: Converts the scraped frame data into a structured format compatible with Discord bots.
- **Multi-Version Compatibility**: Categorizes and organizes frame data by game versions (e.g., variations for A, B, C moves).
- **Handles Complex Movelists**:
  - Supports movelists with follow-ups.
  - Parses input variations like `236*` for A/B/C buttons.
  - Includes notes and metadata for each move.
- **Cleans Up Incomplete Files**: Automatically removes small or incomplete files generated during scraping.
- **Error-Resilient Scraping**: Includes robust error handling to ensure reliable data extraction.
- **Batch Processing**: Sequentially processes multiple characters while adhering to rate-limiting constraints.
- **Discord-Friendly Output**: Formats the data to allow seamless querying and presentation within Discord.

---

## How It Works

1. **Scraping**: The bot scrapes character frame data and move information from the Mizumi Wiki.
2. **Processing**: Processes the scraped data into Discord-ready JSON files with:
   - Character names
   - Move inputs
   - Frame data (startup, active, recovery, etc.)
   - Notes and additional metadata
3. **Integration**: The processed data is used by the Discord bot to respond to user queries about character moves and frame data.

CURRENTLY, A LOT OF THINGS IN THE JSONs are hardcoded, since the Wiki has inconsistent formatting for different characters(mostly follow-up moves)
---
```
## Getting Started
```
### Prerequisites
- Node.js (latest LTS version recommended)
- npm or yarn
- Access to the Mizumi Wiki for scraping data
```
### Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/Aquat1c/efz_framedata_discordbot.git
   cd efz_framedata_discordbot
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Configure the bot (e.g., API keys, Discord bot token) in the appropriate config files.

### Running the Bot
  
1. Start the bot:
   ```bash
   node start.js
   ```

---

## Contribution

Contributions are welcome! Feel free to open issues or submit pull requests to enhance the functionality of the bot.

---

## License

This project is licensed under the [MIT License](LICENSE).

---

## Acknowledgments
```
- **EFZ Mizumi Wiki**: For providing comprehensive frame data and move information.
- **Copilot AI**: For assisting in the creation of this bot.
```
