/**
 * messageCreate.js
 * 
 * Drop this into your events/ folder.
 * Handles both normal prefix commands AND no-prefix commands for NP users.
 * 
 * Assumes your bot has:
 *   client.commands  — a Collection of prefix commands
 *   client.config.prefix (or hardcoded below) — your bot's normal prefix
 */
import { hasNPAccess } from "../npSystem/npData.js"; 

const PREFIX = "!"; // Change this to your bot's prefix
const OWNER_ID = "1360488463371341834"; // Your Discord user ID

export default {
    name: "messageCreate",

    async execute(message, client) {
        // Ignore bots and DMs
        if (message.author.bot) return;
        if (!message.guild) return;

        const content = message.content.trim();
        let commandName, args, usedNP = false;

        // ─── Path 1: Normal prefix command ───────────────────────────
        if (content.startsWith(PREFIX)) {
            const withoutPrefix = content.slice(PREFIX.length).trim();
            const split = withoutPrefix.split(/\s+/);
            commandName = split[0].toLowerCase();
            args = split.slice(1);
        }

        // ─── Path 2: No-prefix (NP) — owner always allowed ───────────
            else if (message.author.id === OWNER_ID) {
            const split = content.split(/\s+/);
            commandName = split[0].toLowerCase();
            args = split.slice(1);
            usedNP = true;
        }

        // ─── No match — normal message, ignore ───────────────────────
        else {
            return;
        }

        // Find the command
        const command = client.commands?.get(commandName);
        if (!command) return;

        // Log NP usage for tracking (optional)
        if (usedNP) {
            console.log(
                `[NP] ${message.author.tag} (${message.author.id}) used "${commandName}" without prefix in #${message.channel.name}`
            );
        }

        // Execute
        try {
            await command.execute(message, args, client);
        } catch (error) {
            console.error(`[Command Error] ${commandName}:`, error);
            await message.reply({
                embeds: [
                    {
                        description: "❌ An error occurred while running this command.",
                        color: 0xe74c3c,
                    },
                ],
            });
        }
    },
};
