import {
    SlashCommandBuilder,
    EmbedBuilder
} from "discord.js";

const LATENCY_THRESHOLDS = Object.freeze({
    GOOD: 100,
    FAIR: 200,
    POOR: 400
});

const LATENCY_STATUS = Object.freeze({
    GOOD: {
        emoji: "🟢",
        status: "All Systems Operational",
        color: 0x57F287 // Green
    },
    FAIR: {
        emoji: "🟡",
        status: "Minor Latency Detected",
        color: 0xFEE75C // Yellow
    },
    POOR: {
        emoji: "🟠",
        status: "Experiencing High Latency",
        color: 0xFAA61A // Orange
    },
    BAD: {
        emoji: "🔴",
        status: "Service Performance Degraded",
        color: 0xED4245 // Red
    }
});

function getLatencyStatus(ms) {
    if (ms <= LATENCY_THRESHOLDS.GOOD) {
        return LATENCY_STATUS.GOOD;
    }

    if (ms <= LATENCY_THRESHOLDS.FAIR) {
        return LATENCY_STATUS.FAIR;
    }

    if (ms <= LATENCY_THRESHOLDS.POOR) {
        return LATENCY_STATUS.POOR;
    }

    return LATENCY_STATUS.BAD;
}

function formatLatency(ms, info) {
    return `${info.emoji} \`${ms}ms\``;
}

export default {
    data: new SlashCommandBuilder()
        .setName("ping")
        .setDescription("View Pebble's current latency and status."),

    async execute(interaction, guildConfig, client) {
        try {
            await interaction.deferReply();

            const responseTime = Date.now() - interaction.createdTimestamp;
            const rawPing = client?.ws?.ping ?? interaction.client?.ws?.ping ?? -1;
            const discordConnection = rawPing >= 0 ? Math.round(rawPing) : responseTime;

            const connectionStatus = getLatencyStatus(discordConnection);
            const responseStatus = getLatencyStatus(responseTime);
            const overallStatus = getLatencyStatus(
                Math.max(discordConnection, responseTime)
            );

            const embed = new EmbedBuilder()
                .setColor(overallStatus.color)
                .setTitle("🤖 Pebble Ping")
                .addFields(
                    {
                        name: "📡 Discord Connection",
                        value: formatLatency(discordConnection, connectionStatus),
                        inline: true
                    },
                    {
                        name: "⚡ Response Time",
                        value: formatLatency(responseTime, responseStatus),
                        inline: true
                    },
                    {
                        name: "💚 Status",
                        value: `${overallStatus.emoji} ${overallStatus.status}`,
                        inline: false
                    }
                )
                .setFooter({
                    text: "Pebble • Fast. Reliable. Modern."
                })
                .setTimestamp();

            await interaction.editReply({
                embeds: [embed]
            });

        } catch (error) {
            console.error("[PING COMMAND]", error);

            const ERROR_MESSAGE = {
                content: "❌ An unexpected error occurred while checking Pebble's status."
            };

            if (interaction.deferred || interaction.replied) {
                await interaction.editReply(ERROR_MESSAGE).catch(() => {});
            } else {
                await interaction.reply({
                    ...ERROR_MESSAGE,
                    ephemeral: true
                }).catch(() => {});
            }
        }
    }
};
