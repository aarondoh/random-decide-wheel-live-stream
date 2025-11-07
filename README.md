# Random Decide Wheel - TikFinity Integration

A simple and fair random decide wheel for TikTok live streams that integrates with TikFinity to automatically add participants when they send specific gifts.

## Features

- **Fair Random Selection**: Each participant has an equal chance (1/n) of winning
- **TikFinity Integration**: Automatically adds viewers who send specific gifts
- **Gift Count Support**: Multiple gifts (e.g., Roses x 15) = multiple entries for fair odds
- **Max Limit Control**: Set a maximum number of participants or allow unlimited entries
- **Duplicate Entries Allowed**: Users can be added multiple times for better odds
- **Manual Management**: Add or remove participants manually
- **Real-time Updates**: Live participant count and status updates
- **Smooth Animations**: Professional spinning animation with 4-second duration
- **Responsive Design**: Works on desktop and mobile devices

## Deployment Options

### Option 1: Deploy to Railway (Recommended for Production)

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/new/template?template=https://github.com/aarondoh/random-decide-wheel-live-stream)

1. Click the "Deploy on Railway" button above
2. Connect your GitHub account if prompted
3. Configure your Railway project
4. Wait for deployment to complete
5. Railway will provide you with a public URL (e.g., `https://your-app.railway.app`)
6. Open the URL in your browser to access the wheel
7. Configure TikFinity webhook to use: `https://your-app.railway.app/webhook`

### Option 2: Run Locally

#### 1. Install Dependencies

```bash
npm install
```

#### 2. Start the Server

```bash
npm start
```

The server will start on `http://localhost:3000` by default and serve the web interface.

#### 3. Open the Wheel Interface

Navigate to `http://localhost:3000` in your web browser.

#### 4. Configure TikFinity

1. Open TikFinity application
2. Go to **Settings** > **Webhooks**
3. Add a new webhook with URL: `http://localhost:3000/webhook`
4. Select the events you want to track (usually "Gift" events)
5. Save the webhook configuration

#### 5. Configure the Wheel

1. In the wheel interface, enter the gift name (e.g., "Rose", "Galaxy")
2. Click "Set Gift"
3. Optionally set a max participant limit (0 = unlimited)
4. Click "Start Webhook Connection"

#### 6. Start Your Stream!

When viewers send the specified gift during your TikTok live stream, their usernames will automatically be added to the wheel!

## How to Use

### Adding Participants

**Automatic (TikFinity):**
- Viewers send gifts during your TikTok live stream
- Their username is automatically added to the wheel
- Multiple gifts = multiple entries (e.g., Roses x 15 = 15 entries)

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

## Testing Without TikFinity

You can test the webhook integration without TikFinity:

**Local Testing:**
```bash
# Test single gift
curl -X POST http://localhost:3000/test-webhook \
  -H "Content-Type: application/json" \
  -d '{"username": "TestUser123"}'

# Test multiple gifts (e.g., Roses x 15)
curl -X POST http://localhost:3000/test-webhook \
  -H "Content-Type: application/json" \
  -d '{"username": "TestUser123", "giftCount": 15}'
```

**Railway Testing:**
```bash
# Test single gift
curl -X POST https://YOUR-APP-URL.railway.app/test-webhook \
  -H "Content-Type: application/json" \
  -d '{"username": "TestUser123"}'

# Test multiple gifts
curl -X POST https://YOUR-APP-URL.railway.app/test-webhook \
  -H "Content-Type: application/json" \
  -d '{"username": "TestUser123", "giftCount": 15}'
```

**Gift Count Handling:**
- When a viewer sends multiple gifts (e.g., Roses x 15), the webhook receives the count
- The user is added to the wheel 15 times (15 separate entries)
- This increases their odds proportionally to gifts sent
- Respects max participant limit (stops adding if limit reached)

Or use any API testing tool (Postman, Insomnia, etc.) to send POST requests to:
- Local: `http://localhost:3000/test-webhook`
- Railway: `https://YOUR-APP-URL.railway.app/test-webhook`

## Files

- `index.html` - Main wheel interface
- `style.css` - Styling and animations
- `script.js` - Wheel logic and TikFinity integration
- `server.js` - Node.js webhook server (serves static files + handles webhooks)
- `package.json` - Node.js dependencies
- `railway.json` - Railway deployment configuration
- `.railwayignore` - Files to exclude from Railway deployment

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
- Make sure the server is running and accessible
- Check TikFinity webhook URL is correct (use your Railway URL for production)
- Verify TikFinity is sending gift events
- Check the Status log in the web interface for connection errors

**Participants not being added:**
- Verify the gift name matches exactly (case-sensitive)
- Check the browser console for errors (F12)
- Make sure "Start Webhook Connection" was clicked
- Confirm max limit hasn't been reached
- Test with the `/test-webhook` endpoint first

**Wheel not spinning:**
- Ensure there's at least one participant
- Check that a spin isn't already in progress
- Refresh the page if it becomes unresponsive

**Railway Deployment Issues:**
- Check Railway logs for errors
- Ensure all environment variables are set correctly
- Verify the public domain is accessible
- Make sure the PORT environment variable is being used

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
