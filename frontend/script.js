let ws;
let currentUserId = '';
let knownUsers = {}; // This dictionary tracks everyone's online/offline status

function connectAndJoin() {
    const userId = document.getElementById('userId').value.trim();
    const groupId = document.getElementById('groupId').value.trim();

    if (!userId || !groupId) {
        alert("Please enter both a Username and a Group ID.");
        return;
    }

    currentUserId = userId;

    // Connect to your local server
    ws = new WebSocket('ws://localhost:8080');

    ws.onopen = () => {
        // Hide Login, Show App
        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('appScreen').style.display = 'flex';
        
        // Update the top chat header
        document.getElementById('headerGroupTitle').innerText = `Group: ${groupId}`;
        
        // Clear old chats and reset the friends list on fresh connection
        document.getElementById('chatBox').innerHTML = ''; 
        knownUsers = {}; 

        // Send the required join payload to the backend
        const joinMsg = { type: 'join', userId: userId, groupId: groupId };
        ws.send(JSON.stringify(joinMsg));
    };

    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        
        // --- VALORANT SIDEBAR LOGIC ---
        // 1. Handle receiving the full list of online users
        if (data.type === 'userList') {
            // Mark all users in the list as active
            data.users.forEach(user => knownUsers[user] = true);
            renderFriendsList();
        } 
        // 2. Handle a user leaving (gray them out)
        else if (data.type === 'userLeft') {
            knownUsers[data.userId] = false; // Mark as inactive instead of deleting
            renderFriendsList();
        }
        
        // --- STANDARD CHAT LOGIC ---
        else if (data.system) {
            appendSystemMessage(data.system);
        } else if (data.error) {
            appendSystemMessage(`Error: ${data.error}`);
        } else {
            const isSelf = data.from === currentUserId;
            appendMessage(data.from, data.text, isSelf, data.type);
        }
    };

    ws.onclose = () => {
        document.getElementById('loginScreen').style.display = 'flex';
        document.getElementById('appScreen').style.display = 'none';
        currentUserId = '';
        alert("Connection lost or closed.");
    };
    
    ws.onerror = (err) => {
        console.error("WebSocket error:", err);
    };
}

function disconnect() {
    if (ws) ws.close();
}

function handleKeyPress(event) {
    if (event.key === 'Enter') {
        sendMessage();
    }
}

function sendMessage() {
    const textInput = document.getElementById('messageText');
    const typeSelector = document.getElementById('messageType');
    const text = textInput.value.trim();
    const type = typeSelector.value;

    if (!text) return;

    const payload = { type: type, text: text };
    ws.send(JSON.stringify(payload));
    
    textInput.value = ''; 
    textInput.focus();
}

// Helper to get current time like "10:45 AM"
function getCurrentTime() {
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function appendSystemMessage(text) {
    const chatBox = document.getElementById('chatBox');
    const div = document.createElement('div');
    div.className = 'sys-msg';
    div.innerText = text;
    chatBox.appendChild(div);
    chatBox.scrollTop = chatBox.scrollHeight;
}

function appendMessage(sender, text, isSelf, msgType) {
    const chatBox = document.getElementById('chatBox');
    
    const alignClass = isSelf ? 'self' : 'other';
    const timeString = getCurrentTime();
    
    // Determine badge HTML
    let badgeHtml = '';
    if (msgType === 'public') badgeHtml = `<span class="badge badge-public">Public</span>`;
    if (msgType === 'group') badgeHtml = `<span class="badge badge-group">Group</span>`;
    if (msgType === 'private') badgeHtml = `<span class="badge badge-private">Private</span>`;

    // Build the HTML for the message
    const msgHtml = `
        <div class="msg-row ${alignClass}">
            <div class="msg-meta">
                <span class="msg-sender">${sender}</span>
                <span>${timeString}</span>
            </div>
            <div class="msg-bubble">
                ${badgeHtml}
                ${text}
            </div>
        </div>
    `;

    // Append to chat area
    chatBox.insertAdjacentHTML('beforeend', msgHtml);
    chatBox.scrollTop = chatBox.scrollHeight;
}

// Renders the Sidebar Friends List
function renderFriendsList() {
    const list = document.getElementById('friendsList');
    if (!list) return;
    list.innerHTML = '';

    // Sort users: Active users first, then inactive. Alphabetical within those groups.
    const sortedUsers = Object.keys(knownUsers).sort((a, b) => {
        if (knownUsers[a] === knownUsers[b]) return a.localeCompare(b);
        return knownUsers[a] ? -1 : 1;
    });

    sortedUsers.forEach(user => {
        const isActive = knownUsers[user];
        const li = document.createElement('li');
        
        // Apply 'active' or 'inactive' class
        li.className = `friend-item ${isActive ? 'active' : 'inactive'}`;
        
        // Add a "(You)" tag so you know which one is you
        const displayName = user === currentUserId ? `${user} (You)` : user;

        li.innerHTML = `
            <div class="status-dot"></div> 
            <span>${displayName}</span>
        `;
        list.appendChild(li);
    });
}