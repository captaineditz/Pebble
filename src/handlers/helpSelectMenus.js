import { createEmbed } from '../utils/embeds.js';
import { createButton, getPaginationRow } from '../utils/components.js';
import { CATEGORIES, createInitialHelpMenu } from '../commands/Core/help.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { Collection, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } from 'discord.js';
import { logger } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BACK_BUTTON_ID = "help-back-to-main";
const CATEGORY_SELECT_ID = "help-category-select";
const PAGINATION_PREFIX = "help-page";
const CMDS_PER_PAGE = 6;
const SUBCOMMAND_TYPE = 1;
const SUBCOMMAND_GROUP_TYPE = 2;

function normalizeCommandData(command) {
    const rawData = command?.data;
    if (!rawData) return null;
    const jsonData = typeof rawData.toJSON === 'function' ? rawData.toJSON() : rawData;
    if (!jsonData?.name) return null;
    return {
        ...jsonData,
        options: Array.isArray(jsonData.options)
            ? jsonData.options.map(opt => typeof opt?.toJSON === 'function' ? opt.toJSON() : opt)
            : [],
    };
}

function buildHelpEntries(command, category) {
    const commandData = normalizeCommandData(command);
    if (!commandData?.name) return [];

    const baseName = commandData.name;
    const baseDescription = commandData.description || "No description";
    const options = commandData.options || [];
    const entries = [];

    for (const option of options) {
        if (!option) continue;
        if (option.type === SUBCOMMAND_TYPE) {
            entries.push({ baseName, displayName: `${baseName} ${option.name}`, description: option.description || baseDescription, category });
            continue;
        }
        if (option.type === SUBCOMMAND_GROUP_TYPE) {
            for (const nested of option.options || []) {
                if (nested?.type !== SUBCOMMAND_TYPE) continue;
                entries.push({ baseName, displayName: `${baseName} ${option.name} ${nested.name}`, description: nested.description || option.description || baseDescription, category });
            }
        }
    }

    if (entries.length === 0) {
        entries.push({ baseName, displayName: baseName, description: baseDescription, category });
    }

    return entries;
}

async function fetchRegisteredCommands(client) {
    const registeredCommands = new Collection();
    try {
        if (client?.application?.commands?.fetch) {
            const commands = await client.application.commands.fetch();
            for (const cmd of commands.values()) {
                registeredCommands.set(cmd.name, cmd);
            }
        }
    } catch (error) {
        logger.error('Error fetching registered commands:', error);
    }
    return registeredCommands;
}

export async function createCategoryCommandsMenu(categoryValue, client, page = 1) {
    const catMeta = CATEGORIES.find(c => c.value === categoryValue);
    const label = catMeta?.label || categoryValue;
    const emoji = catMeta?.emoji || "🔍";

    const allCommands = [];

    try {
        const categoryPath = path.join(__dirname, "../commands", categoryValue);
        const commandFiles = (await fs.readdir(categoryPath))
            .filter(file => file.endsWith(".js"))
            .sort();

        for (const file of commandFiles) {
            const filePath = path.join(categoryPath, file);
            const commandModule = await import(`file://${filePath}`);
            const command = commandModule.default;
            const commandData = normalizeCommandData(command);

            if (commandData && commandData.name !== "help") {
                allCommands.push(...buildHelpEntries(command, label));
            }
        }
    } catch (error) {
        logger.error(`Error reading commands from category ${categoryValue}:`, error);
    }

    allCommands.sort((a, b) => a.displayName.localeCompare(b.displayName));

    const registeredCommands = await fetchRegisteredCommands(client);
    const totalPages = Math.max(1, Math.ceil(allCommands.length / CMDS_PER_PAGE));
    const safePage = Math.min(Math.max(1, page), totalPages);
    const slice = allCommands.slice((safePage - 1) * CMDS_PER_PAGE, safePage * CMDS_PER_PAGE);

    const embed = createEmbed({
        title: `${emoji} ${label} Commands`,
        description: allCommands.length > 0
            ? `Showing **${(safePage - 1) * CMDS_PER_PAGE + 1}–${Math.min(safePage * CMDS_PER_PAGE, allCommands.length)}** of **${allCommands.length}** commands`
            : `No commands found in the **${label}** category.`,
        color: "primary",
        timestamp: false,
    });

    for (const cmd of slice) {
        const registeredCmd = registeredCommands.get(cmd.baseName);
        const mention = registeredCmd?.id
            ? `</${cmd.displayName}:${registeredCmd.id}>`
            : `\`/${cmd.displayName}\``;

        embed.addFields({
            name: mention,
            value: cmd.description,
            inline: true,
        });
    }

    // Store category in footer so pagination buttons know which category to re-render
    embed.setFooter({
        text: `Page ${safePage} / ${totalPages}  •  Category: ${categoryValue}  •  The best bot`,
    });

    const components = [];

    // Pagination row (only if more than one page)
    if (totalPages > 1) {
        const paginationRow = getPaginationRow(PAGINATION_PREFIX, safePage, totalPages);
        components.push(paginationRow);
    }

    // Back button row
    const backButton = new ButtonBuilder()
        .setCustomId(BACK_BUTTON_ID)
        .setLabel("Back")
        .setEmoji("⬅️")
        .setStyle(ButtonStyle.Secondary);

    components.push(new ActionRowBuilder().addComponents(backButton));

    return { embeds: [embed], components };
}

export const helpCategorySelectMenu = {
    name: CATEGORY_SELECT_ID,
    async execute(interaction, client) {
        try {
            if (!interaction.deferred && !interaction.replied) {
                await interaction.deferUpdate();
            }

            const selectedCategory = interaction.values[0];
            const { embeds, components } = await createCategoryCommandsMenu(selectedCategory, client, 1);
            await interaction.editReply({ embeds, components });
        } catch (error) {
            if (error?.code === 40060 || error?.code === 10062) {
                logger.warn('Help category select interaction already acknowledged or expired.', {
                    event: 'interaction.help.select.unavailable',
                    errorCode: String(error.code),
                    customId: interaction.customId,
                    interactionId: interaction.id,
                });
                return;
            }

            logger.error('Error in help category select menu handler:', error);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: 'An error occurred while loading the category.',
                    flags: MessageFlags.Ephemeral,
                });
            }
        }
    },
};
