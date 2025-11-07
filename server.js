const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Serve static files (HTML, CSS, JS)
app.use(express.static(path.join(__dirname)));

// Store connected clients for Server-Sent Events
let clients = [];

// Serve the main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

// Server-Sent Events endpoint for browser to listen
app.get('/events', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');

    // Add client to list
    const clientId = Date.now();
    const newClient = {
        id: clientId,
        res
    };
    clients.push(newClient);

    console.log(`Client ${clientId} connected. Total clients: ${clients.length}`);

    // Send initial connection message
    res.write(`data: ${JSON.stringify({ message: 'Connected to webhook server' })}\n\n`);

    // Remove client on disconnect
    req.on('close', () => {
        clients = clients.filter(client => client.id !== clientId);
        console.log(`Client ${clientId} disconnected. Total clients: ${clients.length}`);
    });
});

// Webhook endpoint for TikFinity
app.post('/webhook', (req, res) => {
    console.log('=== TikFinity Webhook Received ===');
    console.log('Full payload:', JSON.stringify(req.body, null, 2));
    console.log('Headers:', JSON.stringify(req.headers, null, 2));

    try {
        const data = req.body;

        // TikFinity sends gift event data when configured in Actions & Events
        // We'll handle flexible formats and extract username

        let formattedData = {
            event: 'gift',
            username: null,
            giftCount: 1,
            coinValue: 0,
            raw: data,
            timestamp: Date.now()
        };

        // Try to extract coin value (already total from TikFinity) from various possible fields
        // TikFinity's "coins" field is ALREADY the total (e.g., Rose x5 = coins: "5")
        const possibleCoinFields = [
            'diamondCount', 'diamond_count', 'diamonds',
            'coinValue', 'coin_value', 'coins', 'coinCount', 'coin_count',
            'value', 'price', 'cost'
        ];

        for (const field of possibleCoinFields) {
            if (data[field]) {
                const coins = typeof data[field] === 'number' ? data[field] : parseInt(data[field], 10);
                if (!isNaN(coins) && coins > 0) {
                    formattedData.coinValue = coins;
                    break;
                }
            }
        }

        // Check nested objects for coin value
        if (formattedData.coinValue === 0 && data.data) {
            for (const field of possibleCoinFields) {
                if (data.data[field]) {
                    const coins = typeof data.data[field] === 'number' ? data.data[field] : parseInt(data.data[field], 10);
                    if (!isNaN(coins) && coins > 0) {
                        formattedData.coinValue = coins;
                        break;
                    }
                }
            }
        }

        // Try to extract gift count/quantity from various possible fields
        const possibleCountFields = [
            'giftCount', 'gift_count', 'count',
            'quantity', 'amount', 'combo',
            'repeatCount', 'repeat_count', 'num'
        ];

        for (const field of possibleCountFields) {
            if (data[field]) {
                const count = typeof data[field] === 'number' ? data[field] : parseInt(data[field], 10);
                if (!isNaN(count) && count > 0) {
                    formattedData.giftCount = count;
                    break;
                }
            }
        }

        // Check nested objects for count
        if (formattedData.giftCount === 1 && data.data) {
            for (const field of possibleCountFields) {
                if (data.data[field]) {
                    const count = typeof data.data[field] === 'number' ? data.data[field] : parseInt(data.data[field], 10);
                    if (!isNaN(count) && count > 0) {
                        formattedData.giftCount = count;
                        break;
                    }
                }
            }
        }

        // Try to extract username from various possible fields
        // TikFinity may send: uniqueId, nickname, username, user, name, etc.
        const possibleUsernameFields = [
            'uniqueId', 'unique_id',
            'username', 'user', 'userName', 'user_name',
            'nickname', 'nick', 'displayName', 'display_name',
            'name', 'screenName', 'screen_name'
        ];

        // Check top level
        for (const field of possibleUsernameFields) {
            if (data[field]) {
                formattedData.username = data[field];
                break;
            }
        }

        // Check nested data object if it exists
        if (!formattedData.username && data.data) {
            for (const field of possibleUsernameFields) {
                if (data.data[field]) {
                    formattedData.username = data.data[field];
                    break;
                }
            }
        }

        // Check nested user object if it exists
        if (!formattedData.username && data.user) {
            for (const field of possibleUsernameFields) {
                if (data.user[field]) {
                    formattedData.username = data.user[field];
                    break;
                }
            }
        }

        // If still no username, use a fallback
        if (!formattedData.username) {
            formattedData.username = `User_${Date.now()}`;
            console.log('WARNING: Could not find username in payload, using fallback');
        }

        // TikFinity already sends total coins (not unit price), so don't multiply
        console.log(`Extracted username: ${formattedData.username}, Gift count: ${formattedData.giftCount}, Coin value: ${formattedData.coinValue}`);

        // Broadcast to all connected clients
        if (clients.length > 0) {
            clients.forEach(client => {
                client.res.write(`data: ${JSON.stringify(formattedData)}\n\n`);
            });
            console.log(`Broadcasted to ${clients.length} client(s)`);
        } else {
            console.log('No clients connected to broadcast to');
        }

        res.status(200).json({
            success: true,
            message: 'Webhook received',
            username: formattedData.username,
            giftCount: formattedData.giftCount,
            coinValue: formattedData.coinValue
        });
    } catch (error) {
        console.error('Error processing webhook:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Test endpoint to simulate TikFinity webhook
app.post('/test-webhook', (req, res) => {
    const giftCount = req.body.giftCount || req.body.count || req.body.repeatCount || 1;
    const coinValue = req.body.coinValue || req.body.coins || 0;
    const giftId = req.body.giftId || '11046'; // Default to Galaxy
    const giftName = req.body.giftName || 'Galaxy';

    const testData = {
        event: 'gift',
        username: req.body.username || 'TestUser',
        giftCount: giftCount,
        coinValue: coinValue,
        raw: {
            value1: req.body.username || 'TestUser',
            value2: '',
            value3: giftId,
            content: 'Add to Wheel',
            avatar_url: 'https://example.com/avatar.jpg',
            userId: '1234567890',
            username: req.body.username || 'TestUser',
            nickname: req.body.username || 'TestUser',
            commandParams: '',
            giftId: giftId,
            giftName: giftName,
            coins: coinValue.toString(),
            repeatCount: giftCount.toString(),
            triggerTypeId: '3',
            tikfinityUserId: '1409195',
            tikfinityUsername: 'aarondoh'
        },
        timestamp: Date.now()
    };

    console.log('Test webhook triggered:', testData);

    // Broadcast to clients
    clients.forEach(client => {
        client.res.write(`data: ${JSON.stringify(testData)}\n\n`);
    });

    res.json({ success: true, message: 'Test webhook sent', data: testData });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    const deployUrl = process.env.RAILWAY_PUBLIC_DOMAIN
        ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
        : `http://localhost:${PORT}`;

    const webhookUrl = `${deployUrl}/webhook`;

    console.log(`
╔════════════════════════════════════════════════════════════════╗
║  TikFinity Webhook Server for Random Decide Wheel             ║
╚════════════════════════════════════════════════════════════════╝

Server running on:
  ${deployUrl}

Endpoints:
  GET  /               (Web Interface)
  POST /webhook        (TikFinity webhook)
  GET  /events         (Browser SSE connection)
  POST /test-webhook   (Test with custom data)
  GET  /health         (Health check)

Configure TikFinity webhook URL:
  ${webhookUrl}
    `);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, closing server...');
    clients.forEach(client => {
        client.res.end();
    });
    process.exit(0);
});
