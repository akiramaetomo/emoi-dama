# えもい玉

`えもい玉` is a small browser toy for keeping little emotional moments as
touchable balls.

This repository is the public GitHub Pages target for the early Web prototype.
The normal development repository remains private/separate.

## Prototype Notes

- Data is stored only in the current browser's local storage.
- There is no server database, account system, analytics, advertising, or public
  timeline.
- Do not enter sensitive personal information during early testing.
- URL and JSON features are prototype transfer tools, not a durable backup
  service.

## Local Development

```powershell
npm install
npm test
npm run build
npm run dev
```

## GitHub Pages

This app is built as a static Vite site for the `emoi-dama` project Pages path:

```text
https://<owner>.github.io/emoi-dama/
```

The Pages workflow builds the app and publishes the generated static artifact.
