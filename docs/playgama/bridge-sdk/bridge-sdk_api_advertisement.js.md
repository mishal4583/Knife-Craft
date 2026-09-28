> For the complete documentation index, see [llms.txt](https://wiki.playgama.com/playgama/llms.txt). Markdown versions of documentation pages are available by appending `.md` to page URLs; this page is available as [Markdown](https://wiki.playgama.com/playgama/bridge-sdk/api/advertisement.md).

# Advertisement (required)

You are reading the documentation for Bridge SDK **v2**. If you need the obsolete v1 documentation, see [Documentation (v1)](https://wiki.playgama.com/playgama/bridge-sdk-v1).

Use ads to monetize the game across supported platforms. Every game must show interstitial ads at natural breakpoints to qualify for platform revenue share. Other formats are highly recommended — Rewarded in particular is usually the highest-eCPM format.

Never show ads in the middle of active gameplay. Show them at natural pauses: level transitions, map changes, game over, or return to menu.

## Integration order

1. [**Interstitial**](/playgama/bridge-sdk/api/advertisement/interstitial.md) — **required**. Hook into level transitions and game-over screens.
2. [**Rewarded**](/playgama/bridge-sdk/api/advertisement/rewarded.md) — highly recommended. Add reward-for-watching loops: extra life, double coins, hint, skip. This usually has the highest eCPM because players opt in.
3. [**Banner**](/playgama/bridge-sdk/api/advertisement/banner.md) — fill idle screens.
4. [**Advanced Banners**](/playgama/bridge-sdk/api/advertisement/advanced-banners.md) — use when default banner placement is not flexible enough.
5. [**AdBlock detection**](/playgama/bridge-sdk/api/advertisement/adblock.md) — useful for fallback messaging.

We wrote an article on how to properly monetize your game, best practices, and lifehacks. Check it out here: 

