import { Events } from 'discord.js';
import { logger } from '../utils/logger.js';
import { registerCommands } from '../handlers/commandLoader.js';

export default {
    name: Events.GuildCreate,
    once: false,

    async execute(guild) {
        logger.info(`Joined new guild: ${guild.name} (${guild.id})`);
        try {
            await registerCommands(guild.client, guild.id);
            logger.info(`Commands registered for beta guild: ${guild.name} (${guild.id})`);
        } catch (error) {
            logger.error(`Failed to register commands for guild ${guild.id}:`, error);
        }
    }
};
