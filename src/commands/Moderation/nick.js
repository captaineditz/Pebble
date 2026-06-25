import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { successEmbed, errorEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { handleInteractionError } from '../../utils/errorHandler.js';

export default {
    data: new SlashCommandBuilder()
        .setName('nick')
        .setDescription('Change a nickname')
        .addUserOption(o =>
            o.setName('user')
                .setDescription('User to change nickname (requires Manage Nicknames)')
                .setRequired(false)
        )
        .addStringOption(o =>
            o.setName('nickname')
                .setDescription('New nickname (leave empty to reset)')
                .setRequired(false)
                .setMaxLength(32)
        ),
    category: 'moderation',
    async execute(interaction, config, client) {
        const deferSuccess = await InteractionHelper.safeDefer(interaction);
        if (!deferSuccess) {
            logger.warn('[NICK] Defer failed', { userId: interaction.user.id });
            return;
        }

        try {
            const targetUser = interaction.options.getUser('user');
            const nickname = interaction.options.getString('nickname') || null;

            // Changing someone else's nickname
            if (targetUser && targetUser.id !== interaction.user.id) {
                if (!interaction.member.permissions.has(PermissionFlagsBits.ManageNicknames)) {
                    return await InteractionHelper.safeEditReply(interaction, {
                        embeds: [errorEmbed('You need the **Manage Nicknames** permission to change others\' nicknames.')]
                    });
                }

                const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
                if (!targetMember) {
                    return await InteractionHelper.safeEditReply(interaction, {
                        embeds: [errorEmbed('Could not find that user in this server.')]
                    });
                }

                if (!targetMember.manageable) {
                    return await InteractionHelper.safeEditReply(interaction, {
                        embeds: [errorEmbed('I don\'t have permission to change that user\'s nickname (they may have a higher role).')]
                    });
                }

                await targetMember.setNickname(nickname, `Changed by ${interaction.user.tag}`);

                return await InteractionHelper.safeEditReply(interaction, {
                    embeds: [successEmbed(
                        nickname
                            ? `**${targetUser.username}**'s nickname has been set to **${nickname}**.`
                            : `**${targetUser.username}**'s nickname has been reset.`,
                        '✏️ Nickname Updated'
                    )]
                });
            }

            // Changing own nickname
            await interaction.member.setNickname(nickname, 'User changed their own nickname');

            return await InteractionHelper.safeEditReply(interaction, {
                embeds: [successEmbed(
                    nickname
                        ? `Your nickname has been set to **${nickname}**.`
                        : 'Your nickname has been reset.',
                    '✏️ Nickname Updated'
                )]
            });

        } catch (error) {
            logger.error('[NICK] Command error:', error);
            await handleInteractionError(interaction, error, { subtype: 'nick_failed' });
        }
    }
};
