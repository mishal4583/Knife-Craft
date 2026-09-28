> For the complete documentation index, see [llms.txt](https://wiki.playgama.com/playgama/llms.txt). Markdown versions of documentation pages are available by appending `.md` to page URLs; this page is available as [Markdown](https://wiki.playgama.com/playgama/bridge-sdk/api/storage.md).

# Storage (required)

{% hint style="info" %}
You are reading the documentation for Bridge SDK **v2**. If you need the obsolete v1 documentation, see [Documentation (v1)](https://wiki.playgama.com/playgama/bridge-sdk-v1).
{% endhint %}

The Storage module persists player data: progress, settings, currency, level state. Without it, players lose progress between sessions.

## How it works

Bridge automatically picks the most suitable place to store data on the current platform, including cloud saves when they are available. No configuration is required from the game.

{% hint style="warning" %}
Never save player data directly to `localStorage` or via other local persistence methods of your engine (e.g. `PlayerPrefs`, local files). Always go through the Storage module — otherwise the data won't reach cloud saves and may be lost.
{% endhint %}

## Implementation order

1. **Required** — On game start, call [`storage.get(...)`](#load-data) for the keys you need (`level`, `coins`, `settings`, etc.). Restore the player's state before showing gameplay.
2. **Required** — On meaningful state change (level complete, purchase, settings change), [`storage.set(...)`](#save-data) to persist. Avoid saving every frame.

## Load Data

Load data before gameplay starts. Missing keys return `null`, so always provide defaults in your game state.

{% tabs %}
{% tab title="Plain JS" %}

```javascript
bridge.storage.get(['key_1', 'key_2'])
    .then(data => {
        // Data loaded and you can work with it
        // data[n] = null if there is no data for the given key
        console.log('Data: ', data)
    })
    .catch(error => {
        // Error, something went wrong
    })
```

{% endtab %}

{% tab title="Unity" %}

```csharp
private void Start()
{
    Bridge.storage.Get(new List<string>() { "level", "coins" }, OnStorageGetCompleted);
}

private void OnStorageGetCompleted(bool success, List<string> data)
{
    // Loading succeeded
    if (success)
    {
        if (data[0] != null)
        {
            Debug.Log($"Level: {data[0]}");
        }
        else
        {
            // No data for the key 'level'
        }

        if (data[1] != null)
        {
            Debug.Log($"Coins: {data[1]}");
        }
        else
        {
            // No data for the key 'coins'
        }
    }
    else
    {
        // Error, something went wrong
    }
}
```

{% endtab %}

{% tab title="Construct 3" %}
In the event sheet:

1. On a trigger (e.g. **Button → On clicked**), queue the keys with **Append Storage Data Get Request** (one per key), then run **Send Storage Data Get Request**.
2. Add the **On Storage Data Get Request Completed** condition. Inside it, use **Has Storage Data By Key** for each key and read the value with the `PlaygamaBridge.StorageData("key")` expression.

{% hint style="info" %}
If you need data in JSON format, use the `PlaygamaBridge.StorageDataAsJSON("key_1")` expression.
{% endhint %}

<details>

<summary>Copy This Example</summary>

```
{"is-c3-clipboard-data":true,"type":"events","items":[{"eventType":"block","conditions":[{"id":"on-clicked","objectClass":"Button"}],"actions":[{"id":"append-storage-data-get-request","objectClass":"PlaygamaBridge","parameters":{"key":"\"key_1\""}},{"id":"append-storage-data-get-request","objectClass":"PlaygamaBridge","parameters":{"key":"\"key_2\""}},{"id":"send-storage-data-get-request","objectClass":"PlaygamaBridge"}]},{"eventType":"block","conditions":[{"id":"on-storage-data-get-request-completed","objectClass":"PlaygamaBridge"}],"actions":[],"children":[{"eventType":"block","conditions":[{"id":"has-storage-data","objectClass":"PlaygamaBridge","parameters":{"key":"\"key_1\""}}],"actions":[{"id":"log","objectClass":"Browser","parameters":{"type":"log","message":"PlaygamaBridge.StorageData(\"key_1\")"}}]},{"eventType":"block","conditions":[{"id":"has-storage-data","objectClass":"PlaygamaBridge","parameters":{"key":"\"key_2\""}}],"actions":[{"id":"log","objectClass":"Browser","parameters":{"type":"log","message":"PlaygamaBridge.StorageData(\"key_2\")"}}]}]}]}
```

</details>
{% endtab %}

{% tab title="GDevelop" %}
In the events sheet:

1. On a trigger (e.g. **Button is clicked**), queue the keys with **Append Parameter to Storage Data Get Request** (one per key), then run **Send Storage Data Get Request**.
2. Add the **On Storage Data Get Request Completed** condition. Inside it, use **Has Storage Data** for each key and read the value with the `PlaygamaBridge::StorageData("key")` expression.

{% hint style="info" %}
If you need data in JSON format, use the `PlaygamaBridge::StorageDataAsJSON("key_1")` expression.
{% endhint %}

<details>

<summary>Copy This Example</summary>

```
{"000kind":"GDEVELOP_EventsAndInstructions_CLIPBOARD_KIND-jsBdHbLy912y8Rc","content":{"eventsList":[{"type":"BuiltinCommonInstructions::Standard","conditions":[{"type":{"value":"PanelSpriteButton::PanelSpriteButton::IsClicked"},"parameters":["Button",""]}],"actions":[{"type":{"value":"PlaygamaBridge::AppendStorageDataGetRequest"},"parameters":["","\"key_1\"",""]},{"type":{"value":"PlaygamaBridge::AppendStorageDataGetRequest"},"parameters":["","\"key_2\"",""]},{"type":{"value":"PlaygamaBridge::SendStorageDataGetRequest"},"parameters":["",""]}]},{"type":"BuiltinCommonInstructions::Standard","conditions":[{"type":{"value":"PlaygamaBridge::OnStorageDataGetRequestCompleted"},"parameters":["",""]}],"actions":[],"events":[{"type":"BuiltinCommonInstructions::Standard","conditions":[{"type":{"value":"PlaygamaBridge::HasStorageData"},"parameters":["","\"key_1\"",""]}],"actions":[{"type":{"value":"DebuggerTools::ConsoleLog"},"parameters":["PlaygamaBridge::StorageData(\"key_1\")","\"info\"",""]}]},{"type":"BuiltinCommonInstructions::Standard","conditions":[{"type":{"value":"PlaygamaBridge::HasStorageData"},"parameters":["","\"key_2\"",""]}],"actions":[{"type":{"value":"DebuggerTools::ConsoleLog"},"parameters":["PlaygamaBridge::StorageData(\"key_2\")","\"info\"",""]}]}]}],"eventsCount":2,"actionsList":[],"actionsCount":0,"conditionsList":[],"conditionsCount":0}}
```

</details>
{% endtab %}

{% tab title="Godot" %}
{% tabs %}
{% tab title="Godot 3.x" %}

```gdscript
func _ready():
    Bridge.storage.get(["level", "coins"], funcref(self, "_on_storage_get_completed"))

func _on_storage_get_completed(success, data):
    if success:
        if data[0] != null:
            print("Level: ", data[0])
        else:
            # No data for the key 'level'
            print("Level is null")

        if data[1] != null:
            print("Coins: ", data[1])
        else:
            # No data for the key 'coins'
            print("Coins is null")
```

{% endtab %}

{% tab title="Godot 4.x" %}

```gdscript
func _ready():
    Bridge.storage.get(["level", "coins"], Callable(self, "_on_storage_get_completed"))

func _on_storage_get_completed(success, data):
    if success:
        if data[0] != null:
            print("Level: ", data[0])
        else:
            # No data for the key 'level'
            print("Level is null")

        if data[1] != null:
            print("Coins: ", data[1])
        else:
            # No data for the key 'coins'
            print("Coins is null")
```

{% endtab %}
{% endtabs %}
{% endtab %}

{% tab title="GameMaker" %}

```javascript
// Load data by key
var keys = ["coins", "level"]
playgama_bridge_storage_get(json_stringify(keys))

// callback via Async Social Event
if async_load[? "type"] == "playgama_bridge_storage_get_callback" {
    if async_load[? "success"] {
        var values = json_parse(async_load[? "data"])
        var coins = values[0]
        var level = values[1]

        if is_undefined(coins) {
            // there is no stored data for key "coins"
        }

        if is_undefined(level) {
            // there is no stored data for key "level"
        }
    }
}
```

{% endtab %}

{% tab title="Defold" %}

```lua
local bridge = require("bridge.bridge")

function init(self)	
	bridge.storage.get(
		{ "coins", "level" }, 
		function (_, data)
			if data.coins then
				print("Coins: ", data.coins)
			end
			if data.level then
				print("Level: ", data.level)
			end
		end, 
		function ()
			-- error
		end
	)
end
```

{% endtab %}

{% tab title="Cocos Creator" %}

```javascript
bridge.storage.get(['key_1', 'key_2'])
    .then(data => {
        // Data loaded and you can work with it
        // data[n] = null if there is no data for the given key
        console.log('Data: ', data)
    })
    .catch(error => {
        // Error, something went wrong
    })
```

{% endtab %}

{% tab title="Scratch" %}

<figure><img src="https://1088849411-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F5ukgSPDBOdbQp4FYtbz1%2Fuploads%2FumLdxraCuaOFn0GvYESo%2FScreenshot%202025-07-11%20at%204.46.20%E2%80%AFPM.png?alt=media&amp;token=2bf2cf49-c2ca-406e-85f9-b9078214fe16" alt=""><figcaption></figcaption></figure>
{% endtab %}
{% endtabs %}

## Save Data

Save data after meaningful progress changes, such as level completion, purchase, currency change, or settings update.

{% tabs %}
{% tab title="Plain JS" %}

```javascript
bridge.storage.set(['key_1', 'key_2'], ['value_1', 'value_2'])
    .then(() => {
        // Data successfully saved
    })
    .catch(error => {
        // Error, something went wrong
    })
```

{% endtab %}

{% tab title="Unity" %}

```csharp
private void Start()
{
    var data = new Dictionary<string, object>
    {
        { "level", "dungeon_123" },
        { "is_tutorial_completed", true },
        { "coins", 12 }
    };
    Bridge.storage.Set(data, OnStorageSetCompleted);
}
```

{% endtab %}

{% tab title="Construct 3" %}
In the event sheet:

1. On a trigger (e.g. **Button → On clicked**), queue each key/value with **Append Storage Data Set Request**, then run **Send Storage Data Set Request**.
2. Add the **On Storage Data Set Request Completed** condition. Inside it, check **Is Last Action Completed Successfully** to confirm the save.

<details>

<summary>Copy This Example</summary>

```
{"is-c3-clipboard-data":true,"type":"events","items":[{"eventType":"block","conditions":[{"id":"on-clicked","objectClass":"Button"}],"actions":[{"id":"append-storage-data-set-request","objectClass":"PlaygamaBridge","parameters":{"key":"\"key_1\"","value":"42"}},{"id":"append-storage-data-set-request","objectClass":"PlaygamaBridge","parameters":{"key":"\"key_2\"","value":"\"test\""}},{"id":"send-storage-data-set-request","objectClass":"PlaygamaBridge"}]},{"eventType":"block","conditions":[{"id":"on-storage-data-set-request-completed","objectClass":"PlaygamaBridge"}],"actions":[],"children":[{"eventType":"block","conditions":[{"id":"is-last-action-completed-successfully","objectClass":"PlaygamaBridge"}],"actions":[{"type":"comment","text":"success"}]}]}]}
```

</details>
{% endtab %}

{% tab title="GDevelop" %}
In the events sheet:

1. On a trigger (e.g. **Button is clicked**), queue each key/value with **Append Parameter to Storage Data Set Request**, then run **Send Storage Data Set Request**.
2. Add the **On Storage Data Set Request Completed** condition. Inside it, check **Is Last Action Completed Successfully** to confirm the save.

<details>

<summary>Copy This Example</summary>

```
{"000kind":"GDEVELOP_EventsAndInstructions_CLIPBOARD_KIND-jsBdHbLy912y8Rc","content":{"eventsList":[{"type":"BuiltinCommonInstructions::Standard","conditions":[{"type":{"value":"PanelSpriteButton::PanelSpriteButton::IsClicked"},"parameters":["Button",""]}],"actions":[{"type":{"value":"PlaygamaBridge::AppendStorageDataSetRequest"},"parameters":["","\"key_1\"","\"42\"",""]},{"type":{"value":"PlaygamaBridge::AppendStorageDataSetRequest"},"parameters":["","\"key_2\"","\"test\"",""]},{"type":{"value":"PlaygamaBridge::SendStorageDataSetRequest"},"parameters":["",""]}]},{"type":"BuiltinCommonInstructions::Standard","conditions":[{"type":{"value":"PlaygamaBridge::OnStorageDataSetRequestCompleted"},"parameters":["",""]}],"actions":[],"events":[{"type":"BuiltinCommonInstructions::Standard","conditions":[{"type":{"value":"PlaygamaBridge::IsLastActionCompletedSuccessfully"},"parameters":["",""]}],"actions":[{"type":{"value":"DebuggerTools::ConsoleLog"},"parameters":["\"Data Saved!\"","\"info\"",""]}]}]}],"eventsCount":2,"actionsList":[],"actionsCount":0,"conditionsList":[],"conditionsCount":0}}
```

</details>
{% endtab %}

{% tab title="Godot" %}
{% tabs %}
{% tab title="Godot 3.x" %}

```gdscript
Bridge.storage.set({
    "level": "dungeon_123",
    "is_tutorial_completed": true,
    "coins": 42
}, funcref(self, "_on_storage_set_completed"))
```

{% endtab %}

{% tab title="Godot 4.x" %}

```gdscript
Bridge.storage.set({
    "level": "dungeon_123",
    "is_tutorial_completed": true,
    "coins": 42
}, Callable(self, "_on_storage_set_completed"))
```

{% endtab %}
{% endtabs %}
{% endtab %}

{% tab title="GameMaker" %}

```javascript
var keys = ["coins", "level"]
var values = [42, "dungeon"]
playgama_bridge_storage_set(json_stringify(keys), json_stringify(values))

// callback via Async Social Event
if async_load[? "type"] == "playgama_bridge_storage_set_callback" {
    if async_load[? "success"] {
        // your logic
    }
}
```

{% endtab %}

{% tab title="Defold" %}

<pre class="language-lua"><code class="lang-lua">local bridge = require("bridge.bridge")

function init(self)	
<strong>	bridge.storage.set(
</strong>		{ coins = 42, level = "dungeon" }, 
		function (_)
			-- success
		end, 
		function (_)
			-- error
		end
	)	
end
</code></pre>

{% endtab %}

{% tab title="Cocos Creator" %}

```javascript
bridge.storage.set(['key_1', 'key_2'], ['value_1', 'value_2'])
    .then(() => {
        // Data successfully saved
    })
    .catch(error => {
        // Error, something went wrong
    })
```

{% endtab %}

{% tab title="Scratch" %}

<figure><img src="https://1088849411-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F5ukgSPDBOdbQp4FYtbz1%2Fuploads%2FKuggrPVFnX6eH4GFV4nB%2FScreenshot%202025-07-11%20at%204.46.26%E2%80%AFPM.png?alt=media&amp;token=e2dda506-d92c-4fbf-b629-d11f895a4bf9" alt=""><figcaption></figcaption></figure>
{% endtab %}
{% endtabs %}

## Delete Data

Delete data when you intentionally reset progress, clear settings, or migrate obsolete data.

{% tabs %}
{% tab title="Plain JS" %}

```javascript
bridge.storage.delete(['key_1', 'key_2'])
    .then(() => {
        // Data successfully deleted
    })
    .catch(error => {
        // Error, something went wrong
    })
```

{% endtab %}

{% tab title="Unity" %}

```csharp
private void Start()
{
    var keys = new List<string>() { "level", "is_tutorial_completed", "coins" };
    Bridge.storage.Delete(keys, OnStorageDeleteCompleted);
}
```

{% endtab %}

{% tab title="Construct 3" %}
In the event sheet:

1. On a trigger (e.g. **Button → On clicked**), queue the keys with **Append Storage Data Delete Request** (one per key), then run **Send Storage Data Delete Request**.
2. Add the **On Storage Data Delete Request Completed** condition. Inside it, check **Is Last Action Completed Successfully** to confirm the deletion.

<details>

<summary>Copy This Example</summary>

```
{"is-c3-clipboard-data":true,"type":"events","items":[{"eventType":"block","conditions":[{"id":"on-clicked","objectClass":"Button"}],"actions":[{"id":"append-storage-data-delete-request","objectClass":"PlaygamaBridge","parameters":{"key":"\"key_1\""}},{"id":"append-storage-data-delete-request","objectClass":"PlaygamaBridge","parameters":{"key":"\"key_2\""}},{"id":"send-storage-data-delete-request","objectClass":"PlaygamaBridge"}]},{"eventType":"block","conditions":[{"id":"on-storage-data-delete-request-completed","objectClass":"PlaygamaBridge"}],"actions":[],"children":[{"eventType":"block","conditions":[{"id":"is-last-action-completed-successfully","objectClass":"PlaygamaBridge"}],"actions":[{"type":"comment","text":"success"}]}]}]}
```

</details>
{% endtab %}

{% tab title="GDevelop" %}
In the events sheet:

1. On a trigger (e.g. **Button is clicked**), queue the keys with **Append Parameter to Storage Data Delete Request** (one per key), then run **Send Storage Data Delete Request**.
2. Add the **On Storage Data Delete Request Completed** condition. Inside it, check **Is Last Action Completed Successfully** to confirm the deletion.

<details>

<summary>Copy This Example</summary>

```
{"000kind":"GDEVELOP_EventsAndInstructions_CLIPBOARD_KIND-jsBdHbLy912y8Rc","content":{"eventsList":[{"type":"BuiltinCommonInstructions::Standard","conditions":[{"type":{"value":"PanelSpriteButton::PanelSpriteButton::IsClicked"},"parameters":["Button",""]}],"actions":[{"type":{"value":"PlaygamaBridge::AppendStorageDataDeleteRequest"},"parameters":["","\"key_1\"",""]},{"type":{"value":"PlaygamaBridge::AppendStorageDataDeleteRequest"},"parameters":["","\"key_2\"",""]},{"type":{"value":"PlaygamaBridge::SendStorageDataDeleteRequest"},"parameters":["",""]}]},{"type":"BuiltinCommonInstructions::Standard","conditions":[{"type":{"value":"PlaygamaBridge::OnStorageDataDeleteRequestCompleted"},"parameters":["",""]}],"actions":[],"events":[{"type":"BuiltinCommonInstructions::Standard","conditions":[{"type":{"value":"PlaygamaBridge::IsLastActionCompletedSuccessfully"},"parameters":["",""]}],"actions":[{"type":{"value":"DebuggerTools::ConsoleLog"},"parameters":["\"Data Deleted!\"","\"info\"",""]}]}]}],"eventsCount":2,"actionsList":[],"actionsCount":0,"conditionsList":[],"conditionsCount":0}}
```

</details>
{% endtab %}

{% tab title="Godot" %}
{% tabs %}
{% tab title="Godot 3.x" %}

```gdscript
Bridge.storage.delete(["level", "is_tutorial_completed", "coins"], funcref(self, "_on_storage_delete_completed"))
```

{% endtab %}

{% tab title="Godot 4.x" %}

```gdscript
Bridge.storage.delete(["level", "is_tutorial_completed", "coins"], Callable(self, "_on_storage_delete_completed"))
```

{% endtab %}
{% endtabs %}
{% endtab %}

{% tab title="GameMaker" %}

```javascript
var keys = ["coins", "level"]
playgama_bridge_storage_delete(json_stringify(keys))

// callback via Async Social Event
if async_load[? "type"] == "playgama_bridge_storage_delete_callback" {
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
	bridge.storage.delete(
		{ "coins", "level" }, 
		function ()
			-- success
		end, 
		function ()
			-- error
		end
	)
end
```

{% endtab %}

{% tab title="Cocos Creator" %}

```javascript
bridge.storage.delete(['key_1', 'key_2'])
    .then(() => {
        // Data successfully deleted
    })
    .catch(error => {
        // Error, something went wrong
    })
```

{% endtab %}

{% tab title="Scratch" %}

<figure><img src="https://1088849411-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F5ukgSPDBOdbQp4FYtbz1%2Fuploads%2FRjHoYH5bmeScQrhAlpyx%2FScreenshot%202025-07-11%20at%204.46.42%E2%80%AFPM.png?alt=media&amp;token=cca03cc5-61d9-43fe-9640-03b008cfb455" alt=""><figcaption></figcaption></figure>
{% endtab %}
{% endtabs %}
