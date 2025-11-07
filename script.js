// Wheel state
let participants = [];
let maxLimit = 0; // 0 means no limit
let isSpinning = false;
let targetGiftName = '';
let webhookServer = null;

// Canvas setup
const canvas = document.getElementById('wheelCanvas');
const ctx = canvas.getContext('2d');
const centerX = canvas.width / 2;
const centerY = canvas.height / 2;
const radius = 200;

// Color palette for wheel segments
const colors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8',
    '#F7DC6F', '#BB8FCE', '#85C1E2', '#F8B739', '#52B788',
    '#E63946', '#A8DADC', '#457B9D', '#F1FAEE', '#E76F51'
];

// Initialize
function init() {
    drawWheel();
    updateParticipantDisplay();
    attachEventListeners();
    logStatus('Ready! Configure TikFinity webhook and add participants.');
}

// Draw the wheel
function drawWheel() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (participants.length === 0) {
        // Draw empty wheel
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
        ctx.fillStyle = '#ddd';
        ctx.fill();
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 3;
        ctx.stroke();

        ctx.fillStyle = '#666';
        ctx.font = '20px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Add participants', centerX, centerY);
        return;
    }

    const sliceAngle = (2 * Math.PI) / participants.length;

    participants.forEach((participant, index) => {
        const startAngle = index * sliceAngle;
        const endAngle = startAngle + sliceAngle;

        // Draw slice
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, radius, startAngle, endAngle);
        ctx.closePath();
        ctx.fillStyle = colors[index % colors.length];
        ctx.fill();
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Draw text
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(startAngle + sliceAngle / 2);
        ctx.textAlign = 'center';
        ctx.fillStyle = '#000';
        ctx.font = 'bold 14px Arial';

        // Truncate long names
        let displayName = participant;
        if (displayName.length > 12) {
            displayName = displayName.substring(0, 12) + '...';
        }

        ctx.fillText(displayName, radius / 2, 5);
        ctx.restore();
    });

    // Draw center circle
    ctx.beginPath();
    ctx.arc(centerX, centerY, 20, 0, 2 * Math.PI);
    ctx.fillStyle = '#333';
    ctx.fill();
}

// Spin the wheel with fair random selection
function spinWheel() {
    if (isSpinning) return;
    if (participants.length === 0) {
        logStatus('ERROR: No participants to spin!');
        return;
    }

    isSpinning = true;
    document.getElementById('spinBtn').disabled = true;
    document.getElementById('winnerDisplay').textContent = '';

    // Fair random selection - each participant has equal 1/n chance
    const winnerIndex = Math.floor(Math.random() * participants.length);
    const winner = participants[winnerIndex];

    logStatus(`Spinning... (${participants.length} participants, ${(100 / participants.length).toFixed(2)}% chance each)`);

    // Calculate rotation
    const sliceAngle = (2 * Math.PI) / participants.length;
    const winnerAngle = winnerIndex * sliceAngle + sliceAngle / 2;

    // Spin 5-7 full rotations plus the target angle
    const fullRotations = 5 + Math.random() * 2;
    const totalRotation = fullRotations * 2 * Math.PI + (2 * Math.PI - winnerAngle);

    // Animate the spin
    let currentRotation = 0;
    const duration = 4000; // 4 seconds
    const startTime = Date.now();

    function animate() {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Easing function for smooth deceleration
        const easeOut = 1 - Math.pow(1 - progress, 3);
        currentRotation = totalRotation * easeOut;

        // Redraw wheel with rotation
        ctx.save();
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.translate(centerX, centerY);
        ctx.rotate(currentRotation);
        ctx.translate(-centerX, -centerY);
        drawWheel();
        ctx.restore();

        if (progress < 1) {
            requestAnimationFrame(animate);
        } else {
            // Spin complete
            isSpinning = false;
            document.getElementById('spinBtn').disabled = false;
            document.getElementById('winnerDisplay').textContent = `🎉 WINNER: ${winner} 🎉`;
            logStatus(`Winner selected: ${winner}`);
        }
    }

    animate();
}

// Add participant
function addParticipant(name) {
    if (!name || name.trim() === '') {
        logStatus('ERROR: Name cannot be empty');
        return false;
    }

    name = name.trim();

    // Check if participant already exists
    if (participants.includes(name)) {
        logStatus(`INFO: ${name} is already in the wheel`);
        return false;
    }

    // Check max limit
    if (maxLimit > 0 && participants.length >= maxLimit) {
        logStatus(`ERROR: Max limit reached (${maxLimit})`);
        return false;
    }

    participants.push(name);
    drawWheel();
    updateParticipantDisplay();
    logStatus(`Added: ${name} (${participants.length}/${maxLimit || '∞'})`);
    return true;
}

// Remove participant
function removeParticipant(name) {
    const index = participants.indexOf(name);
    if (index > -1) {
        participants.splice(index, 1);
        drawWheel();
        updateParticipantDisplay();
        logStatus(`Removed: ${name}`);
    }
}

// Remove last participant
function removeLastParticipant() {
    if (participants.length > 0) {
        const removed = participants.pop();
        drawWheel();
        updateParticipantDisplay();
        logStatus(`Removed: ${removed}`);
    }
}

// Clear all participants
function clearAllParticipants() {
    if (participants.length === 0) return;

    const count = participants.length;
    participants = [];
    drawWheel();
    updateParticipantDisplay();
    logStatus(`Cleared ${count} participant(s)`);
}

// Update participant list display
function updateParticipantDisplay() {
    const list = document.getElementById('participantList');
    const count = document.getElementById('participantCount');
    const maxLimitDisplay = document.getElementById('maxLimitDisplay');

    count.textContent = participants.length;
    maxLimitDisplay.textContent = maxLimit > 0 ? ` / ${maxLimit}` : '';

    list.innerHTML = '';
    participants.forEach((participant, index) => {
        const li = document.createElement('li');
        li.innerHTML = `
            <span class="participant-name">${index + 1}. ${participant}</span>
            <button class="btn-remove" data-name="${participant}">×</button>
        `;
        list.appendChild(li);
    });

    // Add remove button event listeners
    document.querySelectorAll('.btn-remove').forEach(btn => {
        btn.addEventListener('click', (e) => {
            removeParticipant(e.target.dataset.name);
        });
    });
}

// Log status messages
function logStatus(message) {
    const statusLog = document.getElementById('statusLog');
    const timestamp = new Date().toLocaleTimeString();
    const entry = document.createElement('div');
    entry.className = 'status-entry';
    entry.textContent = `[${timestamp}] ${message}`;
    statusLog.insertBefore(entry, statusLog.firstChild);

    // Keep only last 10 messages
    while (statusLog.children.length > 10) {
        statusLog.removeChild(statusLog.lastChild);
    }
}

// TikFinity Webhook Server
async function startWebhookServer() {
    const port = document.getElementById('webhookPort').value;

    if (!targetGiftName) {
        logStatus('ERROR: Please set the gift name first');
        return;
    }

    try {
        // In a real implementation, this would start a Node.js server
        // For browser-based implementation, we'll simulate it
        logStatus(`Webhook server starting on port ${port}...`);
        logStatus(`Listening for "${targetGiftName}" gifts from TikFinity`);
        logStatus('SETUP: Configure TikFinity to send webhooks to http://localhost:' + port + '/webhook');

        // Start listening for webhook data via local server
        startWebhookListener(port);
    } catch (error) {
        logStatus(`ERROR: ${error.message}`);
    }
}

// Webhook listener (requires local server - see server.js)
function startWebhookListener(port) {
    // This connects to the local webhook server
    const eventSource = new EventSource(`http://localhost:${port}/events`);

    eventSource.onmessage = function(event) {
        try {
            const data = JSON.parse(event.data);
            handleWebhookData(data);
        } catch (error) {
            logStatus(`ERROR parsing webhook data: ${error.message}`);
        }
    };

    eventSource.onerror = function(error) {
        logStatus('Webhook connection error. Make sure server.js is running!');
        console.error('EventSource error:', error);
    };

    logStatus('Connected to webhook server');
}

// Handle incoming webhook data from TikFinity
function handleWebhookData(data) {
    // TikFinity webhook structure may vary - adjust as needed
    // Expected format: { event: 'gift', username: 'user123', giftName: 'Rose', ... }

    if (data.event === 'gift' && data.giftName === targetGiftName) {
        const username = data.username || data.uniqueId || 'Unknown';
        const success = addParticipant(username);

        if (success) {
            logStatus(`🎁 ${username} sent ${targetGiftName}!`);
        }
    }
}

// Event listeners
function attachEventListeners() {
    document.getElementById('spinBtn').addEventListener('click', spinWheel);

    document.getElementById('addManualBtn').addEventListener('click', () => {
        const input = document.getElementById('manualName');
        addParticipant(input.value);
        input.value = '';
    });

    document.getElementById('manualName').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            addParticipant(e.target.value);
            e.target.value = '';
        }
    });

    document.getElementById('clearAllBtn').addEventListener('click', () => {
        if (confirm('Clear all participants?')) {
            clearAllParticipants();
        }
    });

    document.getElementById('removeLastBtn').addEventListener('click', removeLastParticipant);

    document.getElementById('setLimitBtn').addEventListener('click', () => {
        const value = parseInt(document.getElementById('maxLimit').value) || 0;
        maxLimit = Math.max(0, value);
        updateParticipantDisplay();
        logStatus(`Max limit set to: ${maxLimit || 'No Limit'}`);
    });

    document.getElementById('setGiftBtn').addEventListener('click', () => {
        targetGiftName = document.getElementById('giftName').value.trim();
        if (targetGiftName) {
            logStatus(`Target gift set to: ${targetGiftName}`);
        } else {
            logStatus('ERROR: Gift name cannot be empty');
        }
    });

    document.getElementById('startWebhookBtn').addEventListener('click', startWebhookServer);
}

// Start the application
init();
