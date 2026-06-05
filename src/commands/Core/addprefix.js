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
    .setName('addprefix')
    .setDescription('Add an additional prefix (max 3 total)')
    .addStringOption(option =>
      option.setName('prefix')
        .setDescription('The prefix to add')
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    const prefix = interaction.options.getString('prefix');

    if (prefix.length > 5) {
      return interaction.reply({ content: '❌ Prefix must be 5 characters or fewer.', ephemeral: true });
    }

    const data = loadPrefixes();
    const guildPrefixes = data[interaction.guild.id] || [];

    if (guildPrefixes.length >= 3) {
      return interaction.reply({
        content: '❌ You already have 3 prefixes. Remove one with `/removeprefix` before adding a new one.',
        ephemeral: true
      });
    }

    if (guildPrefixes.includes(prefix)) {
      return interaction.reply({ content: `❌ \`${prefix}\` is already a prefix for this server.`, ephemeral: true });
    }

    guildPrefixes.push(prefix);
    data[interaction.guild.id] = guildPrefixes;
    savePrefixes(data);

    const embed = new EmbedBuilder()
      .setColor(0x57F287)
      .setTitle('✅ Prefix Added')
      .setDescription(`\`${prefix}\` has been added as a prefix.`)
      .addFields({ name: 'All Prefixes', value: guildPrefixes.map(p => `\`${p}\``).join('  ') });

    return interaction.reply({ embeds: [embed] });
  }
};
