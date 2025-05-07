import fs from 'fs/promises';
import path from 'path';
import { loadPage, cleanText } from './utils';

interface CharacterData {
  name: string;
  moves: Record<string, string>;
}

async function scrapeCharacter(url: string, name: string): Promise<CharacterData> {
  const $ = await loadPage(url);

  const moves: Record<string, string> = {};

  $('table.wikitable tr').each((_, tr) => {
    const cells = $(tr).find('td');
    if (cells.length >= 2) {
      const moveName = cleanText($(cells[0]).text());
      const moveDesc = cleanText($(cells[1]).text());
      if (moveName && moveDesc) {
        moves[moveName] = moveDesc;
      }
    }
  });

  return { name, moves };
}

async function main() {
  const characters: Record<string, string> = JSON.parse(
    await fs.readFile('characters.json', 'utf-8')
  );

  for (const [name, url] of Object.entries(characters)) {
    try {
      console.log(`Scraping ${name}...`);
      const data = await scrapeCharacter(url, name);
      const filePath = path.join('output', `${name}.json`);
      await fs.mkdir('output', { recursive: true });
      await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
      console.log(`Saved ${name} to ${filePath}`);
    } catch (err) {
      console.error(`Failed to scrape ${name}:`, err);
    }
  }
}

main().catch(console.error);
