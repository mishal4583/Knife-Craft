> For the complete documentation index, see [llms.txt](https://wiki.playgama.com/playgama/llms.txt). Markdown versions of documentation pages are available by appending `.md` to page URLs; this page is available as [Markdown](https://wiki.playgama.com/playgama/bridge-sdk/api.md).

# API

{% hint style="info" %}
You are reading the documentation for Bridge SDK **v2**. If you need the obsolete v1 documentation, see [Documentation (v1)](https://wiki.playgama.com/playgama/bridge-sdk-v1).
{% endhint %}

Reference for Playgama Bridge SDK modules. Method names and behavior are identical on every platform — Bridge maps each call to the native platform SDK internally.

## Required steps

These steps are **mandatory** for every game. Platforms verify them during moderation — a game that skips any of them can be rejected or behave incorrectly for players.

1. **Wait for Bridge initialization** before calling any SDK API. In Plain JS call `bridge.initialize()` and wait for the promise; engine plugins initialize automatically while the game loads (see [Setup](/playgama/bridge-sdk/setup.md)).
2. **Localize the game using** [**`platform.language`**](/playgama/bridge-sdk/api/platform.md#language) — read it once after initialization and use it as the source language for your localization system.
3. **Save and load progress through** [**Storage**](/playgama/bridge-sdk/api/storage.md) — never use `localStorage` directly.
4. **Subscribe to the** [**pause**](/playgama/bridge-sdk/api/platform.md#pause) **and** [**audio**](/playgama/bridge-sdk/api/platform.md#is-audio-enabled) **state events.** Platforms fire these events when the player switches tabs, minimizes the browser, or an ad opens — a game that keeps playing sound in the background fails moderation.
5. **Send** [**`platform.sendMessage('game_ready')`**](/playgama/bridge-sdk/api/platform.md#sending-a-message-to-the-platform) when the first playable frame is ready — platforms use this message to hide their loading screen and start analytics.
6. **Show** [**interstitial ads**](/playgama/bridge-sdk/api/advertisement/interstitial.md) at natural pauses, such as level transitions or game over — platforms require them to qualify for revenue share.

## Everything else — optional, but highly recommended

The remaining modules are not required to pass moderation, but each one directly improves monetization, retention, or platform ranking. Integrate as many as make sense for your game.

### Monetization

* [**Advertisement → Rewarded**](/playgama/bridge-sdk/api/advertisement/rewarded.md) — opt-in ads for in-game rewards (extra life, double coins, hint). Usually the highest-eCPM format because players consent.
* [**Advertisement → Banner**](/playgama/bridge-sdk/api/advertisement/banner.md) — passive ads on idle screens (menu, lobby, pause).
* [**Advertisement → Advanced Banners**](/playgama/bridge-sdk/api/advertisement/advanced-banners.md) — multiple banners with custom positions and responsive layouts, driven by config placements.
* [**Advertisement → AdBlock detection**](/playgama/bridge-sdk/api/advertisement/adblock.md) — detect blocked ads and show fallback messaging.
* [**Payments**](/playgama/bridge-sdk/api/payments.md) — in-game purchases, both consumable and permanent, with a single product catalog for all platforms.

### Engagement and retention

* [**Leaderboards**](/playgama/bridge-sdk/api/leaderboards.md) — competitive score tables.
* [**Achievements**](/playgama/bridge-sdk/api/achievements.md) — milestones ("defeat the first boss").
* [**Tasks**](/playgama/bridge-sdk/api/tasks.md) — daily / weekly / permanent quests with progress tracking and rewards.
* [**Daily Rewards**](/playgama/bridge-sdk/api/daily-rewards.md) — login streak rewards.
* [**Notifications**](/playgama/bridge-sdk/api/notifications.md) — platform notifications scheduled for after the player leaves the game, to bring them back.
* [**Social**](/playgama/bridge-sdk/api/social.md) — share, invite friends, join community, add to favorites, rate the game. Free organic acquisition.
* [**Cross-Promo**](/playgama/bridge-sdk/api/cross-promo.md) — "more games" modal and games-list API to route players between your titles.

### Platform integration depth

* [**Player**](/playgama/bridge-sdk/api/player.md) — authorization state, player id, name, and avatar for personalization and server-side profiles.
* [**Device**](/playgama/bridge-sdk/api/device.md) — device type, OS, orientation events, safe-area insets for notch-aware layouts.
* [**Remote Config**](/playgama/bridge-sdk/api/remote-config.md) — platform-managed flags to tune the game without a release.
* [**Clipboard**](/playgama/bridge-sdk/api/clipboard.md) — copy/paste for invite links and promo codes.
