// Wheel state
let participants = [];
let maxLimit = 0; // 0 means no limit
let isSpinning = false;
let webhookServer = null;

// Canvas setup
const canvas = document.getElementById('wheelCanvas');
const ctx = canvas.getContext('2d');
const centerX = canvas.width / 2;
const centerY = canvas.height / 2;
const radius = 320; // Increased from 200 to match larger canvas

// Color palette for wheel segments
const colors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8',
    '#F7DC6F', '#BB8FCE', '#85C1E2', '#F8B739', '#52B788',
    '#E63946', '#A8DADC', '#457B9D', '#F1FAEE', '#E76F51'
];

// LocalStorage functions
function saveToLocalStorage() {
    try {
        localStorage.setItem('wheelParticipants', JSON.stringify(participants));
        localStorage.setItem('wheelMaxLimit', maxLimit.toString());
    } catch (error) {
        console.error('Failed to save to localStorage:', error);
    }
}

function loadFromLocalStorage() {
    try {
        const savedParticipants = localStorage.getItem('wheelParticipants');
        const savedMaxLimit = localStorage.getItem('wheelMaxLimit');

        if (savedParticipants) {
            participants = JSON.parse(savedParticipants);
        }

        if (savedMaxLimit) {
            maxLimit = parseInt(savedMaxLimit, 10) || 0;
            document.getElementById('maxLimit').value = maxLimit > 0 ? maxLimit : '';
        }
    } catch (error) {
        console.error('Failed to load from localStorage:', error);
    }
}

// Initialize
function init() {
    loadFromLocalStorage();
    drawWheel();
    updateParticipantDisplay();
    attachEventListeners();
    updateWebhookUrl();

    if (participants.length > 0) {
        logStatus(`Restored ${participants.length} participant(s) from previous session`);
    } else {
        logStatus('Ready! Configure TikFinity webhook and add participants.');
    }
}

// Update webhook URL display
function updateWebhookUrl() {
    const serverUrl = window.location.origin;
    const webhookUrl = `${serverUrl}/webhook`;
    document.getElementById('webhookUrl').textContent = webhookUrl;
}

// Copy webhook URL to clipboard
function copyWebhookUrl() {
    const webhookUrl = document.getElementById('webhookUrl').textContent;
    const copyBtn = document.getElementById('copyUrlBtn');

    navigator.clipboard.writeText(webhookUrl).then(() => {
        // Visual feedback
        copyBtn.textContent = '✓';
        copyBtn.classList.add('copied');

        logStatus('Webhook URL copied to clipboard!');

        // Reset button after 2 seconds
        setTimeout(() => {
            copyBtn.textContent = '📋';
            copyBtn.classList.remove('copied');
        }, 2000);
    }).catch(err => {
        logStatus('ERROR: Failed to copy to clipboard');
        console.error('Copy failed:', err);
    });
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
        ctx.font = '24px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Add participants', centerX, centerY);
        return;
    }

    const sliceAngle = (2 * Math.PI) / participants.length;
    const offsetAngle = -Math.PI / 2; // Start at top instead of right

    participants.forEach((participant, index) => {
        const startAngle = index * sliceAngle + offsetAngle;
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
        ctx.font = 'bold 18px Arial';

        // Truncate long names
        let displayName = participant;
        if (displayName.length > 15) {
            displayName = displayName.substring(0, 15) + '...';
        }

        ctx.fillText(displayName, radius / 1.8, 5);
        ctx.restore();
    });

    // Draw center circle
    ctx.beginPath();
    ctx.arc(centerX, centerY, 30, 0, 2 * Math.PI);
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

    // Calculate rotation to land on winner
    const sliceAngle = (2 * Math.PI) / participants.length;
    const offsetAngle = -Math.PI / 2; // Slices start at top

    // The winner slice center is already positioned considering the offset
    // Since slices start at top (-π/2), the winner slice center is at:
    const winnerSliceCenter = winnerIndex * sliceAngle + sliceAngle / 2 + offsetAngle;

    // We want the winner to land at the top (arrow position at -π/2)
    const fullRotations = 5 + Math.random() * 2;
    const topPosition = -Math.PI / 2; // -90 degrees (arrow at top)

    // Calculate how much to rotate to align winner at top
    const targetAngle = topPosition - winnerSliceCenter;
    const totalRotation = fullRotations * 2 * Math.PI + targetAngle;

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

    // Check max limit
    if (maxLimit > 0 && participants.length >= maxLimit) {
        logStatus(`ERROR: Max limit reached (${maxLimit})`);
        return false;
    }

    // Allow duplicates - just add the participant
    participants.push(name);
    saveToLocalStorage();
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
        saveToLocalStorage();
        drawWheel();
        updateParticipantDisplay();
        logStatus(`Removed: ${name}`);
    }
}

// Remove last participant
function removeLastParticipant() {
    if (participants.length > 0) {
        const removed = participants.pop();
        saveToLocalStorage();
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
    saveToLocalStorage();
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
    try {
        const serverUrl = window.location.origin;
        logStatus(`Connecting to webhook server...`);
        logStatus(`Listening for gift events from TikFinity`);
        logStatus(`Make sure you've configured TikFinity Actions & Events!`);

        // Start listening for webhook data via server
        startWebhookListener();
    } catch (error) {
        logStatus(`ERROR: ${error.message}`);
    }
}

// Webhook listener (connects to server.js)
function startWebhookListener() {
    // This connects to the webhook server (works with Railway deployment)
    const serverUrl = window.location.origin;
    const eventSource = new EventSource(`${serverUrl}/events`);

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
    // TikFinity sends gift event data when viewer sends a gift
    // Format: { event: 'gift', username: 'user123', giftCount: 15, raw: {...}, timestamp: ... }

    // Display the raw webhook data in debug section
    updateWebhookDebug(data);

    if (data.event === 'gift' && data.username) {
        const username = data.username;
        const giftCount = data.giftCount || 1;

        // Add the participant multiple times based on gift count
        let addedCount = 0;
        for (let i = 0; i < giftCount; i++) {
            const success = addParticipant(username);
            if (success) {
                addedCount++;
            } else {
                // Hit max limit, stop adding
                break;
            }
        }

        if (addedCount > 0) {
            if (giftCount > 1) {
                logStatus(`🎁 ${username} sent ${giftCount} gifts! Added ${addedCount} entries.`);
            } else {
                logStatus(`🎁 ${username} sent a gift!`);
            }
        }
    } else if (data.message) {
        // Handle connection messages
        logStatus(data.message);
    }
}

// Update webhook debug display
function updateWebhookDebug(data) {
    const debugEl = document.getElementById('webhookDebug');
    const timestamp = new Date().toLocaleTimeString();

    // Format the data nicely
    const formattedData = JSON.stringify(data, null, 2);

    debugEl.innerHTML = `<strong>[${timestamp}] Latest Webhook:</strong>\n${formattedData}\n\n<strong>Extracted Values:</strong>\n` +
        `- Username: ${data.username || 'NOT FOUND'}\n` +
        `- Gift Count: ${data.giftCount || 'NOT FOUND (defaulting to 1)'}\n\n` +
        `<strong>Raw Payload (from TikFinity):</strong>\n${JSON.stringify(data.raw, null, 2)}`;
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
        saveToLocalStorage();
        updateParticipantDisplay();
        logStatus(`Max limit set to: ${maxLimit || 'No Limit'}`);
    });

    document.getElementById('startWebhookBtn').addEventListener('click', startWebhookServer);

    // Copy button for webhook URL
    document.getElementById('copyUrlBtn').addEventListener('click', copyWebhookUrl);

    // Clear debug log button
    document.getElementById('clearDebugBtn').addEventListener('click', () => {
        document.getElementById('webhookDebug').innerHTML = 'Debug log cleared. Waiting for next webhook...';
    });
}

// Start the application
init();
