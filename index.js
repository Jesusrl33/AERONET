const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();
app.use(cors());
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*", methods: ["GET", "POST"] } });

// --- CONEXIÓN MONGODB ---
const MONGO_URI = process.env.MONGO_URI || "TU_CADENA_DE_CONEXION_AQUI";
mongoose.connect(MONGO_URI).then(() => console.log("📡 DB_CONNECTED")).catch(e => console.log(e));

const TrazoSchema = new mongoose.Schema({
    inicio: { x: Number, y: Number },
    fin: { x: Number, y: Number },
    color: String,
    grosor: Number,
    tipo: String,
    timestamp: { type: Date, default: Date.now }
});
const Trazo = mongoose.model('Trazo', TrazoSchema);

// --- LÓGICA ---
let connectedUsers = 0;

io.on('connection', async (socket) => {
    connectedUsers++;
    io.emit('update-user-count', connectedUsers);

    // Enviar historial al entrar
    const historial = await Trazo.find().sort({ timestamp: 1 });
    historial.forEach(t => socket.emit('linea-received', t));

    socket.on('dibujar-linea', async (data) => {
        socket.broadcast.emit('linea-received', data);
        await new Trazo(data).save(); // Persistencia
    });

    socket.on('enviar-mensaje', (data) => {
        io.emit('mensaje-recibido', { ...data, socketId: socket.id });
    });

    socket.on('enviar-privado', (data) => {
        socket.to(data.toId).emit('mensaje-privado-recibido', { ...data, fromId: socket.id });
    });

    socket.on('mouse-move', (data) => {
        socket.broadcast.emit('ghost-move', { id: socket.id, ...data });
    });

    socket.on('disconnect', () => {
        connectedUsers--;
        io.emit('update-user-count', connectedUsers);
        io.emit('ghost-disconnect', socket.id);
    });
});

server.listen(process.env.PORT || 10000, () => console.log("🚀 SERVER_RUNNING"));
