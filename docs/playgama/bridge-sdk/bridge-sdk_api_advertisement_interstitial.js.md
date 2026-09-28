> For the complete documentation index, see [llms.txt](https://wiki.playgama.com/playgama/llms.txt). Markdown versions of documentation pages are available by appending `.md` to page URLs; this page is available as [Markdown](https://wiki.playgama.com/playgama/bridge-sdk/api/advertisement/interstitial.md).

# Interstitial (required)

You are reading the documentation for Bridge SDK **v2**. If you need the obsolete v1 documentation, see [Documentation (v1)](https://wiki.playgama.com/playgama/bridge-sdk-v1).

Interstitials are full-screen ads shown at natural pauses: between levels, on game over, or when returning to the menu.

## Configuration

Interstitial settings live in the [config](/playgama/bridge-sdk/config.md) under the `advertisement` key.

```json
{
    "advertisement": {
        "minimumDelayBetweenInterstitial": 60, // minimum delay between interstitials in seconds, default 60
        "initialInterstitialDelay": 0, // delay in seconds after game start during which showInterstitial() calls fail
        "interstitial": {
            "disable": false, // disable interstitials entirely
            "preloadOnStart": "level_completed", // placement to preload automatically right after SDK initialization
            "placementFallback": "level_completed", // placement used when showInterstitial() is called without one
            "placements": [ // map a game-level placement id to native placement ids, keyed by platform id
                { "id": "level_completed", "yandex": "native_placement_id" }
            ]
        }
    }
}
```

## Is Interstitial Supported

Check this before showing interstitial-related UI or running interstitial logic.

```javascript
bridge.advertisement.isInterstitialSupported
```

Platform support · 23 of 25 platforms

**Supports:** `crazy_games`, `dlightek`, `facebook`, `game_distribution`, `gamepush`, `gamesnacks`, `huawei`, `jio_games`, `lagged`, `microsoft_store`, `msn`, `ok`, `playgama`, `poki`, `portal`, `samsung`, `telegram`, `tiktok`, `vk`, `xiaomi`, `y8`, `yandex`, `youtube`

**Does not support:** `discord`, `reddit`

## Minimum Interval Between Displays

Set the minimum delay between interstitial attempts. The SDK uses this delay to prevent ads from appearing too often.

```javascript
// Default value = 60 seconds
bridge.advertisement.minimumDelayBetweenInterstitial

bridge.advertisement.setMinimumDelayBetweenInterstitial(30)
```

The SDK tracks the delay internally. Set the required interval once; if you call `showInterstitial()` too early, Bridge waits or skips according to platform behavior instead of showing ads too frequently.

## Interstitial State

Check `interstitialState` at game start. If the state is `opened`, immediately mute audio and pause gameplay (or rely on the universal platform [`AUDIO_STATE_CHANGED`](/playgama/bridge-sdk/api/platform.md#is-audio-enabled) / [`PAUSE_STATE_CHANGED`](/playgama/bridge-sdk/api/platform.md#pause) handlers — see the note below).

Track state changes to drive ad-specific logic. For muting and pausing, prefer the universal platform events described below instead of reacting to each ad state separately.

```javascript
bridge.advertisement.interstitialState
```

Possible values: `loading`, `opened`, `closed`, `failed`.

```javascript
// To track interstitial ad state changes, subscribe to the event
bridge.advertisement.on(
    bridge.EVENT_NAME.INTERSTITIAL_STATE_CHANGED, 
    state => console.log('Interstitial state: ', state)
)
```

While the interstitial is open, the game must be muted and paused. The recommended way to handle this is once, in a single place, by subscribing to the platform [`AUDIO_STATE_CHANGED`](/playgama/bridge-sdk/api/platform.md#is-audio-enabled) and [`PAUSE_STATE_CHANGED`](/playgama/bridge-sdk/api/platform.md#pause) events instead of duplicating the logic per ad type. Bridge raises those events whenever the host requests it — interstitials, rewarded ads, browser tab switches, system pauses — so a single universal handler covers every case.

## Show Interstitial

Request an interstitial at a natural pause, such as a level transition, game over screen, or return to menu.

```javascript
let placement = 'test_placement' // optional
bridge.advertisement.showInterstitial(placement)
```

