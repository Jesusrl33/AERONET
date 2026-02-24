const socket = io('https://aeronet-v4.onrender.com');
const canvas = document.getElementById('pizarra');
const ctx = canvas.getContext('2d');

let usuarioActual = "", avatarActual = "https://cdn-icons-png.flaticon.com/512/149/149071.png";
let avatarSeleccionadoTemp = avatarActual, avatarElegido = false;
let dibujando = false, ultimoPunto = null, gotas = 5, tiempo = 60, tipoPincel = "normal";

function resize() {
    const parent = canvas.parentElement;
    canvas.width = parent.clientWidth;
    canvas.height = parent.clientHeight;
}
window.addEventListener('resize', resize);
setTimeout(resize, 200);

// --- AVATARES ---
function initAvatarGrid() {
    const container = document.getElementById('avatar-grid-container');
    container.innerHTML = '';
    for(let i=1; i<=15; i++) {
        const url = `avatars/avatar (${i}).jpg`;
        const img = document.createElement('img');
        img.src = url;
        img.className = 'avatar-option';
        img.onclick = () => {
            avatarSeleccionadoTemp = url;
            document.querySelectorAll('.avatar-option').forEach(el => el.classList.remove('selected'));
            img.classList.add('selected');
        };
        container.appendChild(img);
    }
}

function openAvatarModal() { document.getElementById('avatar-modal').style.display = 'flex'; initAvatarGrid(); }
function closeAvatarModal() { document.getElementById('avatar-modal').style.display = 'none'; }
function confirmAvatarSelection() {
    avatarActual = avatarSeleccionadoTemp;
    avatarElegido = true;
    document.getElementById('current-avatar-img').src = avatarActual;
    document.getElementById('taskbar-avatar').src = avatarActual;
    closeAvatarModal();
}

// --- CORE ---
function entrar() {
    const nick = document.getElementById('username').value.trim();
    if(!nick || !avatarElegido) return alert("ERROR: IDENT_REQUIRED");
    usuarioActual = nick;
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('main-ui').style.display = 'block';
    document.getElementById('display-user').innerText = usuarioActual;
    resize();
    iniciarContadores();
}

function iniciarContadores() {
    setInterval(() => {
        if(gotas < 5) {
            tiempo--;
            if(tiempo <= 0) { gotas++; tiempo = 60; }
            document.getElementById('timer').innerText = tiempo;
            document.getElementById('drops').innerText = gotas;
        }
    }, 1000);
}

// --- DIBUJO ---
function getPos(e) {
    const rect = canvas.getBoundingClientRect();
    const t = e.touches ? e.touches[0] : e;
    return { x: t.clientX - rect.left, y: t.clientY - rect.top };
}

function setTipo(t, el) {
    tipoPincel = t;
    document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
    el.classList.add('active');
}

canvas.addEventListener('mousedown', (e) => { if(gotas > 0) { dibujando = true; ultimoPunto = getPos(e); } });
window.addEventListener('mousemove', (e) => {
    const p = getPos(e);
    if(usuarioActual) socket.emit('mouse-move', { x: p.x, y: p.y, user: usuarioActual, avatar: avatarActual });
    if(!dibujando) return;
    const d = { inicio: ultimoPunto, fin: p, color: document.getElementById('colorPicker').value, tipo: tipoPincel };
    dibujar(d); socket.emit('dibujar-linea', d);
    ultimoPunto = p;
});
window.addEventListener('mouseup', () => { if(dibujando) { dibujando = false; gotas--; document.getElementById('drops').innerText = gotas; } });

// Táctil
canvas.addEventListener('touchstart', (e) => { e.preventDefault(); if(gotas > 0) { dibujando = true; ultimoPunto = getPos(e); } }, {passive:false});
canvas.addEventListener('touchmove', (e) => { e.preventDefault(); if(!dibujando) return; const p = getPos(e); const d = { inicio: ultimoPunto, fin: p, color: document.getElementById('colorPicker').value, tipo: tipoPincel }; dibujar(d); socket.emit('dibujar-linea', d); ultimoPunto = p; }, {passive:false});
canvas.addEventListener('touchend', () => { if(dibujando) { dibujando = false; gotas--; document.getElementById('drops').innerText = gotas; } });

function dibujar(d) {
    ctx.beginPath(); ctx.strokeStyle = d.color; ctx.lineCap = 'round';
    if(d.tipo === 'neon') { ctx.lineWidth = 10; ctx.shadowBlur = 15; ctx.shadowColor = d.color; }
    else if(d.tipo === 'spray') {
        for(let i=0; i<15; i++) { ctx.fillStyle = d.color; ctx.fillRect(d.fin.x + (Math.random()-0.5)*30, d.fin.y + (Math.random()-0.5)*30, 1.5, 1.5); }
        return;
    } else { ctx.lineWidth = 3; ctx.shadowBlur = 0; }
    ctx.moveTo(d.inicio.x, d.inicio.y); ctx.lineTo(d.fin.x, d.fin.y); ctx.stroke();
}

// --- SOCKETS ---
socket.on('linea-received', (d) => dibujar(d));
socket.on('mensaje-recibido', (d) => {
    const m = document.getElementById('messages');
    m.innerHTML += `<div><img src="${d.avatar}" style="width:15px"> <b>${d.user}:</b> ${d.text}</div>`;
    m.scrollTop = m.scrollHeight;
});
document.getElementById('msg-input').onkeypress = (e) => {
    if(e.key === 'Enter' && e.target.value.trim()) {
        socket.emit('enviar-mensaje', { user: usuarioActual, text: e.target.value, avatar: avatarActual });
        e.target.value = "";
    }
};
socket.on('update-user-count', (c) => document.getElementById('user-count').innerText = `ONLINE: ${c}`);
socket.on('ghost-move', (d) => {
    let g = document.getElementById(`ghost-${d.id}`);
    if(!g) { g = document.createElement('div'); g.id = `ghost-${d.id}`; g.style.position = 'fixed'; g.style.pointerEvents = 'none'; document.body.appendChild(g); }
    g.innerHTML = `<img src="${d.avatar}" style="width:15px; border-radius:50%"><br>${d.user}`;
    g.style.left = d.x + 'px'; g.style.top = d.y + 'px';
});
socket.on('ghost-disconnect', (id) => { const g = document.getElementById(`ghost-${id}`); if(g) g.remove(); });




