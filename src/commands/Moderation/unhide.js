import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { errorEmbed, successEmbed } from '../../utils/embeds.js';
import { logEvent } from '../../utils/moderation.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

export default {
    data: new SlashCommandBuilder()
        .setName('unhide')
        .setDescription('Makes the current channel visible to @everyone again.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
    category: 'moderation',

    async execute(interaction, config, client) {
        const deferSuccess = await InteractionHelper.safeDefer(interaction);
        if (!deferSuccess) {
            logger.warn('Unhide interaction defer failed', { userId: interaction.user.id, guildId: interaction.guildId });
            return;
        }

        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
            return await InteractionHelper.safeEditReply(interaction, {
                embeds: [errorEmbed('Permission Denied', 'You need the `Manage Channels` permission to unhide channels.')]
            });
        }

        const channel = interaction.channel;
        const everyoneRole = interaction.guild.roles.everyone;

        try {
            const currentPerms = channel.permissionsFor(everyoneRole);
            if (currentPerms.has(PermissionFlagsBits.ViewChannel) !== false) {
                return await InteractionHelper.safeEditReply(interaction, {
                    embeds: [errorEmbed('Not Hidden', `${channel} is not hidden.`)]
                });
            }

            await channel.permissionOverwrites.edit(
                everyoneRole,
                { ViewChannel: null },
                { type: 0, reason: `Channel unhidden by ${interaction.user.tag}` }
            );

            await logEvent({
                client,
                guild: interaction.guild,
                event: {
                    action: 'Channel Unhidden',
                    target: channel.toString(),
                    executor: `${interaction.user.tag} (${interaction.user.id})`,
                    metadata: { channelId: channel.id, moderatorId: interaction.user.id }
                }
            });

            await InteractionHelper.safeEditReply(interaction, {
                embeds: [successEmbed(
                    `${channel} is now visible to @everyone again.`,
                    '👁️ Channel Unhidden'
                )]
            });
        } catch (error) {
            logger.error('Unhide command error:', error);
            await InteractionHelper.safeEditReply(interaction, {
                embeds: [errorEmbed('An error occurred while unhiding the channel. Check my permissions (I need `Manage Channels`).')]
            });
        }
    }
};
