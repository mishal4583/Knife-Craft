> For the complete documentation index, see [llms.txt](https://wiki.playgama.com/playgama/llms.txt). Markdown versions of documentation pages are available by appending `.md` to page URLs; this page is available as [Markdown](https://wiki.playgama.com/playgama/bridge-sdk/api/device.md).

# Device

{% hint style="info" %}
You are reading the documentation for Bridge SDK **v2**. If you need the obsolete v1 documentation, see [Documentation (v1)](https://wiki.playgama.com/playgama/bridge-sdk-v1).
{% endhint %}

Read-only information about the player's device. Use it to switch UI layouts, input schemes, or asset quality between `mobile`, `tablet`, `desktop`, and `tv`.

## Device Type

Use this value for broad adaptation only, such as mobile controls, desktop hotkeys, or lower-quality assets on small devices.

{% tabs %}
{% tab title="Plain JS" %}

```javascript
bridge.device.type
```

{% endtab %}

{% tab title="Unity" %}

```java
Bridge.device.type
```

{% endtab %}

{% tab title="Construct 3" %}

```javascript
PlaygamaBridge.DeviceType
```

{% endtab %}

{% tab title="GDevelop" %}

```javascript
PlaygamaBridge::DeviceType()
```

{% endtab %}

{% tab title="Godot" %}

```gdscript
Bridge.device.type
```

{% endtab %}

{% tab title="GameMaker" %}

```javascript
playgama_bridge_device_type()
```

{% endtab %}

{% tab title="Defold" %}

```lua
bridge.device.type()
```

{% endtab %}

{% tab title="Cocos Creator" %}

```javascript
bridge.device.type
```

{% endtab %}

{% tab title="Scratch" %}

<figure><img src="https://1088849411-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F5ukgSPDBOdbQp4FYtbz1%2Fuploads%2FWQQQxXRVNWFGF5bHWKjW%2FScreenshot%202025-07-11%20at%204.57.53%E2%80%AFPM.png?alt=media&amp;token=bba16788-cd44-4a4f-902f-02dd9747cf97" alt=""><figcaption></figcaption></figure>
{% endtab %}
{% endtabs %}

Possible values: `mobile`, `tablet`, `desktop`, `tv`.

<details>

<summary>Platform support · all 25 platforms</summary>

**Supports:** `crazy_games`, `discord`, `dlightek`, `facebook`, `game_distribution`, `gamepush`, `gamesnacks`, `huawei`, `jio_games`, `lagged`, `microsoft_store`, `msn`, `ok`, `playgama`, `poki`, `portal`, `reddit`, `samsung`, `telegram`, `tiktok`, `vk`, `xiaomi`, `y8`, `yandex`, `youtube`

</details>

## Device OS

Returns the operating system of the player's device.

{% hint style="info" %}
Exposed in the Plain JS SDK only. The engine plugins do not wrap this property — call the JS API from your engine's JS interop if you need it there.
{% endhint %}

{% tabs %}
{% tab title="Plain JS" %}

```javascript
bridge.device.os
```

{% endtab %}
{% endtabs %}

Possible values: `windows`, `macos`, `linux`, `android`, `ios`, `other`.

## Orientation

Returns the current screen orientation and lets you react when the player rotates the device.

{% hint style="info" %}
Exposed in the Plain JS SDK only. The engine plugins do not wrap the orientation API — use the built-in orientation popup below or your engine's JS interop.
{% endhint %}

{% tabs %}
{% tab title="Plain JS" %}

```javascript
bridge.device.orientation // 'portrait' | 'landscape'

// Listen for orientation changes
bridge.device.on(bridge.EVENT_NAME.ORIENTATION_STATE_CHANGED, orientation => {
    console.log('Orientation:', orientation)
})
```

{% endtab %}
{% endtabs %}

If your game supports only one orientation, Bridge can show a built-in "rotate the device" overlay on mobile devices. Enable it in the [config](/playgama/bridge-sdk/config.md):

```json
{
    "device": {
        "useBuiltInOrientationPopup": true,
        "supportedOrientations": ["landscape"]
    }
}
```

`supportedOrientations` lists the orientations your game supports (`portrait`, `landscape`); with `useBuiltInOrientationPopup: true` the overlay appears whenever the device is rotated to an unsupported one.

## Screen Size

Listen for viewport size changes (debounced) to adapt the layout.

{% hint style="info" %}
Exposed in the Plain JS SDK only. The engine plugins do not wrap this event — most engines provide their own viewport resize callbacks.
{% endhint %}

{% tabs %}
{% tab title="Plain JS" %}

```javascript
bridge.device.on(bridge.EVENT_NAME.SCREEN_SIZE_CHANGED, size => {
    console.log('Screen size:', size.width, size.height)
})
```

{% endtab %}
{% endtabs %}

## Safe Area

Returns the safe-area insets in pixels — the area not covered by notches, rounded corners, or platform UI. Use it to keep HUD elements visible.

{% tabs %}
{% tab title="Plain JS" %}

```javascript
const { top, bottom, left, right } = bridge.device.safeArea
```

{% endtab %}

{% tab title="Unity" %}

```csharp
var safeArea = Bridge.device.safeArea;
Debug.Log($"{safeArea.top} {safeArea.bottom} {safeArea.left} {safeArea.right}");
```

{% endtab %}
{% endtabs %}

Among the engine plugins, safe area is currently wrapped in Unity only.

Bridge can also apply safe-area padding to the page automatically — set `game.adaptToSafeArea` to `true` in the [config](/playgama/bridge-sdk/config.md).
