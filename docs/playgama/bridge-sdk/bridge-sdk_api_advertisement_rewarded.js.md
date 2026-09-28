> For the complete documentation index, see [llms.txt](https://wiki.playgama.com/playgama/llms.txt). Markdown versions of documentation pages are available by appending `.md` to page URLs; this page is available as [Markdown](https://wiki.playgama.com/playgama/bridge-sdk/api/advertisement/rewarded.md).

# Rewarded

You are reading the documentation for Bridge SDK **v2**. If you need the obsolete v1 documentation, see [Documentation (v1)](https://wiki.playgama.com/playgama/bridge-sdk-v1).

Rewarded ads are **opt-in** full-screen ads. The player chooses to watch in exchange for an in-game reward, such as an extra life, double coins, a hint, or a skip. They usually have high eCPM and low friction because the player consents.

Rewarded integration is highly recommended: it is usually the highest-eCPM ad format, and players opt in willingly.

## When to use

* The player can use a small boost (revive, extra hint, skip a hard level).
* You have premium content gated behind a soft paywall — let non-paying players unlock it via an ad.
* You want to convert engagement into revenue without hurting retention.

Reward the player **only** when the state is `rewarded`. Granting on `closed` lets players claim rewards without watching the ad.

## Configuration

Rewarded settings live in the [config](/playgama/bridge-sdk/config.md) under the `advertisement.rewarded` key.

```json
{
    "advertisement": {
        "rewarded": {
            "disable": false, // disable rewarded ads entirely
            "preloadOnStart": "extra_life", // placement to preload automatically right after SDK initialization
            "placementFallback": "extra_life", // placement used when showRewarded() is called without one
            "placements": [ // map a game-level placement id to native placement ids, keyed by platform id
                { "id": "extra_life", "yandex": "native_placement_id" }
            ]
        }
    }
}
```

## Is Rewarded Supported

Check this before showing a rewarded-ad button.

```javascript
bridge.advertisement.isRewardedSupported
```

Platform support · 23 of 25 platforms

**Supports:** `crazy_games`, `dlightek`, `facebook`, `game_distribution`, `gamepush`, `gamesnacks`, `huawei`, `jio_games`, `lagged`, `microsoft_store`, `msn`, `ok`, `playgama`, `poki`, `portal`, `samsung`, `telegram`, `tiktok`, `vk`, `xiaomi`, `y8`, `yandex`, `youtube`

**Does not support:** `discord`, `reddit`

## Rewarded State

Track state changes to grant the reward only when the final state is `rewarded`. For muting and pausing the game, prefer the universal platform [`AUDIO_STATE_CHANGED`](/playgama/bridge-sdk/api/platform.md#is-audio-enabled) / [`PAUSE_STATE_CHANGED`](/playgama/bridge-sdk/api/platform.md#pause) events described below instead of reacting to each ad state separately.

```javascript
bridge.advertisement.rewardedState
```

Possible values: `loading`, `opened`, `closed`, `rewarded`, `failed`.

```javascript
// To track rewarded ad state changes, subscribe to the event
bridge.advertisement.on(
    bridge.EVENT_NAME.REWARDED_STATE_CHANGED, 
    state => console.log('Rewarded state: ', state)
)
```

While the rewarded ad is open, the game must be muted and paused. The recommended way to handle this is once, in a single place, by subscribing to the platform [`AUDIO_STATE_CHANGED`](/playgama/bridge-sdk/api/platform.md#is-audio-enabled) and [`PAUSE_STATE_CHANGED`](/playgama/bridge-sdk/api/platform.md#pause) events instead of duplicating the logic per ad type. Bridge raises those events whenever the host requests it — interstitials, rewarded ads, browser tab switches, system pauses — so a single universal handler covers every case.

Reward the player only when the state is `rewarded`.

## Rewarded Placement

Read the current rewarded placement when one button can request different rewards. Use it to decide which reward to grant after the state becomes `rewarded`.

```javascript
bridge.advertisement.rewardedPlacement
```

## Show Rewarded Ad

Request a rewarded ad from a direct player action, such as tapping "Watch ad for reward".

```javascript
let placement = 'test_placement' // optional
bridge.advertisement.showRewarded(placement)
```

