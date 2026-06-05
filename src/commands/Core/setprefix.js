import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataPath = path.join(__dirname, '../../data/prefixes.json');

function loadPrefixes() {
  if (!fs.existsSync(dataPath)) return {};
  return JSON.parse(fs.readFileSync(dataPath, 'utf8'));
}

function savePrefixes(data) {
  fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
}

export default {
  data: new SlashCommandBuilder()
    .setName('setprefix')
    .setDescription('Set your first prefix (replaces all existing prefixes)')
    .addStringOption(option =>
      option.setName('prefix')
        .setDescription('The prefix to set (e.g. ! or pb!)')
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    const prefix = interaction.options.getString('prefix');

    if (prefix.length > 5) {
      return interaction.reply({ content: '❌ Prefix must be 5 characters or fewer.', ephemeral: true });
    }

    const data = loadPrefixes();
    data[interaction.guild.id] = [prefix];
    savePrefixes(data);

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('✅ Prefix Set')
      .setDescription(`Server prefix has been set to \`${prefix}\``)
      .setFooter({ text: `You can add up to 2 more prefixes with /addprefix` });

    return interaction.reply({ embeds: [embed] });
  }
};
