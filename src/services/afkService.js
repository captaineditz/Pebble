import { logger } from '../utils/logger.js';

const MAX_PINGS = 20;

export class AfkService {
    static _key(guildId, userId) {
        return `afk:${guildId}:${userId}`;
    }

    static async setAfk(client, guildId, userId, reason = 'AFK') {
        try {
            await client.db.set(AfkService._key(guildId, userId), {
                reason,
                timestamp: Date.now(),
                pings: []
            });
            return { success: true };
        } catch (error) {
            logger.error('[AfkService] setAfk error:', error);
            return { success: false };
        }
    }

    static async clearAfk(client, guildId, userId) {
        try {
            const data = await client.db.get(AfkService._key(guildId, userId));
            await client.db.delete(AfkService._key(guildId, userId));
            return { success: true, data };
        } catch (error) {
            logger.error('[AfkService] clearAfk error:', error);
            return { success: false, data: null };
        }
    }

    static async getAfkStatus(client, guildId, userId) {
        try {
            return await client.db.get(AfkService._key(guildId, userId)) || null;
        } catch (error) {
            logger.error('[AfkService] getAfkStatus error:', error);
            return null;
        }
    }

    static async addPing(client, guildId, afkUserId, ping) {
        try {
            const key = AfkService._key(guildId, afkUserId);
            const data = await client.db.get(key);
            if (!data) return;
            data.pings = data.pings || [];
            if (data.pings.length < MAX_PINGS) {
                data.pings.push(ping);
                await client.db.set(key, data);
            }
        } catch (error) {
            logger.error('[AfkService] addPing error:', error);
        }
    }
}
