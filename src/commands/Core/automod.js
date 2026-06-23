import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { successEmbed, errorEmbed, infoEmbed, warningEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { TitanBotError, ErrorTypes, handleInteractionError } from '../../utils/errorHandler.js';
import { getGuildConfig, updateGuildConfig } from '../../services/guildConfig.js';

const RULE_TYPES = ['spam', 'profanity', 'invites', 'caps', 'mentions', 'links', 'newlines'];
const ACTIONS = ['warn', 'mute', 'kick', 'ban'];
const MUTE_DURATIONS = ['5m', '15m', '1h', '1d'];

export default {
    data: new SlashCommandBuilder()
        .setName('automod')
        .setDescription('Configure automatic moderation rules for your server')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .setDMPermission(false)
        .addSubcommand(subcommand =>
            subcommand
                .setName('toggle')
                .setDescription('Enable or disable automod')
                .addBooleanOption(option =>
                    option
                        .setName('enabled')
                        .setDescription('Enable or disable automod')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('add')
                .setDescription('Add a moderation rule')
                .addStringOption(option =>
                    option
                        .setName('rule')
                        .setDescription('Type of rule to add')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Spam Detection', value: 'spam' },
                            { name: 'Profanity Filter', value: 'profanity' },
                            { name: 'Invite Links', value: 'invites' },
                            { name: 'Excessive Caps', value: 'caps' },
                            { name: 'Excessive Mentions', value: 'mentions' },
                            { name: 'Suspicious Links', value: 'links' },
                            { name: 'Excessive Newlines', value: 'newlines' }
                        )
                )
                .addStringOption(option =>
                    option
                        .setName('action')
                        .setDescription('Action to take when rule triggered')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Warn User', value: 'warn' },
                            { name: 'Mute User', value: 'mute' },
                            { name: 'Kick User', value: 'kick' },
                            { name: 'Ban User', value: 'ban' }
                        )
                )
                .addStringOption(option =>
                    option
                        .setName('duration')
                        .setDescription('Duration for mute (if action is mute)')
                        .setRequired(false)
                        .addChoices(
                            { name: '5 Minutes', value: '5m' },
                            { name: '15 Minutes', value: '15m' },
                            { name: '1 Hour', value: '1h' },
                            { name: '1 Day', value: '1d' }
                        )
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('remove')
                .setDescription('Remove a moderation rule')
                .addStringOption(option =>
                    option
                        .setName('rule')
                        .setDescription('Type of rule to remove')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Spam Detection', value: 'spam' },
                            { name: 'Profanity Filter', value: 'profanity' },
                            { name: 'Invite Links', value: 'invites' },
                            { name: 'Excessive Caps', value: 'caps' },
                            { name: 'Excessive Mentions', value: 'mentions' },
                            { name: 'Suspicious Links', value: 'links' },
                            { name: 'Excessive Newlines', value: 'newlines' }
                        )
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('View all active moderation rules')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('settings')
                .setDescription('View current automod settings')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('action')
                .setDescription('Set default action for all rules')
                .addStringOption(option =>
                    option
                        .setName('action')
                        .setDescription('Default action to take')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Warn User', value: 'warn' },
                            { name: 'Mute User', value: 'mute' },
                            { name: 'Kick User', value: 'kick' },
                            { name: 'Ban User', value: 'ban' }
                        )
                )
                .addStringOption(option =>
                    option
                        .setName('duration')
                        .setDescription('Duration for mute (if action is mute)')
                        .setRequired(false)
                        .addChoices(
                            { name: '5 Minutes', value: '5m' },
                            { name: '15 Minutes', value: '15m' },
                            { name: '1 Hour', value: '1h' },
                            { name: '1 Day', value: '1d' }
                        )
                )
        )
        .addSubcommandGroup(group =>
            group
                .setName('whitelist')
                .setDescription('Manage users, roles, and channels exempt from automod')
                .addSubcommand(sub =>
                    sub
                        .setName('add')
                        .setDescription('Add a user, role, or channel to the whitelist')
                        .addUserOption(o => o.setName('user').setDescription('User to whitelist'))
                        .addRoleOption(o => o.setName('role').setDescription('Role to whitelist'))
                        .addChannelOption(o => o.setName('channel').setDescription('Channel to whitelist'))
                )
                .addSubcommand(sub =>
                    sub
                        .setName('remove')
                        .setDescription('Remove a user, role, or channel from the whitelist')
                        .addUserOption(o => o.setName('user').setDescription('User to remove'))
                        .addRoleOption(o => o.setName('role').setDescription('Role to remove'))
                        .addChannelOption(o => o.setName('channel').setDescription('Channel to remove'))
                )
                .addSubcommand(sub =>
                    sub
                        .setName('list')
                        .setDescription('View the current automod whitelist')
                )
        ),

    category: 'Moderation',

    async execute(interaction, guildConfig, client) {
        try {
            const deferred = await InteractionHelper.safeDefer(interaction);
            if (!deferred) return;

            const subcommandGroup = interaction.options.getSubcommandGroup(false);
            const subcommand = interaction.options.getSubcommand();
            const guildId = interaction.guildId;

            if (subcommandGroup === 'whitelist') {
                return await handleWhitelist(interaction, client, guildId, subcommand);
            }

            switch (subcommand) {
                case 'toggle':
                    return await handleToggle(interaction, client, guildId);
                case 'add':
                    return await handleAdd(interaction, client, guildId);
                case 'remove':
                    return await handleRemove(interaction, client, guildId);
                case 'list':
                    return await handleList(interaction, client, guildId);
                case 'settings':
                    return await handleSettings(interaction, client, guildId);
                case 'action':
                    return await handleAction(interaction, client, guildId);
                default:
                    throw new TitanBotError(
                        'Unknown subcommand',
                        ErrorTypes.VALIDATION,
                        'Unknown automod subcommand.'
                    );
            }
        } catch (error) {
            return handleInteractionError(error, interaction);
        }
    }
};

async function handleToggle(interaction, client, guildId) {
    try {
        const enabled = interaction.options.getBoolean('enabled');
        const currentConfig = await getGuildConfig(client, guildId);

        const automodConfig = currentConfig.automod || {
            enabled: false,
            defaultAction: 'warn',
            rules: {}
        };

        automodConfig.enabled = enabled;

        await updateGuildConfig(client, guildId, {
            automod: automodConfig
        });

        const embed = successEmbed()
            .setTitle('AutoMod ' + (enabled ? 'Enabled' : 'Disabled'))
            .setDescription(
                enabled
                    ? '✅ AutoMod is now **enabled**. I will monitor messages for rule violations.'
                    : '❌ AutoMod is now **disabled**. I will no longer monitor messages.'
            )
            .addFields(
                { name: 'Active Rules', value: Object.keys(automodConfig.rules || {}).length.toString(), inline: true }
            );

        await interaction.editReply({ embeds: [embed] });

        logger.info(`[AUTOMOD] Toggle for guild ${guildId}`, {
            guildId,
            enabled,
            userId: interaction.user.id
        });
    } catch (error) {
        throw error;
    }
}

async function handleAdd(interaction, client, guildId) {
    try {
        const rule = interaction.options.getString('rule');
        const action = interaction.options.getString('action');
        const duration = interaction.options.getString('duration') || null;

        const currentConfig = await getGuildConfig(client, guildId);

        const automodConfig = currentConfig.automod || {
            enabled: false,
            defaultAction: 'warn',
            rules: {}
        };

        if (!automodConfig.rules) {
            automodConfig.rules = {};
        }

        if (automodConfig.rules[rule]) {
            throw new TitanBotError(
                'Rule already exists',
                ErrorTypes.VALIDATION,
                `The **${rule}** rule is already active.`
            );
        }

        automodConfig.rules[rule] = {
            enabled: true,
            action,
            duration: action === 'mute' ? duration : null
        };

        await updateGuildConfig(client, guildId, {
            automod: automodConfig
        });

        const ruleNames = {
            'spam': 'Spam Detection',
            'profanity': 'Profanity Filter',
            'invites': 'Invite Links',
            'caps': 'Excessive Caps',
            'mentions': 'Excessive Mentions',
            'links': 'Suspicious Links',
            'newlines': 'Excessive Newlines'
        };

        const embed = successEmbed()
            .setTitle('Rule Added')
            .setDescription(`✅ **${ruleNames[rule]}** rule has been added.`)
            .addFields(
                { name: 'Action', value: action.charAt(0).toUpperCase() + action.slice(1), inline: true },
                { name: 'Duration', value: duration || 'N/A', inline: true }
            );

        await interaction.editReply({ embeds: [embed] });

        logger.info(`[AUTOMOD] Rule added for guild ${guildId}`, {
            guildId,
            rule,
            action,
            userId: interaction.user.id
        });
    } catch (error) {
        throw error;
    }
}

async function handleRemove(interaction, client, guildId) {
    try {
        const rule = interaction.options.getString('rule');
        const currentConfig = await getGuildConfig(client, guildId);

        const automodConfig = currentConfig.automod || {
            enabled: false,
            defaultAction: 'warn',
            rules: {}
        };

        if (!automodConfig.rules || !automodConfig.rules[rule]) {
            throw new TitanBotError(
                'Rule not found',
                ErrorTypes.VALIDATION,
                `The **${rule}** rule is not active.`
            );
        }

        delete automodConfig.rules[rule];

        await updateGuildConfig(client, guildId, {
            automod: automodConfig
        });

        const ruleNames = {
            'spam': 'Spam Detection',
            'profanity': 'Profanity Filter',
            'invites': 'Invite Links',
            'caps': 'Excessive Caps',
            'mentions': 'Excessive Mentions',
            'links': 'Suspicious Links',
            'newlines': 'Excessive Newlines'
        };

        const embed = successEmbed()
            .setTitle('Rule Removed')
            .setDescription(`🗑️ **${ruleNames[rule]}** rule has been removed.`);

        await interaction.editReply({ embeds: [embed] });

        logger.info(`[AUTOMOD] Rule removed for guild ${guildId}`, {
            guildId,
            rule,
            userId: interaction.user.id
        });
    } catch (error) {
        throw error;
    }
}

async function handleList(interaction, client, guildId) {
    try {
        const currentConfig = await getGuildConfig(client, guildId);
        const automodConfig = currentConfig.automod || {
            enabled: false,
            defaultAction: 'warn',
            rules: {}
        };

        const ruleNames = {
            'spam': '🚨 Spam Detection',
            'profanity': '🤬 Profanity Filter',
            'invites': '🔗 Invite Links',
            'caps': '📢 Excessive Caps',
            'mentions': '@️ Excessive Mentions',
            'links': '🌐 Suspicious Links',
            'newlines': '↵ Excessive Newlines'
        };

        const rules = automodConfig.rules || {};

        if (Object.keys(rules).length === 0) {
            const embed = infoEmbed()
                .setTitle('Active Rules')
                .setDescription('No rules are currently active.\n\nUse `/automod add` to add rules.');

            await interaction.editReply({ embeds: [embed] });
            return;
        }

        const embed = infoEmbed()
            .setTitle('Active AutoMod Rules')
            .setDescription(`Total: **${Object.keys(rules).length}** active rules`);

        for (const [ruleKey, ruleData] of Object.entries(rules)) {
            if (ruleData.enabled) {
                const actionText = ruleData.action.charAt(0).toUpperCase() + ruleData.action.slice(1);
                const duration = ruleData.duration ? ` (${ruleData.duration})` : '';
                embed.addFields({
                    name: ruleNames[ruleKey],
                    value: `**Action:** ${actionText}${duration}`,
                    inline: false
                });
            }
        }

        await interaction.editReply({ embeds: [embed] });

        logger.info(`[AUTOMOD] Rules listed for guild ${guildId}`, {
            guildId,
            userId: interaction.user.id
        });
    } catch (error) {
        throw error;
    }
}

async function handleSettings(interaction, client, guildId) {
    try {
        const currentConfig = await getGuildConfig(client, guildId);
        const automodConfig = currentConfig.automod || {
            enabled: false,
            defaultAction: 'warn',
            rules: {}
        };

        const embed = infoEmbed()
            .setTitle('AutoMod Settings')
            .addFields(
                {
                    name: 'Status',
                    value: automodConfig.enabled ? '🟢 **Enabled**' : '🔴 **Disabled**',
                    inline: true
                },
                {
                    name: 'Default Action',
                    value: automodConfig.defaultAction?.charAt(0).toUpperCase() + automodConfig.defaultAction?.slice(1),
                    inline: true
                },
                {
                    name: 'Active Rules',
                    value: Object.keys(automodConfig.rules || {}).length.toString(),
                    inline: true
                }
            );

        embed.setDescription(
            automodConfig.enabled
                ? '✅ AutoMod is actively monitoring your server.'
                : '❌ AutoMod is currently disabled. Use `/automod toggle enabled:true` to enable it.'
        );

        await interaction.editReply({ embeds: [embed] });

        logger.info(`[AUTOMOD] Settings viewed for guild ${guildId}`, {
            guildId,
            userId: interaction.user.id
        });
    } catch (error) {
        throw error;
    }
}

async function handleWhitelist(interaction, client, guildId, subcommand) {
    const currentConfig = await getGuildConfig(client, guildId);
    const automodConfig = currentConfig.automod || { enabled: false, defaultAction: 'warn', rules: {} };
    const whitelist = automodConfig.whitelist || { users: [], roles: [], channels: [] };

    if (subcommand === 'add' || subcommand === 'remove') {
        const user    = interaction.options.getUser('user');
        const role    = interaction.options.getRole('role');
        const channel = interaction.options.getChannel('channel');

        if (!user && !role && !channel) {
            throw new TitanBotError('No target', ErrorTypes.VALIDATION, 'Provide at least one user, role, or channel.');
        }

        const added = [], removed = [], alreadyIn = [], notIn = [];

        const toggle = (list, id, label) => {
            if (subcommand === 'add') {
                if (list.includes(id)) { alreadyIn.push(label); }
                else { list.push(id); added.push(label); }
            } else {
                const idx = list.indexOf(id);
                if (idx === -1) { notIn.push(label); }
                else { list.splice(idx, 1); removed.push(label); }
            }
        };

        if (user)    toggle(whitelist.users,    user.id,    `<@${user.id}>`);
        if (role)    toggle(whitelist.roles,    role.id,    `<@&${role.id}>`);
        if (channel) toggle(whitelist.channels, channel.id, `<#${channel.id}>`);

        automodConfig.whitelist = whitelist;
        await updateGuildConfig(client, guildId, { automod: automodConfig });

        const lines = [];
        if (added.length)    lines.push(`✅ Added: ${added.join(', ')}`);
        if (removed.length)  lines.push(`🗑️ Removed: ${removed.join(', ')}`);
        if (alreadyIn.length) lines.push(`ℹ️ Already whitelisted: ${alreadyIn.join(', ')}`);
        if (notIn.length)    lines.push(`ℹ️ Not in whitelist: ${notIn.join(', ')}`);

        const embed = successEmbed()
            .setTitle('Automod Whitelist Updated')
            .setDescription(lines.join('\n'));
        return interaction.editReply({ embeds: [embed] });
    }

    if (subcommand === 'list') {
        const users    = (whitelist.users    || []).map(id => `<@${id}>`);
        const roles    = (whitelist.roles    || []).map(id => `<@&${id}>`);
        const channels = (whitelist.channels || []).map(id => `<#${id}>`);

        const embed = infoEmbed()
            .setTitle('Automod Whitelist')
            .addFields(
                { name: '👤 Users',    value: users.length    ? users.join(', ')    : 'None', inline: false },
                { name: '🏷️ Roles',    value: roles.length    ? roles.join(', ')    : 'None', inline: false },
                { name: '📢 Channels', value: channels.length ? channels.join(', ') : 'None', inline: false }
            );
        return interaction.editReply({ embeds: [embed] });
    }
}

async function handleAction(interaction, client, guildId) {
    try {
        const action = interaction.options.getString('action');
        const duration = interaction.options.getString('duration') || null;

        const currentConfig = await getGuildConfig(client, guildId);

        const automodConfig = currentConfig.automod || {
            enabled: false,
            defaultAction: 'warn',
            rules: {}
        };

        automodConfig.defaultAction = action;
        automodConfig.defaultDuration = action === 'mute' ? duration : null;

        await updateGuildConfig(client, guildId, {
            automod: automodConfig
        });

        const embed = successEmbed()
            .setTitle('Default Action Updated')
            .setDescription(`Default action set to: **${action.charAt(0).toUpperCase() + action.slice(1)}**`)
            .addFields(
                { name: 'Duration', value: duration || 'N/A', inline: true },
                { name: 'Status', value: automodConfig.enabled ? '🟢 Enabled' : '🔴 Disabled', inline: true }
            );

        await interaction.editReply({ embeds: [embed] });

        logger.info(`[AUTOMOD] Default action updated for guild ${guildId}`, {
            guildId,
            action,
            userId: interaction.user.id
        });
    } catch (error) {
        throw error;
    }
}
