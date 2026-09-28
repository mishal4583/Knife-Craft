> For the complete documentation index, see [llms.txt](https://wiki.playgama.com/playgama/llms.txt). Markdown versions of documentation pages are available by appending `.md` to page URLs; this page is available as [Markdown](https://wiki.playgama.com/playgama/bridge-sdk/api/storage.md).

# Storage (required)

You are reading the documentation for Bridge SDK **v2**. If you need the obsolete v1 documentation, see [Documentation (v1)](https://wiki.playgama.com/playgama/bridge-sdk-v1).

The Storage module persists player data: progress, settings, currency, level state. Without it, players lose progress between sessions.

## How it works

Bridge automatically picks the most suitable place to store data on the current platform, including cloud saves when they are available. No configuration is required from the game.

Never save player data directly to `localStorage` or via other local persistence methods of your engine (e.g. `PlayerPrefs`, local files). Always go through the Storage module — otherwise the data won't reach cloud saves and may be lost.

## Implementation order

1. **Required** — On game start, call [`storage.get(...)`](#load-data) for the keys you need (`level`, `coins`, `settings`, etc.). Restore the player's state before showing gameplay.
2. **Required** — On meaningful state change (level complete, purchase, settings change), [`storage.set(...)`](#save-data) to persist. Avoid saving every frame.

## Load Data

Load data before gameplay starts. Missing keys return `null`, so always provide defaults in your game state.

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

## Save Data

Save data after meaningful progress changes, such as level completion, purchase, currency change, or settings update.

```javascript
bridge.storage.set(['key_1', 'key_2'], ['value_1', 'value_2'])
    .then(() => {
        // Data successfully saved
    })
    .catch(error => {
        // Error, something went wrong
    })
```

## Delete Data

Delete data when you intentionally reset progress, clear settings, or migrate obsolete data.

```javascript
bridge.storage.delete(['key_1', 'key_2'])
    .then(() => {
        // Data successfully deleted
    })
    .catch(error => {
        // Error, something went wrong
    })
```

