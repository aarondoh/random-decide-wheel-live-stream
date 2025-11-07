# Random Decide Wheel - TikFinity Integration

A simple and fair random decide wheel for TikTok live streams that integrates with TikFinity to automatically add participants when they send specific gifts.

## Features

- **Fair Random Selection**: Each participant has an equal chance (1/n) of winning
- **TikFinity Integration**: Automatically adds viewers who send specific gifts
- **Max Limit Control**: Set a maximum number of participants or allow unlimited entries
- **No Duplicate Names**: Prevents the same username from being added multiple times
- **Manual Management**: Add or remove participants manually
- **Real-time Updates**: Live participant count and status updates
- **Smooth Animations**: Professional spinning animation with 4-second duration
- **Responsive Design**: Works on desktop and mobile devices

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Start the Webhook Server

```bash
npm start
```

The server will start on `http://localhost:3000` by default.

### 3. Open the Wheel Interface

Open `index.html` in your web browser (double-click the file or use a live server).

### 4. Configure TikFinity

1. Open TikFinity application
2. Go to **Settings** > **Webhooks**
3. Add a new webhook with URL: `http://localhost:3000/webhook`
4. Select the events you want to track (usually "Gift" events)
5. Save the webhook configuration

### 5. Configure the Wheel

1. In the wheel interface, enter the gift name (e.g., "Rose", "Galaxy")
2. Click "Set Gift"
3. Optionally set a max participant limit (0 = unlimited)
4. Click "Start Webhook" to connect to the server

### 6. Start Your Stream!

When viewers send the specified gift during your TikTok live stream, their usernames will automatically be added to the wheel!

## How to Use

### Adding Participants

**Automatic (TikFinity):**
- Viewers send the specified gift
- Their username is automatically added to the wheel
- Duplicates are prevented

**Manual:**
- Type a name in the "Add name manually" field
- Press Enter or click "Add"

### Managing Participants

- **Remove Individual**: Click the × button next to a participant's name
- **Remove Last**: Click "Remove Last" to remove the most recent entry
- **Clear All**: Click "Clear All" to remove all participants

### Spinning the Wheel

1. Click "SPIN THE WHEEL" button
2. Watch the wheel spin for 4 seconds
3. The winner will be displayed below the wheel
4. Each participant has exactly 1/n chance of winning (where n = total participants)

### Settings

**Max Limit:**
- Set to 0 for unlimited participants
- Set to any number to cap the maximum entries
- When limit is reached, new entries are rejected

**Gift Name:**
- Specify which TikTok gift triggers entry
- Examples: "Rose", "Galaxy", "Sports Car", "Lion"
- Must match the exact gift name from TikTok

**Webhook Port:**
- Default: 3000
- Change if you need a different port
- Must match the port in server.js

## Testing Without TikFinity

You can test the webhook integration without TikFinity:

```bash
# Test with curl
curl -X POST http://localhost:3000/test-webhook \
  -H "Content-Type: application/json" \
  -d '{"username": "TestUser123", "giftName": "Rose"}'
```

Or use any API testing tool (Postman, Insomnia, etc.) to send POST requests to:
- `http://localhost:3000/test-webhook`

## Files

- `index.html` - Main wheel interface
- `style.css` - Styling and animations
- `script.js` - Wheel logic and TikFinity integration
- `server.js` - Node.js webhook server
- `package.json` - Node.js dependencies

## Fairness Guarantee

The wheel uses JavaScript's `Math.random()` to select winners:

```javascript
const winnerIndex = Math.floor(Math.random() * participants.length);
```

This ensures:
- Each participant has exactly **1/n probability** of winning
- No bias toward any position on the wheel
- Truly random selection every spin

## Troubleshooting

**Webhook not receiving data:**
- Make sure server.js is running (`npm start`)
- Check TikFinity webhook URL is correct
- Verify the port matches (default: 3000)
- Check firewall settings

**Participants not being added:**
- Verify the gift name matches exactly (case-sensitive)
- Check the browser console for errors (F12)
- Make sure "Start Webhook" was clicked
- Confirm max limit hasn't been reached

**Wheel not spinning:**
- Ensure there's at least one participant
- Check that a spin isn't already in progress
- Refresh the page if it becomes unresponsive

## Requirements

- Node.js (v14 or higher)
- Modern web browser (Chrome, Firefox, Edge, Safari)
- TikFinity application (for TikTok integration)

## License

MIT License - Feel free to use and modify for your streams!

## Support

For issues or questions about:
- **This wheel**: Check the code or open an issue
- **TikFinity**: Visit [TikFinity documentation](https://tikfinity.com)
- **TikTok API**: Visit [TikTok Developer Portal](https://developers.tiktok.com)
