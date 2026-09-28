> For the complete documentation index, see [llms.txt](https://wiki.playgama.com/playgama/llms.txt). Markdown versions of documentation pages are available by appending `.md` to page URLs; this page is available as [Markdown](https://wiki.playgama.com/playgama/bridge-sdk/api/leaderboards.md).

# Leaderboards

{% hint style="info" %}
You are reading the documentation for Bridge SDK **v2**. If you need the obsolete v1 documentation, see [Documentation (v1)](https://wiki.playgama.com/playgama/bridge-sdk-v1).
{% endhint %}

Leaderboards rank players by score. Bridge wraps native platform leaderboards and provides an in-game data API when the platform does not render a leaderboard UI. Implement it if your game has comparable scores.

## Leaderboards Type

Returns the leaderboard mode for the current platform. Use it to decide which leaderboard UI to show or hide.

{% tabs %}
{% tab title="Plain JS" %}

```javascript
bridge.leaderboards.type
```

{% endtab %}

{% tab title="Unity" %}

```csharp
Bridge.leaderboards.type
```

{% endtab %}

{% tab title="Construct 3" %}
Read the mode with the `PlaygamaBridge.LeaderboardsType` expression, or branch with the **Is Leaderboards Type = Not Available / In Game / Native / Native Popup** conditions.
{% endtab %}

{% tab title="GDevelop" %}
Read the mode with the `PlaygamaBridge::LeaderboardsType()` expression, or branch with the **The leaderboard is of type Not Available / In Game / Native / Native Popup** conditions.
{% endtab %}

{% tab title="Godot" %}

```gdscript
Bridge.leaderboards.type
```

{% endtab %}

{% tab title="GameMaker" %}

```javascript
playgama_bridge_leaderboards_type()
```

{% endtab %}

{% tab title="Defold" %}

```javascript
bridge.leaderboards.type
```

{% endtab %}

{% tab title="Cocos Creator" %}

```javascript
bridge.leaderboards.type
```

{% endtab %}
{% endtabs %}

| Type            | Game logic                                                                                                      |
| --------------- | --------------------------------------------------------------------------------------------------------------- |
| `not_available` | Hide leaderboard UI.                                                                                            |
| `in_game`       | Call `setScore(...)` and render your own leaderboard with `getEntries(...)`.                                    |
| `native`        | Call `setScore(...)` only. The platform renders the leaderboard, and `getEntries(...)` is unavailable.          |
| `native_popup`  | Call `setScore(...)` and open the native overlay with `showNativePopup(...)`. `getEntries(...)` is unavailable. |

<details>

<summary>Platform support · 8 of 25 platforms</summary>

**`in_game` supports:** `y8`, `yandex`

**`native` supports:** `gamesnacks`, `jio_games`, `lagged`, `msn`, `youtube`

**`native_popup` supports:** `facebook`

**Does not support:** `crazy_games`, `discord`, `dlightek`, `game_distribution`, `gamepush`, `huawei`, `microsoft_store`, `ok`, `playgama`, `poki`, `portal`, `reddit`, `samsung`, `telegram`, `tiktok`, `vk`, `xiaomi`

On top of the platform types, [SaaS leaderboards](/playgama/bridge-sdk/saas/leaderboards.md) can be enabled per platform via the `saas` config block — the module then works as `in_game` through the Playgama backend.

</details>

## Setup

Configure leaderboards in the [config](/playgama/bridge-sdk/config.md). Add an `id` for each leaderboard and use that ID in game code. If a platform uses a different native ID, map it under that platform key.

```json
{
    ...    
    "leaderboards": [
        {
            "id": "test_leaderboard", // use this id in game logic
            "isMain": true, // optional: marks the game's main leaderboard
            "<ANY_PLATFORM_ID_HERE>": "<OVERRIDED_ID_FOR_PLATFORM_HERE>"
        }
    ]
}
```

`isMain` matters on platforms with a single primary leaderboard (`jio_games`, `youtube`): only the score of the leaderboard marked `isMain: true` is submitted there.

## Set Score

Submit the player's score after a meaningful result, such as level completion or game over. Avoid submitting temporary or per-frame values.

{% tabs %}
{% tab title="Plain JS" %}

```javascript
let leaderboardId = "YOUR_LEADERBOARD_ID" // id that you specified in the config file
let score = 42

bridge.leaderboards.setScore(leaderboardId, score)
    .then(() => {
        // success
    })
    .catch(error => {
        // error
    })
```

{% endtab %}

{% tab title="Unity" %}

```csharp
private void Start()
{
    var leaderboardId = "YOUR_LEADERBOARD_ID"; // id that you specified in the config file
    var score = 42;
    Bridge.leaderboards.SetScore(leaderboardId, score, OnSetScoreCompleted);
}

private void OnSetScoreCompleted(bool success)
{
    if (success)
    {
        // Operation succeeded
    }
    else
    {
        // An error occurred
    }
}
```

{% endtab %}

{% tab title="Construct 3" %}
In the event sheet:

1. On a trigger (e.g. **System → On start of layout**), add the **Set Leaderboard Score** action (parameters: ID, Score).
2. Add the **On Leaderboards Set Score Completed** condition. Inside it, check **Is Last Action Completed Successfully** (with a **System → Else** branch for errors).

<details>

<summary>Copy This Example</summary>

```
{"is-c3-clipboard-data":true,"type":"events","items":[{"eventType":"block","conditions":[{"id":"on-start-of-layout","objectClass":"System"}],"actions":[{"id":"leaderboards-set-score","objectClass":"PlaygamaBridge","parameters":{"id":"\"YOUR_LEADERBOARD_ID_HERE\"","score":"42"}}]},{"eventType":"block","conditions":[{"id":"on-leaderboards-set-score-completed","objectClass":"PlaygamaBridge"}],"actions":[],"children":[{"eventType":"block","conditions":[{"id":"is-last-action-completed-successfully","objectClass":"PlaygamaBridge"}],"actions":[{"type":"comment","text":"success"}]},{"eventType":"block","conditions":[{"id":"else","objectClass":"System"}],"actions":[{"type":"comment","text":"error"}]}]}]}
```

</details>
{% endtab %}

{% tab title="GDevelop" %}
In the events sheet:

1. On a trigger (e.g. **At the beginning of the scene**), add the **Leaderboards Set Score** action (parameters: Id, Score).
2. Add the **On Leaderboards Set Score Completed** condition. Inside it, check **Is Last Action Completed Successfully**.

<details>

<summary>Copy This Example</summary>

```
{"000kind":"GDEVELOP_EventsAndInstructions_CLIPBOARD_KIND-jsBdHbLy912y8Rc","content":{"eventsList":[{"type":"BuiltinCommonInstructions::Standard","conditions":[],"actions":[{"type":{"value":"PlaygamaBridge::LeaderboardsSetScore"},"parameters":["","\"YOUR_LEADERBOARD_ID_HERE\"","42",""]}]},{"type":"BuiltinCommonInstructions::Standard","conditions":[{"type":{"value":"PlaygamaBridge::OnLeaderboardsSetScoreCompleted"},"parameters":["",""]}],"actions":[],"events":[{"type":"BuiltinCommonInstructions::Standard","conditions":[{"type":{"value":"PlaygamaBridge::IsLastActionCompletedSuccessfully"},"parameters":["",""]}],"actions":[{"type":{"value":"DebuggerTools::ConsoleLog"},"parameters":["\"success\"","\"info\"",""]}]}]}],"eventsCount":2,"actionsList":[],"actionsCount":0,"conditionsList":[],"conditionsCount":0}}
```

</details>
{% endtab %}

{% tab title="Godot" %}
{% tabs %}
{% tab title="Godot 3.x" %}

```gdscript
func _ready():
    var leaderboardId = "YOUR_LEADERBOARD_ID" # id that you specified in the config file
    var score = 42
    Bridge.leaderboards.set_score(leaderboardId, score, funcref(self, "_on_set_score_completed"))

func _on_set_score_completed(success):
    print(success)
```

{% endtab %}

{% tab title="Godot 4.x" %}

```gdscript
func _ready():
    var leaderboardId = "YOUR_LEADERBOARD_ID" # id that you specified in the config file
    var score = 42
    Bridge.leaderboards.set_score(leaderboardId, score, Callable(self, "_on_set_score_completed"))

func _on_set_score_completed(success):
    print(success)
```

{% endtab %}
{% endtabs %}
{% endtab %}

{% tab title="GameMaker" %}

```javascript
var leaderboardId = "YOUR_LEADERBOARD_ID" // id that you specified in the config file
var score = 42

playgama_bridge_leaderboards_set_score(leaderboardId, score)

// callback via Async Social Event
if async_load[? "type"] == "playgama_bridge_leaderboards_set_score_callback" {
    if async_load[? "success"] {
        // your logic
    }
}
```

{% endtab %}

{% tab title="Defold" %}

```lua
local bridge = require("bridge.bridge")

function init(self)
    local leaderboardId = "YOUR_LEADERBOARD_ID" -- id that you specified in the config file
    local score = 42

    bridge.leaderboards.set_score(leaderboardId, score, function ()
        -- success
    end, function ()
        -- error
    end)
end
```

{% endtab %}

{% tab title="Cocos Creator" %}

```javascript
let leaderboardId = "YOUR_LEADERBOARD_ID" // id that you specified in the config file
let score = 42

bridge.leaderboards.setScore(leaderboardId, score)
    .then(() => {
        // success
    })
    .catch(error => {
        // error
    })
```

{% endtab %}
{% endtabs %}

## Get Entries

{% hint style="info" %}
Works only when `bridge.leaderboards.type` = `in_game`
{% endhint %}

Load leaderboard entries when `leaderboards.type` is `in_game` and render them in your own UI.

{% tabs %}
{% tab title="Plain JS" %}

```javascript
let leaderboardId = "YOUR_LEADERBOARD_ID" // id that you specified in the config file

bridge.leaderboards.getEntries(leaderboardId)
    .then(entries => {
        entries.forEach(entry => {
            console.log('ID: ' + entry.id)
            console.log('Name: ' + entry.name)
            console.log('Photo: ' + entry.photo)
            console.log('Score: ' + entry.score)
            console.log('Rank: ' + entry.rank)
        })
    })
    .catch(error => {
        // error
    })
```

{% endtab %}

{% tab title="Unity" %}

```csharp
private void Start()
{
    var leaderboardId = "YOUR_LEADERBOARD_ID"; // id that you specified in the config file
    Bridge.leaderboards.GetEntries(leaderboardId, OnGetEntriesCompleted);
}

private void OnGetEntriesCompleted(bool success, List<Dictionary<string, string>> entries)
{
    Debug.Log($"OnGetEntriesCompleted, success: {success}, entries:");
    
    if (success)
    {
        foreach (var entry in entries)
        {
            Debug.Log("ID: " + entry["id"]);
            Debug.Log("Score: " + entry["score"]);
            Debug.Log("Rank: " + entry["rank"]);
            Debug.Log("Name: " + entry["name"]);
            Debug.Log("Photo: " + entry["photo"]);
        }
    }
}
```

{% endtab %}

{% tab title="Construct 3" %}
In the event sheet:

1. On a trigger (e.g. **System → On start of layout**), add the **Get Leaderboard Entries** action (parameter: ID).
2. Add the **On Leaderboards Get Entries Completed** condition. Inside it, when **Is Last Action Completed Successfully**, loop with **System → For** from `0` to `PlaygamaBridge.LeaderboardEntriesCount - 1` and read `LeaderboardEntryId`, `LeaderboardEntryName`, `LeaderboardEntryPhoto`, `LeaderboardEntryRank`, `LeaderboardEntryScore` at `loopindex`.

<details>

<summary>Copy This Example</summary>

```
{"is-c3-clipboard-data":true,"type":"events","items":[{"eventType":"block","conditions":[{"id":"on-start-of-layout","objectClass":"System"}],"actions":[{"id":"leaderboards-get-entries","objectClass":"PlaygamaBridge","parameters":{"id":"\"YOUR_LEADERBOARD_ID_HERE\""}}]},{"eventType":"block","conditions":[{"id":"on-leaderboards-get-entries-completed","objectClass":"PlaygamaBridge"}],"actions":[],"children":[{"eventType":"block","conditions":[{"id":"is-last-action-completed-successfully","objectClass":"PlaygamaBridge"}],"actions":[{"type":"comment","text":"success"}],"children":[{"eventType":"block","conditions":[{"id":"for","objectClass":"System","parameters":{"name":"\"\"","start-index":"0","end-index":"PlaygamaBridge.LeaderboardEntriesCount - 1"}}],"actions":[{"id":"log","objectClass":"Browser","parameters":{"type":"log","message":"\"ID: \" & PlaygamaBridge.LeaderboardEntryId(loopindex)"}},{"id":"log","objectClass":"Browser","parameters":{"type":"log","message":"\"Name: \" & PlaygamaBridge.LeaderboardEntryName(loopindex)"}},{"id":"log","objectClass":"Browser","parameters":{"type":"log","message":"\"Photo: \" & PlaygamaBridge.LeaderboardEntryPhoto(loopindex)"}},{"id":"log","objectClass":"Browser","parameters":{"type":"log","message":"\"Rank: \" & PlaygamaBridge.LeaderboardEntryRank(loopindex)"}},{"id":"log","objectClass":"Browser","parameters":{"type":"log","message":"\"Score: \" & PlaygamaBridge.LeaderboardEntryScore(loopindex)"}}]}]}]}]}
```

</details>
{% endtab %}

{% tab title="GDevelop" %}
In the events sheet:

1. On a trigger (e.g. **At the beginning of the scene**), add the **Leaderboards Get Entries** action (parameter: Id).
2. Add the **On Leaderboards Get Entries Completed** condition. Inside it, when **Is Last Action Completed Successfully**, **Repeat** `PlaygamaBridge::LeaderboardEntriesCount()` times and read `LeaderboardEntryId`, `LeaderboardEntryName`, `LeaderboardEntryPhoto`, `LeaderboardEntryRank`, `LeaderboardEntryScore` at the current index.

<details>

<summary>Copy This Example</summary>

```
{"000kind":"GDEVELOP_EventsAndInstructions_CLIPBOARD_KIND-jsBdHbLy912y8Rc","content":{"eventsList":[{"type":"BuiltinCommonInstructions::Standard","conditions":[],"actions":[{"type":{"value":"PlaygamaBridge::LeaderboardsGetEntries"},"parameters":["","\"YOUR_LEADERBOARD_ID\"",""]}]},{"type":"BuiltinCommonInstructions::Standard","conditions":[{"type":{"value":"PlaygamaBridge::OnLeaderboardsGetEntriesCompleted"},"parameters":["",""]}],"actions":[{"type":{"value":"SetNumberVariable"},"parameters":["loopindex","=","0"]}],"events":[{"type":"BuiltinCommonInstructions::Standard","conditions":[{"type":{"value":"PlaygamaBridge::IsLastActionCompletedSuccessfully"},"parameters":["",""]}],"actions":[{"type":{"value":"DebuggerTools::ConsoleLog"},"parameters":["\"success\"","\"info\"",""]}],"events":[{"type":"BuiltinCommonInstructions::Repeat","repeatExpression":"PlaygamaBridge::LeaderboardEntriesCount()","conditions":[],"actions":[{"type":{"value":"DebuggerTools::ConsoleLog"},"parameters":["\"ID: \" + PlaygamaBridge::LeaderboardEntryId(loopindex)","\"info\"",""]},{"type":{"value":"DebuggerTools::ConsoleLog"},"parameters":["\"Name: \" + PlaygamaBridge::LeaderboardEntryName(loopindex)","\"info\"",""]},{"type":{"value":"DebuggerTools::ConsoleLog"},"parameters":["\"Photo: \" + PlaygamaBridge::LeaderboardEntryPhoto(loopindex)","\"info\"",""]},{"type":{"value":"DebuggerTools::ConsoleLog"},"parameters":["\"Rank: \" + PlaygamaBridge::LeaderboardEntryRank(loopindex)","\"info\"",""]},{"type":{"value":"DebuggerTools::ConsoleLog"},"parameters":["\"Score: \" + PlaygamaBridge::LeaderboardEntryScore(loopindex)","\"info\"",""]},{"type":{"value":"SetNumberVariable"},"parameters":["loopindex","+","1"]}]}]}]}],"eventsCount":2,"actionsList":[],"actionsCount":0,"conditionsList":[],"conditionsCount":0}}
```

</details>
{% endtab %}

{% tab title="Godot" %}
{% tabs %}
{% tab title="Godot 3.x" %}

```gdscript
func _ready():
    var leaderboardId = "YOUR_LEADERBOARD_ID" # id that you specified in the config file
    Bridge.leaderboards.get_entries(leaderboardId, funcref(self, "_on_get_entries_completed"))

func _on_get_entries_completed(success, entries):
    print(success)
    
    for entry in entries:
        print("ID: " + str(entry.id))
        print("Name: " + str(entry.name))
        print("Score: " + str(entry.score))
        print("Rank: " + str(entry.rank))
        print("Photo: " + str(entry.photo))
```

{% endtab %}

{% tab title="Godot 4.x" %}

```gdscript
func _ready():
    var leaderboardId = "YOUR_LEADERBOARD_ID" # id that you specified in the config file
    Bridge.leaderboards.get_entries(leaderboardId, Callable(self, "_on_get_entries_completed"))

func _on_get_entries_completed(success, entries):
    print(success)
    
    for entry in entries:
        print("ID: " + str(entry.id))
        print("Name: " + str(entry.name))
        print("Score: " + str(entry.score))
        print("Rank: " + str(entry.rank))
        print("Photo: " + str(entry.photo))
```

{% endtab %}
{% endtabs %}
{% endtab %}

{% tab title="GameMaker" %}

```javascript
var leaderboardId = "YOUR_LEADERBOARD_ID" // id that you specified in the config file

playgama_bridge_leaderboards_get_entries(leaderboardId)

// callback via Async Social Event
if async_load[? "type"] == "playgama_bridge_leaderboards_get_entries_callback" {
    if async_load[? "success"] {
        var entries = json_parse(async_load[? "data"])
    }
}
```

{% endtab %}

{% tab title="Defold" %}

```lua
local bridge = require("bridge.bridge")

function init(self)
    local leaderboardId = "YOUR_LEADERBOARD_ID" -- id that you specified in the config file
    bridge.leaderboards.get_entries(leaderboardId, function (_, data)
        -- success
        for key, value in pairs(data) do
            print("ID:", value.id)
            print("Name:", value.name)
            print("Photo:", value.photo)
            print("Score:", value.score)
            print("Rank:", value.rank)
        end
    end, function ()
        -- error
    end)
end
```

{% endtab %}

{% tab title="Cocos Creator" %}

```javascript
let leaderboardId = "YOUR_LEADERBOARD_ID" // id that you specified in the config file

bridge.leaderboards.getEntries(leaderboardId)
    .then(entries => {
        entries.forEach(entry => {
            console.log('ID: ' + entry.id)
            console.log('Name: ' + entry.name)
            console.log('Photo: ' + entry.photo)
            console.log('Score: ' + entry.score)
            console.log('Rank: ' + entry.rank)
        })
    })
    .catch(error => {
        // error
    })
```

{% endtab %}
{% endtabs %}

## Show Native Popup

{% hint style="info" %}
Works only when `bridge.leaderboards.type` = `native_popup`
{% endhint %}

Opens the platform's native leaderboard overlay. Use it only when `leaderboards.type` is `native_popup`.

{% tabs %}
{% tab title="Plain JS" %}

```javascript
let leaderboardId = "YOUR_LEADERBOARD_ID" // id that you specified in the config file

bridge.leaderboards.showNativePopup(leaderboardId)
    .then(() => {
        // success
    })
    .catch(error => {
        // error
    })
```

{% endtab %}

{% tab title="Unity" %}

```csharp
private void Start()
{
    var leaderboardId = "YOUR_LEADERBOARD_ID"; // id that you specified in the config file
    Bridge.leaderboards.ShowNativePopup(leaderboardId, OnShowNativePopupCompleted);
}

private void OnShowNativePopupCompleted(bool success)
{
    if (success)
    {
        // Operation succeeded
    }
    else
    {
        // An error occurred
    }
}
```

{% endtab %}

{% tab title="Construct 3" %}
In the event sheet:

1. On a trigger (e.g. **System → On start of layout**), add the **Show Leaderboard Native Popup** action (parameter: ID).
2. Add the **On Leaderboards Show Native Popup Completed** condition. Inside it, check **Is Last Action Completed Successfully** (with a **System → Else** branch for errors).

<details>

<summary>Copy This Example</summary>

```
{"is-c3-clipboard-data":true,"type":"events","items":[{"eventType":"block","conditions":[{"id":"on-start-of-layout","objectClass":"System"}],"actions":[{"id":"leaderboards-show-native-popup","objectClass":"PlaygamaBridge","parameters":{"id":"\"YOUR_LEADERBOARD_ID_HERE\""}}]},{"eventType":"block","conditions":[{"id":"on-leaderboards-show-native-popup-completed","objectClass":"PlaygamaBridge"}],"actions":[],"children":[{"eventType":"block","conditions":[{"id":"is-last-action-completed-successfully","objectClass":"PlaygamaBridge"}],"actions":[{"type":"comment","text":"success"}]},{"eventType":"block","conditions":[{"id":"else","objectClass":"System"}],"actions":[{"type":"comment","text":"error"}]}]}]}
```

</details>
{% endtab %}

{% tab title="GDevelop" %}
In the events sheet:

1. On a trigger (e.g. **At the beginning of the scene**), add the **Leaderboards Show Native Popup** action (parameter: Id).
2. Add the **On Leaderboards Show Native Popup Completed** condition. Inside it, check **Is Last Action Completed Successfully**.

<details>

<summary>Copy This Example</summary>

```
{"000kind":"GDEVELOP_EventsAndInstructions_CLIPBOARD_KIND-jsBdHbLy912y8Rc","content":{"eventsList":[{"type":"BuiltinCommonInstructions::Standard","conditions":[],"actions":[{"type":{"value":"PlaygamaBridge::LeaderboardsShowNativePopup"},"parameters":["","\"YOUR_LEADERBOARD_ID_HERE\"",""]}]},{"type":"BuiltinCommonInstructions::Standard","conditions":[{"type":{"value":"PlaygamaBridge::OnLeaderboardsShowNativePopupCompleted"},"parameters":["",""]}],"actions":[],"events":[{"type":"BuiltinCommonInstructions::Standard","conditions":[{"type":{"value":"PlaygamaBridge::IsLastActionCompletedSuccessfully"},"parameters":["",""]}],"actions":[{"type":{"value":"DebuggerTools::ConsoleLog"},"parameters":["\"success\"","\"info\"",""]}]}]}],"eventsCount":2,"actionsList":[],"actionsCount":0,"conditionsList":[],"conditionsCount":0}}
```

</details>
{% endtab %}

{% tab title="Godot" %}
{% tabs %}
{% tab title="Godot 3.x" %}

```gdscript
func _ready():
    var leaderboardId = "YOUR_LEADERBOARD_ID" # id that you specified in the config file
    Bridge.leaderboards.show_native_popup(leaderboardId, funcref(self, "_on_show_native_popup_completed"))

func _on_show_native_popup_completed(success):
    print(success)
```

{% endtab %}

{% tab title="Godot 4.x" %}

```gdscript
func _ready():
    var leaderboardId = "YOUR_LEADERBOARD_ID" # id that you specified in the config file
    Bridge.leaderboards.show_native_popup(leaderboardId, Callable(self, "_on_show_native_popup_completed"))

func _on_show_native_popup_completed(success):
    print(success)
```

{% endtab %}
{% endtabs %}
{% endtab %}

{% tab title="GameMaker" %}

```javascript
var leaderboardId = "YOUR_LEADERBOARD_ID" // id that you specified in the config file

playgama_bridge_leaderboards_show_native_popup(leaderboardId)

// callback via Async Social Event
if async_load[? "type"] == "playgama_bridge_leaderboards_show_native_popup_callback" {
    if async_load[? "success"] {
        // your logic
    }
}
```

{% endtab %}

{% tab title="Defold" %}

```lua
local bridge = require("bridge.bridge")

function init(self)
    local leaderboardId = "YOUR_LEADERBOARD_ID" -- id that you specified in the config file

    bridge.leaderboards.show_native_popup(leaderboardId, function ()
        -- success
    end, function ()
        -- error
    end)
end
```

{% endtab %}

{% tab title="Cocos Creator" %}

```javascript
let leaderboardId = "YOUR_LEADERBOARD_ID" // id that you specified in the config file

bridge.leaderboards.showNativePopup(leaderboardId)
    .then(() => {
        // success
    })
    .catch(error => {
        // error
    })
```

{% endtab %}
{% endtabs %}
