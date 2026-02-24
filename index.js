const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const mongoose = require('mongoose'); // Añadimos Mongoose

const app = express();
app.use(cors());
const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: "*", 
        methods: ["GET", "POST"]
    }
});

// --- CONEXIÓN A MONGODB ---
// Recuerda configurar MONGO_URI en las variables de entorno de Render
const MONGO_URI = process.env.MONGO_URI || "TU_CADENA_DE_CONEXION_AQUI";

mongoose.connect(MONGO_URI)
    .then(() => console.log("📡 CONNECTED_TO_AERONET_DATABASE"))
    .catch(err => console.error("❌ DATABASE_CONNECTION_ERROR:", err));

// Esquema para guardar los trazos
const TrazoSchema = new mongoose.Schema({
    x: Number,
    y: Number,
    lastX: Number,
    lastY: Number,
    color: String,
    tipo: String,
    timestamp: { type: Date, default: Date.now }
});
const Trazo = mongoose.model('Trazo', TrazoSchema);

// --- LÓGICA DEL SISTEMA ---
let connectedUsers = 0;

setInterval(async () => {
    const ahora = new Date();
    const min = ahora.getMinutes();
    const seg = ahora.getSeconds();
    
    if (min === 59 && seg === 0) {
        io.emit('mensaje-recibido', { user: "SYSTEM", text: "⚠️ WARNING: DATABASE PURGE IN 60s", avatar: "https://cdn-icons-png.flaticon.com/512/3950/3950815.png" });
    }
    if (min === 59 && seg >= 50) {
        io.emit('cuenta-atras', 60 - seg);
    }
    if (min === 0 && seg === 0) {
        await Trazo.deleteMany({}); // Borra la base de datos físicamente
        io.emit('pizarra-limpia');
        io.emit('mensaje-recibido', { user: "SYSTEM", text: "🔄 MEMORY WIPED. NEW CYCLE STARTED.", avatar: "https://cdn-icons-png.flaticon.com/512/3950/3950815.png" });
    }
}, 1000);

// --- GESTIÓN DE SOCKETS ---
io.on('connection', async (socket) => {
    connectedUsers++;
    io.emit('update-user-count', connectedUsers);

    // 1. Enviar los dibujos guardados al nuevo usuario
    try {
        const historial = await Trazo.find().sort({ timestamp: 1 });
        historial.forEach(linea => {
            socket.emit('linea-received', linea);
        });
    } catch (err) {
        console.error("Error cargando historial:", err);
    }

    socket.on('mouse-move', (data) => {
        socket.broadcast.emit('ghost-move', { id: socket.id, ...data });
    });

    socket.on('dibujar-linea', async (data) => {
        socket.broadcast.emit('linea-received', data);
        // 2. Guardar el trazo en la base de datos
        const nuevoTrazo = new Trazo(data);
        await nuevoTrazo.save();
    });

    socket.on('enviar-mensaje', (data) => {
        io.emit('mensaje-recibido', { ...data, socketId: socket.id, isPrivate: false });
    });

    socket.on('enviar-privado', (data) => {
        socket.to(data.toId).emit('mensaje-privado-recibido', {
            ...data,
            fromId: socket.id 
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
    console.log(`🚀 AERONET_SERVER_ACTIVE_ON_PORT_${PORT}`);
});
