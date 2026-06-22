import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags, EmbedBuilder } from 'discord.js';
import { createEmbed, errorEmbed, successEmbed, infoEmbed, warningEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { TitanBotError, ErrorTypes, handleInteractionError } from '../../utils/errorHandler.js';
import { getGuildConfig, updateGuildConfig } from '../../services/guildConfig.js';
import { getColor } from '../../config/bot.js';

export default {
    data: new SlashCommandBuilder()
        .setName('antilink')
        .setDescription('Configure antilink settings to auto-delete invite/external links')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .setDMPermission(false)
        .addSubcommand(subcommand =>
            subcommand
                .setName('toggle')
                .setDescription('Enable or disable the antilink feature')
                .addBooleanOption(option =>
                    option
                        .setName('enabled')
                        .setDescription('Enable or disable antilink')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('action')
                .setDescription('Set the action when a link is detected')
                .addStringOption(option =>
                    option
                        .setName('action')
                        .setDescription('What to do when links are detected')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Delete Message', value: 'delete' },
                            { name: 'Delete + Warn User', value: 'delete-warn' },
                            { name: 'Delete + Mute (10min)', value: 'delete-mute' },
                            { name: 'Delete + Kick', value: 'delete-kick' }
                        )
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('whitelist')
                .setDescription('Manage whitelisted links')
                .addStringOption(option =>
                    option
                        .setName('action')
                        .setDescription('Add or remove a whitelisted link')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Add', value: 'add' },
                            { name: 'Remove', value: 'remove' },
                            { name: 'List', value: 'list' }
                        )
                )
                .addStringOption(option =>
                    option
                        .setName('link')
                        .setDescription('The link to whitelist (required for add/remove)')
                        .setRequired(false)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('settings')
                .setDescription('View current antilink settings')
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
                case 'whitelist':
                    return await handleWhitelist(interaction, client, guildId);
                case 'settings':
                    return await handleSettings(interaction, client, guildId);
                default:
                    throw new TitanBotError(
                        'Unknown subcommand',
                        ErrorTypes.VALIDATION,
                        'Unknown antilink subcommand.'
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

        const antilinkConfig = currentConfig.antilink || {
            enabled: false,
            action: 'delete',
            whitelist: []
        };

        antilinkConfig.enabled = enabled;

        await updateGuildConfig(client, guildId, {
            antilink: antilinkConfig
        });

        const embed = successEmbed()
            .setTitle('Antilink ' + (enabled ? 'Enabled' : 'Disabled'))
            .setDescription(
                enabled
                    ? '✅ Antilink is now **enabled**. I will delete messages containing invite links and external links.'
                    : '❌ Antilink is now **disabled**. I will no longer monitor for links.'
            )
            .addFields(
                { name: 'Current Action', value: antilinkConfig.action || 'delete', inline: true },
                { name: 'Whitelisted Links', value: antilinkConfig.whitelist?.length || '0', inline: true }
            );

        await interaction.editReply({ embeds: [embed] });

        logger.info(`[ANTILINK] Feature toggled for guild ${guildId}`, {
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

        const antilinkConfig = currentConfig.antilink || {
            enabled: false,
            action: 'delete',
            whitelist: []
        };

        antilinkConfig.action = action;

        await updateGuildConfig(client, guildId, {
            antilink: antilinkConfig
        });

        const actionDescriptions = {
            'delete': '🗑️ Delete the message',
            'delete-warn': '🗑️ Delete the message and warn the user',
            'delete-mute': '🗑️ Delete the message and mute the user for 10 minutes',
            'delete-kick': '🗑️ Delete the message and kick the user'
        };

        const embed = successEmbed()
            .setTitle('Antilink Action Updated')
            .setDescription(`Action set to: **${actionDescriptions[action]}**`)
            .addFields(
                { name: 'Status', value: antilinkConfig.enabled ? '🟢 Enabled' : '🔴 Disabled', inline: true }
            );

        await interaction.editReply({ embeds: [embed] });

        logger.info(`[ANTILINK] Action updated for guild ${guildId}`, {
            guildId,
            action,
            userId: interaction.user.id
        });
    } catch (error) {
        throw error;
    }
}

async function handleWhitelist(interaction, client, guildId) {
    try {
        const action = interaction.options.getString('action');
        const link = interaction.options.getString('link')?.toLowerCase();
        const currentConfig = await getGuildConfig(client, guildId);

        let antilinkConfig = currentConfig.antilink || {
            enabled: false,
            action: 'delete',
            whitelist: []
        };

        if (!antilinkConfig.whitelist) {
            antilinkConfig.whitelist = [];
        }

        if (action === 'add') {
            if (!link) {
                throw new TitanBotError(
                    'Missing link parameter',
                    ErrorTypes.VALIDATION,
                    'Please provide a link to whitelist.'
                );
            }

            if (antilinkConfig.whitelist.includes(link)) {
                throw new TitanBotError(
                    'Link already whitelisted',
                    ErrorTypes.VALIDATION,
                    `The link **${link}** is already whitelisted.`
                );
            }

            if (antilinkConfig.whitelist.length >= 50) {
                throw new TitanBotError(
                    'Whitelist limit reached',
                    ErrorTypes.VALIDATION,
                    'You can only whitelist up to 50 links.'
                );
            }

            antilinkConfig.whitelist.push(link);

            await updateGuildConfig(client, guildId, {
                antilink: antilinkConfig
            });

            const embed = successEmbed()
                .setTitle('Link Whitelisted')
                .setDescription(`✅ The link **${link}** has been added to the whitelist.`);

            await interaction.editReply({ embeds: [embed] });

            logger.info(`[ANTILINK] Link whitelisted for guild ${guildId}`, {
                guildId,
                link,
                userId: interaction.user.id
            });
        } else if (action === 'remove') {
            if (!link) {
                throw new TitanBotError(
                    'Missing link parameter',
                    ErrorTypes.VALIDATION,
                    'Please provide a link to remove from whitelist.'
                );
            }

            const index = antilinkConfig.whitelist.indexOf(link);
            if (index === -1) {
                throw new TitanBotError(
                    'Link not found',
                    ErrorTypes.VALIDATION,
                    `The link **${link}** is not whitelisted.`
                );
            }

            antilinkConfig.whitelist.splice(index, 1);

            await updateGuildConfig(client, guildId, {
                antilink: antilinkConfig
            });

            const embed = successEmbed()
                .setTitle('Link Removed from Whitelist')
                .setDescription(`❌ The link **${link}** has been removed from the whitelist.`);

            await interaction.editReply({ embeds: [embed] });

            logger.info(`[ANTILINK] Link removed from whitelist for guild ${guildId}`, {
                guildId,
                link,
                userId: interaction.user.id
            });
        } else if (action === 'list') {
            const whitelist = antilinkConfig.whitelist || [];

            if (whitelist.length === 0) {
                const embed = infoEmbed()
                    .setTitle('Whitelisted Links')
                    .setDescription('No links are currently whitelisted.\n\nUse `/antilink whitelist action:add` to add links.');

                await interaction.editReply({ embeds: [embed] });
                return;
            }

            const chunks = [];
            for (let i = 0; i < whitelist.length; i += 10) {
                chunks.push(whitelist.slice(i, i + 10).join('\n'));
            }

            const embed = infoEmbed()
                .setTitle('Whitelisted Links')
                .setDescription(chunks[0])
                .setFooter({ text: `Total: ${whitelist.length} links` });

            if (chunks.length > 1) {
                embed.addFields(
                    ...chunks.slice(1).map((chunk, i) => ({
                        name: `Links ${i * 10 + 11} - ${Math.min((i + 1) * 10 + 10, whitelist.length)}`,
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
        const antilinkConfig = currentConfig.antilink || {
            enabled: false,
            action: 'delete',
            whitelist: []
        };

        const actionDescriptions = {
            'delete': '🗑️ Delete the message',
            'delete-warn': '🗑️ Delete the message and warn the user',
            'delete-mute': '🗑️ Delete the message and mute the user for 10 minutes',
            'delete-kick': '🗑️ Delete the message and kick the user'
        };

        const embed = infoEmbed()
            .setTitle('Antilink Settings')
            .addFields(
                {
                    name: 'Status',
                    value: antilinkConfig.enabled ? '🟢 **Enabled**' : '🔴 **Disabled**',
                    inline: true
                },
                {
                    name: 'Action',
                    value: actionDescriptions[antilinkConfig.action] || 'Not configured',
                    inline: true
                },
                {
                    name: 'Whitelisted Links',
                    value: antilinkConfig.whitelist?.length ? `${antilinkConfig.whitelist.length}/50` : '0/50',
                    inline: true
                }
            );

        if (antilinkConfig.whitelist && antilinkConfig.whitelist.length > 0) {
            const linkList = antilinkConfig.whitelist.slice(0, 5).join('\n');
            embed.addFields({
                name: 'Sample Whitelisted Links',
                value: linkList + (antilinkConfig.whitelist.length > 5 ? `\n... and ${antilinkConfig.whitelist.length - 5} more` : '')
            });
        }

        embed.setDescription(
            antilinkConfig.enabled
                ? '✅ Antilink is actively monitoring messages for links.'
                : '❌ Antilink is currently disabled. Use `/antilink toggle enabled:true` to enable it.'
        );

        await interaction.editReply({ embeds: [embed] });

        logger.info(`[ANTILINK] Settings viewed for guild ${guildId}`, {
            guildId,
            userId: interaction.user.id
        });
    } catch (error) {
        throw error;
    }
}
