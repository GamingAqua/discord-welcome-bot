// src/welcomeHandler.js
//
// This bot welcomes members using Discord's own `guildMemberAdd` event -
// the event Discord fires the moment someone actually joins the server.
// This is the authoritative source of truth for "who joined and when",
// so unlike parsing another bot's chat messages, there's no ambiguity
// about identity here: `member` is always the exact GuildMember who joined.

const { EmbedBuilder } = require('discord.js');
const config = require('./config');

/**
 * Duplicate protection.
 *
 * `guildMemberAdd` should fire exactly once per join, but Discord gateway
 * reconnects can occasionally cause duplicate event delivery in edge cases.
 * We guard against that with a short-lived in-memory record per member ID.
 *
 * This is intentionally a short window (default 60s), not a permanent
 * "has this user ever been welcomed" record - a member who leaves and
 * rejoins later SHOULD be welcomed again.
 *
 * In-memory only, resets on restart. If you run multiple bot processes
 * sharing one token/guild (uncommon), swap this Map for a shared store
 * (e.g. Redis) using the same expiry logic.
 */
const recentlyWelcomed = new Map(); // memberId -> expiry timestamp (ms)

function pruneExpiredEntries() {
  const now = Date.now();
  for (const [memberId, expiry] of recentlyWelcomed.entries()) {
    if (expiry <= now) recentlyWelcomed.delete(memberId);
  }
}

function isDuplicate(memberId) {
  pruneExpiredEntries();
  const expiry = recentlyWelcomed.get(memberId);
  return typeof expiry === 'number' && expiry > Date.now();
}

function markWelcomed(memberId) {
  recentlyWelcomed.set(memberId, Date.now() + config.DEDUPE_WINDOW_SECONDS * 1000);
}

/**
 * Builds the payload for the welcome message (plain string or embed),
 * based on config.USE_EMBED / config.EMBED_COLOR / config.WELCOME_MESSAGE.
 */
function buildWelcomePayload(member) {
  const text = config.WELCOME_MESSAGE(member);

  if (!config.USE_EMBED) {
    return { content: text };
  }

  const embed = new EmbedBuilder()
    .setColor(config.EMBED_COLOR)
    .setDescription(text)
    .setThumbnail(member.displayAvatarURL({ size: 256 }));

  return { embeds: [embed] };
}

/**
 * Main entry point, called from index.js whenever Discord reports a new
 * member joining the guild.
 */
async function handleMemberJoin(member, client) {
  try {
    // Ignore bots joining (invited bots, integrations, etc.) - almost
    // always not something you want a "welcome to the community" message
    // for. Remove this check if you do want to welcome bots too.
    if (member.user.bot) {
      console.log(`[ignored] ${member.user.tag} (${member.id}) is a bot account - skipping.`);
      return;
    }

    if (isDuplicate(member.id)) {
      console.log(
        `[ignored] ${member.user.tag} (${member.id}) was already welcomed within ` +
        `the last ${config.DEDUPE_WINDOW_SECONDS}s - skipping duplicate join event.`
      );
      return;
    }

    console.log(`[detected] New member joined: ${member.user.tag} (${member.id}).`);

    const channel = await client.channels.fetch(config.WELCOME_CHANNEL_ID).catch(() => null);

    if (!channel) {
      console.error(
        `[error] Could not resolve WELCOME_CHANNEL_ID (${config.WELCOME_CHANNEL_ID}). ` +
        `Check that the ID is correct and the bot can see that channel.`
      );
      return;
    }

    const payload = buildWelcomePayload(member);
    await channel.send(payload);

    // Mark as welcomed only AFTER a successful send, so a failed send
    // (e.g. transient rate limit) isn't permanently and silently swallowed -
    // though in practice, since this fires once per real join, there is
    // nothing that will naturally retry it. This mainly guards against a
    // duplicate `guildMemberAdd` firing moments later for the same join.
    markWelcomed(member.id);

    console.log(`[sent] Welcome message sent for ${member.user.tag} (${member.id}).`);
  } catch (error) {
    handleJoinError(error, member);
  }
}

/**
 * Centralized error handling for anything that goes wrong while welcoming
 * a new member. Categorizes common Discord API failure modes so logs are
 * actually actionable.
 */
function handleJoinError(error, member) {
  const code = error?.code;

  if (code === 50013) {
    console.error(
      `[error] Missing Permissions: the bot lacks permission to send messages ` +
      `(or embed links) in the configured welcome channel. Check the bot's ` +
      `role permissions and channel-specific overrides.`
    );
    return;
  }

  if (code === 50001) {
    console.error(
      `[error] Missing Access: the bot cannot see the welcome channel at all. ` +
      `Verify the bot's role has "View Channel" permission there.`
    );
    return;
  }

  if (code === 10007 || code === 10013) {
    console.error(
      `[error] Unknown Member/User: ${member?.id ?? 'unknown'} appears to have ` +
      `left or their account no longer resolves (e.g. they left immediately ` +
      `after joining). Skipping - nothing further to do.`
    );
    return;
  }

  if (code === 429 || error?.status === 429) {
    console.error(
      `[error] Rate limited by Discord. discord.js will normally retry ` +
      `automatically; if this persists, you may be welcoming members in ` +
      `an unusually high volume, or another process is sharing this token.`
    );
    return;
  }

  console.error(`[error] Unexpected error while welcoming ${member?.id ?? 'unknown'}:`, error);
}

module.exports = {
  handleMemberJoin,
  // Exported for testing / introspection only:
  _internal: { isDuplicate, markWelcomed },
};
