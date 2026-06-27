const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Replies with the bot latency.'),

    async execute(interaction) {
        const sent = await interaction.reply({
            content: 'Pinging...',
            fetchReply: true
        });

        const latency = sent.createdTimestamp - interaction.createdTimestamp;

        await interaction.editReply(
            `🏓 Pong!\nBot Latency: ${latency}ms\nAPI Latency: ${Math.round(interaction.client.ws.ping)}ms`
        );
    },
};
