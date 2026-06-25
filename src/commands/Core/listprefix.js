import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataPath = path.join(__dirname, '../../data/prefixes.json');

function loadPrefixes() {
    if (!fs.existsSync(dataPath)) return {};
    return JSON.parse(fs.readFileSync(dataPath, 'utf8'));
}

export default {
    data: new SlashCommandBuilder()
        .setName('listprefix')
        .setDescription('List all prefixes set for this server'),

    async execute(interaction) {
        const data = loadPrefixes();
        const prefixes = data[interaction.guild.id] || [];

        if (prefixes.length === 0) {
            const embed = new EmbedBuilder()
                .setColor(0x5865F2)
                .setTitle('📋 Server Prefixes')
                .setDescription('No custom prefixes set. Default prefix is `^`');
            return interaction.reply({ embeds: [embed] });
        }

        const embed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle('📋 Server Prefixes')
            .setDescription(prefixes.map((p, i) => `**${i + 1}.** \`${p}\``).join('\n'))
            .setFooter({ text: `${prefixes.length}/3 prefixes used` });

        return interaction.reply({ embeds: [embed] });
    }
};
