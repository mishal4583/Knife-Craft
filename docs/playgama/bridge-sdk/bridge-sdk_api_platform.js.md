> For the complete documentation index, see [llms.txt](https://wiki.playgama.com/playgama/llms.txt). Markdown versions of documentation pages are available by appending `.md` to page URLs; this page is available as [Markdown](https://wiki.playgama.com/playgama/bridge-sdk/api/platform.md).

# Platform (required)

You are reading the documentation for Bridge SDK **v2**. If you need the obsolete v1 documentation, see [Documentation (v1)](https://wiki.playgama.com/playgama/bridge-sdk-v1).

The Platform module exposes host-platform data and lets the game report lifecycle events back to the host.

## Implementation order

1. **Required** — Read [`platform.language`](#language) and apply localization.
2. **Required** — Send [`platform.sendMessage('game_ready')`](#sending-a-message-to-the-platform) when the first playable frame is ready.
3. **Required** — On game start, check [`platform.isAudioEnabled`](#is-audio-enabled) and mute the game if it is `false`. Also react to [audio](#is-audio-enabled) and [pause](#pause) state events to mute or pause the game when the user switches tabs or the platform requests it.
4. **Recommended** — Send additional [`sendMessage`](#sending-a-message-to-the-platform) lifecycle events (`level_started`, `level_completed`, etc.).

## Language

Read this after initialization and use it as the source language for your localization system.

Returns the language selected by the user on the host platform. If the platform does not provide a language, Bridge falls back to the browser language.

```javascript
bridge.platform.language
```

If the platform provides user language data, this will be the language set by the user on the platform. If not, it will be the browser language.

Format: ISO 639-1. Example: `ru`, `en`.

Platform support · all 25 platforms

**Supports:** `crazy_games`, `discord`, `dlightek`, `facebook`, `game_distribution`, `gamepush`, `gamesnacks`, `huawei`, `jio_games`, `lagged`, `microsoft_store`, `msn`, `ok`, `playgama`, `poki`, `portal`, `reddit`, `samsung`, `telegram`, `tiktok`, `vk`, `xiaomi`, `y8`, `yandex`, `youtube`

## Sending a Message to the Platform

Send lifecycle messages to the host platform. `game_ready` is required; the other messages help the platform understand gameplay state.

```javascript
bridge.platform.sendMessage("game_ready")
```

MessageParametersDescriptiongame_readyNo parametersThe game has loaded, all loading screens have passed, the player can interact with the game.in_game_loading_startedNo parametersAny loading within the game has started. For example, when a level is loading.in_game_loading_stoppedNo parametersIn-game loading has finished.player_got_achievementNo parametersThe player reached a significant moment. For example, defeating a boss, setting a record, etc.level_startedoptional "world" and "level", example:{"world":"desert","level":"1"}Gameplay has started. For example, the player has entered a level from the main menu.level_completedoptional "world" and "level", example:{"world":"desert","level":"1"}Gameplay has completed. For example, the player won level.level_failedoptional "world" and "level", example:{"world":"desert","level":"1"}Gameplay has failed. For example, the player lost level.level_pausedoptional "world" and "level", example:{"world":"desert","level":"1"}Gameplay has paused. Opened settings menu or used pause buttonlevel_resumedoptional "world" and "level", example:{"world":"desert","level":"1"}Gameplay has resumed. Returned from settings menu or hit unpause button

Platform support · varies by message

The matrix below lists, for each message, the platforms whose host SDK receives a corresponding signal. On any other platform the call is a silent no-op.

| Message                   | Platforms that relay the message                                                                                        |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `game_ready`              | `dlightek`, `facebook`, `gamesnacks`, `playgama`, `poki`, `portal`, `telegram`, `tiktok`, `xiaomi`, `yandex`, `youtube` |
| `in_game_loading_started` | `crazy_games`                                                                                                           |
| `in_game_loading_stopped` | `crazy_games`                                                                                                           |
| `level_started`           | `crazy_games`, `poki`, `yandex`                                                                                         |
| `level_completed`         | `crazy_games`, `gamesnacks`, `poki`, `yandex`                                                                           |
| `level_failed`            | `crazy_games`, `gamesnacks`, `poki`, `yandex`                                                                           |
| `level_paused`            | `crazy_games`, `poki`, `yandex`                                                                                         |
| `level_resumed`           | `crazy_games`, `poki`, `yandex`                                                                                         |
| `player_got_achievement`  | `crazy_games`                                                                                                           |

**Does not relay any message:** `discord`, `game_distribution`, `gamepush`, `huawei`, `jio_games`, `lagged`, `microsoft_store`, `msn`, `ok`, `reddit`, `samsung`, `vk`, `y8`

## Sending a Custom Message

Sends a message with an id of your own, for game events the built-in list does not cover — `shop_opened`, `boss_defeated`, `settings_closed`. Bridge treats it like a built-in message:

* the message is recorded in Bridge analytics under its id;
* it triggers the matching [Advanced Banners](/playgama/bridge-sdk/api/advertisement/advanced-banners.md#show-hide-via-platform-messages) placement, if the [config](/playgama/bridge-sdk/config.md) declares one;
* it shows an interstitial when the id is listed in `advertisement.interstitial.autoShow` in the config.

This is what makes banners and interstitials follow your own game flow without extra show/hide calls.

Platform SDKs do not receive custom messages — no platform defines messages of its own, so the call is resolved inside Bridge. Keep using [built-in messages](#sending-a-message-to-the-platform) for lifecycle reporting, `game_ready` above all.

A custom message carries its id and nothing else. Analytics records the id; any extra data passed to the call is ignored — it reaches neither analytics nor the platform.

```javascript
bridge.platform.sendCustomMessage('shop_opened')
```

## Is Audio Enabled

Returns whether the host platform currently allows game audio.

On game start, check the current value and mute the game audio if it is `false`. Subscribing to the event alone is not enough — it only fires on subsequent changes, so the initial state must be applied manually.

```javascript
bridge.platform.isAudioEnabled
```

```javascript
// Listen for state changes
bridge.platform.on(bridge.EVENT_NAME.AUDIO_STATE_CHANGED, isEnabled => {
    console.log('Is audio enabled:', isEnabled);
});
```

Platform support · all 25 platforms

**Supports:** `crazy_games`, `discord`, `dlightek`, `facebook`, `game_distribution`, `gamepush`, `gamesnacks`, `huawei`, `jio_games`, `lagged`, `microsoft_store`, `msn`, `ok`, `playgama`, `poki`, `portal`, `reddit`, `samsung`, `telegram`, `tiktok`, `vk`, `xiaomi`, `y8`, `yandex`, `youtube`

## Pause

Listen for host pause/resume requests. Pause gameplay, timers, and audio while `isPaused` is `true`.

```javascript
// Listen for state changes
bridge.platform.on(bridge.EVENT_NAME.PAUSE_STATE_CHANGED, isPaused => {
    console.log('Is paused:', isPaused);
});
```

Platform support · all 25 platforms

**Supports:** `crazy_games`, `discord`, `dlightek`, `facebook`, `game_distribution`, `gamepush`, `gamesnacks`, `huawei`, `jio_games`, `lagged`, `microsoft_store`, `msn`, `ok`, `playgama`, `poki`, `portal`, `reddit`, `samsung`, `telegram`, `tiktok`, `vk`, `xiaomi`, `y8`, `yandex`, `youtube`

## Platform ID

```javascript
bridge.platform.id
```

Returns the ID of the platform on which the game is currently running.

Platform support · all 25 platforms

**Supports:** `crazy_games`, `discord`, `dlightek`, `facebook`, `game_distribution`, `gamepush`, `gamesnacks`, `huawei`, `jio_games`, `lagged`, `microsoft_store`, `msn`, `ok`, `playgama`, `poki`, `portal`, `reddit`, `samsung`, `telegram`, `tiktok`, `vk`, `xiaomi`, `y8`, `yandex`, `youtube`

## URL Parameter

Read optional launch data passed through the platform URL. Use it for referral codes, deep links, invited-user context, or other launch parameters.

```javascript
bridge.platform.payload
```

The payload works only on platforms that pass it into the game URL. The exact URL format is platform-specific:

| Platform    | URL Format                                                           |
| ----------- | -------------------------------------------------------------------- |
| Playgama    | playgama.com/game/game\_nam&#x65;**?payload=your-info**              |
| VK          | \*\*                       |
| Yandex      | \*\* |
| Crazy Games | crazygames.com/game/game\_nam&#x65;**?payload=your-info**            |

On any other platform there is no way to pass the payload through the URL, so the value is `null`.

The same property also delivers the payload of the [notification](/playgama/bridge-sdk/api/notifications.md) the game was launched from, on platforms that support notifications, and the payload attached to a post with [`createPost(id, payload)`](/playgama/bridge-sdk/api/social.md#create-post). There the value does not come from the URL, so the table above does not apply to it.

Platform support · 5 of 25 platforms

**Supports:** `crazy_games`, `playgama`, `reddit`, `vk`, `yandex`

**Does not support:** `discord`, `dlightek`, `facebook`, `game_distribution`, `gamepush`, `gamesnacks`, `huawei`, `jio_games`, `lagged`, `microsoft_store`, `msn`, `ok`, `poki`, `portal`, `samsung`, `telegram`, `tiktok`, `xiaomi`, `y8`, `youtube`

## Launch Source

Tells where the game was opened from: `notification` for a [scheduled notification](/playgama/bridge-sdk/api/notifications.md), `post` for one of the game's own [posts](/playgama/bridge-sdk/api/social.md#create-post). It is `null` on an ordinary launch, which is the common case — treat anything else as a bonus path, never as a requirement.

```javascript
bridge.platform.launchSource
```

## Launch Data

Everything the launch carries, as key-value pairs: the parameters the platform passed to the game, plus `postId` — the id of the [`social.posts`](/playgama/bridge-sdk/api/social.md#content-by-id) entry the post was created from — when the game was opened from a post. Together with [`payload`](#url-parameter) this is what lets a game restore what was shared: the entry says which kind of post it is, the payload carries the level, seed or challenge itself.

```javascript
bridge.platform.data.postId
```

## Server Time

Returns trusted UTC server time. Use it for daily rewards, cooldowns, or time-limited offers where local device time is not reliable.

Server time is fetched via an external HTTP request, so it is unavailable on platforms that block external calls ([Is External Calls Supported](#is-external-calls-supported) is `false`) — the request fails there.

```javascript
bridge.platform.getServerTime()
    .then(result => {
        console.log(result) // UTC time in milliseconds
    })
    .catch(error => {
        console.log(error)
    })
```

Platform support · 19 of 25 platforms

**Supports:** `crazy_games`, `discord`, `dlightek`, `gamepush`, `huawei`, `jio_games`, `lagged`, `microsoft_store`, `msn`, `ok`, `playgama`, `portal`, `samsung`, `telegram`, `tiktok`, `vk`, `xiaomi`, `y8`, `yandex`

**Does not support:** `facebook`, `game_distribution`, `gamesnacks`, `poki`, `reddit`, `youtube`

## Native SDK

Returns the original platform SDK object when Bridge exposes it. Use it only for platform-specific features that Bridge does not wrap.

```javascript
bridge.platform.sdk
```

## Domain Information

Returns the platform top-level domain when the host provides it. Use it for regional links, legal text, or domain-specific configuration.

```javascript
bridge.platform.tld
```

Returns `null` when no data is available; otherwise returns a TLD such as `com` or `ru`.

Platform support · 1 of 25 platforms

**Supports:** `yandex`

**Does not support:** `crazy_games`, `discord`, `dlightek`, `facebook`, `game_distribution`, `gamepush`, `gamesnacks`, `huawei`, `jio_games`, `lagged`, `microsoft_store`, `msn`, `ok`, `playgama`, `poki`, `portal`, `reddit`, `samsung`, `telegram`, `tiktok`, `vk`, `xiaomi`, `y8`, `youtube`

## Is External Calls Supported

Returns whether the platform environment allows the game to make external HTTP requests (your own backend, third-party services). Some platforms run games in a sandbox that blocks outgoing requests — check this flag before relying on any external service.

```javascript
bridge.platform.isExternalCallsSupported
```

Platform support · 19 of 25 platforms

**Supports:** `crazy_games`, `discord`, `dlightek`, `gamepush`, `huawei`, `jio_games`, `lagged`, `microsoft_store`, `msn`, `ok`, `playgama`, `portal`, `samsung`, `telegram`, `tiktok`, `vk`, `xiaomi`, `y8`, `yandex`

**Does not support:** `facebook`, `game_distribution`, `gamesnacks`, `poki`, `reddit`, `youtube`

## Is External Links Allowed

Returns whether the platform allows opening external links from the game. Hide buttons that lead outside the platform (your socials, other stores) when this is `false`.

```javascript
bridge.platform.isExternalLinksAllowed
```

Platform support · 15 of 25 platforms

**Supports:** `crazy_games`, `discord`, `dlightek`, `facebook`, `gamepush`, `gamesnacks`, `huawei`, `lagged`, `microsoft_store`, `msn`, `portal`, `reddit`, `telegram`, `tiktok`, `vk`

**Does not support:** `game_distribution`, `jio_games`, `ok`, `playgama`, `poki`, `samsung`, `xiaomi`, `y8`, `yandex`, `youtube`

