// --- CONFIGURACIÓN INICIAL ---
const socket = io('https://aeronet-v4.onrender.com');
const canvas = document.getElementById('pizarra');
const ctx = canvas.getContext('2d');

let usuarioActual = "";
let avatarActual = "https://cdn-icons-png.flaticon.com/512/149/149071.png";
let avatarSeleccionadoTemp = avatarActual;
let avatarElegido = false;

// Variables de estado del dibujo
let dibujando = false;
let ultimoPunto = null;
let gotas = 5;
let tiempo = 60;
let tipoPincel = "normal"; // 'normal', 'neon', 'spray'

// Ajustar tamaño del canvas al iniciar y al redimensionar
function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

// --- GESTIÓN DE AVATARES (Rutas corregidas) ---
// Genera la lista basada en tus archivos: "avatars/avatar (1).jpg"
const avatarList = Array.from({length: 15}, (_, i) => `avatars/avatar (${i + 1}).jpg`);

function initAvatarGrid() {
    const container = document.getElementById('avatar-grid-container');
    container.innerHTML = '';
    avatarList.forEach(url => {
        const img = document.createElement('img');
        img.src = url;
        img.className = `avatar-option ${url === avatarActual ? 'selected' : ''}`;
        img.onclick = () => {
            avatarSeleccionadoTemp = url;
            document.querySelectorAll('.avatar-option').forEach(el => el.classList.remove('selected'));
            img.classList.add('selected');
        };
        container.appendChild(img);
    });
}

function openAvatarModal() { 
    document.getElementById('avatar-modal').style.display = 'flex'; 
    initAvatarGrid(); 
}

function closeAvatarModal() { 
    document.getElementById('avatar-modal').style.display = 'none'; 
}

function confirmAvatarSelection() {
    avatarActual = avatarSeleccionadoTemp;
    avatarElegido = true;
    document.getElementById('current-avatar-img').src = avatarActual;
    document.getElementById('current-avatar-img').style.opacity = "1";
    closeAvatarModal();
}

// --- LOGIN Y SISTEMA DE RECARGA ---
function entrar() {
    usuarioActual = document.getElementById('username').value.trim();
    if(!usuarioActual || !avatarElegido) return alert("ERROR: IDENT_REQUIRED & AVATAR_UNIT_REQUIRED");

    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('main-ui').style.display = 'block';
    document.getElementById('display-user').innerText = usuarioActual;
    document.getElementById('taskbar-avatar').src = avatarActual;
    
    iniciarContadores();
}

function iniciarContadores() {
    setInterval(() => {
        if(gotas < 5) {
            tiempo--;
            if(tiempo <= 0) {
                gotas++;
                tiempo = 60;
            }
            document.getElementById('timer').innerText = tiempo;
            document.getElementById('drops').innerText = gotas;
        }
    }, 1000);
}

// --- LÓGICA DE HERRAMIENTAS ---
function setTipo(t, el) {
    tipoPincel = t;
    // Actualizar feedback visual en los botones
    document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active'));
    el.classList.add('active');
}

// --- DIBUJO (RATÓN Y TÁCTIL UNIFICADO) ---
function getPos(e) {
    const rect = canvas.getBoundingClientRect();
    const t = e.touches ? e.touches[0] : e;
    return { x: t.clientX - rect.left, y: t.clientY - rect.top };
}

function empezarDibujo(e) {
    if(gotas <= 0) return;
    dibujando = true;
    ultimoPunto = getPos(e);
}

function moverDibujo(e) {
    const p = getPos(e);
    // Mostrar coordenadas en la UI
    const coords = document.getElementById('coords');
    if(coords) coords.innerText = `LAT: ${p.x.toFixed(0)} | LON: ${p.y.toFixed(0)}`;
    
    // Emitir posición del cursor "fantasma"
    if(usuarioActual) socket.emit('mouse-move', { x: p.x, y: p.y, user: usuarioActual, avatar: avatarActual });

    if(!dibujando) return;

    const datosTrazo = {
        inicio: ultimoPunto,
        fin: p,
        color: document.getElementById('colorPicker').value,
        tipo: tipoPincel,
        usuario: usuarioActual
    };

    dibujar(datosTrazo);
    socket.emit('dibujar-linea', datosTrazo);
    ultimoPunto = p;
}

function pararDibujo() {
    if(dibujando) {
        dibujando = false;
        gotas--;
        document.getElementById('drops').innerText = gotas;
    }
}

// Event Listeners de dibujo
canvas.addEventListener('mousedown', empezarDibujo);
window.addEventListener('mousemove', moverDibujo);
window.addEventListener('mouseup', pararDibujo);

canvas.addEventListener('touchstart', (e) => { e.preventDefault(); empezarDibujo(e); }, {passive: false});
canvas.addEventListener('touchmove', (e) => { e.preventDefault(); moverDibujo(e); }, {passive: false});
canvas.addEventListener('touchend', pararDibujo);

function dibujar(d) {
    ctx.beginPath();
    ctx.strokeStyle = d.color;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if(d.tipo === 'neon') {
        ctx.lineWidth = 10;
        ctx.shadowBlur = 15;
        ctx.shadowColor = d.color;
    } else if(d.tipo === 'spray') {
        ctx.lineWidth = 1;
        for(let i=0; i<15; i++) {
            ctx.fillStyle = d.color;
            ctx.fillRect(d.fin.x + (Math.random()-0.5)*30, d.fin.y + (Math.random()-0.5)*30, 1.5, 1.5);
        }
        return; // El spray no usa stroke()
    } else {
        ctx.lineWidth = 3;
        ctx.shadowBlur = 0;
    }

    ctx.moveTo(d.inicio.x, d.inicio.y);
    ctx.lineTo(d.fin.x, d.fin.y);
    ctx.stroke();
    ctx.shadowBlur = 0; // Resetear brillo para el siguiente trazo
}

// --- COMUNICACIÓN SOCKET.IO ---

// 1. Recibir trazos de otros (y del historial de MongoDB)
socket.on('linea-received', (data) => {
    dibujar(data);
});

// 2. Chat Global
socket.on('mensaje-recibido', (data) => {
    const m = document.getElementById('messages');
    m.innerHTML += `
        <div class="msg-box">
            <img src="${data.avatar}" style="width:18px; height:18px; border-radius:50%; vertical-align:middle; border:1px solid var(--neon);">
            <b style="color:var(--neon); cursor:pointer;">${data.user}:</b> 
            <span>${data.text.toUpperCase()}</span>
        </div>
    `;
    m.scrollTop = m.scrollHeight;
});

// Enviar mensaje
document.getElementById('msg-input').onkeypress = (e) => {
    if(e.key === 'Enter' && e.target.value.trim()) {
        socket.emit('enviar-mensaje', { 
            user: usuarioActual, 
            text: e.target.value, 
            avatar: avatarActual 
        });
        e.target.value = "";
    }
};

// 3. Usuarios online
socket.on('update-user-count', (count) => {
    const countEl = document.getElementById('user-count');
    if(countEl) countEl.innerText = `ONLINE: ${count}`;
});

// 4. Cursores fantasmas
socket.on('ghost-move', (data) => {
    let ghost = document.getElementById(`ghost-${data.id}`);
    if(!ghost) {
        ghost = document.createElement('div');
        ghost.id = `ghost-${data.id}`;
        ghost.className = 'panel'; 
        ghost.style.position = 'fixed';
        ghost.style.padding = '2px 5px';
        ghost.style.fontSize = '10px';
        ghost.style.zIndex = '900';
        ghost.style.pointerEvents = 'none';
        document.body.appendChild(ghost);
    }
    ghost.innerHTML = `<img src="${data.avatar}" style="width:12px; height:12px; border-radius:50%;"> ${data.user}`;
    ghost.style.left = data.x + 'px';
    ghost.style.top = (data.y - 20) + 'px';
});

socket.on('ghost-disconnect', (id) => {
    const ghost = document.getElementById(`ghost-${id}`);
    if(ghost) ghost.remove();
});

// 5. Purgas de sistema
socket.on('pizarra-limpia', () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
});




