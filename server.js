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

// Test endpoint to simulate TikFinity webhook (simulates combo behavior)
app.post('/test-webhook', (req, res) => {
    const finalGiftCount = req.body.giftCount || req.body.count || req.body.repeatCount || 1;
    const unitCoinValue = 1000; // Galaxy default
    const giftId = req.body.giftId || '11046'; // Default to Galaxy
    const giftName = req.body.giftName || 'Galaxy';
    const username = req.body.username || 'TestUser';

    console.log(`\n=== TEST WEBHOOK SIMULATION ===`);
    console.log(`Simulating ${finalGiftCount}x ${giftName} from ${username}`);
    console.log(`This will send 3 webhooks to simulate TikTok combo behavior:\n`);

    // Helper function to create webhook data
    function createWebhookData(repeatCount, delayMs = 0) {
        return {
            event: 'gift',
            username: username,
            giftCount: repeatCount,
            coinValue: unitCoinValue * repeatCount,
            raw: {
                value1: username,
                value2: '',
                value3: giftId,
                content: 'Add to Wheel',
                avatar_url: 'https://example.com/avatar.jpg',
                userId: '1234567890',
                username: username,
                nickname: username,
                commandParams: '',
                giftId: giftId,
                giftName: giftName,
                coins: (unitCoinValue * repeatCount).toString(),
                repeatCount: repeatCount.toString(),
                triggerTypeId: '3',
                tikfinityUserId: '1409195',
                tikfinityUsername: 'aarondoh'
            },
            timestamp: Date.now() + delayMs
        };
    }

    // Simulate the 3-webhook pattern TikTok sends for combos:
    // Webhook 1: Initial gift (1x)
    const webhook1 = createWebhookData(1, 0);
    console.log(`Webhook #1: 1x ${giftName} (${unitCoinValue} coins) - Initial gift`);

    // Webhook 2: Combo'd gift (final count)
    const webhook2 = createWebhookData(finalGiftCount, 500);
    console.log(`Webhook #2: ${finalGiftCount}x ${giftName} (${unitCoinValue * finalGiftCount} coins) - Combo upgrade`);

    // Webhook 3: Duplicate of combo (same as webhook 2)
    const webhook3 = createWebhookData(finalGiftCount, 1000);
    console.log(`Webhook #3: ${finalGiftCount}x ${giftName} (${unitCoinValue * finalGiftCount} coins) - Duplicate\n`);
    console.log(`Expected result: Should count ${finalGiftCount} entries total (not ${1 + finalGiftCount + finalGiftCount})`);

    // Send webhooks with delays to simulate real behavior
    setTimeout(() => {
        clients.forEach(client => {
            client.res.write(`data: ${JSON.stringify(webhook1)}\n\n`);
        });
        console.log('✓ Sent webhook #1');
    }, 0);

    setTimeout(() => {
        clients.forEach(client => {
            client.res.write(`data: ${JSON.stringify(webhook2)}\n\n`);
        });
        console.log('✓ Sent webhook #2');
    }, 500);

    setTimeout(() => {
        clients.forEach(client => {
            client.res.write(`data: ${JSON.stringify(webhook3)}\n\n`);
        });
        console.log('✓ Sent webhook #3');
    }, 1000);

    res.json({
        success: true,
        message: `Test combo simulation started: ${finalGiftCount}x ${giftName}`,
        webhooks: [
            { order: 1, repeatCount: 1, coins: unitCoinValue },
            { order: 2, repeatCount: finalGiftCount, coins: unitCoinValue * finalGiftCount },
            { order: 3, repeatCount: finalGiftCount, coins: unitCoinValue * finalGiftCount }
        ]
    });
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
