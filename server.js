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
    console.log('Received webhook:', JSON.stringify(req.body, null, 2));

    try {
        const data = req.body;

        // TikFinity sends various event types
        // Common structure: { event, data: { uniqueId, nickname, giftName, ... } }

        let formattedData = null;

        // Handle different TikFinity webhook formats
        if (data.event === 'gift' || data.type === 'gift') {
            formattedData = {
                event: 'gift',
                username: data.data?.uniqueId || data.uniqueId || data.username || 'Unknown',
                nickname: data.data?.nickname || data.nickname || '',
                giftName: data.data?.giftName || data.giftName || '',
                giftId: data.data?.giftId || data.giftId || 0,
                timestamp: Date.now()
            };

            console.log(`Gift received: ${formattedData.username} sent ${formattedData.giftName}`);
        }
        // Handle other event types if needed
        else if (data.event === 'follow' || data.type === 'follow') {
            formattedData = {
                event: 'follow',
                username: data.data?.uniqueId || data.uniqueId || 'Unknown',
                timestamp: Date.now()
            };
        }
        else if (data.event === 'share' || data.type === 'share') {
            formattedData = {
                event: 'share',
                username: data.data?.uniqueId || data.uniqueId || 'Unknown',
                timestamp: Date.now()
            };
        }
        else if (data.event === 'comment' || data.type === 'comment') {
            formattedData = {
                event: 'comment',
                username: data.data?.uniqueId || data.uniqueId || 'Unknown',
                comment: data.data?.comment || data.comment || '',
                timestamp: Date.now()
            };
        }
        else {
            // Generic event handling
            formattedData = {
                event: data.event || data.type || 'unknown',
                ...data,
                timestamp: Date.now()
            };
        }

        // Broadcast to all connected clients
        if (formattedData && clients.length > 0) {
            clients.forEach(client => {
                client.res.write(`data: ${JSON.stringify(formattedData)}\n\n`);
            });
            console.log(`Broadcasted to ${clients.length} client(s)`);
        } else if (!formattedData) {
            console.log('No formatted data to send');
        } else {
            console.log('No clients connected to broadcast to');
        }

        res.status(200).json({ success: true, message: 'Webhook received' });
    } catch (error) {
        console.error('Error processing webhook:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Test endpoint to simulate TikFinity webhook
app.post('/test-webhook', (req, res) => {
    const testData = {
        event: 'gift',
        username: req.body.username || 'TestUser',
        giftName: req.body.giftName || 'Rose',
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

    console.log(`
╔═══════════════════════════════════════════════════════════╗
║  TikFinity Webhook Server for Random Decide Wheel        ║
║                                                           ║
║  Server running on: ${deployUrl.padEnd(40)} ║
║                                                           ║
║  Endpoints:                                               ║
║  - GET  /               (Web Interface)                  ║
║  - POST /webhook        (TikFinity webhook)              ║
║  - GET  /events         (Browser SSE connection)         ║
║  - POST /test-webhook   (Test with custom data)          ║
║  - GET  /health         (Health check)                   ║
║                                                           ║
║  Configure TikFinity webhook URL:                        ║
║  ${deployUrl}/webhook${' '.repeat(40 - (deployUrl + '/webhook').length)} ║
╚═══════════════════════════════════════════════════════════╝
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
