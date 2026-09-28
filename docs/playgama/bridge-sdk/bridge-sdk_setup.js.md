> For the complete documentation index, see [llms.txt](https://wiki.playgama.com/playgama/llms.txt). Markdown versions of documentation pages are available by appending `.md` to page URLs; this page is available as [Markdown](https://wiki.playgama.com/playgama/bridge-sdk/setup.md).

# Setup

You are reading the documentation for Bridge SDK **v2**. If you need the obsolete v1 documentation, see [Documentation (v1)](https://wiki.playgama.com/playgama/bridge-sdk-v1).

## Installation

Install the Bridge package for your engine:

JS Core contains the shared SDK logic. Engine packages for Unity, Godot, Construct and other engines are wrappers around JS Core. Use JS Core directly in web engines such as PlayCanvas, Phaser, LayaAir and similar frameworks.

#### Integration

**CDN is the recommended option.** It always serves the current stable build, and only the adapter of the platform the game actually runs on is downloaded. Choose npm when the build has to be self-contained — offline builds, a strict CSP, or a bundler that manages every dependency.

**CDN (recommended)**

Add the script from CDN:

```html

    
        
    
    ...

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

// typings for the global `bridge` when the SDK is loaded with a  tag
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

## Required steps

Installation is only the first part of the integration. Every game must also implement the required steps. See the full list with exact methods in [API → Required steps](/playgama/bridge-sdk/api.md#required-steps).
