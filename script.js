const socket = io('https://aeronet-v4.onrender.com');
const canvas = document.getElementById('pizarra');
const ctx = canvas.getContext('2d');

let usuarioActual = "", avatarActual = "https://cdn-icons-png.flaticon.com/512/149/149071.png";
let avatarSeleccionadoTemp = avatarActual, avatarElegido = false;
let dibujando = false, ultimoPunto = null, gotas = 5, tiempo = 60, tipoPincel = "normal";

// Inicializar Canvas
function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
window.addEventListener('resize', resize); resize();

// --- AVATARES ---
const avatarList = Array.from({length: 15}, (_, i) => `avatars/avatar (${i + 1}).jpg`);

function initAvatarGrid() {
    const grid = document.getElementById('avatar-grid');
    grid.innerHTML = '';
    avatarList.forEach(url => {
        const img = document.createElement('img');
        img.src = url;
        img.className = 'avatar-option';
        img.onclick = () => {
            avatarSeleccionadoTemp = url;
            document.querySelectorAll('.avatar-option').forEach(el => el.classList.remove('selected'));
            img.classList.add('selected');
        };
        grid.appendChild(img);
    });
}

function openAvatarModal() { document.getElementById('avatar-modal').style.display = 'flex'; initAvatarGrid(); }
function closeAvatarModal() { document.getElementById('avatar-modal').style.display = 'none'; }
function confirmAvatarSelection() {
    avatarActual = avatarSeleccionadoTemp;
    avatarElegido = true;
    document.getElementById('current-avatar-img').src = avatarActual;
    closeAvatarModal();
}

function entrar() {
    usuarioActual = document.getElementById('username').value.trim();
    if(!usuarioActual || !avatarElegido) return alert("REQUIRED: USER_ID & AVATAR");
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('main-ui').style.display = 'block';
    document.getElementById('display-user').innerText = usuarioActual;
    document.getElementById('taskbar-avatar').src = avatarActual;
    setInterval(() => {
        if(gotas < 5) {
            tiempo--; if(tiempo <= 0) { gotas++; tiempo = 60; }
            document.getElementById('timer').innerText = tiempo;
            document.getElementById('drops').innerText = gotas;
        }
    }, 1000);
}

// --- DIBUJO (MOUSE & TOUCH) ---
function getPos(e) {
    const t = e.touches ? e.touches[0] : e;
    return { x: t.clientX, y: t.clientY };
}

function start(e) { 
    if(gotas <= 0) return; 
    dibujando = true; 
    ultimoPunto = getPos(e); 
}

function move(e) {
    const p = getPos(e);
    document.getElementById('coords').innerText = `LAT: ${p.x} | LON: ${p.y}`;
    if(usuarioActual) socket.emit('mouse-move', { ...p, user: usuarioActual, avatar: avatarActual });
    if(!dibujando) return;
    const d = { inicio: ultimoPunto, fin: p, color: document.getElementById('colorPicker').value, grosor: tipoPincel === 'neon' ? 10 : 3, tipo: tipoPincel };
    dibujar(d); socket.emit('dibujar-linea', d);
    ultimoPunto = p;
}

function stop() { if(dibujando) { dibujando = false; gotas--; } }

canvas.addEventListener('mousedown', start); canvas.addEventListener('mousemove', move); window.addEventListener('mouseup', stop);
canvas.addEventListener('touchstart', e => { e.preventDefault(); start(e); }, {passive:false});
canvas.addEventListener('touchmove', e => { e.preventDefault(); move(e); }, {passive:false});
canvas.addEventListener('touchend', stop);

function dibujar(d) {
    ctx.beginPath(); ctx.strokeStyle = d.color; ctx.lineWidth = d.grosor; ctx.lineCap = 'round';
    if(d.tipo === 'neon') { ctx.shadowBlur = 15; ctx.shadowColor = d.color; }
    if(d.tipo === 'spray') {
        for(let i=0; i<10; i++) ctx.fillRect(d.fin.x+(Math.random()-0.5)*20, d.fin.y+(Math.random()-0.5)*20, 1.5, 1.5);
        return;
    }
    ctx.moveTo(d.inicio.x, d.inicio.y); ctx.lineTo(d.fin.x, d.fin.y); ctx.stroke(); ctx.shadowBlur = 0;
}

// --- SOCKETS ---
socket.on('linea-received', d => dibujar(d));
socket.on('mensaje-recibido', d => {
    const m = document.getElementById('messages');
    m.innerHTML += `<div class="msg"><img src="${d.avatar}" class="mini-av"> <b onclick="abrirDM('${d.socketId}','${d.user}')">${d.user}:</b> ${d.text}</div>`;
    m.scrollTop = m.scrollHeight;
});

document.getElementById('msg-input').onkeypress = (e) => {
    if(e.key === 'Enter' && e.target.value) {
        socket.emit('enviar-mensaje', { user: usuarioActual, text: e.target.value, avatar: avatarActual });
        e.target.value = "";
    }
};

socket.on('update-user-count', c => document.getElementById('user-count').innerText = `ONLINE: ${c}`);





