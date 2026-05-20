module.exports = {
  name: 'np',
  description: 'No prefix command - Exclusive access',
  execute(message, args) {
    const OWNER_ID = '1360488463371341834';
    
    // Only allow the owner to use this command
    if (message.author.id !== OWNER_ID) {
      return message.reply('❌ This feature is exclusive and not available to you.');
    }
    
    // Owner access granted
    message.reply('✅ You have access to this exclusive feature!');
  }
};
