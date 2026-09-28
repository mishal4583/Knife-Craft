> For the complete documentation index, see [llms.txt](https://wiki.playgama.com/playgama/llms.txt). Markdown versions of documentation pages are available by appending `.md` to page URLs; this page is available as [Markdown](https://wiki.playgama.com/playgama/bridge-sdk/api/platform.md).

# Platform (required)

{% hint style="info" %}
You are reading the documentation for Bridge SDK **v2**. If you need the obsolete v1 documentation, see [Documentation (v1)](https://wiki.playgama.com/playgama/bridge-sdk-v1).
{% endhint %}

The Platform module exposes host-platform data and lets the game report lifecycle events back to the host.

## Implementation order

1. **Required** — Read [`platform.language`](#language) and apply localization.
2. **Required** — Send [`platform.sendMessage('game_ready')`](#sending-a-message-to-the-platform) when the first playable frame is ready.
3. **Required** — On game start, check [`platform.isAudioEnabled`](#is-audio-enabled) and mute the game if it is `false`. Also react to [audio](#is-audio-enabled) and [pause](#pause) state events to mute or pause the game when the user switches tabs or the platform requests it.
4. **Recommended** — Send additional [`sendMessage`](#sending-a-message-to-the-platform) lifecycle events (`level_started`, `level_completed`, etc.).

## Language

{% hint style="warning" %}
Read this after initialization and use it as the source language for your localization system.
{% endhint %}

Returns the language selected by the user on the host platform. If the platform does not provide a language, Bridge falls back to the browser language.

{% tabs %}
{% tab title="Plain JS" %}

```javascript
bridge.platform.language
```

{% endtab %}

{% tab title="Unity" %}

```java
Bridge.platform.language
```

{% endtab %}

{% tab title="Construct 3" %}

```javascript
PlaygamaBridge.PlatformLanguage
```

{% endtab %}

{% tab title="GDevelop" %}

```javascript
PlaygamaBridge::PlatformLanguage()
```

{% endtab %}

{% tab title="Godot" %}

```gdscript
Bridge.platform.language
```

{% endtab %}

{% tab title="GameMaker" %}

```javascript
playgama_bridge_platform_language()
```

{% endtab %}

{% tab title="Defold" %}

```lua
bridge.platform.language()
```

{% endtab %}

{% tab title="Cocos Creator" %}

```typescript
bridge.platform.language
```

{% endtab %}

{% tab title="Scratch" %}

<figure><img src="https://1088849411-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F5ukgSPDBOdbQp4FYtbz1%2Fuploads%2FljxWpvp5lfMc2rakqVoN%2FScreenshot%202025-07-11%20at%204.39.05%E2%80%AFPM.png?alt=media&amp;token=898ed61e-9214-4af7-995a-73590fc5abde" alt=""><figcaption></figcaption></figure>
{% endtab %}
{% endtabs %}

If the platform provides user language data, this will be the language set by the user on the platform. If not, it will be the browser language.

Format: ISO 639-1. Example: `ru`, `en`.

<details>

<summary>Platform support · all 25 platforms</summary>

**Supports:** `crazy_games`, `discord`, `dlightek`, `facebook`, `game_distribution`, `gamepush`, `gamesnacks`, `huawei`, `jio_games`, `lagged`, `microsoft_store`, `msn`, `ok`, `playgama`, `poki`, `portal`, `reddit`, `samsung`, `telegram`, `tiktok`, `vk`, `xiaomi`, `y8`, `yandex`, `youtube`

</details>

## Sending a Message to the Platform

Send lifecycle messages to the host platform. `game_ready` is required; the other messages help the platform understand gameplay state.

{% tabs %}
{% tab title="Plain JS" %}

```javascript
bridge.platform.sendMessage("game_ready")
```

{% endtab %}

{% tab title="Unity" %}

```java
Bridge.platform.SendMessage(PlatformMessage.GameReady)
```

{% endtab %}

{% tab title="Construct 3" %}
Add the PlaygamaBridge **Send Message to Platform** action and pick a message from the list (see the table below). Send **Game Ready** once the first playable frame is ready.

<details>

<summary>Copy This Example</summary>

```
{"is-c3-clipboard-data":true,"type":"events","items":[{"eventType":"block","conditions":[{"id":"on-start-of-layout","objectClass":"System"}],"actions":[{"id":"send-message","objectClass":"PlaygamaBridge","parameters":{"message":"game-ready"}}]}]}
```

</details>
{% endtab %}

{% tab title="GDevelop" %}
Add the **Send Message** action and pick a message from the list (see the table below). Send **Game Ready** once the first playable frame is ready.

<details>

<summary>Copy This Example</summary>

```
{"000kind":"GDEVELOP_EventsAndInstructions_CLIPBOARD_KIND-jsBdHbLy912y8Rc","content":{"eventsList":[{"type":"BuiltinCommonInstructions::Standard","conditions":[],"actions":[{"type":{"value":"PlaygamaBridge::SendMessage"},"parameters":["","\"GAME_READY\""]}]}],"eventsCount":1,"actionsList":[],"actionsCount":0,"conditionsList":[],"conditionsCount":0}}
```

</details>
{% endtab %}

{% tab title="Godot" %}

```gdscript
Bridge.platform.send_message("game_ready")
```

To use constants for convenience:

```gdscript
Bridge.platform.send_message(Bridge.PlatformMessage.GAME_READY)
```

{% endtab %}

{% tab title="GameMaker" %}

```javascript
playgama_bridge_platform_send_message("game_ready")
```

{% endtab %}

{% tab title="Defold" %}

```javascript
bridge.platform.send_message("game_ready")
```

{% endtab %}

{% tab title="Cocos Creator" %}

```javascript
sendGameReadyMessage() {
    bridge.platform.sendMessage(PLATFORM_MESSAGE.GAME_READY)
        .then(() => {
            console.log("Game ready message sent.");
        })
        .catch((error) => {
            console.error("Failed to send game ready message:", error);
        });
}
```

{% endtab %}

{% tab title="Scratch" %}

<figure><img src="https://1088849411-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F5ukgSPDBOdbQp4FYtbz1%2Fuploads%2FBdvWKX7SylrwENvusUda%2FScreenshot%202025-07-11%20at%204.41.19%E2%80%AFPM.png?alt=media&amp;token=8ffb97f5-38ae-4d44-a010-09b7cf4f43ef" alt=""><figcaption></figcaption></figure>
{% endtab %}
{% endtabs %}

<table><thead><tr><th width="225.51953125">Message</th><th>Parameters</th><th>Description</th></tr></thead><tbody><tr><td>game_ready</td><td>No parameters</td><td>The game has loaded, all loading screens have passed, the player can interact with the game.</td></tr><tr><td>in_game_loading_started</td><td>No parameters</td><td>Any loading within the game has started. For example, when a level is loading.</td></tr><tr><td>in_game_loading_stopped</td><td>No parameters</td><td>In-game loading has finished.</td></tr><tr><td>player_got_achievement</td><td>No parameters</td><td>The player reached a significant moment. For example, defeating a boss, setting a record, etc.</td></tr><tr><td>level_started</td><td>optional <code>"world"</code> and <code>"level"</code>, example:<br><code>{"world":"desert","level":"1"}</code></td><td>Gameplay has started. For example, the player has entered a level from the main menu.</td></tr><tr><td>level_completed</td><td>optional <code>"world"</code> and <code>"level"</code>, example:<br><code>{"world":"desert","level":"1"}</code></td><td>Gameplay has completed. For example, the player won level.</td></tr><tr><td>level_failed</td><td>optional <code>"world"</code> and <code>"level"</code>, example:<br><code>{"world":"desert","level":"1"}</code></td><td>Gameplay has failed. For example, the player lost level.</td></tr><tr><td>level_paused</td><td>optional <code>"world"</code> and <code>"level"</code>, example:<br><code>{"world":"desert","level":"1"}</code></td><td>Gameplay has paused. Opened settings menu or used pause button</td></tr><tr><td>level_resumed</td><td>optional <code>"world"</code> and <code>"level"</code>, example:<br><code>{"world":"desert","level":"1"}</code></td><td>Gameplay has resumed. Returned from settings menu or hit unpause button</td></tr></tbody></table>

<details>

<summary>Platform support · varies by message</summary>

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

</details>

## Sending a Custom Message

Sends a message with an id of your own, for game events the built-in list does not cover — `shop_opened`, `boss_defeated`, `settings_closed`. Bridge treats it like a built-in message:

* the message is recorded in Bridge analytics under its id;
* it triggers the matching [Advanced Banners](/playgama/bridge-sdk/api/advertisement/advanced-banners.md#show-hide-via-platform-messages) placement, if the [config](/playgama/bridge-sdk/config.md) declares one;
* it shows an interstitial when the id is listed in `advertisement.interstitial.autoShow` in the config.

This is what makes banners and interstitials follow your own game flow without extra show/hide calls.

{% hint style="info" %}
Platform SDKs do not receive custom messages — no platform defines messages of its own, so the call is resolved inside Bridge. Keep using [built-in messages](#sending-a-message-to-the-platform) for lifecycle reporting, `game_ready` above all.
{% endhint %}

{% hint style="warning" %}
A custom message carries its id and nothing else. Analytics records the id; any extra data passed to the call is ignored — it reaches neither analytics nor the platform.
{% endhint %}

{% tabs %}
{% tab title="Plain JS" %}

```javascript
bridge.platform.sendCustomMessage('shop_opened')
```

{% endtab %}

{% tab title="Unity" %}

```csharp
Bridge.platform.SendCustomMessage("shop_opened");
```

{% endtab %}

{% tab title="Construct 3" %}
Add the PlaygamaBridge **Send Custom Message to Platform** action and type your own id.

<details>

<summary>Copy This Example</summary>

```
{"is-c3-clipboard-data":true,"type":"events","items":[{"eventType":"block","conditions":[{"id":"on-clicked","objectClass":"Button"}],"actions":[{"id":"send-custom-message","objectClass":"PlaygamaBridge","parameters":{"id":"\"shop_opened\""}}]}]}
```

</details>
{% endtab %}

{% tab title="GDevelop" %}
Add the **Send Custom Message** action and type your own id.

<details>

<summary>Copy This Example</summary>

```
{"000kind":"GDEVELOP_EventsAndInstructions_CLIPBOARD_KIND-jsBdHbLy912y8Rc","content":{"eventsList":[{"type":"BuiltinCommonInstructions::Standard","conditions":[{"type":{"value":"PanelSpriteButton::PanelSpriteButton::IsClicked"},"parameters":["Button",""]}],"actions":[{"type":{"value":"PlaygamaBridge::SendCustomMessage"},"parameters":["","\"shop_opened\"",""]}]}],"eventsCount":1,"actionsList":[],"actionsCount":0,"conditionsList":[],"conditionsCount":0}}
```

</details>
{% endtab %}

{% tab title="Godot" %}

```gdscript
Bridge.platform.send_custom_message("shop_opened")
```

{% endtab %}

{% tab title="GameMaker" %}

```javascript
playgama_bridge_platform_send_custom_message("shop_opened", "")
```

{% endtab %}

{% tab title="Defold" %}

```lua
bridge.platform.send_custom_message("shop_opened")
```

{% endtab %}

{% tab title="Cocos Creator" %}

```typescript
bridge.platform.sendCustomMessage('shop_opened')
```

{% endtab %}

{% tab title="Scratch" %}
Use the `send custom message [id] to platform with data [data]` block and leave `data` empty — the field is not forwarded anywhere.
{% endtab %}
{% endtabs %}

## Is Audio Enabled

Returns whether the host platform currently allows game audio.

{% hint style="warning" %}
On game start, check the current value and mute the game audio if it is `false`. Subscribing to the event alone is not enough — it only fires on subsequent changes, so the initial state must be applied manually.
{% endhint %}

{% tabs %}
{% tab title="Plain JS" %}

```javascript
bridge.platform.isAudioEnabled
```

```javascript
// Listen for state changes
bridge.platform.on(bridge.EVENT_NAME.AUDIO_STATE_CHANGED, isEnabled => {
    console.log('Is audio enabled:', isEnabled);
});
```

{% endtab %}

{% tab title="Unity" %}

```csharp
Bridge.platform.isAudioEnabled
```

```javascript
// Listen for state changes
private void Start()
{
    Bridge.platform.audioStateChanged += OnAudioStateChanged;
}

private void OnAudioStateChanged(bool isEnabled)
{
    // audio state changed
}
```

{% endtab %}

{% tab title="Construct 3" %}
On game start, check the **Is Platform Audio Enabled** condition and mute the game if it is false. React to later changes with the **On Platform Audio State Changed** trigger condition (re-check **Is Platform Audio Enabled** inside it).

<details>

<summary>Copy This Example</summary>

```
{"is-c3-clipboard-data":true,"type":"events","items":[{"eventType":"block","conditions":[{"id":"on-platform-audio-state-changed","objectClass":"PlaygamaBridge"}],"actions":[],"children":[{"eventType":"block","conditions":[{"id":"is-platform-audio-enabled","objectClass":"PlaygamaBridge"}],"actions":[{"type":"comment","text":"audio enabled — unmute"}]}]}]}
```

</details>
{% endtab %}

{% tab title="GDevelop" %}
On game start, check the **Platform Is Audio Enabled** condition and mute the game if it is false. React to later changes with the **Platform On Audio State Changed** trigger condition (re-check **Platform Is Audio Enabled** inside it).

<details>

<summary>Copy This Example</summary>

```
{"000kind":"GDEVELOP_EventsAndInstructions_CLIPBOARD_KIND-jsBdHbLy912y8Rc","content":{"eventsList":[{"type":"BuiltinCommonInstructions::Standard","conditions":[{"type":{"value":"PlaygamaBridge::PlatformOnAudioStateChanged"},"parameters":[""]}],"actions":[],"events":[{"type":"BuiltinCommonInstructions::Standard","conditions":[{"type":{"value":"PlaygamaBridge::PlatformIsAudioEnabled"},"parameters":[""]}],"actions":[{"type":{"value":"DebuggerTools::ConsoleLog"},"parameters":["\"Audio enabled — unmute\"","\"info\"",""]}]}]}],"eventsCount":1,"actionsList":[],"actionsCount":0,"conditionsList":[],"conditionsCount":0}}
```

</details>
{% endtab %}

{% tab title="Godot" %}

```gdscript
Bridge.platform.is_audio_enabled
```

{% tabs %}
{% tab title="Godot 3.x" %}

```gdscript
# Listen for state changes
func _ready():
    Bridge.platform.connect("audio_state_changed", self, "_on_audio_state_changed")

func _on_audio_state_changed(is_enabled):
    print(is_enabled)
```

{% endtab %}

{% tab title="Godot 4.x" %}

```gdscript
# Listen for state changes
func _ready():
    Bridge.platform.connect("audio_state_changed", Callable(self, "_on_audio_state_changed"))

func _on_audio_state_changed(is_enabled):
    print(is_enabled)
```

{% endtab %}
{% endtabs %}
{% endtab %}

{% tab title="GameMaker" %}

```javascript
playgama_bridge_platform_is_audio_enabled()
```

```javascript
// Listen for state changes

// via Async Social Event
if async_load[? "type"] == "playgama_bridge_platform_audio_state_changed" {
    if async_load[? "data"] {
        // audio enabled
    } else {
        // audio disabled
    }
}
```

{% endtab %}

{% tab title="Defold" %}

```lua
bridge.platform.is_audio_enabled()
```

```javascript
// Listen for state changes
local bridge = require("bridge.bridge")

function init(self)
    bridge.platform.on("audio_state_changed", function (_, is_enabled)
        print("Is audio enabled: ", is_enabled)
    end)
end
```

{% endtab %}

{% tab title="Cocos Creator" %}

```javascript
bridge.platform.isAudioEnabled
```

```javascript
// Listen for state changes
bridge.platform.on(EVENT_NAME.AUDIO_STATE_CHANGED, this.onAudioStateChanged.bind(this));

onAudioStateChanged(isEnabled) {
    console.log("Is audio enabled: ", isEnabled);
}
```

{% endtab %}

{% tab title="Scratch" %}

<figure><img src="https://1088849411-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F5ukgSPDBOdbQp4FYtbz1%2Fuploads%2FVYqbXIbIrloLdvbycpVB%2FScreenshot%202025-07-25%20at%2010.10.01%E2%80%AFAM.png?alt=media&amp;token=50261047-2cac-4b20-be76-af0a98a7a375" alt=""><figcaption></figcaption></figure>
{% endtab %}
{% endtabs %}

<details>

<summary>Platform support · all 25 platforms</summary>

**Supports:** `crazy_games`, `discord`, `dlightek`, `facebook`, `game_distribution`, `gamepush`, `gamesnacks`, `huawei`, `jio_games`, `lagged`, `microsoft_store`, `msn`, `ok`, `playgama`, `poki`, `portal`, `reddit`, `samsung`, `telegram`, `tiktok`, `vk`, `xiaomi`, `y8`, `yandex`, `youtube`

</details>

## Pause

Listen for host pause/resume requests. Pause gameplay, timers, and audio while `isPaused` is `true`.

{% tabs %}
{% tab title="Plain JS" %}

```javascript
// Listen for state changes
bridge.platform.on(bridge.EVENT_NAME.PAUSE_STATE_CHANGED, isPaused => {
    console.log('Is paused:', isPaused);
});
```

{% endtab %}

{% tab title="Unity" %}

```javascript
// Listen for state changes
private void Start()
{
    Bridge.platform.pauseStateChanged += OnPauseStateChanged;
}

private void OnPauseStateChanged(bool isPaused)
{
    // pause state changed
}
```

{% endtab %}

{% tab title="Construct 3" %}
React to host pause/resume with the **On Platform Pause State Changed** trigger condition, and read the current state with the **Is Platform Paused** condition. Pause gameplay, timers, and audio while paused.

<details>

<summary>Copy This Example</summary>

```
{"is-c3-clipboard-data":true,"type":"events","items":[{"eventType":"block","conditions":[{"id":"on-platform-pause-state-changed","objectClass":"PlaygamaBridge"}],"actions":[],"children":[{"eventType":"block","conditions":[{"id":"is-platform-paused","objectClass":"PlaygamaBridge"}],"actions":[{"type":"comment","text":"paused — pause gameplay"}]}]}]}
```

</details>
{% endtab %}

{% tab title="GDevelop" %}
React to host pause/resume with the **Platform On Pause State Changed** trigger condition, and read the current state with the **Platform Is Paused** condition. Pause gameplay, timers, and audio while paused.

<details>

<summary>Copy This Example</summary>

```
{"000kind":"GDEVELOP_EventsAndInstructions_CLIPBOARD_KIND-jsBdHbLy912y8Rc","content":{"eventsList":[{"type":"BuiltinCommonInstructions::Standard","conditions":[{"type":{"value":"PlaygamaBridge::PlatformOnPauseStateChanged"},"parameters":[""]}],"actions":[],"events":[{"type":"BuiltinCommonInstructions::Standard","conditions":[{"type":{"value":"PlaygamaBridge::PlatformIsPaused"},"parameters":[""]}],"actions":[{"type":{"value":"DebuggerTools::ConsoleLog"},"parameters":["\"Paused — pause gameplay\"","\"info\"",""]}]}]}],"eventsCount":1,"actionsList":[],"actionsCount":0,"conditionsList":[],"conditionsCount":0}}
```

</details>
{% endtab %}

{% tab title="Godot" %}
{% tabs %}
{% tab title="Godot 3.x" %}

```gdscript
# Listen for state changes
func _ready():
    Bridge.platform.connect("pause_state_changed", self, "_on_pause_state_changed")

func _on_pause_state_changed(is_paused):
    print(is_paused)
```

{% endtab %}

{% tab title="Godot 4.x" %}

```gdscript
# Listen for state changes
func _ready():
    Bridge.platform.connect("pause_state_changed", Callable(self, "_on_pause_state_changed"))

func _on_pause_state_changed(is_paused):
    print(is_paused)
```

{% endtab %}
{% endtabs %}
{% endtab %}

{% tab title="GameMaker" %}

```javascript
// Listen for state changes

// via Async Social Event
if async_load[? "type"] == "playgama_bridge_platform_pause_state_changed" {
    if async_load[? "data"] {
        // paused
    } else {
        // resumed
    }
}
```

{% endtab %}

{% tab title="Defold" %}

```javascript
// Listen for state changes
local bridge = require("bridge.bridge")

function init(self)
    bridge.platform.on("pause_state_changed", function (_, is_paused)
        print("Is paused: ", is_paused)
    end)
end
```

{% endtab %}

{% tab title="Cocos Creator" %}

```javascript
// Listen for state changes
bridge.platform.on(EVENT_NAME.PAUSE_STATE_CHANGED, this.onPauseStateChanged.bind(this));

onPauseStateChanged(isPaused) {
    console.log("Is paused: ", isPaused);
}
```

{% endtab %}

{% tab title="Scratch" %}

<figure><img src="https://1088849411-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F5ukgSPDBOdbQp4FYtbz1%2Fuploads%2FRNOK4c1fpD6OAwaOOi4I%2FScreenshot%202025-07-25%20at%2010.10.34%E2%80%AFAM.png?alt=media&amp;token=e1921af8-f470-4083-aee4-c7bf0c6508d4" alt=""><figcaption></figcaption></figure>
{% endtab %}
{% endtabs %}

<details>

<summary>Platform support · all 25 platforms</summary>

**Supports:** `crazy_games`, `discord`, `dlightek`, `facebook`, `game_distribution`, `gamepush`, `gamesnacks`, `huawei`, `jio_games`, `lagged`, `microsoft_store`, `msn`, `ok`, `playgama`, `poki`, `portal`, `reddit`, `samsung`, `telegram`, `tiktok`, `vk`, `xiaomi`, `y8`, `yandex`, `youtube`

</details>

## Platform ID

{% tabs %}
{% tab title="Plain JS" %}

```javascript
bridge.platform.id
```

{% endtab %}

{% tab title="Unity" %}

```java
Bridge.platform.id
```

{% endtab %}

{% tab title="Construct 3" %}

```javascript
PlaygamaBridge.PlatformId
```

{% endtab %}

{% tab title="GDevelop" %}

```javascript
PlaygamaBridge::PlatformId()
```

{% endtab %}

{% tab title="Godot" %}

```gdscript
Bridge.platform.id
```

{% endtab %}

{% tab title="GameMaker" %}

```javascript
playgama_bridge_platform_id()
```

{% endtab %}

{% tab title="Defold" %}

```lua
bridge.platform.id()
```

{% endtab %}

{% tab title="Cocos Creator" %}

```typescript
bridge.platform.id
```

{% endtab %}

{% tab title="Scratch" %}

<figure><img src="https://1088849411-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F5ukgSPDBOdbQp4FYtbz1%2Fuploads%2F6AzQ07IHfokBmNJSmbXz%2FScreenshot%202025-07-11%20at%204.38.17%E2%80%AFPM.png?alt=media&amp;token=3535665c-b130-4089-bab1-412ceed1d800" alt=""><figcaption></figcaption></figure>
{% endtab %}
{% endtabs %}

Returns the ID of the platform on which the game is currently running.

<details>

<summary>Platform support · all 25 platforms</summary>

**Supports:** `crazy_games`, `discord`, `dlightek`, `facebook`, `game_distribution`, `gamepush`, `gamesnacks`, `huawei`, `jio_games`, `lagged`, `microsoft_store`, `msn`, `ok`, `playgama`, `poki`, `portal`, `reddit`, `samsung`, `telegram`, `tiktok`, `vk`, `xiaomi`, `y8`, `yandex`, `youtube`

</details>

## URL Parameter

Read optional launch data passed through the platform URL. Use it for referral codes, deep links, invited-user context, or other launch parameters.

{% tabs %}
{% tab title="Plain JS" %}

```javascript
bridge.platform.payload
```

{% endtab %}

{% tab title="Unity" %}

```java
Bridge.platform.payload
```

{% endtab %}

{% tab title="Construct 3" %}

```javascript
PlaygamaBridge.PlatformPayload
```

{% endtab %}

{% tab title="GDevelop" %}

```javascript
PlaygamaBridge::PlatformPayload()
```

{% endtab %}

{% tab title="Godot" %}

```gdscript
Bridge.platform.payload
```

{% endtab %}

{% tab title="GameMaker" %}

```javascript
playgama_bridge_platform_payload()
```

{% endtab %}

{% tab title="Defold" %}

```lua
bridge.platform.payload()
```

{% endtab %}

{% tab title="Cocos Creator" %}

```typescript
bridge.platform.payload
```

{% endtab %}

{% tab title="Scratch" %}

<figure><img src="https://1088849411-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F5ukgSPDBOdbQp4FYtbz1%2Fuploads%2FtFR3cMkeVTspCjLUDYnu%2FScreenshot%202025-07-11%20at%204.39.46%E2%80%AFPM.png?alt=media&amp;token=c090d78f-baec-4c80-a699-89d02fdbefc6" alt=""><figcaption></figcaption></figure>
{% endtab %}
{% endtabs %}

The payload works only on platforms that pass it into the game URL. The exact URL format is platform-specific:

| Platform    | URL Format                                                           |
| ----------- | -------------------------------------------------------------------- |
| Playgama    | playgama.com/game/game\_nam&#x65;**?payload=your-info**              |
| VK          | <http://vk.com/game\\_i&#x64;**#your-info>\*\*                       |
| Yandex      | <http://yandex.com/games/app/game\\_i&#x64;**?payload=your-info>\*\* |
| Crazy Games | crazygames.com/game/game\_nam&#x65;**?payload=your-info**            |

On any other platform there is no way to pass the payload through the URL, so the value is `null`.

{% hint style="info" %}
The same property also delivers the payload of the [notification](/playgama/bridge-sdk/api/notifications.md) the game was launched from, on platforms that support notifications, and the payload attached to a post with [`createPost(id, payload)`](/playgama/bridge-sdk/api/social.md#create-post). There the value does not come from the URL, so the table above does not apply to it.
{% endhint %}

<details>

<summary>Platform support · 5 of 25 platforms</summary>

**Supports:** `crazy_games`, `playgama`, `reddit`, `vk`, `yandex`

**Does not support:** `discord`, `dlightek`, `facebook`, `game_distribution`, `gamepush`, `gamesnacks`, `huawei`, `jio_games`, `lagged`, `microsoft_store`, `msn`, `ok`, `poki`, `portal`, `samsung`, `telegram`, `tiktok`, `xiaomi`, `y8`, `youtube`

</details>

## Launch Source

Tells where the game was opened from: `notification` for a [scheduled notification](/playgama/bridge-sdk/api/notifications.md), `post` for one of the game's own [posts](/playgama/bridge-sdk/api/social.md#create-post). It is `null` on an ordinary launch, which is the common case — treat anything else as a bonus path, never as a requirement.

{% tabs %}
{% tab title="Plain JS" %}

```javascript
bridge.platform.launchSource
```

{% endtab %}

{% tab title="Unity" %}

```java
Bridge.platform.launchSource
```

{% endtab %}

{% tab title="Construct 3" %}

```javascript
PlaygamaBridge.PlatformLaunchSource
```

{% endtab %}

{% tab title="GDevelop" %}

```javascript
PlaygamaBridge::PlatformLaunchSource()
```

{% endtab %}

{% tab title="Godot" %}

```gdscript
Bridge.platform.launch_source
```

{% endtab %}

{% tab title="GameMaker" %}

```javascript
playgama_bridge_platform_launch_source()
```

{% endtab %}

{% tab title="Defold" %}

```lua
bridge.platform.launch_source()
```

{% endtab %}

{% tab title="Cocos Creator" %}

```typescript
bridge.platform.launchSource
```

{% endtab %}
{% endtabs %}

## Launch Data

Everything the launch carries, as key-value pairs: the parameters the platform passed to the game, plus `postId` — the id of the [`social.posts`](/playgama/bridge-sdk/api/social.md#content-by-id) entry the post was created from — when the game was opened from a post. Together with [`payload`](#url-parameter) this is what lets a game restore what was shared: the entry says which kind of post it is, the payload carries the level, seed or challenge itself.

{% tabs %}
{% tab title="Plain JS" %}

```javascript
bridge.platform.data.postId
```

{% endtab %}

{% tab title="Unity" %}

```csharp
Bridge.platform.data["postId"]
```

{% endtab %}

{% tab title="Construct 3" %}

```javascript
PlaygamaBridge.PlatformDataValue("postId")
```

`PlaygamaBridge.PlatformDataAsJSON` returns everything at once.
{% endtab %}

{% tab title="GDevelop" %}

```javascript
PlaygamaBridge::PlatformDataValue("postId")
```

`PlaygamaBridge::PlatformDataAsJSON()` returns everything at once.
{% endtab %}

{% tab title="Godot" %}

```gdscript
Bridge.platform.data.postId
```

{% endtab %}

{% tab title="GameMaker" %}

```javascript
var data = json_parse(playgama_bridge_platform_data())
var postId = data.postId
```

{% endtab %}

{% tab title="Defold" %}

```lua
local data = bridge.platform.data()
local post_id = data.postId
```

{% endtab %}

{% tab title="Cocos Creator" %}

```typescript
bridge.platform.data.postId
```

{% endtab %}
{% endtabs %}

## Server Time

Returns trusted UTC server time. Use it for daily rewards, cooldowns, or time-limited offers where local device time is not reliable.

{% hint style="warning" %}
Server time is fetched via an external HTTP request, so it is unavailable on platforms that block external calls ([Is External Calls Supported](#is-external-calls-supported) is `false`) — the request fails there.
{% endhint %}

{% tabs %}
{% tab title="Plain JS" %}

```javascript
bridge.platform.getServerTime()
    .then(result => {
        console.log(result) // UTC time in milliseconds
    })
    .catch(error => {
        console.log(error)
    })
```

{% endtab %}

{% tab title="Unity" %}

```csharp
private void Start()
{
    Bridge.platform.GetServerTime(OnGetServerTimeCompleted);
}

private void OnGetServerTimeCompleted(DateTime? result)
{
    if (result.HasValue)
    {
        Debug.Log(result.Value); // UTC time
    }
}
```

{% endtab %}

{% tab title="Construct 3" %}
In the event sheet:

1. On a trigger (e.g. **Button → On clicked**), add the **Get Server Time** action.
2. Add the **On Get Server Time Completed** condition. Inside it, check **Has Server Time** and read the `PlaygamaBridge.ServerTime` expression (UTC time in milliseconds).

<details>

<summary>Copy This Example</summary>

```
{"is-c3-clipboard-data":true,"type":"events","items":[{"eventType":"block","conditions":[{"id":"on-clicked","objectClass":"Button"}],"actions":[{"id":"get-server-time","objectClass":"PlaygamaBridge"}]},{"eventType":"block","conditions":[{"id":"on-get-server-time-completed","objectClass":"PlaygamaBridge"}],"actions":[],"children":[{"eventType":"block","conditions":[{"id":"has-server-time","objectClass":"PlaygamaBridge"}],"actions":[{"id":"log","objectClass":"Browser","parameters":{"type":"log","message":"PlaygamaBridge.ServerTime"}}]}]}]}
```

</details>
{% endtab %}

{% tab title="GDevelop" %}
In the events sheet:

1. On a trigger (e.g. **Button is clicked**), add the **Get Server Time** action.
2. Add the **On Get Server Time Completed** condition. Inside it, check **Has Server Time** and read the `PlaygamaBridge::ServerTime()` expression (UTC time in milliseconds).

<details>

<summary>Copy This Example</summary>

```
{"000kind":"GDEVELOP_EventsAndInstructions_CLIPBOARD_KIND-jsBdHbLy912y8Rc","content":{"eventsList":[{"type":"BuiltinCommonInstructions::Standard","conditions":[{"type":{"value":"PanelSpriteButton::PanelSpriteButton::IsClicked"},"parameters":["Button",""]}],"actions":[{"type":{"value":"PlaygamaBridge::GetServerTime"},"parameters":["",""]}]},{"type":"BuiltinCommonInstructions::Standard","conditions":[{"type":{"value":"PlaygamaBridge::OnGetServerTimeCompleted"},"parameters":["",""]}],"actions":[],"events":[{"type":"BuiltinCommonInstructions::Standard","conditions":[{"type":{"value":"PlaygamaBridge::HasServerTime"},"parameters":["",""]}],"actions":[{"type":{"value":"DebuggerTools::ConsoleLog"},"parameters":["ToString(PlaygamaBridge::ServerTime())","\"info\"",""]}]}]}],"eventsCount":2,"actionsList":[],"actionsCount":0,"conditionsList":[],"conditionsCount":0}}
```

</details>
{% endtab %}

{% tab title="Godot" %}
{% tabs %}
{% tab title="Godot 3.x" %}

```gdscript
func _ready():
    Bridge.platform.get_server_time(funcref(self, "_on_get_server_time_completed"))
	
func _on_get_server_time_completed(result):
    print(result) # UTC time in milliseconds
```

{% endtab %}

{% tab title="Godot 4.x" %}

```gdscript
func _ready():
    Bridge.platform.get_server_time(Callable(self, "_on_get_server_time_completed"))

func _on_get_server_time_completed(result):
    print(result) # UTC time in milliseconds
```

{% endtab %}
{% endtabs %}
{% endtab %}

{% tab title="GameMaker" %}

```javascript
playgama_bridge_platform_get_server_time()

// callback via Async Social Event
if async_load[? "type"] == "playgama_bridge_platform_get_server_time_callback" {
    if async_load[? "success"] {
        var server_time = async_load[? "data"]
    }
}
```

{% endtab %}

{% tab title="Defold" %}

```lua
local bridge = require("bridge.bridge")

function init(self)
	bridge.platform.get_server_time(function (_, data)
		print("Server time: ", data)
	end, 
	function ()
		-- error
	end)
end
```

{% endtab %}

{% tab title="Cocos Creator" %}

```javascript
getServerTime(){
    bridge.platform.getServerTime()
        .then((time) => {
            console.log("Server time: ", time);
        })
        .catch((error) => {
            console.error("Failed to get server time:", error);
        });
}
```

{% endtab %}
{% endtabs %}

<details>

<summary>Platform support · 19 of 25 platforms</summary>

**Supports:** `crazy_games`, `discord`, `dlightek`, `gamepush`, `huawei`, `jio_games`, `lagged`, `microsoft_store`, `msn`, `ok`, `playgama`, `portal`, `samsung`, `telegram`, `tiktok`, `vk`, `xiaomi`, `y8`, `yandex`

**Does not support:** `facebook`, `game_distribution`, `gamesnacks`, `poki`, `reddit`, `youtube`

</details>

## Native SDK

Returns the original platform SDK object when Bridge exposes it. Use it only for platform-specific features that Bridge does not wrap.

{% tabs %}
{% tab title="Plain JS" %}

```javascript
bridge.platform.sdk
```

{% endtab %}
{% endtabs %}

## Domain Information

Returns the platform top-level domain when the host provides it. Use it for regional links, legal text, or domain-specific configuration.

{% tabs %}
{% tab title="Plain JS" %}

```javascript
bridge.platform.tld
```

{% endtab %}

{% tab title="Unity" %}

```java
Bridge.platform.tld
```

{% endtab %}

{% tab title="Construct 3" %}

```javascript
PlaygamaBridge.PlatformTld
```

{% endtab %}

{% tab title="GDevelop" %}

```javascript
PlaygamaBridge::PlatformTld()
```

{% endtab %}

{% tab title="Godot" %}

```gdscript
Bridge.platform.tld
```

{% endtab %}

{% tab title="GameMaker" %}

```javascript
playgama_bridge_platform_tld()
```

{% endtab %}

{% tab title="Defold" %}

```lua
bridge.platform.tld()
```

{% endtab %}

{% tab title="Cocos Creator" %}

```typescript
bridge.platform.tld
```

{% endtab %}

{% tab title="Scratch" %}

<figure><img src="https://1088849411-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F5ukgSPDBOdbQp4FYtbz1%2Fuploads%2FtFR3cMkeVTspCjLUDYnu%2FScreenshot%202025-07-11%20at%204.39.46%E2%80%AFPM.png?alt=media&amp;token=c090d78f-baec-4c80-a699-89d02fdbefc6" alt=""><figcaption></figcaption></figure>
{% endtab %}
{% endtabs %}

Returns `null` when no data is available; otherwise returns a TLD such as `com` or `ru`.

<details>

<summary>Platform support · 1 of 25 platforms</summary>

**Supports:** `yandex`

**Does not support:** `crazy_games`, `discord`, `dlightek`, `facebook`, `game_distribution`, `gamepush`, `gamesnacks`, `huawei`, `jio_games`, `lagged`, `microsoft_store`, `msn`, `ok`, `playgama`, `poki`, `portal`, `reddit`, `samsung`, `telegram`, `tiktok`, `vk`, `xiaomi`, `y8`, `youtube`

</details>

## Is External Calls Supported

Returns whether the platform environment allows the game to make external HTTP requests (your own backend, third-party services). Some platforms run games in a sandbox that blocks outgoing requests — check this flag before relying on any external service.

{% tabs %}
{% tab title="Plain JS" %}

```javascript
bridge.platform.isExternalCallsSupported
```

{% endtab %}

{% tab title="Unity" %}

```csharp
Bridge.platform.isExternalCallsSupported
```

{% endtab %}

{% tab title="Construct 3" %}
Use the PlaygamaBridge condition `Is Platform External Calls Supported`.
{% endtab %}

{% tab title="GDevelop" %}
Use the PlaygamaBridge condition `Is External Calls Supported`.
{% endtab %}

{% tab title="Godot" %}

```gdscript
Bridge.platform.is_external_calls_supported
```

{% endtab %}

{% tab title="GameMaker" %}

```javascript
playgama_bridge_platform_is_external_calls_supported()
```

{% endtab %}

{% tab title="Defold" %}

```lua
bridge.platform.is_external_calls_supported()
```

{% endtab %}

{% tab title="Cocos Creator" %}

```typescript
bridge.platform.isExternalCallsSupported
```

{% endtab %}
{% endtabs %}

<details>

<summary>Platform support · 19 of 25 platforms</summary>

**Supports:** `crazy_games`, `discord`, `dlightek`, `gamepush`, `huawei`, `jio_games`, `lagged`, `microsoft_store`, `msn`, `ok`, `playgama`, `portal`, `samsung`, `telegram`, `tiktok`, `vk`, `xiaomi`, `y8`, `yandex`

**Does not support:** `facebook`, `game_distribution`, `gamesnacks`, `poki`, `reddit`, `youtube`

</details>

## Is External Links Allowed

Returns whether the platform allows opening external links from the game. Hide buttons that lead outside the platform (your socials, other stores) when this is `false`.

{% tabs %}
{% tab title="Plain JS" %}

```javascript
bridge.platform.isExternalLinksAllowed
```

{% endtab %}

{% tab title="Unity" %}

```csharp
Bridge.platform.isExternalLinksAllowed
```

{% endtab %}

{% tab title="Construct 3" %}
Use the PlaygamaBridge **Is External Links Allowed** condition. Hide buttons that lead outside the platform when it is false.
{% endtab %}

{% tab title="GDevelop" %}
Use the PlaygamaBridge **Is External Links Allowed** condition. Hide buttons that lead outside the platform when it is false.
{% endtab %}

{% tab title="Godot" %}

```gdscript
Bridge.platform.is_external_links_allowed
```

{% endtab %}

{% tab title="GameMaker" %}

```javascript
playgama_bridge_platform_is_external_links_allowed()
```

{% endtab %}

{% tab title="Defold" %}

```lua
bridge.platform.is_external_links_allowed()
```

{% endtab %}

{% tab title="Cocos Creator" %}

```typescript
bridge.platform.isExternalLinksAllowed
```

{% endtab %}
{% endtabs %}

<details>

<summary>Platform support · 15 of 25 platforms</summary>

**Supports:** `crazy_games`, `discord`, `dlightek`, `facebook`, `gamepush`, `gamesnacks`, `huawei`, `lagged`, `microsoft_store`, `msn`, `portal`, `reddit`, `telegram`, `tiktok`, `vk`

**Does not support:** `game_distribution`, `jio_games`, `ok`, `playgama`, `poki`, `samsung`, `xiaomi`, `y8`, `yandex`, `youtube`

</details>
