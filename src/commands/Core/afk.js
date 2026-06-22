import { SlashCommandBuilder } from 'discord.js';
import { successEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { handleInteractionError } from '../../utils/errorHandler.js';
import { AfkService } from '../../services/afkService.js';

export default {
    data: new SlashCommandBuilder()
        .setName('afk')
        .setDescription('Set your AFK status so others know you are away')
        .addStringOption(o =>
            o.setName('reason')
                .setDescription('Reason for going AFK')
                .setRequired(false)
                .setMaxLength(200)
        ),
    category: 'core',

    async execute(interaction, config, client) {
        const deferSuccess = await InteractionHelper.safeDefer(interaction);
        if (!deferSuccess) {
            logger.warn('[AFK] Defer failed', { userId: interaction.user.id, guildId: interaction.guildId });
            return;
        }

        try {
            const reason = interaction.options.getString('reason') || 'AFK';
            const result = await AfkService.setAfk(client, interaction.guildId, interaction.user.id, reason);

            if (!result.success) {
                throw new Error('Failed to save AFK status.');
            }

            await InteractionHelper.safeEditReply(interaction, {
                embeds: [
                    successEmbed(
                        `Your status has been set to **${reason}**.\nIf someone pings you, I'll let them know you're away.`,
                        '😴 You are now AFK'
                    )
                ]
            });
        } catch (error) {
            logger.error('[AFK] Command error:', error);
            await handleInteractionError(interaction, error, { subtype: 'afk_failed' });
        }
    }
};
