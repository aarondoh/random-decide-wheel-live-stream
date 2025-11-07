// Wheel state
let participants = [];
let maxLimit = 0; // 0 means no limit
let minCoins = 0; // Minimum coins required for one entry (0 = disabled)
let userCoinBalances = {}; // Track remaining coins per user: {username: coinAmount}
let userStats = {}; // Track stats per user: {username: {totalCoins: X, submissions: Y}}
let isSpinning = false;
let webhookServer = null;
let processedWebhooks = new Map(); // Track processed webhooks with timestamps: hash -> timestamp
let giftCombos = new Map(); // Track gift combos: "username-giftId" -> {coins, repeatCount, timestamp, processed}
let pendingGifts = new Map(); // Track pending gifts waiting for combo: "username-giftId" -> {data, timeoutId}

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
        localStorage.setItem('wheelMinCoins', minCoins.toString());
        localStorage.setItem('wheelUserCoinBalances', JSON.stringify(userCoinBalances));
        localStorage.setItem('wheelUserStats', JSON.stringify(userStats));
    } catch (error) {
        console.error('Failed to save to localStorage:', error);
    }
}

function loadFromLocalStorage() {
    try {
        const savedParticipants = localStorage.getItem('wheelParticipants');
        const savedMaxLimit = localStorage.getItem('wheelMaxLimit');
        const savedMinCoins = localStorage.getItem('wheelMinCoins');
        const savedCoinBalances = localStorage.getItem('wheelUserCoinBalances');
        const savedUserStats = localStorage.getItem('wheelUserStats');

        if (savedParticipants) {
            participants = JSON.parse(savedParticipants);
        }

        if (savedMaxLimit !== null) {
            maxLimit = parseInt(savedMaxLimit, 10) || 0;
            document.getElementById('maxLimit').value = maxLimit > 0 ? maxLimit : '';
        }

        if (savedMinCoins) {
            minCoins = parseInt(savedMinCoins, 10) || 0;
            document.getElementById('minCoins').value = minCoins > 0 ? minCoins : '';
        }

        if (savedCoinBalances) {
            userCoinBalances = JSON.parse(savedCoinBalances);
        }

        if (savedUserStats) {
            userStats = JSON.parse(savedUserStats);
        }
    } catch (error) {
        console.error('Failed to load from localStorage:', error);
    }
}

// Update leaderboard display
function updateLeaderboard() {
    const leaderboardList = document.getElementById('leaderboardList');
    const showAllBtn = document.getElementById('showAllLeaderboardBtn');

    // Convert userStats to array and sort by totalCoins descending
    const sortedUsers = Object.entries(userStats)
        .map(([username, stats]) => ({ username, ...stats }))
        .sort((a, b) => b.totalCoins - a.totalCoins);

    // Show top 10 by default
    const isShowingAll = showAllBtn && showAllBtn.textContent.includes('Hide');
    const displayUsers = isShowingAll ? sortedUsers : sortedUsers.slice(0, 10);

    leaderboardList.innerHTML = '';

    if (displayUsers.length === 0) {
        leaderboardList.innerHTML = '<li class="leaderboard-empty">No data yet...</li>';
        if (showAllBtn) showAllBtn.style.display = 'none';
        return;
    }

    displayUsers.forEach((user, index) => {
        const rank = sortedUsers.findIndex(u => u.username === user.username) + 1;
        const li = document.createElement('li');
        li.className = 'leaderboard-item';

        // Add medal for top 3
        let medal = '';
        if (rank === 1) medal = '🥇';
        else if (rank === 2) medal = '🥈';
        else if (rank === 3) medal = '🥉';

        li.innerHTML = `
            <span class="leaderboard-rank">${medal || `#${rank}`}</span>
            <span class="leaderboard-username">${user.username}</span>
            <span class="leaderboard-stats">
                <span class="leaderboard-coins">💰${user.totalCoins}</span>
                <span class="leaderboard-submissions">🎫${user.submissions}</span>
            </span>
        `;
        leaderboardList.appendChild(li);
    });

    // Show/hide "Show All" button
    if (showAllBtn) {
        if (sortedUsers.length > 10) {
            showAllBtn.style.display = 'block';
            showAllBtn.textContent = isShowingAll ? 'Show Top 10' : `Show All (${sortedUsers.length})`;
        } else {
            showAllBtn.style.display = 'none';
        }
    }
}

// Initialize
function init() {
    loadFromLocalStorage();
    drawWheel();
    updateParticipantDisplay();
    updateLeaderboard();
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
            // Spin complete - determine winner based on final rotation
            // Normalize rotation to 0-2π range
            const normalizedRotation = ((currentRotation % (2 * Math.PI)) + (2 * Math.PI)) % (2 * Math.PI);

            // The arrow points at -π/2 (top). After rotation, which slice is there?
            // We need to find which slice's range includes the top position
            const topPosition = -Math.PI / 2;

            // Calculate the angle at the top after rotation (inverse rotation)
            const angleAtTop = (topPosition - normalizedRotation + (2 * Math.PI)) % (2 * Math.PI);

            // Adjust for the offset angle (slices start at -π/2)
            const adjustedAngle = (angleAtTop + Math.PI / 2 + (2 * Math.PI)) % (2 * Math.PI);

            // Which slice does this angle fall into?
            const actualWinnerIndex = Math.floor(adjustedAngle / sliceAngle) % participants.length;
            const actualWinner = participants[actualWinnerIndex];

            isSpinning = false;
            document.getElementById('spinBtn').disabled = false;
            document.getElementById('winnerDisplay').textContent = `🎉 WINNER: ${actualWinner} 🎉`;
            logStatus(`Winner selected: ${actualWinner}`);
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

// Process gift and add participants (actual processing logic)
function processGift(data) {
    const username = data.username;
    const coinValue = data.coinValue || 0;
    const giftCount = data.giftCount || 1;
    const giftId = data.raw?.giftId || 'unknown';
    const repeatCount = parseInt(data.raw?.repeatCount || data.giftCount || 1);
    const comboKey = `${username}-${giftId}`;

    console.log(`[Processing Gift] ${username}: ${repeatCount}x gift, ${coinValue} coins`);

    // If minCoins is disabled (0), use old behavior (gift count based)
    if (minCoins === 0 || minCoins === null) {
        // Initialize user stats if not exists
        if (!userStats[username]) {
            userStats[username] = { totalCoins: 0, submissions: 0 };
        }

        // Track coins even in gift count mode
        userStats[username].totalCoins += coinValue;

        // Add the participant multiple times based on gift count
        let addedCount = 0;
        for (let i = 0; i < giftCount; i++) {
            const success = addParticipant(username);
            if (success) {
                addedCount++;
                userStats[username].submissions++;
            } else {
                // Hit max limit, stop adding
                break;
            }
        }

        // Mark this combo as processed
        const combo = giftCombos.get(comboKey);
        if (combo && combo.repeatCount === repeatCount) {
            combo.processed = true;
            giftCombos.set(comboKey, combo);
        }

        saveToLocalStorage();
        updateLeaderboard();

        if (addedCount > 0) {
            if (giftCount > 1) {
                logStatus(`🎁 ${username} sent ${giftCount} gifts! Added ${addedCount} entries.`);
            } else {
                logStatus(`🎁 ${username} sent a gift!`);
            }
        }
    } else {
        // Coin-based system is active
        const totalCoins = coinValue;

        // Initialize user stats and balance if not exists
        if (!userCoinBalances[username]) {
            userCoinBalances[username] = 0;
        }
        if (!userStats[username]) {
            userStats[username] = { totalCoins: 0, submissions: 0 };
        }

        // Add coins to user's balance and total
        userCoinBalances[username] += totalCoins;
        userStats[username].totalCoins += totalCoins;
        saveToLocalStorage();
        updateLeaderboard();

        logStatus(`💰 ${username} sent ${totalCoins} coins (Balance: ${userCoinBalances[username]})`);

        // Check how many entries they've earned
        const entriesEarned = Math.floor(userCoinBalances[username] / minCoins);

        if (entriesEarned > 0) {
            // Add entries and deduct coins
            let addedCount = 0;
            for (let i = 0; i < entriesEarned; i++) {
                const success = addParticipant(username);
                if (success) {
                    addedCount++;
                    userCoinBalances[username] -= minCoins;
                    userStats[username].submissions++;
                } else {
                    // Hit max limit, stop adding
                    break;
                }
            }

            saveToLocalStorage();
            updateLeaderboard();

            if (addedCount > 0) {
                logStatus(`✅ ${username} earned ${addedCount} entr${addedCount > 1 ? 'ies' : 'y'}! Remaining: ${userCoinBalances[username]} coins`);
            }
        }

        // Mark this combo as processed
        const combo = giftCombos.get(comboKey);
        if (combo && combo.repeatCount === repeatCount) {
            combo.processed = true;
            giftCombos.set(comboKey, combo);
        }
    }
}

// Handle incoming webhook data from TikFinity
function handleWebhookData(data) {
    // TikFinity sends gift event data when viewer sends a gift
    // Format: { event: 'gift', username: 'user123', giftCount: 15, coinValue: 1000, raw: {...}, timestamp: ... }

    // Display the raw webhook data in debug section
    updateWebhookDebug(data);

    // Handle TikTok gift combos and duplicates
    if (data.event === 'gift' && data.username) {
        const giftId = data.raw?.giftId || 'unknown';
        const repeatCount = parseInt(data.raw?.repeatCount || data.giftCount || 1);
        const coinValue = data.coinValue || 0;
        const now = Date.now();
        const comboKey = `${data.username}-${giftId}`;
        const webhookHash = `${data.username}-${giftId}-${coinValue}-${repeatCount}`;

        console.log(`[Gift Check] User: ${data.username}, Gift: ${giftId}, Coins: ${coinValue}, Repeat: ${repeatCount}`);

        // Check for exact duplicate (same webhook sent twice by TikFinity)
        const recentDuplicate = Array.from(processedWebhooks.entries())
            .find(([key, timestamp]) => {
                const timeDiff = now - timestamp;
                return key === webhookHash && timeDiff < 5000;
            });

        if (recentDuplicate) {
            console.log('✋ Exact duplicate webhook, ignoring...', webhookHash);
            logStatus(`⚠️ Duplicate gift ignored: ${data.username} - ${coinValue} coins (x${repeatCount})`);
            return;
        }

        // Check for combo (user sent gift, then combo'd it within 30 seconds)
        const existingCombo = giftCombos.get(comboKey);
        const hasPendingGift = pendingGifts.has(comboKey);

        if (existingCombo && (now - existingCombo.timestamp) < 30000) {
            console.log(`[Combo Check] Found existing: ${existingCombo.repeatCount}x (processed: ${existingCombo.processed}), New: ${repeatCount}x`);

            // If new repeatCount is HIGHER, this is a combo upgrade
            if (repeatCount > existingCombo.repeatCount) {
                console.log(`✓ Combo upgrade detected! ${existingCombo.repeatCount}x → ${repeatCount}x`);
                logStatus(`🎯 Gift combo: ${data.username} upgraded to ${repeatCount}x ${data.raw?.giftName || 'gifts'}`);

                // Cancel pending processing - we'll wait for the next upgrade or timeout
                if (hasPendingGift) {
                    const pending = pendingGifts.get(comboKey);
                    if (pending && pending.timeoutId) {
                        clearTimeout(pending.timeoutId);
                    }
                    pendingGifts.delete(comboKey);
                    console.log('✓ Cancelled pending - waiting for more upgrades');
                }

                // Update combo tracking with new higher value
                giftCombos.set(comboKey, {
                    coins: coinValue,
                    repeatCount: repeatCount,
                    timestamp: now,
                    processed: false
                });

                // DO NOT process immediately - continue to delay logic below
            } else if (repeatCount < existingCombo.repeatCount) {
                // Lower repeatCount - this is out-of-order or already upgraded
                console.log('✋ Ignoring lower repeatCount (already have higher combo)');
                logStatus(`⚠️ Ignored: ${data.username} - lower combo value`);
                return;
            } else if (repeatCount === existingCombo.repeatCount) {
                // Same repeatCount - check if already processed
                if (existingCombo.processed) {
                    console.log('✋ Ignoring - already processed this combo');
                    logStatus(`⚠️ Duplicate gift ignored: ${data.username} - ${coinValue} coins (x${repeatCount})`);
                    return;
                } else {
                    // Same value but not processed - this is the duplicate at the end
                    console.log('✋ Duplicate final webhook - ignoring');
                    logStatus(`⚠️ Duplicate gift ignored: ${data.username} - ${coinValue} coins (x${repeatCount})`);
                    return;
                }
            }
        }

        // Store webhook hash to prevent exact duplicates
        processedWebhooks.set(webhookHash, now);

        // For gifts over 99 coins, delay processing to wait for potential combo
        if (coinValue > 99) {
            console.log(`⏳ Delaying processing for ${repeatCount}x gift (${coinValue} coins) - waiting for combo...`);

            // Cancel any existing pending gift for this combo
            if (hasPendingGift) {
                const pending = pendingGifts.get(comboKey);
                if (pending && pending.timeoutId) {
                    clearTimeout(pending.timeoutId);
                }
            }

            // Track this gift in combo system
            giftCombos.set(comboKey, {
                coins: coinValue,
                repeatCount: repeatCount,
                timestamp: now,
                processed: false
            });

            // Schedule processing after 5 second delay (allows time for multiple back-to-back gifts)
            const timeoutId = setTimeout(() => {
                console.log(`✓ Delay complete - processing ${repeatCount}x gift now`);
                processGift(data);
                pendingGifts.delete(comboKey);
            }, 5000);

            pendingGifts.set(comboKey, { data, timeoutId });
        } else {
            // Low value gifts - process immediately
            giftCombos.set(comboKey, {
                coins: coinValue,
                repeatCount: repeatCount,
                timestamp: now,
                processed: false
            });
            processGift(data);
        }

        // Clean up old entries
        for (const [key, timestamp] of processedWebhooks.entries()) {
            if (now - timestamp > 5000) processedWebhooks.delete(key);
        }
        for (const [key, combo] of giftCombos.entries()) {
            if (now - combo.timestamp > 30000) giftCombos.delete(key);
        }
    } else if (data.message) {
        // Handle connection messages
        logStatus(data.message);
    }
}

// Store webhook history
let webhookHistory = [];

// Update webhook debug display
function updateWebhookDebug(data) {
    const debugEl = document.getElementById('webhookDebug');
    const timestamp = new Date().toLocaleTimeString();

    // Add to history (keep last 10)
    webhookHistory.unshift({ timestamp, data });
    if (webhookHistory.length > 10) {
        webhookHistory.pop();
    }

    // Build display with all history entries
    let displayHTML = '<strong>Webhook History (Last 10):</strong>\n\n';

    webhookHistory.forEach((entry, index) => {
        const separator = index > 0 ? '\n\n' + '='.repeat(80) + '\n\n' : '';
        const formattedData = JSON.stringify(entry.data, null, 2);

        displayHTML += separator +
            `<strong>[${entry.timestamp}] Webhook #${webhookHistory.length - index}:</strong>\n${formattedData}\n\n` +
            `<strong>Extracted Values:</strong>\n` +
            `- Username: ${entry.data.username || 'NOT FOUND'}\n` +
            `- Gift Count: ${entry.data.giftCount || 'NOT FOUND (defaulting to 1)'}\n` +
            `- Coin Value: ${entry.data.coinValue || 'NOT FOUND (defaulting to 0)'}\n\n` +
            `<strong>Raw Payload:</strong>\n${JSON.stringify(entry.data.raw, null, 2)}`;
    });

    debugEl.innerHTML = displayHTML;
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

    document.getElementById('setMinCoinsBtn').addEventListener('click', () => {
        const value = parseInt(document.getElementById('minCoins').value) || 0;
        minCoins = Math.max(0, value);
        saveToLocalStorage();
        if (minCoins > 0) {
            logStatus(`Min coins per entry set to: ${minCoins} (Coin tracking enabled)`);
        } else {
            logStatus(`Min coins disabled - using gift count mode`);
        }
    });

    document.getElementById('clearCoinBalancesBtn').addEventListener('click', () => {
        if (confirm('Clear all user coin balances and leaderboard stats? This will reset everyone to 0 coins and submissions.')) {
            userCoinBalances = {};
            userStats = {};
            saveToLocalStorage();
            updateLeaderboard();
            logStatus('All coin balances and leaderboard stats cleared');
        }
    });

    document.getElementById('startWebhookBtn').addEventListener('click', startWebhookServer);

    // Test combo simulation button
    document.getElementById('testMultipleBtn').addEventListener('click', async () => {
        const giftCount = parseInt(document.getElementById('testGiftCount').value) || 10;
        const serverUrl = window.location.origin;

        try {
            const response = await fetch(`${serverUrl}/test-webhook`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: 'TestUser',
                    giftCount: giftCount,
                    giftId: '11046',
                    giftName: 'Galaxy'
                })
            });

            const result = await response.json();
            logStatus(`🧪 Test: Simulating ${giftCount}x Galaxy combo (3 webhooks: 1x → ${giftCount}x → ${giftCount}x duplicate)`);
        } catch (error) {
            logStatus(`ERROR: Test failed - ${error.message}`);
        }
    });

    // Copy button for webhook URL
    document.getElementById('copyUrlBtn').addEventListener('click', copyWebhookUrl);

    // Clear debug log button
    document.getElementById('clearDebugBtn').addEventListener('click', () => {
        webhookHistory = [];
        document.getElementById('webhookDebug').innerHTML = 'Debug log cleared. Waiting for next webhook...';
    });

    // Show all leaderboard button
    document.getElementById('showAllLeaderboardBtn').addEventListener('click', () => {
        updateLeaderboard();
    });
}

// Make leaderboard draggable
function makeLeaderboardDraggable() {
    const leaderboard = document.querySelector('.leaderboard');
    let isDragging = false;
    let currentX;
    let currentY;
    let initialX;
    let initialY;
    let xOffset = 0;
    let yOffset = 0;

    // Load saved position from localStorage
    const savedPosition = localStorage.getItem('leaderboardPosition');
    if (savedPosition) {
        const { x, y } = JSON.parse(savedPosition);
        xOffset = x;
        yOffset = y;
        leaderboard.style.transform = `translate(${x}px, ${y}px)`;
    }

    leaderboard.addEventListener('mousedown', dragStart);
    document.addEventListener('mousemove', drag);
    document.addEventListener('mouseup', dragEnd);

    function dragStart(e) {
        // Only start drag if clicking on the header or empty space (not buttons, etc.)
        if (e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT' || e.target.closest('.leaderboard-item')) {
            return;
        }

        initialX = e.clientX - xOffset;
        initialY = e.clientY - yOffset;

        if (e.target === leaderboard || e.target.closest('.leaderboard h2')) {
            isDragging = true;
            leaderboard.style.cursor = 'grabbing';
        }
    }

    function drag(e) {
        if (isDragging) {
            e.preventDefault();
            currentX = e.clientX - initialX;
            currentY = e.clientY - initialY;

            xOffset = currentX;
            yOffset = currentY;

            leaderboard.style.transform = `translate(${currentX}px, ${currentY}px)`;
        }
    }

    function dragEnd(e) {
        if (isDragging) {
            initialX = currentX;
            initialY = currentY;
            isDragging = false;
            leaderboard.style.cursor = 'grab';

            // Save position to localStorage
            localStorage.setItem('leaderboardPosition', JSON.stringify({ x: xOffset, y: yOffset }));
        }
    }
}

// Start the application
init();
makeLeaderboardDraggable();
