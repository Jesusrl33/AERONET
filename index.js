const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());
const server = http.createServer(app);
// En server.js busca la parte de io y déjala así:
const io = new Server(server, {
    cors: {
        origin: "*", // Esto permite que cualquier origen se conecte
        methods: ["GET", "POST"]
    }
});
let connectedUsers = 0;

setInterval(() => {
    const ahora = new Date();
    const min = ahora.getMinutes();
    const seg = ahora.getSeconds();
    if (min === 59 && seg === 0) {
        io.emit('mensaje-recibido', { user: "SYSTEM", text: "⚠️ WARNING: DATABASE PURGE IN 60s", avatar: "avatars/system.png" });
    }
    if (min === 59 && seg >= 50) {
        io.emit('cuenta-atras', 60 - seg);
    }
    if (min === 0 && seg === 0) {
        io.emit('pizarra-limpia');
        io.emit('mensaje-recibido', { user: "SYSTEM", text: "🔄 MEMORY WIPED. NEW CYCLE STARTED.", avatar: "avatars/system.png" });
    }
}, 1000);

io.on('connection', (socket) => {
    connectedUsers++;
    io.emit('update-user-count', connectedUsers);

    socket.on('mouse-move', (data) => {
        socket.broadcast.emit('ghost-move', { id: socket.id, ...data });
    });

    socket.on('dibujar-linea', (data) => {
        socket.broadcast.emit('linea-received', data);
    });

    socket.on('enviar-mensaje', (data) => {
        io.emit('mensaje-recibido', { ...data, socketId: socket.id, isPrivate: false });
    });

    socket.on('enviar-privado', (data) => {
        socket.to(data.toId).emit('mensaje-privado-recibido', {
            ...data,
            fromId: socket.id // ID para que el receptor pueda responder
        });
    });

    socket.on('disconnect', () => {
        connectedUsers--;
        io.emit('update-user-count', connectedUsers);
        io.emit('ghost-disconnect', socket.id);
    });
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
    console.log(`🚀 AERONET_SERVER_ACTIVE_ON_PORT_${10000}`);

});
