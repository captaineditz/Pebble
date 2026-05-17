import { Command } from 'discord-akairo';
import { Message } from 'discord.js';

export default class AntiLinkCommand extends Command {
    constructor() {
        super('antiLink', {
            aliases: ['antiLink'],
            category: 'moderation',
            description: {
                content: 'Prevents users from posting links in the chat.',
                usage: 'antiLink',
                examples: ['antiLink']
            },
            ratelimit: 2,
        });
    }

    async exec(message: Message) {
        const linkRegex = /https?:\/\/[^\s]+/g;
        if (linkRegex.test(message.content)) {
            await message.delete();
            return message.reply('Links are not allowed in this server.');
        }
    }
}
