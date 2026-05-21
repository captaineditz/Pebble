/**
 * messageCreate.js
 * Handles both prefix (!) and no-prefix (NP) commands.
 * Wraps message into a fake interaction so all slash commands work as-is.
 */
import { hasNPAccess } from "../npSystem/npData.js";

const PREFIX = "!";
const OWNER_ID = "1360488463371341834";

/**
 * Creates a fake interaction object from a Discord message.
 * This tricks slash commands into working with prefix/NP messages.
 */
function createFakeInteraction(message, client) {
    const replied = { value: false };

    const buildResponse = (data) => {
        // Handle string shorthand
        if (typeof data === "string") data = { content: data };
        return data;
    };

    return {
        // ── Identity ──────────────────────────────────────────────
        id: message.id,
        token: null,
        type: 2,
        isChatInputCommand: () => true,
        isButton: () => false,
        isSelectMenu: () => false,
        isModalSubmit: () => false,
        isAutocomplete: () => false,

        // ── Context ───────────────────────────────────────────────
        user: message.author,
        member: message.member,
        guild: message.guild,
        guildId: message.guild?.id,
        channel: message.channel,
        channelId: message.channel?.id,
        client,
        createdAt: message.createdAt,
        createdTimestamp: message.createdTimestamp,

        // ── Options (slash command args — return null for prefix) ─
        options: {
            getString: () => null,
            getInteger: () => null,
            getNumber: () => null,
            getBoolean: () => null,
            getUser: () => null,
            getMember: () => null,
            getChannel: () => null,
            getRole: () => null,
            getMentionable: () => null,
            getSubcommand: () => null,
            getSubcommandGroup: () => null,
            get: () => null,
            data: [],
        },

        // ── Reply methods ─────────────────────────────────────────
        reply: async (data) => {
            replied.value = true;
            return message.reply(buildResponse(data));
        },
        editReply: async (data) => {
            return message.reply(buildResponse(data));
        },
        followUp: async (data) => {
            return message.reply(buildResponse(data));
        },
        deferReply: async () => {
            // No-op for prefix commands (no "thinking..." state needed)
            replied.value = true;
            return Promise.resolve();
        },
        deleteReply: async () => Promise.resolve(),
        fetchReply: async () => Promise.resolve(message),

        // ── State ─────────────────────────────────────────────────
        deferred: false,
        replied: false,

        // ── Locale (some commands use this) ───────────────────────
        locale: "en-US",
        guildLocale: "en-US",

        // ── Raw message reference (in case commands need it) ──────
        _originalMessage: message,
    };
}

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

        // ─── Path 2: No-prefix (NP) — owner + NP users ───────────────
        else if (message.author.id === OWNER_ID || await hasNPAccess(message.author.id)) {
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

        // Log NP usage
        if (usedNP) {
            console.log(
                `[NP] ${message.author.tag} (${message.author.id}) used "${commandName}" without prefix in #${message.channel.name}`
            );
        }

        // Build fake interaction and execute
        const fakeInteraction = createFakeInteraction(message, client);

        try {
            await command.execute(fakeInteraction, null, client);
        } catch (error) {
            console.error(`[Command Error] ${commandName}:`, error);
            try {
                await message.reply({
                    embeds: [
                        {
                            description: "❌ An error occurred while running this command.",
                            color: 0xe74c3c,
                        },
                    ],
                });
            } catch (_) {}
        }
    },
};
