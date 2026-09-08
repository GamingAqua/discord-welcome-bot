// src/index.js
//
// Bot entry point: creates the client with the minimum required intents,
// wires up event handlers, and logs in.

const { Client, GatewayIntentBits, ActivityType } = require('discord.js');
const config = require('./config'); // validates env vars on require - fails fast if misconfigured
const { handleMemberJoin } = require('./welcomeHandler');

// --- Required Gateway Intents ---------------------------------------------
// Guilds:       needed for basically any bot - gives access to guild/channel objects.
// GuildMembers: PRIVILEGED intent. Required to receive the `guildMemberAdd`
//               event at all. Must be enabled both here AND in the Discord
//               Developer Portal (Bot page -> "Server Members Intent"
//               toggle) - see README.md.
//
// We do NOT request GuildMessages or MessageContent - this bot never reads
// message content, so those intents (and their associated Message Content
// review requirements at scale) simply aren't needed.
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
  ],
});

client.once('clientReady', () => {
  console.log(`[startup] Logged in as ${client.user.tag} (${client.user.id}).`);
  console.log(`[startup] Welcome channel: ${config.WELCOME_CHANNEL_ID}`);

  client.user.setPresence({
    activities: [{ name: config.BOT_ACTIVITY, type: ActivityType.Watching }],
    status: 'online',
  });
});

client.on('guildMemberAdd', (member) => {
  // Don't let one bad join event crash the whole process - handleMemberJoin
  // already wraps its own logic in try/catch, but this is a second safety
  // net in case something throws synchronously before that.
  Promise.resolve(handleMemberJoin(member, client)).catch((error) => {
    console.error('[error] Unhandled error in guildMemberAdd handler:', error);
  });
});

client.on('error', (error) => {
  console.error('[error] Discord client error:', error);
});

client.on('shardError', (error) => {
  console.error('[error] Websocket connection error:', error);
});

process.on('unhandledRejection', (reason) => {
  console.error('[error] Unhandled promise rejection:', reason);
});

process.on('SIGINT', () => {
  console.log('\n[shutdown] Received SIGINT, logging out gracefully...');
  client.destroy();
  process.exit(0);
});

// --- Login -----------------------------------------------------------------
// Never log config.DISCORD_TOKEN anywhere, including in error messages.
client.login(config.DISCORD_TOKEN).catch((error) => {
  console.error(
    '[fatal] Failed to log in. This usually means DISCORD_TOKEN is invalid ' +
    'or has been reset. Double-check your .env file (do not log the token itself).'
  );
  console.error('[fatal] Discord.js error name:', error?.name);
  process.exit(1);
});
