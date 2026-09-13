# Discord Welcome Bot (direct join detection)

A Node.js + discord.js v14 bot that welcomes new members the moment they
join the server, using Discord's own `guildMemberAdd` event.

This is a simpler, fully reliable  welcome messages: `guildMemberAdd` is Discord's own
authoritative "this exact member just joined" event, so there's no
ambiguity about identity.

---

## Project structure

```
discord-welcome-bot/
├── src/
│   ├── index.js          # bot bootstrap, intents, event wiring
│   ├── config.js         # loads + validates all env vars, welcome message template
│   └── welcomeHandler.js # dedup, sending, error handling
├── .env                  # your real secrets (create this, never commit it)
├── .env.example          # template showing all available variables
├── .gitignore
├── package.json
└── README.md
```

---

## 1. Install Node.js

You need **Node.js 18 or newer** (discord.js v14 requires it).

- Download from https://nodejs.org (LTS version).
- Verify install:
  ```bash
  node -v   # should print v18.x.x or higher
  npm -v
  ```

## 2. Create the Discord application

1. Go to https://discord.com/developers/applications.
2. Click **New Application**, give it a name (e.g. "Welcome Bot").
3. Open the **Bot** tab on the left.

## 3. Create the bot user & get the token

1. On the **Bot** tab, click **Reset Token** (or it may already show one) to
   reveal your bot token.
2. Click **Copy**. This is your `DISCORD_TOKEN` — treat it like a password.
3. **Never** paste it into code, screenshots, or commit it to git.

### If your token ever leaks

Go to the **Bot** tab → **Reset Token**. This immediately invalidates the
old token (any running bot using it disconnects) and issues a new one.
Update `.env` with the new token and restart the bot. There's no way to
"undo" a leak other than resetting — assume a leaked token is compromised.

## 4. Enable required intents (Developer Portal)

Still on the **Bot** tab, scroll to **Privileged Gateway Intents** and enable:

- ✅ **Server Members Intent** — required to receive the `guildMemberAdd`
  event when someone joins.

You do **not** need "Message Content Intent" or "Presence Intent" — this
bot never reads message content or presence data.

## 5. Bot permissions (keep minimal)

When generating the invite link (next step), grant only:

- **View Channel** — to see the welcome channel.
- **Send Messages** — to post the welcome message.
- **Embed Links** — only needed if `USE_EMBED=true`.

Avoid granting Administrator or any moderation permissions — this bot never
needs them.

## 6. Invite your bot to the server

1. In the Developer Portal, go to **OAuth2 → URL Generator**.
2. Under **Scopes**, check `bot`.
3. Under **Bot Permissions**, check the permissions listed above.
4. Copy the generated URL, open it in a browser, select your server, and
   authorize.

## 7. Get your welcome channel's ID

1. In Discord, enable **Developer Mode**: User Settings → Advanced →
   Developer Mode → on.
2. Right-click the channel you want welcomes posted in → **Copy Channel ID**.
3. This is your `WELCOME_CHANNEL_ID` value.

## 8. Configure `.env`

```bash
cp .env.example .env
```

Then edit `.env`:

```env
DISCORD_TOKEN=your_bot_token
WELCOME_CHANNEL_ID=123456789012345678
USE_EMBED=true
EMBED_COLOR=#5865F2
BOT_ACTIVITY=Watching for new members
DEDUPE_WINDOW_SECONDS=60
```

All variables are documented inline in `.env.example`.

## 9. Install dependencies

```bash
cd discord-welcome-bot
npm install
```

## 10. Start the bot

```bash
npm start
```

You should see:

```
[startup] Logged in as YourBot#1234 (123456789012345678).
[startup] Welcome channel: 123456789012345678
```

## 11. Test it

1. Have a test account join the server (an alt account, or ask a friend).
2. Watch your bot's console:
   - `[detected]` — a new member joined.
   - `[sent]` — the welcome message posted successfully.
   - `[ignored]` — the joiner was a bot account, or a duplicate join event
     within the dedupe window.
3. Confirm the welcome message appears in the configured channel and pings
   the correct new member.

---

## How duplicate protection works

`guildMemberAdd` should fire exactly once per real join, but Discord
gateway reconnects can occasionally cause duplicate event delivery in edge
cases. Every welcomed member ID is tracked in an in-memory `Map` of
`memberId → expiry timestamp`, expiring `DEDUPE_WINDOW_SECONDS` (default
60s) after a successful send. A join event for the same member inside that
window is logged as `[ignored]` and skipped.

This state is in-memory and resets on restart — intentional, since a member
who leaves and rejoins later (even the same day) should be welcomed again.
If you ever run multiple bot processes sharing one token/guild, replace the
`Map` in `welcomeHandler.js` with a shared store (e.g. Redis) using the same
expiry logic.

## Customizing the welcome message

Edit the `WELCOME_MESSAGE` function in `src/config.js` — nothing else needs
to change:

```js
function WELCOME_MESSAGE(member) {
  return (
    `👋 Welcome to **${member.guild.name}**, ${member}! We're glad to have you here! 🎉\n\n` +
    `Please take a moment to check out the rules and introduce yourself. Have fun!`
  );
}
```

`member` is a discord.js `GuildMember`, so `${member}` renders as a real
ping, `member.guild.name` is the server name, `member.user.tag` is their
username#tag, etc.

Other things configurable purely via `.env` (no code edits): `WELCOME_CHANNEL_ID`,
`USE_EMBED`, `EMBED_COLOR`, `BOT_ACTIVITY`, `DEDUPE_WINDOW_SECONDS`.

By default, accounts that are bots themselves (e.g. other invited bots) are
not welcomed — remove the `member.user.bot` check near the top of
`handleMemberJoin` in `src/welcomeHandler.js` if you want them welcomed too.

## Security notes

- The token is only ever read via `config.js` → `process.env.DISCORD_TOKEN`
  and passed straight to `client.login()`. It is never logged, and error
  handlers explicitly avoid printing the token or full error objects that
  might contain it.
- `config.js` validates required variables **on startup** and throws a
  clear error immediately if `DISCORD_TOKEN` or `WELCOME_CHANNEL_ID` is
  missing or malformed, rather than failing confusingly later.
- `.env` is listed in `.gitignore` so it's never accidentally committed.
- If the token leaks, reset it immediately (see step 3 above).

## Troubleshooting

**Bot logs in but never welcomes anyone.**
Confirm **Server Members Intent** is enabled both in the Developer Portal
and that `GatewayIntentBits.GuildMembers` is present in `src/index.js`'s
intents list. Without it, Discord silently never sends `guildMemberAdd`
events to your bot.

**`Missing Permissions` errors.**
Check the bot's role has "Send Messages" (and "Embed Links" if
`USE_EMBED=true`) in the welcome channel, and that no channel-specific
permission override is blocking it.

**Bot won't start / crashes immediately.**
Read the `[config]` or `[fatal]` error message — it will name the exact
missing/invalid environment variable rather than a generic crash.

**Getting rate limited.**
discord.js retries rate limits automatically; if you see persistent `429`
errors, you likely have another process also using the same token, or an
unusual volume of members joining at once (e.g. a raid).
