> For the complete documentation index, see [llms.txt](https://wiki.playgama.com/playgama/llms.txt). Markdown versions of documentation pages are available by appending `.md` to page URLs; this page is available as [Markdown](https://wiki.playgama.com/playgama/bridge-sdk/setup.md).

# Setup

{% hint style="info" %}
You are reading the documentation for Bridge SDK **v2**. If you need the obsolete v1 documentation, see [Documentation (v1)](https://wiki.playgama.com/playgama/bridge-sdk-v1).
{% endhint %}

## Installation

Install the Bridge package for your engine:

{% tabs %}
{% tab title="Plain JS" %}
JS Core contains the shared SDK logic. Engine packages for Unity, Godot, Construct and other engines are wrappers around JS Core. Use JS Core directly in web engines such as PlayCanvas, Phaser, LayaAir and similar frameworks.

#### Integration

{% hint style="success" %}
**CDN is the recommended option.** It always serves the current stable build, and only the adapter of the platform the game actually runs on is downloaded. Choose npm when the build has to be self-contained — offline builds, a strict CSP, or a bundler that manages every dependency.
{% endhint %}

**CDN (recommended)**

Add the script from CDN:

```html
<html>
    <head>
        <script src="https://bridge.playgama.com/v2/stable/playgama-bridge.js"></script>
    </head>
    <body>...</body>
</html>
```

**npm**

```bash
npm i @playgama/bridge
```

```javascript
import bridge from '@playgama/bridge'
```

The npm build inlines every platform adapter into a single file, so nothing is fetched at runtime. It also assigns `window.bridge`, so code written against the global keeps working.

For TypeScript projects:

```typescript
// constant values without pulling in the SDK runtime — works with the CDN build too
import { PLATFORM_MESSAGE, BANNER_STATE } from '@playgama/bridge/constants'

// typings for the global `bridge` when the SDK is loaded with a <script> tag
import type {} from '@playgama/bridge/global'
```

With both options, place `playgama-bridge-config.json` next to your `index.html` — Bridge loads it from `./playgama-bridge-config.json`.

When the game launches on a supported platform, Bridge automatically loads the required platform scripts. In unsupported environments, Bridge uses a mock platform and returns safe defaults (`false`, `reject`, etc.) instead of throwing.

#### Initialization

Call the initialization method and wait for it to finish before using any `bridge.*` API.

```javascript
bridge.initialize()
    .then(() => {
        // initialization was successful, SDK can be used
    })
    .catch(error => {
        // error, something went wrong
    })
```

{% endtab %}

{% tab title="Unity" %}

#### Installation

* Open `Window` → `Package Management` → `Package Manager`
* Click the `plus` button and select `Install package from git URL`
* Enter `https://github.com/playgama/bridge-unity.git`
* Open `Playgama` → `Bridge Setup` and click `Add` in the `Add Bridge WebGL Template` section

{% hint style="success" %}
Use the example project as a reference integration:

<https://github.com/playgama/bridge-unity-examples>
{% endhint %}

#### Initialization and Build

The Unity package initializes Bridge automatically while the game loads. No extra initialization call is required.

Select the Bridge WebGL Template before building.

<figure><img src="https://1088849411-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F5ukgSPDBOdbQp4FYtbz1%2Fuploads%2FiTu62lwZ2OpI3mis9P1n%2FScreenshot%202025-04-17%20at%201.54.32%E2%80%AFPM.png?alt=media&amp;token=fa68dc3c-4315-49b1-9a78-e94114104daa" alt=""><figcaption></figcaption></figure>
{% endtab %}

{% tab title="Construct 3" %}

#### Installation

Download the latest version of `playgama_bridge.c3addon` from the [GitHub release page](https://github.com/playgama/bridge-construct/releases).

Go to `Menu` → `View` → `Addon Manager` and click `Install new addon...`. Select the downloaded file and click `Install` in the popup window.

Open your project, right-click on the `Object types` folder, and select `Add new object type`. Choose `Playgama Bridge` and click `Insert`.

#### Setup

Set `Use Worker` to `No` in the project settings (`Menu` → `Project` → `Properties`).
{% endtab %}

{% tab title="GDevelop" %}

#### Installation

**Release page**

Download the required version of `PlaygamaBridge.json` from the [GitHub release page](https://github.com/playgama/bridge-gdevelop/releases).

Go to `Project Manager` <img src="https://1088849411-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F5ukgSPDBOdbQp4FYtbz1%2Fuploads%2FEu4k66xHk2USeNqEhSkj%2FScreenshot%202025-01-20%20at%2010.51.19.png?alt=media&amp;token=dcd2f7f9-5598-4060-9f06-a162f42d612a" alt="" data-size="line"> → `Create or search for new extensions` <img src="https://1088849411-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F5ukgSPDBOdbQp4FYtbz1%2Fuploads%2FEj221DFgEaAWLE9q3jwG%2FScreenshot%202025-01-20%20at%2010.57.40.png?alt=media&amp;token=ef276c0b-c8fd-4aeb-85c8-6267ff77e5a4" alt="" data-size="line"> → `Import extension` <img src="https://1088849411-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F5ukgSPDBOdbQp4FYtbz1%2Fuploads%2FQygx6o59JU8mVpco0rkO%2FScreenshot%202025-01-20%20at%2011.00.03.png?alt=media&amp;token=7e995720-bda2-4634-92c0-e636f3949853" alt="" data-size="line"> and select the downloaded file.

#### Initialization

Initialization starts automatically. Wait until it completes before running game logic that uses Bridge, such as reading player profile or storage data. Use the **Is Initialized** condition to gate that logic.
{% endtab %}

{% tab title="Godot" %}

#### Integration

Download the latest `playgama_bridge.zip` archive, unzip it, and place the contents into `res://addons`:

* [GitHub releases page](https://github.com/playgama/bridge-godot/releases) for Godot 3
* [GitHub releases page](https://github.com/playgama/bridge-godot-4/releases) for Godot 4

<figure><img src="https://1088849411-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F5ukgSPDBOdbQp4FYtbz1%2Fuploads%2FZ7Qu2PMJn8ySRaKhWrlZ%2FScreenshot%202024-10-17%20at%204.36.04%E2%80%AFPM.png?alt=media&amp;token=dccd6f5b-935e-453b-bbf5-8ab0b597389b" alt="" width="374"><figcaption></figcaption></figure>

Enable the plugin in the project settings:

<figure><img src="https://1088849411-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F5ukgSPDBOdbQp4FYtbz1%2Fuploads%2FandsHryC6a0OuL5MZpqN%2FScreenshot%202024-10-17%20at%204.37.08%E2%80%AFPM.png?alt=media&amp;token=98d68039-25e1-4865-9fa6-4dfe382a3cc0" alt=""><figcaption></figcaption></figure>

{% hint style="warning" %}
Place Bridge first in the AutoLoad list.
{% endhint %}

#### Initialization

The Godot plugin initializes Bridge automatically while the game loads. No extra initialization call is required.

#### Build

Select the Bridge HTML template in export settings under `Custom HTML Shell`:

```
res://addons/playgama_bridge/template/index.html
```

<figure><img src="https://1088849411-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F5ukgSPDBOdbQp4FYtbz1%2Fuploads%2FmJRYfT0yvnSdCglpFO5n%2FScreenshot%202024-10-17%20at%204.38.38%E2%80%AFPM.png?alt=media&amp;token=738fff42-7ddf-49de-a553-b82882c52170" alt=""><figcaption></figcaption></figure>
{% endtab %}

{% tab title="GameMaker" %}

#### Installation

Download the latest `.yymps` from the [GitHub release page](https://github.com/Playgama/bridge-gamemaker/releases) and import it via `Tools` → `Import Local Package` menu.

<figure><img src="https://1088849411-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F5ukgSPDBOdbQp4FYtbz1%2Fuploads%2Fe1oZii66kthYEMvVuNbS%2FScreenshot%202025-02-12%20at%2010.59.35%E2%80%AFAM.png?alt=media&amp;token=06201574-f078-45a1-9a75-40a412899944" alt=""><figcaption><p>Tools → Import Local Package</p></figcaption></figure>

#### Initialization and Build

The GameMaker package initializes Bridge automatically while the game loads. No extra initialization call is required.

Select the Bridge index template before building.

<figure><img src="https://1088849411-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F5ukgSPDBOdbQp4FYtbz1%2Fuploads%2FTxkHZTSUbafJFTJ4ZMWY%2FScreenshot%202025-02-12%20at%2011.04.47%E2%80%AFAM.png?alt=media&amp;token=d3663cdd-63bb-47cd-9f59-a12d96a41a6d" alt=""><figcaption><p>Game Options → HTML5 → General</p></figcaption></figure>
{% endtab %}

{% tab title="Defold" %}

#### Installation

Copy the `Source code.zip` link from the [GitHub release page](https://github.com/Playgama/bridge-defold/releases) and add it as a dependency in your project settings.

<figure><img src="https://1088849411-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F5ukgSPDBOdbQp4FYtbz1%2Fuploads%2FxHHuRngm9Gx7TMcw3xD0%2FScreenshot%202025-02-26%20at%209.51.47%E2%80%AFAM.png?alt=media&amp;token=c952fa41-508c-4c1c-afaf-72ab81f0c763" alt=""><figcaption></figcaption></figure>

Then select `Project` → `Fetch Libraries`.

#### Initialization and Build

The Defold package initializes Bridge automatically while the game loads. No extra initialization call is required.

Select the Bridge index template before building.

<figure><img src="https://1088849411-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F5ukgSPDBOdbQp4FYtbz1%2Fuploads%2FU3jUDlXyKXAuPGhuH7yj%2FScreenshot%202025-02-26%20at%209.52.11%E2%80%AFAM.png?alt=media&amp;token=b7333424-117c-4f84-a504-bbe9c53a3ad2" alt=""><figcaption></figcaption></figure>
{% endtab %}

{% tab title="Cocos Creator" %}

#### Installation

{% hint style="success" %}
**npm is the recommended option.** The SDK is bundled with your scripts, TypeScript typings come with the package, and no editor extension has to be kept in sync with the project.
{% endhint %}

**npm (recommended)**

Install the package in the project root — the folder that contains `assets/`:

```bash
npm i @playgama/bridge
```

Import the SDK and initialize it before using any API:

```typescript
import bridge from '@playgama/bridge'

bridge.engine = 'cocos'

bridge.initialize()
    .then(() => {
        // initialization was successful, SDK can be used
    })
```

Put `playgama-bridge-config.json` into `build-templates/web-mobile/` — Cocos Creator copies that folder into the build output, so the file ends up next to `index.html`, where Bridge looks for it.

**Editor extension**

Download the latest `.zip` archive from the [GitHub release page](https://github.com/Playgama/bridge-cocos-creator) and import it into your project. Import all files except the optional `Examples` folder. The extension installs `web-mobile` and `preview` templates automatically; you can also run manual installation from `Extensions` → `Playgama Bridge` → `Install`.

<figure><img src="https://1088849411-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F5ukgSPDBOdbQp4FYtbz1%2Fuploads%2Ffmb3iXvMisdWmXebl27J%2FScreenshot%202025-05-30%20at%2000.54.54.png?alt=media&amp;token=22deab6e-50a5-4ff8-ba81-9ead9f43157b" alt=""><figcaption></figcaption></figure>

The templates load the SDK from CDN, set `bridge.engine`, and call `bridge.initialize()` before the game starts, so no initialization call is needed in your code. Do not combine this option with the npm package — the game would load two copies of the SDK.

#### Build Template

{% hint style="danger" %}
Use the `web-mobile` build target. Bridge provides templates for `web-mobile` and `preview` builds.
{% endhint %}

<figure><img src="https://1088849411-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F5ukgSPDBOdbQp4FYtbz1%2Fuploads%2Fgit-blob-2b7cf1f44817d54bd6f505f7ad791f2865e04caf%2Fcocos_creator_build_template.png?alt=media" alt=""><figcaption></figcaption></figure>
{% endtab %}

{% tab title="Scratch" %}

#### Integration

Download `PlaygamaBridge.js` from the [GitHub release page](https://github.com/playgama/bridge-scratch/releases). In TurboWarp, click `Add Extension`, select `Custom Extension`, choose the downloaded file, and enable `Run without sandbox`.

When the game launches on a supported platform, Bridge automatically loads the required platform scripts. In unsupported environments, Bridge uses a mock platform and returns safe defaults (`false`, `reject`, etc.) instead of throwing.

#### Initialization

Call the initialization method and wait for it to finish before using Bridge blocks.

<figure><img src="https://1088849411-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F5ukgSPDBOdbQp4FYtbz1%2Fuploads%2FYW13tCI2HcnuBQbHGNoP%2FScreenshot%202025-07-11%20at%204.37.05%E2%80%AFPM.png?alt=media&amp;token=5df32d75-a30f-4594-a090-17d4b10e0440" alt=""><figcaption></figcaption></figure>
{% endtab %}
{% endtabs %}

## Required steps

Installation is only the first part of the integration. Every game must also implement the required steps. See the full list with exact methods in [API → Required steps](/playgama/bridge-sdk/api.md#required-steps).
