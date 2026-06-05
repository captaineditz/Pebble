/**
 * messageCreate.js
 * Handles both prefix (p!) and no-prefix (NP) commands.
 * Wraps message into a fake interaction so all slash commands work as-is.
 */
import { hasNPAccess } from "../npSystem/npData.js";

const PREFIX = "!";
const OWNER_ID = "1360488463371341834";

/**
 * Extract options from command definition
 */
function getCommandOptions(command) {
    if (!command.data || !command.data.options) return [];
    return command.data.options;
}

/**
 * Creates a fake interaction object from a Discord message.
 * Maps prefix arguments to slash command options by position.
 */
function createFakeInteraction(message, client, args, command) {
    const commandOptions = getCommandOptions(command);
    const replied = { value: false };

    const buildResponse = (data) => {
        if (typeof data === "string") data = { content: data };
        return data;
    };

    // Map args to options by position
    const optionsMap = {};
    commandOptions.forEach((option, index) => {
        optionsMap[option.name] = args[index] || null;
    });

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

        // ── Options (smart parsing) ────────────────────────────────
        options: {
            getString: (name) => optionsMap[name] || null,
            getInteger: (name) => {
                const val = optionsMap[name];
                return val ? parseInt(val, 10) : null;
            },
            getNumber: (name) => {
                const val = optionsMap[name];
                return val ? parseFloat(val) : null;
            },
            getBoolean: (name) => {
                const val = optionsMap[name];
                return val === "true" || val === "1" || val === "yes" ? true : null;
            },
            getUser: (name) => {
                const mention = optionsMap[name];
                if (!mention) return null;
                const userId = mention.replace(/[<@!>]/g, "");
                return client.users.cache.get(userId) || null;
            },
            getMember: (name) => {
                const mention = optionsMap[name];
                if (!mention || !message.guild) return null;
                const userId = mention.replace(/[<@!>]/g, "");
                return message.guild.members.cache.get(userId) || null;
            },
            getChannel: (name) => {
                const mention = optionsMap[name];
                if (!mention || !message.guild) return null;
                const channelId = mention.replace(/[<#>]/g, "");
                return message.guild.channels.cache.get(channelId) || null;
            },
            getRole: (name) => {
                const mention = optionsMap[name];
                if (!mention || !message.guild) return null;
                const roleId = mention.replace(/[<@&>]/g, "");
                return message.guild.roles.cache.get(roleId) || null;
            },
            getMentionable: (name) => {
                return this.options.getUser(name) || this.options.getRole(name);
            },
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
            replied.value = true;
            return Promise.resolve();
        },
        deleteReply: async () => Promise.resolve(),
        fetchReply: async () => Promise.resolve(message),

        // ── State ─────────────────────────────────────────────────
        deferred: false,
        replied: false,

        // ── Locale ────────────────────────────────────────────────
        locale: "en-US",
        guildLocale: "en-US",

        // ── Raw message reference ─────────────────────────────────
        _originalMessage: message,
    };
}

export default {
    name: "messageCreate",

    async execute(message, client) {
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

        const command = client.commands?.get(commandName);
        if (!command) return;

        if (usedNP) {
            console.log(
                `[NP] ${message.author.tag} (${message.author.id}) used "${commandName}" without prefix in #${message.channel.name}`
            );
        }

        const fakeInteraction = createFakeInteraction(message, client, args, command);

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
