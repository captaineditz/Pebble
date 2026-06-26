/**
 * np.js
 * Manages no-prefix (NP) access for Pebble Bot.
 * Usage: np give @user [duration] | np remove @user | np list
 * Only the owner can use this command.
 */

import { addNPUser, removeNPUser, listNPUsers, formatExpiry } from "../../npSystem/npData.js";

const OWNER_ID = "1360488463371341834";

export default {
    name: "np",
    data: { name: "np" },

    async execute(interaction, _, client) {
        // Owner only
        if (interaction.user.id !== OWNER_ID) {
            return interaction.reply({
                embeds: [{
                    description: "❌ Only the bot owner can manage NP access.",
                    color: 0xe74c3c,
                }],
                ephemeral: true,
            });
        }

        // Get raw args from original message (NP/prefix invocation)
        const msg = interaction._originalMessage;
        if (!msg) {
            return interaction.reply({
                embeds: [{
                    description: "❌ This command must be used via prefix or NP, not as a slash command.",
                    color: 0xe74c3c,
                }],
            });
        }

        const content = msg.content.trim();
        // Strip prefix or "np" trigger word, get args after "np"
        const parts = content.split(/\s+/);
        // parts[0] = prefix+np or just "np", parts[1] = subcommand, parts[2] = mention, parts[3] = duration
        const sub = parts[1]?.toLowerCase();
        const mention = parts[2]; // e.g. <@123456>
        const duration = parts[3] || null; // e.g. 30d, 7d, 24h

        // ── np list ────────────────────────────────────────────────
        if (sub === "list") {
            const users = await listNPUsers();
            const entries = Object.entries(users);

            if (entries.length === 0) {
                return interaction.reply({
                    embeds: [{
                        title: "📋 NP Users",
                        description: "No users currently have NP access.",
                        color: 0x5865f2,
                    }],
                });
            }

            const lines = entries.map(([id, data]) => {
                const expiry = formatExpiry(data.expiresAt);
                return `• <@${id}> (**${data.username}**) — expires: **${expiry}**`;
            });

            return interaction.reply({
                embeds: [{
                    title: "📋 NP Users",
                    description: lines.join("\n"),
                    color: 0x5865f2,
                    footer: { text: `${entries.length} user(s) with NP access` },
                }],
            });
        }

        // ── np give @user [duration] ───────────────────────────────
        if (sub === "give") {
            if (!mention) {
                return interaction.reply({
                    embeds: [{
                        description: "❌ Usage: `np give @user [duration]`\nDuration examples: `30d`, `7d`, `24h`, `60m` (omit for permanent)",
                        color: 0xe74c3c,
                    }],
                });
            }

            const userId = mention.replace(/[<@!>]/g, "");
            if (!userId || isNaN(userId)) {
                return interaction.reply({
                    embeds: [{
                        description: "❌ Invalid user mention.",
                        color: 0xe74c3c,
                    }],
                });
            }

            // Fetch user from Discord
            let targetUser;
            try {
                targetUser = await client.users.fetch(userId);
            } catch {
                return interaction.reply({
                    embeds: [{
                        description: "❌ Could not find that user.",
                        color: 0xe74c3c,
                    }],
                });
            }

            const result = await addNPUser(userId, targetUser.username, duration);

            if (!result.success) {
                return interaction.reply({
                    embeds: [{
                        description: `❌ ${result.reason}`,
                        color: 0xe74c3c,
                    }],
                });
            }

            const expiry = formatExpiry(result.expiresAt);
            return interaction.reply({
                embeds: [{
                    title: "✅ NP Access Granted",
                    description: `**${targetUser.username}** (<@${userId}>) can now use commands without a prefix.\nExpires: **${expiry}**`,
                    color: 0x57f287,
                }],
            });
        }

        // ── np remove @user ────────────────────────────────────────
        if (sub === "remove") {
            if (!mention) {
                return interaction.reply({
                    embeds: [{
                        description: "❌ Usage: `np remove @user`",
                        color: 0xe74c3c,
                    }],
                });
            }

            const userId = mention.replace(/[<@!>]/g, "");
            if (!userId || isNaN(userId)) {
                return interaction.reply({
                    embeds: [{
                        description: "❌ Invalid user mention.",
                        color: 0xe74c3c,
                    }],
                });
            }

            const removed = await removeNPUser(userId);

            if (!removed) {
                return interaction.reply({
                    embeds: [{
                        description: "❌ That user doesn't have NP access.",
                        color: 0xe74c3c,
                    }],
                });
            }

            return interaction.reply({
                embeds: [{
                    title: "✅ NP Access Removed",
                    description: `<@${userId}> no longer has no-prefix access.`,
                    color: 0x57f287,
                }],
            });
        }

        // ── Unknown subcommand ─────────────────────────────────────
        return interaction.reply({
            embeds: [{
                title: "📖 NP Command Usage",
                description: [
                    "`np give @user [duration]` — Grant NP access (permanent or timed)",
                    "`np remove @user` — Revoke NP access",
                    "`np list` — List all NP users",
                    "",
                    "Duration formats: `30d`, `7d`, `24h`, `60m`",
                ].join("\n"),
                color: 0x5865f2,
            }],
        });
    },
};
