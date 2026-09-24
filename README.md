# GeoGuessr Round Saver

A Chrome extension that adds **+ Save to JSON** to completed Duels round cards. It updates a chosen local map-making.app export in place. Classic `/results/...` pages get a labeled round list in the extension panel.

## Install (no build tools required)

1. If using the ZIP, extract it to a permanent folder first.
2. Open `chrome://extensions` in Chrome.
3. Turn on **Developer mode** at the top right.
4. Click **Load unpacked** and select the `geoguessr-round-saver` folder containing `manifest.json`.
5. Click the extension in Chrome's Extensions menu to open its setup page.
6. Click **Choose existing file**, select your map export, and allow editing. Files with no extension, such as `CostaRica-CR-17.05.26`, work. Alternatively, click **Create new map**.
7. Reload any already-open GeoGuessr summary page.

## Use

Finish a game and open its summary. Click **+ Save to JSON** next to any round. A **Saved** message means the write completed. **Already in JSON** means that panorama is already present. You can close the setup tab after selecting the file.

The saved location is the actual panorama, with its starting heading, pitch, and zoom, rather than a player's guess or the camera's replay position. Import the resulting JSON manually into map-making.app. The extension does not upload anything automatically.

Chrome may expire file permission after restarting or a period of inactivity. Click **Map file**, then **Reconnect**, allow editing, and retry the round. Picking a new file changes the destination for subsequent saves.

## Data handling

- Uses Chrome's File System Access API; no native program or blanket disk access is needed.
- Keeps the selected file handle in extension-local IndexedDB. Only your selected file can be edited.
- Preserves existing locations, tags, map name, and other fields. JSON whitespace is reformatted on write.
- Supports `{ "name": "My map", "customCoordinates": [...] }` and bare location arrays.
- Decodes GeoGuessr's hex-encoded panorama IDs. Repeated panorama IDs are skipped. If an ID is missing, duplicates are checked by coordinates within 0.000001 degrees. Distinct panoramas at the same coordinates are retained.
- New locations have empty tags. Existing tags are never changed.
- Rereads the file before every update and serializes writes across tabs. Avoid editing the same file in another program during a save; simultaneous external writes cannot be fully locked out.
- Before each addition, stores the exact previous file contents locally. **Download last backup** exports that recovery copy. Only the most recent backup is retained; removing the extension removes it.
- Invalid JSON, invalid coordinates, denied permission, or backup failure prevents the write.
- Network access is limited to GeoGuessr's own game endpoints, using your existing signed-in session. No analytics or third-party services.

## Supported pages and limitations

- Duels: `/duels/GAME_ID/summary` and `/team-duels/GAME_ID/summary`. Built against the nine-round Duels HTML supplied on September 24, 2026.
- Classic: `/results/GAME_ID`, with buttons in a floating labeled round list.
- Live games, Battle Royale, challenge leaderboards, and replay-only pages are not supported.
- If GeoGuessr changes its layout, the labeled round list serves as a fallback. If its private API changes, the extension may need an update.
- Current Duels endpoint and its flattened round structure were verified in JavaScript bundled with the supplied saved page. Legacy Duels responses with nested panorama data are also supported.
- Automated checks cover sample-file preservation, file-write failure cases, and button injection/messages on the supplied HTML in a mocked browser session. A signed-in live GeoGuessr game and the native file-permission dialog were not end-to-end tested.

## Troubleshooting

- **No buttons:** reload after installing, ensure you are on a supported completed summary route, and look for the Round Saver panel at the bottom right.
- **HTTP error:** sign in to GeoGuessr, reload the page, then click Reload rounds. The game must be accessible to your account.
- **File access needs approval:** reconnect from the setup page; saving is never reported as successful until the file stream has closed.
- **Invalid map:** choose a map-making.app JSON export with a `customCoordinates` array. The filename extension itself does not matter.

## Technical reference

Manifest V3, plain JavaScript, no dependencies or build step. The extension service worker performs fetching and file writes. A Web Lock serializes destination changes and appends.

Chrome's File System Access API: https://developer.chrome.com/docs/capabilities/web-apis/file-system-access

Persistent file permissions: https://developer.chrome.com/blog/persistent-permissions-for-the-file-system-access-api
