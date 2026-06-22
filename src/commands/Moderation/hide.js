import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { createEmbed, errorEmbed, successEmbed } from '../../utils/embeds.js';
import { logEvent } from '../../utils/moderation.js';
import { logger } from '../../utils/logger.js';
import { getColor } from '../../config/bot.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

export default {
    data: new SlashCommandBuilder()
        .setName('hide')
        .setDescription('Hides the current channel from @everyone.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
    category: 'moderation',

    async execute(interaction, config, client) {
        const deferSuccess = await InteractionHelper.safeDefer(interaction);
        if (!deferSuccess) {
            logger.warn('Hide interaction defer failed', { userId: interaction.user.id, guildId: interaction.guildId });
            return;
        }

        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
            return await InteractionHelper.safeEditReply(interaction, {
                embeds: [errorEmbed('Permission Denied', 'You need the `Manage Channels` permission to hide channels.')]
            });
        }

        const channel = interaction.channel;
        const everyoneRole = interaction.guild.roles.everyone;

        try {
            const currentPerms = channel.permissionsFor(everyoneRole);
            if (currentPerms.has(PermissionFlagsBits.ViewChannel) === false) {
                return await InteractionHelper.safeEditReply(interaction, {
                    embeds: [errorEmbed('Already Hidden', `${channel} is already hidden.`)]
                });
            }

            await channel.permissionOverwrites.edit(
                everyoneRole,
                { ViewChannel: false },
                { type: 0, reason: `Channel hidden by ${interaction.user.tag}` }
            );

            await logEvent({
                client,
                guild: interaction.guild,
                event: {
                    action: 'Channel Hidden',
                    target: channel.toString(),
                    executor: `${interaction.user.tag} (${interaction.user.id})`,
                    metadata: { channelId: channel.id, moderatorId: interaction.user.id }
                }
            });

            await InteractionHelper.safeEditReply(interaction, {
                embeds: [successEmbed(
                    `${channel} is now hidden from @everyone.`,
                    '🙈 Channel Hidden'
                )]
            });
        } catch (error) {
            logger.error('Hide command error:', error);
            await InteractionHelper.safeEditReply(interaction, {
                embeds: [errorEmbed('An error occurred while hiding the channel. Check my permissions (I need `Manage Channels`).')]
            });
        }
    }
};
