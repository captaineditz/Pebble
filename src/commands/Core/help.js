import {
    SlashCommandBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
} from "discord.js";
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { createEmbed } from "../../utils/embeds.js";
import { createSelectMenu } from "../../utils/components.js";

const CATEGORY_SELECT_ID = "help-category-select";

export const CATEGORIES = [
    { value: "Moderation",    label: "Moderation",     emoji: "🔨", desc: "Bans, kicks, mutes & warnings" },
    { value: "Leveling",      label: "Leveling",       emoji: "🏆", desc: "XP, ranks & leaderboards" },
    { value: "Ticket",        label: "Tickets",        emoji: "📩", desc: "Multi-panel support system" },
    { value: "Giveaway",      label: "Giveaways",      emoji: "🎁", desc: "Create & manage giveaways" },
    { value: "Welcome",       label: "Welcome",        emoji: "🌐", desc: "Greet messages, cards & goodbye" },
    { value: "Community",     label: "Community",      emoji: "💬", desc: "Polls, apps & engagement" },
    { value: "Config",        label: "Config",         emoji: "🔩", desc: "Bot & server settings" },
    { value: "Counter",       label: "Counter",        emoji: "📡", desc: "Live stat channels" },
    { value: "Voice",         label: "Join to Create", emoji: "🔊", desc: "Dynamic voice channels" },
    { value: "Reaction_roles",label: "Reaction Roles", emoji: "🏷️", desc: "Self-assignable roles" },
    { value: "Verification",  label: "Verification",   emoji: "🔐", desc: "Access gating workflows" },
    { value: "Utility",       label: "Utilities",      emoji: "🛠️", desc: "Server tools & helpers" },
];

export async function createInitialHelpMenu(client) {
    const botName = client?.user?.username || "Pebble";

    const embed = createEmbed({
        title: `🤖 ${botName} Help Center`,
        description: "Your all-in-one Discord companion for moderation, leveling, ticketing, and more.\nSelect a category below to explore commands.",
        color: "primary",
        timestamp: false,
    });

    for (const cat of CATEGORIES) {
        embed.addFields({
            name: `${cat.emoji} ${cat.label}`,
            value: cat.desc,
            inline: true,
        });
    }

    embed.setFooter({
        text: `${CATEGORIES.length} categories  •  Use the menu below to browse commands  •  The best bot`,
    });

    const supportButton = new ButtonBuilder()
        .setLabel("Support Server")
        .setURL("https://discord.gg/xwYzSxzUVa")
        .setStyle(ButtonStyle.Link);

    const inviteButton = new ButtonBuilder()
        .setLabel("Invite Me")
        .setURL("https://discord.com/oauth2/authorize?client_id=1505174828905271436&permissions=8&integration_type=0&scope=bot")
        .setStyle(ButtonStyle.Link);

    const linkRow = new ActionRowBuilder().addComponents(supportButton, inviteButton);

    const selectOptions = CATEGORIES.map(cat => ({
        label: `${cat.emoji} ${cat.label}`,
        description: cat.desc,
        value: cat.value,
    }));

    const selectRow = createSelectMenu(
        CATEGORY_SELECT_ID,
        "Select a category to browse commands",
        selectOptions,
    );

    return {
        embeds: [embed],
        components: [linkRow, selectRow],
    };
}

export default {
    data: new SlashCommandBuilder()
        .setName("help")
        .setDescription("Displays the help menu with all available commands"),

    async execute(interaction, guildConfig, client) {
        await InteractionHelper.safeDefer(interaction);

        const { embeds, components } = await createInitialHelpMenu(client);

        await InteractionHelper.safeEditReply(interaction, {
            embeds,
            components,
        });
    },
};
