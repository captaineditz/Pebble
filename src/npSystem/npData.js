import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_FILE = path.join(__dirname, "npUsers.json");

// Load NP users from JSON
export async function loadNPUsers() {
    try {
        const raw = await fs.readFile(DATA_FILE, "utf-8");
        return JSON.parse(raw);
    } catch {
        return {}; // Return empty if file doesn't exist yet
    }
}

// Save NP users to JSON
export async function saveNPUsers(data) {
    await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2));
}

// Check if a user has valid NP access
export async function hasNPAccess(userId) {
    const data = await loadNPUsers();
    const user = data[userId];
    if (!user) return false;

    // Permanent access
    if (!user.expiresAt) return true;

    // Time-limited access
    if (Date.now() < user.expiresAt) return true;

    // Expired — auto-remove
    delete data[userId];
    await saveNPUsers(data);
    return false;
}

// Add a user with optional expiry duration string like "30d", "7d", "24h"
export async function addNPUser(userId, username, duration = null) {
    const data = await loadNPUsers();

    let expiresAt = null;
    if (duration) {
        const ms = parseDuration(duration);
        if (!ms) return { success: false, reason: "Invalid duration format. Use e.g. `30d`, `7d`, `24h`, `60m`." };
        expiresAt = Date.now() + ms;
    }

    data[userId] = {
        username,
        addedAt: Date.now(),
        expiresAt,
    };

    await saveNPUsers(data);
    return { success: true, expiresAt };
}

// Remove a user
export async function removeNPUser(userId) {
    const data = await loadNPUsers();
    if (!data[userId]) return false;
    delete data[userId];
    await saveNPUsers(data);
    return true;
}

// Get all NP users
export async function listNPUsers() {
    const data = await loadNPUsers();
    return data;
}

// Parse duration strings like 30d, 7d, 24h, 60m
export function parseDuration(str) {
    const match = str.match(/^(\d+)(d|h|m)$/i);
    if (!match) return null;
    const amount = parseInt(match[1]);
    const unit = match[2].toLowerCase();
    const multipliers = { d: 86400000, h: 3600000, m: 60000 };
    return amount * multipliers[unit];
}

// Format a timestamp into a readable expiry string
export function formatExpiry(expiresAt) {
    if (!expiresAt) return "Never (Permanent)";
    const remaining = expiresAt - Date.now();
    if (remaining <= 0) return "Expired";
    const d = Math.floor(remaining / 86400000);
    const h = Math.floor((remaining % 86400000) / 3600000);
    const m = Math.floor((remaining % 3600000) / 60000);
    const parts = [];
    if (d > 0) parts.push(`${d}d`);
    if (h > 0) parts.push(`${h}h`);
    if (m > 0) parts.push(`${m}m`);
    return parts.length ? parts.join(" ") : "< 1m";
}

