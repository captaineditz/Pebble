import {
    addNPUser,
    removeNPUser,
    listNPUsers,
    formatExpiry,
} from "../npSystem/npData.js";

const OWNER_ID = "1360488463371341834"; // Your Discord user ID

export default {
    name: "np",
    description: "Manage No-Prefix access (Owner only)",

    async execute(message, args) {
        // ─── Owner gate ───────────────────────────────────────────────
        if (message.author.id !== OWNER_ID) {
            return message.reply({
                embeds: [errorEmbed("❌ This command is restricted to the bot owner.")],
            });
        }

        const sub = args[0]?.toLowerCase();

        // ─── !np add @user [duration] ─────────────────────────────────
        if (sub === "add") {
            const target = message.mentions.users.first();
            if (!target) {
                return message.reply({
                    embeds: [errorEmbed("❌ Please mention a user.\nUsage: `!np add @user [30d|7d|24h]`")],
                });
            }

            const duration = args[2] || null; // Optional: 30d, 7h, etc.
            const result = await addNPUser(target.id, target.username, duration);

            if (!result.success) {
                return message.reply({ embeds: [errorEmbed(`❌ ${result.reason}`)] });
            }

            return message.reply({
                embeds: [
                    successEmbed(
                        "✅ NP Access Granted",
                        `**User:** ${target.tag}\n**ID:** \`${target.id}\`\n**Expires:** ${formatExpiry(result.expiresAt)}`
                    ),
                ],
            });
        }

        // ─── !np remove @user ─────────────────────────────────────────
        if (sub === "remove") {
            const target = message.mentions.users.first();
            if (!target) {
                return message.reply({
                    embeds: [errorEmbed("❌ Please mention a user.\nUsage: `!np remove @user`")],
                });
            }

            const removed = await removeNPUser(target.id);
            if (!removed) {
                return message.reply({
                    embeds: [errorEmbed(`❌ **${target.tag}** does not have NP access.`)],
                });
            }

            return message.reply({
                embeds: [
                    successEmbed(
                        "🗑️ NP Access Revoked",
                        `**${target.tag}** no longer has No-Prefix access.`
                    ),
                ],
            });
        }

        // ─── !np list ─────────────────────────────────────────────────
        if (sub === "list") {
            const users = await listNPUsers();
            const entries = Object.entries(users);

            if (entries.length === 0) {
                return message.reply({
                    embeds: [infoEmbed("📋 NP Users", "No users currently have NP access.")],
                });
            }

            const lines = entries.map(([id, info], i) => {
                const expiry = formatExpiry(info.expiresAt);
                return `\`${i + 1}.\` **${info.username}** (\`${id}\`)\n> Expires: **${expiry}**`;
            });

            return message.reply({
                embeds: [
                    infoEmbed(
                        `📋 NP Users — ${entries.length} total`,
                        lines.join("\n\n")
                    ),
                ],
            });
        }

        // ─── !np expiry @user <duration> ─────────────────────────────
        if (sub === "expiry") {
            const target = message.mentions.users.first();
            const duration = args[2];

            if (!target || !duration) {
                return message.reply({
                    embeds: [
                        errorEmbed(
                            "❌ Usage: `!np expiry @user <duration>`\nExample: `!np expiry @user 30d`"
                        ),
                    ],
                });
            }

            // Re-add with new duration (preserves username, resets timer)
            const result = await addNPUser(target.id, target.username, duration);
            if (!result.success) {
                return message.reply({ embeds: [errorEmbed(`❌ ${result.reason}`)] });
            }

            return message.reply({
                embeds: [
                    successEmbed(
                        "⏱️ Expiry Updated",
                        `**User:** ${target.tag}\n**New Expiry:** ${formatExpiry(result.expiresAt)}`
                    ),
                ],
            });
        }

        // ─── Help fallback ────────────────────────────────────────────
        return message.reply({
            embeds: [
                infoEmbed(
                    "🔧 NP Command — Usage",
                    [
                        "`!np add @user` — Grant permanent NP access",
                        "`!np add @user 30d` — Grant timed access (30d/7h/60m)",
                        "`!np remove @user` — Revoke NP access",
                        "`!np list` — View all NP users",
                        "`!np expiry @user 30d` — Update expiry for a user",
                    ].join("\n")
                ),
            ],
        });
    },
};

// ─── Embed helpers ────────────────────────────────────────────────────────────

function successEmbed(title, description) {
    return {
        title,
        description,
        color: 0x2ecc71,
        timestamp: new Date().toISOString(),
    };
}

function errorEmbed(description) {
    return {
        description,
        color: 0xe74c3c,
        timestamp: new Date().toISOString(),
    };
}

function infoEmbed(title, description) {
    return {
        title,
        description,
        color: 0x3498db,
        timestamp: new Date().toISOString(),
    };
}
