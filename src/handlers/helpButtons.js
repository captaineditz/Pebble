import { createInitialHelpMenu } from '../commands/Core/help.js';
import { createCategoryCommandsMenu } from './helpSelectMenus.js';
import { logger } from '../utils/logger.js';

const BACK_BUTTON_ID = "help-back-to-main";
const PAGINATION_PREFIX = "help-page";

export const helpBackButton = {
    name: BACK_BUTTON_ID,
    async execute(interaction, client) {
        try {
            if (!interaction.deferred && !interaction.replied) {
                await interaction.deferUpdate();
            }

            const { embeds, components } = await createInitialHelpMenu(client);
            await interaction.editReply({ embeds, components });
        } catch (error) {
            if (error?.code === 40060 || error?.code === 10062) {
                logger.warn('Help back button interaction already acknowledged or expired.', {
                    event: 'interaction.help.button.unavailable',
                    errorCode: String(error.code),
                    customId: interaction.customId,
                    interactionId: interaction.id,
                });
                return;
            }
            throw error;
        }
    },
};

function getPaginationInfo(components) {
    for (const row of components || []) {
        for (const component of row.components || []) {
            if (component.customId === `${PAGINATION_PREFIX}_page`) {
                const label = component.label || '';
                const match = label.match(/Page\s+(\d+)\s+of\s+(\d+)/i);
                if (match) {
                    return {
                        currentPage: Number(match[1]),
                        totalPages: Number(match[2]),
                    };
                }
            }
        }
    }
    return { currentPage: 1, totalPages: 1 };
}

export const helpPaginationButton = {
    name: `${PAGINATION_PREFIX}_next`,
    async execute(interaction, client) {
        try {
            if (!interaction.deferred && !interaction.replied) {
                await interaction.deferUpdate();
            }

            // Read category from stored embed title so we paginate the right category
            const embedTitle = interaction.message?.embeds?.[0]?.title || '';
            const footerText = interaction.message?.embeds?.[0]?.footer?.text || '';

            // Footer format: "Page X / Y  •  Category: <value>  •  ..."
            const catMatch = footerText.match(/Category:\s*(\S+)/i);
            const categoryValue = catMatch ? catMatch[1] : null;

            const { currentPage, totalPages } = getPaginationInfo(interaction.message?.components);

            let nextPage = currentPage;
            switch (interaction.customId) {
                case `${PAGINATION_PREFIX}_first`: nextPage = 1; break;
                case `${PAGINATION_PREFIX}_prev`:  nextPage = Math.max(1, currentPage - 1); break;
                case `${PAGINATION_PREFIX}_next`:  nextPage = Math.min(totalPages, currentPage + 1); break;
                case `${PAGINATION_PREFIX}_last`:  nextPage = totalPages; break;
                default: nextPage = currentPage; break;
            }

            const { embeds, components } = await createCategoryCommandsMenu(categoryValue, client, nextPage);
            await interaction.editReply({ embeds, components });
        } catch (error) {
            if (error?.code === 40060 || error?.code === 10062) {
                logger.warn('Help pagination interaction already acknowledged or expired.', {
                    event: 'interaction.help.pagination.unavailable',
                    errorCode: String(error.code),
                    customId: interaction.customId,
                    interactionId: interaction.id,
                });
                return;
            }
            throw error;
        }
    },
};
