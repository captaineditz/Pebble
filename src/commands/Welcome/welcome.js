import { SlashCommandBuilder, PermissionFlagsBits, ChannelType, EmbedBuilder, MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { errorEmbed, successEmbed, infoEmbed } from '../../utils/embeds.js';
import { getWelcomeConfig, updateWelcomeConfig } from '../../utils/database.js';
import { formatWelcomeMessage } from '../../utils/welcome.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { getColor } from '../../config/bot.js';

export default {
    data: new SlashCommandBuilder()
        .setName('welcome')
        .setDescription('Configure the welcome system')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addSubcommand(subcommand =>
            subcommand
                .setName('setup')
                .setDescription('Set up the welcome message')
                .addChannelOption(option =>
                    option.setName('channel')
                        .setDescription('Channel to send welcome messages')
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('message')
                        .setDescription('Welcome message. Use {user}, {username}, {server}, {memberCount}')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('image')
                        .setDescription('Image URL for welcome message')
                        .setRequired(false))
                .addBooleanOption(option =>
                    option.setName('ping')
                        .setDescription('Ping the user in welcome message')
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('dashboard')
                .setDescription('View welcome settings'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('edit')
                .setDescription('Edit welcome settings')
                .addStringOption(option =>
                    option.setName('setting')
                        .setDescription('What to edit')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Channel', value: 'channel' },
                            { name: 'Message', value: 'message' },
                            { name: 'Image', value: 'image' },
                            { name: 'Ping', value: 'ping' },
                            { name: 'Enabled', value: 'enabled' }
                        ))
                .addStringOption(option =>
                    option.setName('value')
                        .setDescription('New value')
                        .setRequired(false))
                .addChannelOption(option =>
                    option.setName('channel')
                        .setDescription('New channel')
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(false))
                .addBooleanOption(option =>
                    option.setName('enabled')
                        .setDescription('Enable/disable')
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('preview')
                .setDescription('Preview welcome message'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('reset')
                .setDescription('Reset welcome settings')),

    async execute(interaction) {
        try {
            const deferSuccess = await InteractionHelper.safeDefer(interaction);
            if (!deferSuccess) return;

            const { options, guild, client } = interaction;

            if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
                return await InteractionHelper.safeEditReply(interaction, {
                    embeds: [errorEmbed('Missing Permissions', 'You need **Manage Server** permission')],
                    flags: MessageFlags.Ephemeral
                });
            }

            const subcommand = options.getSubcommand();

            switch (subcommand) {
                case 'setup':
                    return await handleSetup(interaction, client, guild);
                case 'dashboard':
                    return await handleDashboard(interaction, client, guild);
                case 'edit':
                    return await handleEdit(interaction, client, guild);
                case 'preview':
                    return await handlePreview(interaction, client, guild);
                case 'reset':
                    return await handleReset(interaction, client, guild);
            }
        } catch (error) {
            logger.error(`[Welcome] Error:`, error);
            await InteractionHelper.safeEditReply(interaction, {
                embeds: [errorEmbed('Error', 'Something went wrong')],
                flags: MessageFlags.Ephemeral
            });
        }
    }
};

async function handleSetup(interaction, client, guild) {
    const channel = interaction.options.getChannel('channel');
    const message = interaction.options.getString('message');
    const image = interaction.options.getString('image');
    const ping = interaction.options.getBoolean('ping') ?? false;

    const existing = await getWelcomeConfig(client, guild.id);
    if (existing?.channelId) {
        return await InteractionHelper.safeEditReply(interaction, {
            embeds: [errorEmbed('Already Configured', `Welcome already set to <#${existing.channelId}>. Use /welcome edit to change`)],
            flags: MessageFlags.Ephemeral
        });
    }

    if (!message?.trim()) {
        return await InteractionHelper.safeEditReply(interaction, {
            embeds: [errorEmbed('Invalid Message', 'Message cannot be empty')],
            flags: MessageFlags.Ephemeral
        });
    }

    if (image) {
        try {
            new URL(image);
        } catch {
            return await InteractionHelper.safeEditReply(interaction, {
                embeds: [errorEmbed('Invalid URL', 'Image URL must be valid')],
                flags: MessageFlags.Ephemeral
            });
        }
    }

    await updateWelcomeConfig(client, guild.id, {
        enabled: true,
        channelId: channel.id,
        welcomeMessage: message,
        welcomeImage: image,
        welcomePing: ping
    });

    const preview = formatWelcomeMessage(message, { user: interaction.user, guild });
    const embed = new EmbedBuilder()
        .setColor(getColor('success'))
        .setTitle('✅ Welcome Configured')
        .setDescription(`Channel: ${channel}\nMessage: ${preview}`)
        .setFooter({ text: 'Use /welcome edit to modify' });

    if (image) embed.setImage(image);

    await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
    logger.info(`[Welcome] Setup by ${interaction.user.tag} in ${guild.id}`);
}

async function handleDashboard(interaction, client, guild) {
    const config = await getWelcomeConfig(client, guild.id);

    const embed = infoEmbed()
        .setTitle('Welcome Dashboard')
        .addFields(
            { name: '📍 Channel', value: config?.channelId ? `<#${config.channelId}>` : '❌ Not set', inline: true },
            { name: '✅ Status', value: config?.enabled ? '🟢 Enabled' : '🔴 Disabled', inline: true },
            { name: '💬 Message', value: `\`${config?.welcomeMessage || 'Not set'}\`` },
            { name: '🖼️ Image', value: config?.welcomeImage ? '✅ Set' : '❌ Not set', inline: true },
            { name: 'Ping', value: config?.welcomePing ? '✅ Yes' : '❌ No', inline: true }
        );

    const buttons = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder().setCustomId('welcome_edit').setLabel('Edit').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('welcome_preview').setLabel('Preview').setStyle(ButtonStyle.Secondary)
        );

    await InteractionHelper.safeEditReply(interaction, { embeds: [embed], components: [buttons] });
}

async function handleEdit(interaction, client, guild) {
    const setting = interaction.options.getString('setting');
    const value = interaction.options.getString('value');
    const channel = interaction.options.getChannel('channel');
    const enabled = interaction.options.getBoolean('enabled');

    const config = await getWelcomeConfig(client, guild.id) || {};

    if (setting === 'channel' && channel) {
        config.channelId = channel.id;
        await updateWelcomeConfig(client, guild.id, config);
        return await InteractionHelper.safeEditReply(interaction, {
            embeds: [successEmbed().setTitle('Channel Updated').setDescription(`Set to ${channel}`)]
        });
    }

    if (setting === 'message' && value) {
        config.welcomeMessage = value;
        await updateWelcomeConfig(client, guild.id, config);
        return await InteractionHelper.safeEditReply(interaction, {
            embeds: [successEmbed().setTitle('Message Updated').setDescription(`\`${value}\``)]
        });
    }

    if (setting === 'image' && value) {
        try {
            new URL(value);
            config.welcomeImage = value;
            await updateWelcomeConfig(client, guild.id, config);
            return await InteractionHelper.safeEditReply(interaction, {
                embeds: [successEmbed().setTitle('Image Updated').setImage(value)]
            });
        } catch {
            return await InteractionHelper.safeEditReply(interaction, {
                embeds: [errorEmbed('Invalid URL', 'Must be valid image URL')],
                flags: MessageFlags.Ephemeral
            });
        }
    }

    if (setting === 'ping' && enabled !== null) {
        config.welcomePing = enabled;
        await updateWelcomeConfig(client, guild.id, config);
        return await InteractionHelper.safeEditReply(interaction, {
            embeds: [successEmbed().setTitle('Ping Updated').setDescription(enabled ? '✅ Enabled' : '❌ Disabled')]
        });
    }

    if (setting === 'enabled' && enabled !== null) {
        config.enabled = enabled;
        await updateWelcomeConfig(client, guild.id, config);
        return await InteractionHelper.safeEditReply(interaction, {
            embeds: [successEmbed().setTitle(`Welcome ${enabled ? 'Enabled' : 'Disabled'}`)]
        });
    }

    await InteractionHelper.safeEditReply(interaction, {
        embeds: [errorEmbed('Invalid', 'Please provide valid value')],
        flags: MessageFlags.Ephemeral
    });
}

async function handlePreview(interaction, client, guild) {
    const config = await getWelcomeConfig(client, guild.id);

    if (!config?.welcomeMessage) {
        return await InteractionHelper.safeEditReply(interaction, {
            embeds: [errorEmbed('Not Configured', 'No welcome message set')],
            flags: MessageFlags.Ephemeral
        });
    }

    const preview = formatWelcomeMessage(config.welcomeMessage, { user: interaction.user, guild });
    const embed = new EmbedBuilder()
        .setColor(getColor('info'))
        .setTitle('Welcome Preview')
        .setDescription(preview);

    if (config.welcomeImage) embed.setImage(config.welcomeImage);

    await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
}

async function handleReset(interaction, client, guild) {
    await updateWelcomeConfig(client, guild.id, {
        enabled: false,
        channelId: null,
        welcomeMessage: null,
        welcomeImage: null,
        welcomePing: false
    });

    await InteractionHelper.safeEditReply(interaction, {
        embeds: [successEmbed().setTitle('Welcome Reset').setDescription('All settings reset')]
    });
}
