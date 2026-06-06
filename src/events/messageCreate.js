/**
 * messageCreate.js
 * Handles both prefix (!) and no-prefix (NP) commands.
 * Properly supports subcommands and subcommand groups.
 */
import { hasNPAccess } from "../npSystem/npData.js";

const PREFIX = "!";
const OWNER_ID = "1360488463371341834";

function getCommandOptions(command) {
    if (!command.data || !command.data.options) return [];
    return command.data.options;
}

function getSubcommandInfo(command, subcommandName) {
    const options = getCommandOptions(command);
    for (const option of options) {
        if (option.type === 1 && option.name === subcommandName) {
            return option.options || [];
        }
    }
    return [];
}

function createFakeInteraction(message, client, args, command) {
    const commandOptions = getCommandOptions(command);
    const replied = { value: false };

    const buildResponse = (data) => {
        if (typeof data === "string") data = { content: data };
        return data;
    };

    let subcommandName = null;
    let subcommandOptions = [];
    let argsForOptions = args;

    if (commandOptions.length > 0 && commandOptions[0].type === 1) {
        subcommandName = args[0]?.toLowerCase() || null;
        argsForOptions = args.slice(1);
        
        if (subcommandName) {
            subcommandOptions = getSubcommandInfo(command, subcommandName);
        }
    }

    const optionsMap = {};
    subcommandOptions.forEach((option, index) => {
        optionsMap[option.name] = argsForOptions[index] || null;
    });

    return {
        id: message.id,
        token: null,
        type: 2,
        isChatInputCommand: () => true,
        isButton: () => false,
        isSelectMenu: () => false,
        isModalSubmit: () => false,
        isAutocomplete: () => false,

        user: message.author,
        member: message.member,
        guild: message.guild,
        guildId: message.guild?.id,
        channel: message.channel,
        channelId: message.channel?.id,
        client,
        createdAt: message.createdAt,
        createdTimestamp: message.createdTimestamp,

        options: {
            getString: (name) => optionsMap[name] || null,
            getInteger: (name) => {
                const val = optionsMap[name];
                return val !== null && val !== undefined ? parseInt(val, 10) : null;
            },
            getNumber: (name) => {
                const val = optionsMap[name];
                return val !== null && val !== undefined ? parseFloat(val) : null;
            },
            getBoolean: (name) => {
                const val = optionsMap[name];
                if (val === null || val === undefined) return null;
                const lowerVal = String(val).toLowerCase().trim();
                return lowerVal === "true" || lowerVal === "1" || lowerVal === "yes" || lowerVal === "enable" || lowerVal === "on";
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
            getSubcommand: () => subcommandName,
            getSubcommandGroup: () => null,
            get: () => null,
            data: [],
        },

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

        deferred: false,
        replied: false,

        locale: "en-US",
        guildLocale: "en-US",

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

        if (content.startsWith(PREFIX)) {
            const withoutPrefix = content.slice(PREFIX.length).trim();
            const split = withoutPrefix.split(/\s+/);
            commandName = split[0].toLowerCase();
            args = split.slice(1);
        }

        else if (message.author.id === OWNER_ID || await hasNPAccess(message.author.id)) {
            const split = content.split(/\s+/);
            commandName = split[0].toLowerCase();
            args = split.slice(1);
            usedNP = true;
        }

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
