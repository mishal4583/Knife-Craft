> For the complete documentation index, see [llms.txt](https://wiki.playgama.com/playgama/llms.txt). Markdown versions of documentation pages are available by appending `.md` to page URLs; this page is available as [Markdown](https://wiki.playgama.com/playgama/bridge-sdk/api/advertisement/rewarded.md).

# Rewarded

{% hint style="info" %}
You are reading the documentation for Bridge SDK **v2**. If you need the obsolete v1 documentation, see [Documentation (v1)](https://wiki.playgama.com/playgama/bridge-sdk-v1).
{% endhint %}

Rewarded ads are **opt-in** full-screen ads. The player chooses to watch in exchange for an in-game reward, such as an extra life, double coins, a hint, or a skip. They usually have high eCPM and low friction because the player consents.

{% hint style="info" %}
Rewarded integration is highly recommended: it is usually the highest-eCPM ad format, and players opt in willingly.
{% endhint %}

## When to use

* The player can use a small boost (revive, extra hint, skip a hard level).
* You have premium content gated behind a soft paywall — let non-paying players unlock it via an ad.
* You want to convert engagement into revenue without hurting retention.

{% hint style="danger" %}
Reward the player **only** when the state is `rewarded`. Granting on `closed` lets players claim rewards without watching the ad.
{% endhint %}

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

{% tabs %}
{% tab title="Plain JS" %}

```javascript
bridge.advertisement.isRewardedSupported
```

{% endtab %}

{% tab title="Unity" %}

```csharp
Bridge.advertisement.isRewardedSupported
```

{% endtab %}

{% tab title="Construct 3" %}
Use the PlaygamaBridge **Is Rewarded Supported** condition before showing a rewarded-ad button.
{% endtab %}

{% tab title="GDevelop" %}
Use the PlaygamaBridge **Is Rewarded Supported** condition before showing a rewarded-ad button.
{% endtab %}

{% tab title="Godot" %}

```gdscript
Bridge.advertisement.is_rewarded_supported
```

{% endtab %}

{% tab title="GameMaker" %}

```javascript
playgama_bridge_advertisement_is_rewarded_supported()
```

{% endtab %}

{% tab title="Defold" %}

```lua
bridge.advertisement.is_rewarded_supported()
```

{% endtab %}

{% tab title="Cocos Creator" %}

```javascript
bridge.advertisement.isRewardedSupported
```

{% endtab %}

{% tab title="Scratch" %}

<figure><img src="https://1088849411-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F5ukgSPDBOdbQp4FYtbz1%2Fuploads%2FWSW8k2sUCd9zgsSw1X7L%2FScreenshot%202025-07-25%20at%2010.11.10%E2%80%AFAM.png?alt=media&amp;token=93ccfe14-4ced-4cb4-b2c6-f4532ad47b0c" alt=""><figcaption></figcaption></figure>
{% endtab %}
{% endtabs %}

<details>

<summary>Platform support · 23 of 25 platforms</summary>

**Supports:** `crazy_games`, `dlightek`, `facebook`, `game_distribution`, `gamepush`, `gamesnacks`, `huawei`, `jio_games`, `lagged`, `microsoft_store`, `msn`, `ok`, `playgama`, `poki`, `portal`, `samsung`, `telegram`, `tiktok`, `vk`, `xiaomi`, `y8`, `yandex`, `youtube`

**Does not support:** `discord`, `reddit`

</details>

## Rewarded State

Track state changes to grant the reward only when the final state is `rewarded`. For muting and pausing the game, prefer the universal platform [`AUDIO_STATE_CHANGED`](/playgama/bridge-sdk/api/platform.md#is-audio-enabled) / [`PAUSE_STATE_CHANGED`](/playgama/bridge-sdk/api/platform.md#pause) events described below instead of reacting to each ad state separately.

{% tabs %}
{% tab title="Plain JS" %}

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

{% endtab %}

{% tab title="Unity" %}

```csharp
Bridge.advertisement.rewardedState
```

Possible values: `Loading`, `Opened`, `Closed`, `Rewarded`, `Failed`.

```csharp
// To track rewarded ad state changes, subscribe to the event
private void Start()
{
    Bridge.advertisement.rewardedStateChanged += OnRewardedStateChanged;
}

private void OnRewardedStateChanged(RewardedState state)
{
    Debug.Log(state);
}
```

{% endtab %}

{% tab title="Construct 3" %}
Read the current state from the expression. Possible values: `loading`, `opened`, `closed`, `rewarded`, `failed`.

```javascript
PlaygamaBridge.RewardedState
```

To react to changes, use the trigger conditions **On Rewarded State Changed**, **On Rewarded Loading**, **On Rewarded Opened**, **On Rewarded Rewarded**, **On Rewarded Closed**, **On Rewarded Failed**. Grant the reward only inside **On Rewarded Rewarded**.

<details>

<summary>Copy This Example</summary>

```
{"is-c3-clipboard-data":true,"type":"events","items":[{"eventType":"block","conditions":[{"id":"on-rewarded-rewarded","objectClass":"PlaygamaBridge"}],"actions":[{"id":"log","objectClass":"Browser","parameters":{"type":"log","message":"\"Grant the reward here\""}}]}]}
```

</details>
{% endtab %}

{% tab title="GDevelop" %}
Read the current state from the expression. Possible values: `loading`, `opened`, `closed`, `rewarded`, `failed`.

```javascript
PlaygamaBridge::RewardedState()
```

To react to changes, use the trigger conditions **On Rewarded State Changed**, **On Rewarded Loading**, **On Rewarded Opened**, **On Rewarded Rewarded**, **On Rewarded Closed**, **On Rewarded Failed**. Grant the reward only inside **On Rewarded Rewarded**.

<details>

<summary>Copy This Example</summary>

```
{"000kind":"GDEVELOP_EventsAndInstructions_CLIPBOARD_KIND-jsBdHbLy912y8Rc","content":{"eventsList":[{"type":"BuiltinCommonInstructions::Standard","conditions":[{"type":{"value":"PlaygamaBridge::OnRewardedRewarded"},"parameters":[""]}],"actions":[{"type":{"value":"DebuggerTools::ConsoleLog"},"parameters":["\"Grant the reward here\"","\"info\"",""]}]}],"eventsCount":1,"actionsList":[],"actionsCount":0,"conditionsList":[],"conditionsCount":0}}
```

</details>
{% endtab %}

{% tab title="Godot" %}

```gdscript
Bridge.advertisement.rewarded_state
```

Returns the current state of the rewarded ad. Possible values: `loading`, `opened`, `closed`, `rewarded`, `failed`.

{% tabs %}
{% tab title="Godot 3.x" %}

<pre class="language-gdscript"><code class="lang-gdscript"><strong># To track rewarded ad state changes, connect to the signal
</strong>func _ready():
    Bridge.advertisement.connect("rewarded_state_changed", self, "_on_rewarded_state_changed")

func _on_rewarded_state_changed(state):
    print(state)
</code></pre>

{% endtab %}

{% tab title="Godot 4.x" %}

<pre class="language-gdscript"><code class="lang-gdscript"><strong># To track rewarded ad state changes, connect to the signal
</strong>func _ready():
    Bridge.advertisement.connect("rewarded_state_changed", Callable(self, "_on_rewarded_state_changed"))

func _on_rewarded_state_changed(state):
    print(state)
</code></pre>

{% endtab %}
{% endtabs %}
{% endtab %}

{% tab title="GameMaker" %}

```javascript
playgama_bridge_advertisement_rewarded_state()
```

Possible values: `loading`, `opened`, `closed`, `rewarded`, `failed`.

```javascript
// To track rewarded ad state changes, subscribe to the event

// via Async Social Event
if async_load[? "type"] == "playgama_bridge_advertisement_rewarded_state_changed" {
    switch async_load[? "data"] {
        case "loading":
            // your logic here
            break
        case "opened":
            // your logic here
            break
        case "closed":
            // your logic here
            break
        case "failed":
            // your logic here
            break
    }
}
```

{% endtab %}

{% tab title="Defold" %}

```lua
bridge.advertisement.rewarded_state()
```

Possible values: `loading`, `opened`, `closed`, `rewarded`, `failed`.

```lua
local bridge = require("bridge.bridge")

function init(self)
	bridge.advertisement.on("rewarded_state_changed", function (_, state)
		print("Rewarded state changed: ", state)
	end)
end
```

{% endtab %}

{% tab title="Cocos Creator" %}

```javascript
bridge.advertisement.rewardedState
```

Possible values: `loading`, `opened`, `closed`, `rewarded`, `failed`.

```javascript
// To track rewarded ad state changes, subscribe to the event
bridge.advertisement.on(EVENT_NAME.REWARDED_STATE_CHANGED, this.onRewardedStateChanged.bind(this));

onRewardedStateChanged(state: REWARDED_STATE) {
    console.log("Rewarded state: ", state);
    switch (state) {
        case 'loading':
            break;
        case 'opened':
            break;
        case 'rewarded':
            break;
        case 'closed':
            break;
        case 'failed':
            break;
    }
}
```

{% endtab %}

{% tab title="Scratch" %}

<figure><img src="https://1088849411-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F5ukgSPDBOdbQp4FYtbz1%2Fuploads%2Fy9NGzkFBaeN9nHWGKj95%2FScreenshot%202025-07-11%20at%204.54.55%E2%80%AFPM.png?alt=media&amp;token=ee6f0d49-e500-4117-bd06-469022904bb8" alt=""><figcaption></figcaption></figure>
{% endtab %}
{% endtabs %}

{% hint style="info" %}
While the rewarded ad is open, the game must be muted and paused. The recommended way to handle this is once, in a single place, by subscribing to the platform [`AUDIO_STATE_CHANGED`](/playgama/bridge-sdk/api/platform.md#is-audio-enabled) and [`PAUSE_STATE_CHANGED`](/playgama/bridge-sdk/api/platform.md#pause) events instead of duplicating the logic per ad type. Bridge raises those events whenever the host requests it — interstitials, rewarded ads, browser tab switches, system pauses — so a single universal handler covers every case.
{% endhint %}

{% hint style="danger" %}
Reward the player only when the state is `rewarded`.
{% endhint %}

## Rewarded Placement

Read the current rewarded placement when one button can request different rewards. Use it to decide which reward to grant after the state becomes `rewarded`.

{% tabs %}
{% tab title="Plain JS" %}

```javascript
bridge.advertisement.rewardedPlacement
```

{% endtab %}

{% tab title="Unity" %}

```csharp
Bridge.advertisement.rewardedPlacement
```

{% endtab %}

{% tab title="Construct 3" %}

```javascript
PlaygamaBridge.RewardedPlacement
```

{% endtab %}

{% tab title="GDevelop" %}

```javascript
PlaygamaBridge::RewardedPlacement()
```

{% endtab %}

{% tab title="Godot" %}

```gdscript
Bridge.advertisement.rewarded_placement
```

{% endtab %}

{% tab title="GameMaker" %}

```javascript
playgama_bridge_advertisement_rewarded_placement()
```

{% endtab %}

{% tab title="Defold" %}

```lua
bridge.advertisement.rewarded_placement()
```

{% endtab %}

{% tab title="Cocos Creator" %}

```javascript
bridge.advertisement.rewardedPlacement
```

{% endtab %}
{% endtabs %}

## Show Rewarded Ad

Request a rewarded ad from a direct player action, such as tapping "Watch ad for reward".

{% tabs %}
{% tab title="Plain JS" %}

```javascript
let placement = 'test_placement' // optional
bridge.advertisement.showRewarded(placement)
```

{% endtab %}

{% tab title="Unity" %}

```csharp
private void Start()
{
    var placement = "test_placement"; // optional
    Bridge.advertisement.ShowRewarded(placement);
}
```

{% endtab %}

{% tab title="Construct 3" %}
Add the PlaygamaBridge **Show Rewarded** action. Parameters:

* Placement (optional)
  {% endtab %}

{% tab title="GDevelop" %}
Add the **Show Rewarded** action. Parameters:

* Placement (optional)
  {% endtab %}

{% tab title="Godot" %}

```gdscript
var placement = "test_placement" # optional
Bridge.advertisement.show_rewarded(placement)
```

{% endtab %}

{% tab title="GameMaker" %}

```javascript
var placement = "test_placement" // optional
playgama_bridge_advertisement_show_rewarded(placement)
```

{% endtab %}

{% tab title="Defold" %}

```lua
local placement = "test_placement" -- optional
bridge.advertisement.show_rewarded(placement)
```

{% endtab %}

{% tab title="Cocos Creator" %}

```javascript
let placement = 'test_placement' // optional
bridge.advertisement.showRewarded(placement)
```

{% endtab %}

{% tab title="Scratch" %}

<figure><img src="https://1088849411-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F5ukgSPDBOdbQp4FYtbz1%2Fuploads%2FFgFYCRewzPYhSaun0fxK%2FScreenshot%202025-07-11%20at%204.55.40%E2%80%AFPM.png?alt=media&amp;token=8ccd81f1-4a98-47bb-8364-6afd3908f367" alt=""><figcaption></figcaption></figure>
{% endtab %}
{% endtabs %}
