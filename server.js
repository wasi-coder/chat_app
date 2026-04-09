const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

// 1. Set up the Express Web Server
const app = express();
const server = http.createServer(app);

// Tell Express to serve your HTML, CSS, and JS files from the "frontend" folder
app.use(express.static(path.join(__dirname, 'frontend'))); 

// 2. Attach the WebSocket Server to the Web Server
const wss = new WebSocket.Server({ server });

console.log("Starting server...");

// --- YOUR EXACT CHAT LOGIC ---
wss.on('connection', (ws) => {
    console.log("A new client connected.");

    ws.on('message', (message) => {
        let data;
        try {
            data = JSON.parse(message);
        } catch (e) {
            return; // Ignore broken messages
        }

        // 1. Handle the user joining the chat
        if (data.type === 'join') {
            ws.userId = data.userId;
            ws.groupId = data.groupId;
            
            console.log(`${ws.userId} joined Group: ${ws.groupId}`);
            
            // Send a welcome message back to the user
            ws.send(JSON.stringify({ 
                system: `Welcome ${ws.userId}! You joined group: ${ws.groupId}` 
            }));

            // --- VALORANT SIDEBAR LOGIC ---
            // Figure out who is currently in this group
            const usersInGroup = [];
            wss.clients.forEach(client => {
                if (client.readyState === WebSocket.OPEN && client.groupId === ws.groupId) {
                    usersInGroup.push(client.userId);
                }
            });

            // Tell EVERYONE in the group the new updated user list
            wss.clients.forEach(client => {
                if (client.readyState === WebSocket.OPEN && client.groupId === ws.groupId) {
                    client.send(JSON.stringify({ 
                        type: 'userList', 
                        users: usersInGroup 
                    }));
                }
            });
            // ------------------------------
            
            return;
        }

        // Security check: Don't let them send messages if they haven't joined
        if (!ws.userId) return;

        // 2. Handle Message Routing
        wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                
                // PUBLIC: Send to absolutely everyone connected to the server
                if (data.type === 'public') {
                    client.send(JSON.stringify({ 
                        from: ws.userId, 
                        text: data.text, 
                        type: 'public' 
                    }));
                } 
                
                // GROUP: Send ONLY to people who typed in the same Group ID
                else if (data.type === 'group') {
                    if (client.groupId === ws.groupId) {
                        client.send(JSON.stringify({ 
                            from: ws.userId, 
                            text: data.text, 
                            type: 'group' 
                        }));
                    }
                } 
                
                // PRIVATE: "Note to Self" - echoes the message back to the sender only
                else if (data.type === 'private') {
                    if (client === ws) {
                        client.send(JSON.stringify({ 
                            from: ws.userId, 
                            text: data.text, 
                            type: 'private' 
                        }));
                    }
                }
            }
        });
    });

    ws.on('close', () => {
        console.log(`${ws.userId || 'A user'} disconnected.`);
        
        // --- VALORANT SIDEBAR LOGIC: DISCONNECT ---
        // When someone leaves, tell everyone else in their group to gray out their name
        if (ws.userId && ws.groupId) {
            wss.clients.forEach(client => {
                if (client.readyState === WebSocket.OPEN && client.groupId === ws.groupId) {
                    client.send(JSON.stringify({ 
                        type: 'userLeft', 
                        userId: ws.userId 
                    }));
                }
            });
        }
        // ------------------------------------------
    });
});

// 3. Start listening on port 8080
server.listen(8080, () => {
    console.log("Web and Chat Server are LIVE on port 8080!");
});