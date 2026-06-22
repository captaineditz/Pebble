import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags, EmbedBuilder } from 'discord.js';
import { createEmbed, errorEmbed, successEmbed, infoEmbed, warningEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { TitanBotError, ErrorTypes, handleInteractionError } from '../../utils/errorHandler.js';
import { getGuildConfig, updateGuildConfig } from '../../services/guildConfig.js';
import { getColor } from '../../config/bot.js';

export default {
    data: new SlashCommandBuilder()
        .setName('antinuke')
        .setDescription('Configure antinuke settings to protect against server raids')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .setDMPermission(false)
        .addSubcommand(subcommand =>
            subcommand
                .setName('toggle')
                .setDescription('Enable or disable antinuke protection')
                .addBooleanOption(option =>
                    option
                        .setName('enabled')
                        .setDescription('Enable or disable antinuke')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('action')
                .setDescription('Set the action taken when suspicious activity is detected')
                .addStringOption(option =>
                    option
                        .setName('action')
                        .setDescription('What to do when nuke attempt is detected')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Remove Permissions', value: 'remove-perms' },
                            { name: 'Kick User', value: 'kick' },
                            { name: 'Ban User', value: 'ban' },
                            { name: 'Kick + Remove Perms', value: 'kick-remove-perms' }
                        )
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('threshold')
                .setDescription('Set thresholds for detecting nuke attempts')
                .addStringOption(option =>
                    option
                        .setName('type')
                        .setDescription('Type of threshold to set')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Channel Deletes', value: 'channels' },
                            { name: 'Role Deletes', value: 'roles' },
                            { name: 'Bans', value: 'bans' },
                            { name: 'Kicks', value: 'kicks' }
                        )
                )
                .addIntegerOption(option =>
                    option
                        .setName('amount')
                        .setDescription('Number of actions before triggering (1-50)')
                        .setRequired(true)
                        .setMinValue(1)
                        .setMaxValue(50)
                )
                .addIntegerOption(option =>
                    option
                        .setName('seconds')
                        .setDescription('Time window in seconds (5-600)')
                        .setRequired(true)
                        .setMinValue(5)
                        .setMaxValue(600)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('whitelist')
                .setDescription('Manage whitelisted users who can perform bulk actions')
                .addStringOption(option =>
                    option
                        .setName('action')
                        .setDescription('Add or remove a whitelisted user')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Add', value: 'add' },
                            { name: 'Remove', value: 'remove' },
                            { name: 'List', value: 'list' }
                        )
                )
                .addUserOption(option =>
                    option
                        .setName('user')
                        .setDescription('The user to whitelist (required for add/remove)')
                        .setRequired(false)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('settings')
                .setDescription('View current antinuke settings')
        ),

    category: 'Moderation',

    async execute(interaction, guildConfig, client) {
        try {
            const deferred = await InteractionHelper.safeDefer(interaction);
            if (!deferred) return;

            const subcommand = interaction.options.getSubcommand();
            const guildId = interaction.guildId;

            switch (subcommand) {
                case 'toggle':
                    return await handleToggle(interaction, client, guildId);
                case 'action':
                    return await handleAction(interaction, client, guildId);
                case 'threshold':
                    return await handleThreshold(interaction, client, guildId);
                case 'whitelist':
                    return await handleWhitelist(interaction, client, guildId);
                case 'settings':
                    return await handleSettings(interaction, client, guildId);
                default:
                    throw new TitanBotError(
                        'Unknown subcommand',
                        ErrorTypes.VALIDATION,
                        'Unknown antinuke subcommand.'
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

        const antinukeConfig = currentConfig.antinuke || {
            enabled: false,
            action: 'remove-perms',
            whitelist: [],
            thresholds: {
                channels: { amount: 5, seconds: 60 },
                roles: { amount: 5, seconds: 60 },
                bans: { amount: 10, seconds: 60 },
                kicks: { amount: 10, seconds: 60 }
            }
        };

        antinukeConfig.enabled = enabled;

        await updateGuildConfig(client, guildId, {
            antinuke: antinukeConfig
        });

        const embed = successEmbed()
            .setTitle('Antinuke ' + (enabled ? 'Enabled' : 'Disabled'))
            .setDescription(
                enabled
                    ? '✅ Antinuke is now **enabled**. I will monitor for raid/nuke attempts.'
                    : '❌ Antinuke is now **disabled**. I will no longer monitor for nuke attempts.'
            )
            .addFields(
                { name: 'Current Action', value: antinukeConfig.action || 'remove-perms', inline: true },
                { name: 'Whitelisted Users', value: antinukeConfig.whitelist?.length || '0', inline: true }
            );

        await interaction.editReply({ embeds: [embed] });

        logger.info(`[ANTINUKE] Feature toggled for guild ${guildId}`, {
            guildId,
            enabled,
            userId: interaction.user.id
        });
    } catch (error) {
        throw error;
    }
}

async function handleAction(interaction, client, guildId) {
    try {
        const action = interaction.options.getString('action');
        const currentConfig = await getGuildConfig(client, guildId);

        const antinukeConfig = currentConfig.antinuke || {
            enabled: false,
            action: 'remove-perms',
            whitelist: [],
            thresholds: {
                channels: { amount: 5, seconds: 60 },
                roles: { amount: 5, seconds: 60 },
                bans: { amount: 10, seconds: 60 },
                kicks: { amount: 10, seconds: 60 }
            }
        };

        antinukeConfig.action = action;

        await updateGuildConfig(client, guildId, {
            antinuke: antinukeConfig
        });

        const actionDescriptions = {
            'remove-perms': '🔒 Remove admin/mod permissions',
            'kick': '👢 Kick the user',
            'ban': '🔨 Ban the user',
            'kick-remove-perms': '👢 Kick the user and remove permissions'
        };

        const embed = successEmbed()
            .setTitle('Antinuke Action Updated')
            .setDescription(`Action set to: **${actionDescriptions[action]}**`)
            .addFields(
                { name: 'Status', value: antinukeConfig.enabled ? '🟢 Enabled' : '🔴 Disabled', inline: true }
            );

        await interaction.editReply({ embeds: [embed] });

        logger.info(`[ANTINUKE] Action updated for guild ${guildId}`, {
            guildId,
            action,
            userId: interaction.user.id
        });
    } catch (error) {
        throw error;
    }
}

async function handleThreshold(interaction, client, guildId) {
    try {
        const type = interaction.options.getString('type');
        const amount = interaction.options.getInteger('amount');
        const seconds = interaction.options.getInteger('seconds');

        const currentConfig = await getGuildConfig(client, guildId);

        let antinukeConfig = currentConfig.antinuke || {
            enabled: false,
            action: 'remove-perms',
            whitelist: [],
            thresholds: {
                channels: { amount: 5, seconds: 60 },
                roles: { amount: 5, seconds: 60 },
                bans: { amount: 10, seconds: 60 },
                kicks: { amount: 10, seconds: 60 }
            }
        };

        if (!antinukeConfig.thresholds) {
            antinukeConfig.thresholds = {
                channels: { amount: 5, seconds: 60 },
                roles: { amount: 5, seconds: 60 },
                bans: { amount: 10, seconds: 60 },
                kicks: { amount: 10, seconds: 60 }
            };
        }

        antinukeConfig.thresholds[type] = { amount, seconds };

        await updateGuildConfig(client, guildId, {
            antinuke: antinukeConfig
        });

        const typeDescriptions = {
            'channels': 'Channel Deletions',
            'roles': 'Role Deletions',
            'bans': 'User Bans',
            'kicks': 'User Kicks'
        };

        const embed = successEmbed()
            .setTitle('Threshold Updated')
            .setDescription(`**${typeDescriptions[type]}** threshold updated`)
            .addFields(
                { name: 'Trigger Amount', value: `${amount} actions`, inline: true },
                { name: 'Time Window', value: `${seconds} seconds`, inline: true }
            );

        await interaction.editReply({ embeds: [embed] });

        logger.info(`[ANTINUKE] Threshold updated for guild ${guildId}`, {
            guildId,
            type,
            amount,
            seconds,
            userId: interaction.user.id
        });
    } catch (error) {
        throw error;
    }
}

async function handleWhitelist(interaction, client, guildId) {
    try {
        const action = interaction.options.getString('action');
        const user = interaction.options.getUser('user');

        const currentConfig = await getGuildConfig(client, guildId);

        let antinukeConfig = currentConfig.antinuke || {
            enabled: false,
            action: 'remove-perms',
            whitelist: [],
            thresholds: {
                channels: { amount: 5, seconds: 60 },
                roles: { amount: 5, seconds: 60 },
                bans: { amount: 10, seconds: 60 },
                kicks: { amount: 10, seconds: 60 }
            }
        };

        if (!antinukeConfig.whitelist) {
            antinukeConfig.whitelist = [];
        }

        if (action === 'add') {
            if (!user) {
                throw new TitanBotError(
                    'Missing user parameter',
                    ErrorTypes.VALIDATION,
                    'Please provide a user to whitelist.'
                );
            }

            if (antinukeConfig.whitelist.includes(user.id)) {
                throw new TitanBotError(
                    'User already whitelisted',
                    ErrorTypes.VALIDATION,
                    `**${user.tag}** is already whitelisted.`
                );
            }

            antinukeConfig.whitelist.push(user.id);

            await updateGuildConfig(client, guildId, {
                antinuke: antinukeConfig
            });

            const embed = successEmbed()
                .setTitle('User Whitelisted')
                .setDescription(`✅ **${user.tag}** has been added to the antinuke whitelist.\n\nThey can now perform bulk actions without triggering antinuke.`);

            await interaction.editReply({ embeds: [embed] });

            logger.info(`[ANTINUKE] User whitelisted for guild ${guildId}`, {
                guildId,
                userId: user.id,
                moderatorId: interaction.user.id
            });
        } else if (action === 'remove') {
            if (!user) {
                throw new TitanBotError(
                    'Missing user parameter',
                    ErrorTypes.VALIDATION,
                    'Please provide a user to remove from whitelist.'
                );
            }

            const index = antinukeConfig.whitelist.indexOf(user.id);
            if (index === -1) {
                throw new TitanBotError(
                    'User not whitelisted',
                    ErrorTypes.VALIDATION,
                    `**${user.tag}** is not whitelisted.`
                );
            }

            antinukeConfig.whitelist.splice(index, 1);

            await updateGuildConfig(client, guildId, {
                antinuke: antinukeConfig
            });

            const embed = successEmbed()
                .setTitle('User Removed from Whitelist')
                .setDescription(`❌ **${user.tag}** has been removed from the antinuke whitelist.`);

            await interaction.editReply({ embeds: [embed] });

            logger.info(`[ANTINUKE] User removed from whitelist for guild ${guildId}`, {
                guildId,
                userId: user.id,
                moderatorId: interaction.user.id
            });
        } else if (action === 'list') {
            const whitelist = antinukeConfig.whitelist || [];

            if (whitelist.length === 0) {
                const embed = infoEmbed()
                    .setTitle('Whitelisted Users')
                    .setDescription('No users are currently whitelisted.\n\nUse `/antinuke whitelist action:add` to whitelist users.');

                await interaction.editReply({ embeds: [embed] });
                return;
            }

            const whitelistUsers = await Promise.all(
                whitelist.map(async (userId) => {
                    try {
                        const whitelistUser = await client.users.fetch(userId).catch(() => null);
                        return whitelistUser?.tag || `Unknown User (${userId})`;
                    } catch {
                        return `Unknown User (${userId})`;
                    }
                })
            );

            const chunks = [];
            for (let i = 0; i < whitelistUsers.length; i += 10) {
                chunks.push(whitelistUsers.slice(i, i + 10).join('\n'));
            }

            const embed = infoEmbed()
                .setTitle('Whitelisted Users')
                .setDescription(chunks[0])
                .setFooter({ text: `Total: ${whitelistUsers.length} users` });

            if (chunks.length > 1) {
                embed.addFields(
                    ...chunks.slice(1).map((chunk, i) => ({
                        name: `Users ${i * 10 + 11} - ${Math.min((i + 1) * 10 + 10, whitelistUsers.length)}`,
                        value: chunk
                    }))
                );
            }

            await interaction.editReply({ embeds: [embed] });
        }
    } catch (error) {
        throw error;
    }
}

async function handleSettings(interaction, client, guildId) {
    try {
        const currentConfig = await getGuildConfig(client, guildId);
        const antinukeConfig = currentConfig.antinuke || {
            enabled: false,
            action: 'remove-perms',
            whitelist: [],
            thresholds: {
                channels: { amount: 5, seconds: 60 },
                roles: { amount: 5, seconds: 60 },
                bans: { amount: 10, seconds: 60 },
                kicks: { amount: 10, seconds: 60 }
            }
        };

        const actionDescriptions = {
            'remove-perms': '🔒 Remove admin/mod permissions',
            'kick': '👢 Kick the user',
            'ban': '🔨 Ban the user',
            'kick-remove-perms': '👢 Kick the user and remove permissions'
        };

        const embed = infoEmbed()
            .setTitle('Antinuke Settings')
            .addFields(
                {
                    name: 'Status',
                    value: antinukeConfig.enabled ? '🟢 **Enabled**' : '🔴 **Disabled**',
                    inline: true
                },
                {
                    name: 'Action',
                    value: actionDescriptions[antinukeConfig.action] || 'Not configured',
                    inline: true
                },
                {
                    name: 'Whitelisted Users',
                    value: antinukeConfig.whitelist?.length ? `${antinukeConfig.whitelist.length}` : '0',
                    inline: true
                }
            )
            .addFields(
                {
                    name: 'Channel Delete Threshold',
                    value: `${antinukeConfig.thresholds?.channels?.amount || 5} deletions in ${antinukeConfig.thresholds?.channels?.seconds || 60}s`,
                    inline: true
                },
                {
                    name: 'Role Delete Threshold',
                    value: `${antinukeConfig.thresholds?.roles?.amount || 5} deletions in ${antinukeConfig.thresholds?.roles?.seconds || 60}s`,
                    inline: true
                },
                {
                    name: 'Ban Threshold',
                    value: `${antinukeConfig.thresholds?.bans?.amount || 10} bans in ${antinukeConfig.thresholds?.bans?.seconds || 60}s`,
                    inline: true
                },
                {
                    name: 'Kick Threshold',
                    value: `${antinukeConfig.thresholds?.kicks?.amount || 10} kicks in ${antinukeConfig.thresholds?.kicks?.seconds || 60}s`,
                    inline: true
                }
            );

        embed.setDescription(
            antinukeConfig.enabled
                ? '✅ Antinuke is actively monitoring for suspicious activity.'
                : '❌ Antinuke is currently disabled. Use `/antinuke toggle enabled:true` to enable it.'
        );

        await interaction.editReply({ embeds: [embed] });

        logger.info(`[ANTINUKE] Settings viewed for guild ${guildId}`, {
            guildId,
            userId: interaction.user.id
        });
    } catch (error) {
        throw error;
    }
}
