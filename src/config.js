// src/config.js
//
// Central place for all configuration. Nothing outside this file should
// read from process.env directly - that keeps validation and defaults
// in one spot, and makes the rest of the code easy to read/test.

require('dotenv').config();

/**
 * Throws a clear startup error instead of letting the bot crash later
 * with a confusing stack trace when a required variable is missing.
 */
function requireEnv(name) {
  const value = process.env[name];
  if (!value || value.trim() === '') {
    throw new Error(
      `[config] Missing required environment variable: ${name}\n` +
      `Add it to your .env file. See .env.example for the expected format.`
    );
  }
  return value.trim();
}

function optionalEnv(name, fallback = undefined) {
  const value = process.env[name];
  if (value === undefined || value.trim() === '') return fallback;
  return value.trim();
}

function parseBool(value, fallback) {
  if (value === undefined) return fallback;
  return ['true', '1', 'yes', 'on'].includes(String(value).toLowerCase());
}

function parseIntSafe(value, fallback) {
  const n = parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
}

// --- Required ------------------------------------------------------------
const DISCORD_TOKEN = requireEnv('DISCORD_TOKEN');
const WELCOME_CHANNEL_ID = requireEnv('WELCOME_CHANNEL_ID');

// Discord snowflake IDs are numeric strings, typically 17-19 digits.
if (!/^\d{15,25}$/.test(WELCOME_CHANNEL_ID)) {
  throw new Error(
    `[config] WELCOME_CHANNEL_ID ("${WELCOME_CHANNEL_ID}") does not look like ` +
    `a valid Discord channel ID. It should be a numeric snowflake. ` +
    `See README.md for how to copy a channel ID.`
  );
}

// --- Optional --------------------------------------------------------------
const USE_EMBED = parseBool(optionalEnv('USE_EMBED'), true);
const EMBED_COLOR_RAW = optionalEnv('EMBED_COLOR', '#5865F2');
const BOT_ACTIVITY = optionalEnv('BOT_ACTIVITY', 'Watching for new members');
const DEDUPE_WINDOW_SECONDS = parseIntSafe(optionalEnv('DEDUPE_WINDOW_SECONDS'), 60);

// Basic sanity check on the hex color so a typo doesn't crash discord.js
// deep inside an API call with a confusing error.
const hexColorPattern = /^#?[0-9a-fA-F]{6}$/;
const EMBED_COLOR = hexColorPattern.test(EMBED_COLOR_RAW)
  ? (EMBED_COLOR_RAW.startsWith('#') ? EMBED_COLOR_RAW : `#${EMBED_COLOR_RAW}`)
  : '#5865F2';

if (!hexColorPattern.test(EMBED_COLOR_RAW)) {
  console.warn(
    `[config] EMBED_COLOR ("${EMBED_COLOR_RAW}") is not a valid hex color. ` +
    `Falling back to default #5865F2.`
  );
}

/**
 * The message posted when a new member joins.
 *
 * This is the ONE place to edit if you want to change the wording - no
 * need to touch index.js or welcomeHandler.js.
 *
 * `member` is a discord.js GuildMember.
 */
function WELCOME_MESSAGE(member) {
  return (
    `🎉 Welcome to the server, ${member}!\n` +
    `Feel free to roam around and make yourself at home! 🏠\n` +
    `🤖 We've got some bots to have fun with\n` +
    `🎵 VC channels to listen to music\n` +
    `🎬 Watch parties to enjoy with everyone\n` +
    `🎉 Events happening regularly\n` +
    `🔔 Get yourself the notification tags that you like\n` +
    `🏆 We've also got a few competitions going on:\n` +
    `🚗 Stewardle\n` +
    `🟩 Wordle\n` +
    `🏁 Hotlaps\n\n` +
    `Have fun, meet new people, and enjoy your stay! ❤️`
  );
}

module.exports = {
  DISCORD_TOKEN,
  WELCOME_CHANNEL_ID,
  USE_EMBED,
  EMBED_COLOR,
  BOT_ACTIVITY,
  DEDUPE_WINDOW_SECONDS,
  WELCOME_MESSAGE,
};
