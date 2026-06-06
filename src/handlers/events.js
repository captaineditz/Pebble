import { readdir } from 'fs/promises';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { logger } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default async function loadEvents(client) {
    const eventsPath = join(__dirname, '../events');
    
    try {
        const eventFiles = await readdir(eventsPath);
        const jsFiles = eventFiles.filter(file => file.endsWith('.js'));
        
        logger.info(`Found ${jsFiles.length} event files to load`);
        
        for (const file of jsFiles) {
            const filePath = join(eventsPath, file);
            
            try {
                const { default: event } = await import(`file://${filePath}`);
                
                // Validate event structure
                if (!event?.name) {
                    logger.warn(`Event ${file} missing "name" property`);
                    continue;
                }
                
                if (typeof event.execute !== 'function') {
                    logger.warn(`Event ${file} missing "execute" function`);
                    continue;
                }
                
                // Wrap execute with error handling
                const safeExecute = async (...args) => {
                    try {
                        await event.execute(...args, client);
                    } catch (error) {
                        logger.error(`Error in event ${event.name}:`, error);
                    }
                };
                
                // Register event
                if (event.once) {
                    client.once(event.name, safeExecute);
                    logger.debug(`Loaded one-time event: ${event.name}`);
                } else {
                    client.on(event.name, safeExecute);
                    logger.debug(`Loaded event: ${event.name}`);
                }
            } catch (error) {
                logger.error(`Failed to load event ${file}:`, error.message);
            }
        }
        
        logger.info(`✅ Event handler loaded successfully`);
    } catch (error) {
        logger.error('Fatal error loading events:', error);
        throw error;
    }
}
