import { Events } from 'discord.js';
import { logger } from '../utils/logger.js';
import { registerCommands } from '../handlers/commandLoader.js';

export default {
    name: Events.GuildCreate,
    once: false,

    async execute(guild) {
        logger.info(`Joined new guild: ${guild.name} (${guild.id})`);
        const BETA_GUILD_ID = '1505180294993674300';
        if (guild.id !== BETA_GUILD_ID) return;
        try {
            await registerCommands(guild.client, guild.id);
            logger.info(`Commands registered for beta guild: ${guild.name} (${guild.id})`);
        } catch (error) {
            logger.error(`Failed to register commands for guild ${guild.id}:`, error);
        }
    }
};
