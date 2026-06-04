const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, '../../data/prefixes.json');

function loadPrefixes() {
  if (!fs.existsSync(dataPath)) return {};
  return JSON.parse(fs.readFileSync(dataPath, 'utf8'));
}

function savePrefixes(data) {
  fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('removeprefix')
    .setDescription('Remove a prefix from the server')
    .addStringOption(option =>
      option.setName('prefix')
        .setDescription('The prefix to remove')
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    const prefix = interaction.options.getString('prefix');
    const data = loadPrefixes();
    const guildPrefixes = data[interaction.guild.id] || [];

    if (!guildPrefixes.includes(prefix)) {
      return interaction.reply({ content: `❌ \`${prefix}\` is not a registered prefix for this server.`, ephemeral: true });
    }

    const updated = guildPrefixes.filter(p => p !== prefix);
    data[interaction.guild.id] = updated;
    savePrefixes(data);

    const embed = new EmbedBuilder()
      .setColor(0xED4245)
      .setTitle('🗑️ Prefix Removed')
      .setDescription(`\`${prefix}\` has been removed.`)
      .addFields({
        name: 'Remaining Prefixes',
        value: updated.length > 0 ? updated.map(p => `\`${p}\``).join('  ') : 'None'
      });

    return interaction.reply({ embeds: [embed] });
  }
};
