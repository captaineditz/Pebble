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
    .setName('editprefix')
    .setDescription('Replace an existing prefix with a new one')
    .addStringOption(option =>
      option.setName('old')
        .setDescription('The prefix you want to replace')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('new')
        .setDescription('The new prefix to use instead')
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    const oldPrefix = interaction.options.getString('old');
    const newPrefix = interaction.options.getString('new');

    if (newPrefix.length > 5) {
      return interaction.reply({ content: '❌ New prefix must be 5 characters or fewer.', ephemeral: true });
    }

    const data = loadPrefixes();
    const guildPrefixes = data[interaction.guild.id] || [];

    if (!guildPrefixes.includes(oldPrefix)) {
      return interaction.reply({ content: `❌ \`${oldPrefix}\` is not a registered prefix for this server.`, ephemeral: true });
    }

    if (guildPrefixes.includes(newPrefix)) {
      return interaction.reply({ content: `❌ \`${newPrefix}\` is already a prefix for this server.`, ephemeral: true });
    }

    const updated = guildPrefixes.map(p => p === oldPrefix ? newPrefix : p);
    data[interaction.guild.id] = updated;
    savePrefixes(data);

    const embed = new EmbedBuilder()
      .setColor(0xFEE75C)
      .setTitle('✏️ Prefix Updated')
      .setDescription(`\`${oldPrefix}\` → \`${newPrefix}\``)
      .addFields({ name: 'All Prefixes', value: updated.map(p => `\`${p}\``).join('  ') });

    return interaction.reply({ embeds: [embed] });
  }
};
