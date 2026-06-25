/**
 * messageCreate.js
 * Handles both prefix (!) and no-prefix (NP) commands.
 * Wraps message into a fake interaction so all slash commands work as-is.
 */
import { hasNPAccess } from "../npSystem/npData.js";
import { AfkService } from "../services/afkService.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PREFIXES_PATH = path.join(__dirname, "../data/prefixes.json");

function getGuildPrefixes(guildId) {
    try {
        if (!fs.existsSync(PREFIXES_PATH)) return [];
        const data = JSON.parse(fs.readFileSync(PREFIXES_PATH, "utf8"));
        return data[guildId] || [];
    } catch (_) {
        return [];
    }
}

const DEFAULT_PREFIX = "!";
const OWNER_ID = "1360488463371341834";

/**
 * Creates a fake interaction object from a Discord message.
 * This tricks slash commands into working with prefix/NP messages.
 */
function createFakeInteraction(message, client, args) {
    const replied = { value: false };

    const buildResponse = (data) => {
        if (typeof data === "string") data = { content: data };
        return data;
    };

    // Parse arguments into an options-like object
    const parseArgs = () => {
        const parsed = {};
        for (let i = 0; i < args.length; i++) {
            parsed[i] = args[i];
        }
        return parsed;
    };

    const parsedArgs = parseArgs();

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

        // ── Options (parse prefix args) ────────────────────────────
        options: {
            getString: (name) => args.join(' ') || null,
            getInteger: (name) => {
                const val = parsedArgs[0];
                return val ? parseInt(val, 10) : null;
            },
            getNumber: (name) => {
                const val = parsedArgs[0];
                return val ? parseFloat(val) : null;
            },
            getBoolean: (name) => {
                const val = parsedArgs[0];
                return val === "true" || val === "1" ? true : null;
            },
            getUser: (name) => {
                const mention = parsedArgs[0];
                if (!mention) return null;
                const userId = mention.replace(/[<@!>]/g, "");
                return client.users.cache.get(userId) || null;
            },
            getMember: (name) => {
                const mention = parsedArgs[0];
                if (!mention || !message.guild) return null;
                const userId = mention.replace(/[<@!>]/g, "");
                return message.guild.members.cache.get(userId) || null;
            },
            getChannel: (name) => {
                const mention = parsedArgs[0];
                if (!mention || !message.guild) return null;
                const channelId = mention.replace(/[<#>]/g, "");
                return message.guild.channels.cache.get(channelId) || null;
            },
            getRole: (name) => {
                const mention = parsedArgs[0];
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

async function handleAfkChecks(message, client) {
    const guildId = message.guild.id;
    const userId = message.author.id;

    // --- Return from AFK ---
    const afkData = await AfkService.getAfkStatus(client, guildId, userId);
    if (afkData) {
        await AfkService.clearAfk(client, guildId, userId);

        const elapsed = Date.now() - afkData.timestamp;
        const minutes = Math.floor(elapsed / 60000);
        const hours = Math.floor(minutes / 60);
        const durationText = hours > 0
            ? `${hours}h ${minutes % 60}m`
            : `${minutes}m`;

        const pings = afkData.pings || [];
        let pingText = '';
        if (pings.length > 0) {
            const lines = pings.slice(0, 10).map(p => {
                const jumpLink = p.messageId
                    ? `https://discord.com/channels/${p.guildId}/${p.channelId}/${p.messageId}`
                    : null;
                const jump = jumpLink ? ` — [Jump](${jumpLink})` : '';
                return `• **${p.username}** in <#${p.channelId}> <t:${Math.floor(p.timestamp / 1000)}:R>${jump}`;
            });
            pingText = `\n\n**Pings while you were away (${pings.length}):**\n${lines.join('\n')}`;
            if (pings.length > 10) pingText += `\n…and ${pings.length - 10} more.`;
        }

        try {
            await message.reply({
                embeds: [{
                    title: '👋 Welcome back!',
                    description: `You were AFK for **${durationText}**.${pingText}`,
                    color: 0x57f287,
                    timestamp: new Date().toISOString()
                }]
            });
        } catch (_) {}
    }

    // --- Mention AFK users ---
    if (message.mentions.users.size === 0) return;

    for (const [mentionedId, mentionedUser] of message.mentions.users) {
        if (mentionedId === userId) continue;
        const status = await AfkService.getAfkStatus(client, guildId, mentionedId);
        if (!status) continue;

        const elapsed = Date.now() - status.timestamp;
        const minutes = Math.floor(elapsed / 60000);
        const hours = Math.floor(minutes / 60);
        const durationText = hours > 0 ? `${hours}h ${minutes % 60}m` : `${minutes}m`;

        try {
            await message.reply({
                embeds: [{
                    description: `**${mentionedUser.username}** is currently AFK: **${status.reason}** (${durationText} ago)`,
                    color: 0xfee75c,
                    timestamp: new Date().toISOString()
                }]
            });
        } catch (_) {}

        await AfkService.addPing(client, guildId, mentionedId, {
            userId: message.author.id,
            username: message.author.username,
            channelId: message.channel.id,
            messageId: message.id,
            guildId,
            timestamp: Date.now()
        });
    }
}

export default {
    name: "messageCreate",

    async execute(message, client) {
        if (message.author.bot) return;
        if (!message.guild) return;

        try {
            await handleAfkChecks(message, client);
        } catch (_) {}

        const content = message.content.trim();
        let commandName, args, usedNP = false;

        // Build list of active prefixes for this guild
        const customPrefixes = getGuildPrefixes(message.guild.id);
        const prefixes = [DEFAULT_PREFIX, ...customPrefixes.filter(p => p !== DEFAULT_PREFIX)];

        // ─── Path 1: Normal prefix command ───────────────────────────
        const usedPrefix = prefixes.find(p => content.startsWith(p));
        if (usedPrefix) {
            const withoutPrefix = content.slice(usedPrefix.length).trim();
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

        const fakeInteraction = createFakeInteraction(message, client, args);

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
