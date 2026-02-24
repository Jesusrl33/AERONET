const socket = io('https://aeronet-v4.onrender.com');
const canvas = document.getElementById('pizarra');
const ctx = canvas.getContext('2d');

let usuarioActual = "";
let avatarActual = "avatars/avatar (1).jpg"; 
let avatarSeleccionadoTemp = avatarActual;

let dibujando = false, ultimoPunto = null, gotas = 5, tiempo = 60, tipoPincel = "normal";

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const avatarList = Array.from({length: 15}, (_, i) => `avatars/avatar (${i + 1}).jpg`);

// ================= AVATAR MODAL =================
function initAvatarGrid() {
    const container = document.getElementById('avatar-grid-container');
    container.innerHTML = '';
    avatarList.forEach(url => {
        const div = document.createElement('div');
        div.className = `avatar-option ${url === avatarActual ? 'selected' : ''}`;
        div.innerHTML = `<img src="${url}">`;
        div.onclick = () => {
            avatarSeleccionadoTemp = url;
            document.querySelectorAll('.avatar-option').forEach(el => el.classList.remove('selected'));
            div.classList.add('selected');
        };
        container.appendChild(div);
    });
}

function openAvatarModal() { document.getElementById('avatar-modal').style.display = 'block'; initAvatarGrid(); }
function closeAvatarModal() { document.getElementById('avatar-modal').style.display = 'none'; }
function confirmAvatarSelection() {
    avatarActual = avatarSeleccionadoTemp;
    document.getElementById('current-avatar-img').src = avatarActual;
    closeAvatarModal();
}

// ================= LOGIN & CORE =================
function entrar() {
    usuarioActual = document.getElementById('username').value.trim();
    if(!usuarioActual) return alert("ERROR: SUBJECT ID REQUIRED");
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('main-ui').style.display = 'block';
    document.getElementById('display-user').innerText = usuarioActual;
    document.getElementById('taskbar-avatar').src = avatarActual;
    iniciarRecarga();
}

function iniciarRecarga() {
    setInterval(() => {
        if(gotas < 5) {
            tiempo--;
            if(tiempo <= 0) { gotas++; tiempo = 60; }
            document.getElementById('timer').innerText = tiempo;
            document.getElementById('drops').innerText = gotas;
        }
    }, 1000);
}

// ================= LÓGICA DE VENTANAS PRIVADAS ARRASTRABLES =================
function abrirVentanaPrivada(id, nombre) {
    let win = document.getElementById(`win-${id}`);
    if (!win) {
        win = document.createElement('div');
        win.id = `win-${id}`;
        win.className = 'panel private-window';
        win.style.top = "200px"; win.style.left = "200px";
        
        win.innerHTML = `
            <div class="private-header" id="head-${id}">
                <span>> DM: ${nombre}</span>
                <span onclick="document.getElementById('win-${id}').remove()" style="cursor:pointer; padding:0 5px;">X</span>
            </div>
            <div class="private-messages" id="msgs-${id}"></div>
            <input type="text" class="private-input" placeholder="REPLY..." 
                   onfocus="document.getElementById('win-${id}').classList.remove('notificacion-activa')"
                   onkeypress="manejarInputPrivado(event, '${id}', '${nombre}')">
        `;
        document.getElementById('private-chats-container').appendChild(win);
        dragElement(win, document.getElementById(`head-${id}`));
    }
    return win;
}

function dragElement(elmnt, header) {
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    header.onmousedown = (e) => {
        e.preventDefault();
        pos3 = e.clientX; pos4 = e.clientY;
        document.onmouseup = () => { document.onmouseup = null; document.onmousemove = null; };
        document.onmousemove = (e) => {
            e.preventDefault();
            pos1 = pos3 - e.clientX; pos2 = pos4 - e.clientY;
            pos3 = e.clientX; pos4 = e.clientY;
            elmnt.style.top = (elmnt.offsetTop - pos2) + "px";
            elmnt.style.left = (elmnt.offsetLeft - pos1) + "px";
        };
        document.querySelectorAll('.private-window').forEach(w => w.style.zIndex = "500");
        elmnt.style.zIndex = "600";
    };
}

function manejarInputPrivado(e, toId, nombre) {
    if (e.key === 'Enter' && e.target.value.trim()) {
        const text = e.target.value;
        socket.emit('enviar-privado', { toId, text, user: usuarioActual, avatar: avatarActual });
        const m = document.getElementById(`msgs-${toId}`);
        m.innerHTML += `<div style="color:#888; margin-bottom:5px;">[YO]: ${text.toUpperCase()}</div>`;
        m.scrollTop = m.scrollHeight;
        e.target.value = "";
    }
}

// ================= DIBUJO & MOUSE =================
function setTipo(t, el) {
    tipoPincel = t;
    document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
    el.classList.add('active');
}

canvas.addEventListener('mousedown', (e) => {
    if(gotas <= 0) return;
    dibujando = true;
    ultimoPunto = { x: e.clientX, y: e.clientY };
});

canvas.addEventListener('mousemove', (e) => {
    document.getElementById('coords').innerText = `LAT: ${(e.clientX/100).toFixed(4)}° N | LON: ${(e.clientY/100).toFixed(4)}° W`;
    if(usuarioActual) socket.emit('mouse-move', { x: e.clientX, y: e.clientY, user: usuarioActual, avatar: avatarActual });
    if (!dibujando) return;
    const datos = { 
        inicio: ultimoPunto, fin: {x: e.clientX, y: e.clientY}, 
        color: document.getElementById('colorPicker').value, 
        grosor: tipoPincel === 'neon' ? 10 : 3, tipo: tipoPincel, usuario: usuarioActual 
    };
    dibujar(datos);
    socket.emit('dibujar-linea', datos);
    ultimoPunto = { x: e.clientX, y: e.clientY };
});

canvas.addEventListener('mouseup', () => { if(dibujando) { dibujando = false; gotas--; document.getElementById('drops').innerText = gotas; } });

function dibujar(d) {
    ctx.beginPath(); ctx.strokeStyle = d.color; ctx.lineWidth = d.grosor; ctx.lineCap = 'round';
    if(d.tipo === 'neon'){ ctx.shadowBlur = 15; ctx.shadowColor = d.color; }
    else if(d.tipo === 'spray'){
        for(let i=0; i<12; i++){ ctx.fillStyle = d.color; ctx.fillRect(d.fin.x + (Math.random()-0.5)*25, d.fin.y + (Math.random()-0.5)*25, 1.5, 1.5); }
        return;
    }
    ctx.moveTo(d.inicio.x, d.inicio.y); ctx.lineTo(d.fin.x, d.fin.y); ctx.stroke(); ctx.shadowBlur = 0;
}

// SOPORTE PARA MÓVIL (Eventos Touch)
canvas.addEventListener('touchstart', (e) => {
    e.preventDefault(); // Evita que la pantalla se mueva al tocar
    const touch = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    const mouseEvent = new MouseEvent("mousedown", {
        clientX: touch.clientX,
        clientY: touch.clientY
    });
    canvas.dispatchEvent(mouseEvent);
}, { passive: false });

canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    const mouseEvent = new MouseEvent("mousemove", {
        clientX: touch.clientX,
        clientY: touch.clientY
    });
    canvas.dispatchEvent(mouseEvent);
}, { passive: false });

canvas.addEventListener('touchend', () => {
    const mouseEvent = new MouseEvent("mouseup", {});
    canvas.dispatchEvent(mouseEvent);
});

// ================= SOCKET EVENTS =================
socket.on('update-user-count', count => document.getElementById('user-count').innerText = `ONLINE: ${count}`);

socket.on('mensaje-recibido', data => {
    const m = document.getElementById('messages');
    m.innerHTML += `<div style="margin-bottom:8px;">
        <img src="${data.avatar}" style="width:18px; height:18px; border-radius:50%; vertical-align:middle; border:1px solid var(--neon);">
        <span onclick="abrirVentanaPrivada('${data.socketId}', '${data.user}')" style="color:var(--neon); cursor:pointer; font-weight:bold; text-decoration:underline;">
            ${data.user} >
        </span> 
        <span>${data.text.toUpperCase()}</span>
    </div>`;
    m.scrollTop = m.scrollHeight;
});

socket.on('mensaje-privado-recibido', data => {
    const win = abrirVentanaPrivada(data.fromId, data.user);
    const m = document.getElementById(`msgs-${data.fromId}`);
    m.innerHTML += `<div style="margin-bottom:5px;"><span style="color:var(--private)">${data.user}:</span> ${data.text.toUpperCase()}</div>`;
    m.scrollTop = m.scrollHeight;
    if (document.activeElement !== win.querySelector('input')) win.classList.add('notificacion-activa');
});

document.getElementById('msg-input').onkeypress = (e) => {
    if(e.key === 'Enter' && e.target.value.trim()) {
        socket.emit('enviar-mensaje', { user: usuarioActual, text: e.target.value, avatar: avatarActual });
        e.target.value = "";
    }
};

socket.on('ghost-move', data => {
    let el = document.getElementById(`ghost-${data.id}`);
    if(!el) {
        el = document.createElement('div'); el.id = `ghost-${data.id}`; el.className = 'ghost-container';
        el.innerHTML = `<img src="${data.avatar}" class="ghost-avatar"><span style="color:var(--neon); font-size:12px;">${data.user}</span>`;
        document.body.appendChild(el);
    }
    el.style.left = data.x + 'px'; el.style.top = data.y + 'px';
});

socket.on('ghost-disconnect', id => document.getElementById(`ghost-${id}`)?.remove());
socket.on('cuenta-atras', s => { document.getElementById('countdown-alert').style.display = 'block'; document.getElementById('count-num').innerText = s; });
socket.on('pizarra-limpia', () => ctx.clearRect(0,0,canvas.width, canvas.height));
socket.on('linea-received', d => dibujar(d));


initAvatarGrid();


