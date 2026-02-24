const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();
app.use(cors());
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*", methods: ["GET", "POST"] } });

const MONGO_URI = process.env.MONGO_URI || "TU_CADENA_AQUI";
mongoose.connect(MONGO_URI).then(() => console.log("📡 DB_OK")).catch(e => console.log(e));

const Trazo = mongoose.model('Trazo', new mongoose.Schema({
    inicio: { x: Number, y: Number }, fin: { x: Number, y: Number },
    color: String, tipo: String, timestamp: { type: Date, default: Date.now, expires: 86400 }
}));

let users = 0;
io.on('connection', async (socket) => {
    users++; io.emit('update-user-count', users);
    const historial = await Trazo.find().sort({ timestamp: 1 });
    historial.forEach(t => socket.emit('linea-received', t));

    socket.on('dibujar-linea', async (data) => {
        socket.broadcast.emit('linea-received', data);
        await new Trazo(data).save();
    });

    socket.on('enviar-mensaje', (data) => io.emit('mensaje-recibido', data));
    socket.on('mouse-move', (data) => socket.broadcast.emit('ghost-move', { id: socket.id, ...data }));
    socket.on('disconnect', () => { users--; io.emit('update-user-count', users); io.emit('ghost-disconnect', socket.id); });
});

server.listen(process.env.PORT || 10000);
