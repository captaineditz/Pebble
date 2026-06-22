import { Events } from "discord.js";
import { logger, startupLog } from "../utils/logger.js";
import config from "../config/application.js";
import { reconcileReactionRoleMessages } from "../services/reactionRoleService.js";
import { registerCommands } from "../handlers/commandLoader.js";

export default {
  name: Events.ClientReady,
  once: true,

  async execute(client) {
    try {
      client.user.setPresence(config.bot.presence);

      startupLog(`Ready! Logged in as ${client.user.tag}`);
      startupLog(`Serving ${client.guilds.cache.size} guild(s)`);
      startupLog(`Loaded ${client.commands.size} commands`);

      const BETA_GUILD_ID = '1505180294993674300';

      for (const guild of client.guilds.cache.values()) {
        try {
          if (guild.id === BETA_GUILD_ID) {
            await registerCommands(client, guild.id);
            logger.info(`Commands registered for beta guild: ${guild.name}`);
          } else {
            await guild.commands.set([]);
            logger.info(`Commands cleared from guild: ${guild.name} (${guild.id})`);
          }
        } catch (err) {
          logger.error(`Failed to update commands for guild ${guild.id} (${guild.name}):`, err);
        }
      }

      const reconciliationSummary = await reconcileReactionRoleMessages(client);
      startupLog(
        `Reaction role reconciliation: scanned ${reconciliationSummary.scannedMessages}, removed ${reconciliationSummary.removedMessages}, errors ${reconciliationSummary.errors}`
      );
    } catch (error) {
      logger.error("Error in ready event:", error);
    }
  },
};


