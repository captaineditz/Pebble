import { getGuildConfig as getGuildConfigDb, setGuildConfig as setGuildConfigDb } from '../utils/database.js';
import { BotConfig } from '../config/bot.js';
import { normalizeGuildConfig, validateGuildConfigOrThrow } from '../utils/schemas.js';
import { wrapServiceBoundary } from '../utils/serviceErrorBoundary.js';
import { logger } from '../utils/logger.js';

const GUILD_CONFIG_DEFAULTS = {
    // Basic Settings
    prefix: BotConfig.prefix,
    
    // Role Settings
    modRole: null,
    adminRole: null,
    
    // Channel Settings
    logChannelId: null,
    welcomeChannel: null,
    
    // Messages
    welcomeMessage: 'Welcome {user} to {server}!',
    
    // Auto Features
    autoRole: null,
    dmOnClose: true,
    
    // Logging
    logIgnore: { 
        users: [], 
        channels: [] 
    },
    logging: {
        enabled: false,
        channelId: null,
        enabledEvents: {}
    },
    
    // AntiNuke Settings
    antinuke: {
        enabled: false,
        action: 'remove-perms',
        whitelist: [],
        thresholds: {
            channels: { amount: 5, seconds: 60 },
            roles: { amount: 5, seconds: 60 },
            bans: { amount: 10, seconds: 60 },
            kicks: { amount: 10, seconds: 60 }
        }
    },
    
  // AutoMod Settings
automod: {
    enabled: false,
    defaultAction: 'warn',
    rules: {},
    whitelist: {
        users: [],
        roles: [],
        channels: []
    }
},
    
    // Prefix Settings
    prefixes: [],
    
    // NP Users (No-Prefix access)
    npUsers: []
};

export const getGuildConfig = wrapServiceBoundary(async function getGuildConfig(client, guildId, context = {}) {
    try {
        const config = await getGuildConfigDb(client, guildId, context);
        const normalized = normalizeGuildConfig(config, GUILD_CONFIG_DEFAULTS);
        
        logger.debug(`[GuildConfig] Retrieved config for guild ${guildId}`, {
            guildId,
            keys: Object.keys(normalized)
        });
        
        return normalized;
    } catch (error) {
        logger.error(`[GuildConfig] Error retrieving config for guild ${guildId}:`, {
            guildId,
            error: error.message,
            ...context
        });
        throw error;
    }
}, {
    service: 'guildConfigService',
    operation: 'getGuildConfig',
    message: 'Failed to fetch guild configuration',
    userMessage: 'Failed to load server configuration. Please try again.'
});

export const setGuildConfig = wrapServiceBoundary(async function setGuildConfig(client, guildId, config, context = {}) {
    try {
        const normalized = normalizeGuildConfig(config, GUILD_CONFIG_DEFAULTS);
        const validated = validateGuildConfigOrThrow(normalized, { guildId, ...context });
        
        const result = await setGuildConfigDb(client, guildId, validated, context);
        
        logger.info(`[GuildConfig] Updated config for guild ${guildId}`, {
            guildId,
            updatedKeys: Object.keys(config),
            ...context
        });
        
        return result;
    } catch (error) {
        logger.error(`[GuildConfig] Error setting config for guild ${guildId}:`, {
            guildId,
            error: error.message,
            ...context
        });
        throw error;
    }
}, {
    service: 'guildConfigService',
    operation: 'setGuildConfig',
    message: 'Failed to save guild configuration',
    userMessage: 'Failed to save server configuration. Please try again.'
});

export const updateGuildConfig = wrapServiceBoundary(async function updateGuildConfig(client, guildId, updates, context = {}) {
    try {
        const currentConfig = await getGuildConfigDb(client, guildId, context);
        const newConfig = { ...currentConfig, ...updates };
        const normalized = normalizeGuildConfig(newConfig, GUILD_CONFIG_DEFAULTS);
        const validated = validateGuildConfigOrThrow(normalized, { guildId, ...context });
        
        const result = await setGuildConfigDb(client, guildId, validated, context);
        
        logger.info(`[GuildConfig] Updated guild ${guildId} with changes`, {
            guildId,
            changedKeys: Object.keys(updates),
            ...context
        });
        
        return result;
    } catch (error) {
        logger.error(`[GuildConfig] Error updating config for guild ${guildId}:`, {
            guildId,
            error: error.message,
            attemptedUpdates: Object.keys(updates),
            ...context
        });
        throw error;
    }
}, {
    service: 'guildConfigService',
    operation: 'updateGuildConfig',
    message: 'Failed to update guild configuration',
    userMessage: 'Failed to update server configuration. Please try again.'
});

export const getConfigValue = wrapServiceBoundary(async function getConfigValue(client, guildId, key, defaultValue = null, context = {}) {
    try {
        const config = await getGuildConfig(client, guildId, context);
        const value = config[key] !== undefined ? config[key] : defaultValue;
        
        logger.debug(`[GuildConfig] Retrieved config value for guild ${guildId}`, {
            guildId,
            key,
            hasValue: value !== null && value !== undefined
        });
        
        return value;
    } catch (error) {
        logger.error(`[GuildConfig] Error reading config value ${key} for guild ${guildId}:`, {
            guildId,
            key,
            error: error.message,
            ...context
        });
        throw error;
    }
}, {
    service: 'guildConfigService',
    operation: 'getConfigValue',
    message: 'Failed to read guild configuration value',
    userMessage: 'Failed to read a server setting. Please try again.'
});

export const setConfigValue = wrapServiceBoundary(async function setConfigValue(client, guildId, key, value, context = {}) {
    try {
        const result = await updateGuildConfig(client, guildId, { [key]: value }, context);
        
        logger.debug(`[GuildConfig] Set config value for guild ${guildId}`, {
            guildId,
            key,
            ...context
        });
        
        return result;
    } catch (error) {
        logger.error(`[GuildConfig] Error setting config value ${key} for guild ${guildId}:`, {
            guildId,
            key,
            error: error.message,
            ...context
        });
        throw error;
    }
}, {
    service: 'guildConfigService',
    operation: 'setConfigValue',
    message: 'Failed to update guild configuration value',
    userMessage: 'Failed to update a server setting. Please try again.'
});

export default {
    getGuildConfig,
    setGuildConfig,
    updateGuildConfig,
    getConfigValue,
    setConfigValue,
    GUILD_CONFIG_DEFAULTS
};
