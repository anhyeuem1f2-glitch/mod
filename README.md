# Miemie Future Planner

Standalone Tavern Helper script for SillyTavern. It keeps a private future-outline using a second OpenAI-compatible model and injects that outline into the main generation context.

## Files

- `dist/index.js` — actual runtime code. This is the file to host on GitHub/jsDelivr.
- `release/Miemie Future Planner - Tavern Helper.json` — directly importable into Tavern Helper for local testing.
- `loader/Miemie Future Planner - GitHub Loader.template.json` — tiny loader template for a GitHub-hosted build.
- `tavern-helper-script.config.json` — repo/build metadata template.

## Test locally first

In SillyTavern:

1. Extensions → Tavern Helper → Script.
2. Click **Import**.
3. Import `release/Miemie Future Planner - Tavern Helper.json`.
4. Save/reload if Tavern Helper asks.
5. Use the script button **Miemie Future Planner**.

The UI contains Base URL, API key, Load model, model selector, temperature, token/history/timeout controls, Run now, Clear outline and raw outline preview.

## Host on GitHub

Push this folder to a GitHub repository. Then use either Raw GitHub or jsDelivr for `dist/index.js`.

Recommended CDN form:

`https://cdn.jsdelivr.net/gh/<USER>/<REPO>@main/dist/index.js`

After you know the final URL, replace `__REMOTE_URL__` in:

`loader/Miemie Future Planner - GitHub Loader.template.json`

Then import that loader JSON into Tavern Helper. The loader will fetch the current `dist/index.js` from GitHub/CDN.

## Notes

- The planner API is called directly from the browser. The endpoint must allow CORS, or you need to use a proxy URL that does.
- API key saving is optional and uses browser `localStorage` only when enabled.
- Outline state is stored per SillyTavern chat metadata.
- The script registers a Tavern Helper script button. If that API is unavailable, it falls back to a visible `🧭 MFP` button at the top-right.
