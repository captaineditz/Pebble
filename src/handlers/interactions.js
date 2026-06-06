import { readdir } from 'fs/promises';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { logger } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const interactionTypes = ['buttons', 'selectMenus', 'modals'];

export default async (client) => {
  try {
    const interactionsPath = join(__dirname, '../interactions');
    let totalLoaded = 0;

    for (const type of interactionTypes) {
      const typePath = join(interactionsPath, type);
      let typeCount = 0;

      try {
        // Validate collection exists
        if (!client[type]) {
          logger.warn(`Client collection "${type}" does not exist, skipping...`);
          continue;
        }

        const interactionFiles = (await readdir(typePath)).filter(file => file.endsWith('.js'));
        logger.debug(`Found ${interactionFiles.length} ${type} files`);

        for (const file of interactionFiles) {
          try {
            const filePath = join(typePath, file);
            const module = await import(`file://${filePath}`);
            const moduleExport = module.default;
            const interactions = Array.isArray(moduleExport) ? moduleExport : [moduleExport];

            for (const interaction of interactions) {
              // Validate interaction
              if (!interaction?.name) {
                logger.warn(`${type}/${file} missing "name" property`);
                continue;
              }

              if (typeof interaction.execute !== 'function') {
                logger.warn(`${type}/${file} missing "execute" function`);
                continue;
              }

              client[type].set(interaction.name, interaction);
              typeCount++;
              totalLoaded++;
            }
          } catch (error) {
            logger.error(`Error loading ${type}/${file}:`, error.message);
          }
        }

        logger.info(`Loaded ${typeCount} ${type}`);
      } catch (error) {
        if (error.code !== 'ENOENT') {
          logger.error(`Error reading ${type} directory:`, error.message);
        } else {
          logger.debug(`No ${type} directory found`);
        }
      }
    }

    logger.info(`✅ Interactions handler loaded: ${totalLoaded} total interactions`);
  } catch (error) {
    logger.error('Fatal error loading interactions:', error);
    throw error;
  }
};
