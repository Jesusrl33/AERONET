const socket = io('https://aeronet-v4.onrender.com');
const canvas = document.getElementById('pizarra');
const ctx = canvas.getContext('2d');

let usuarioActual = "";
// Empezamos con el avatar genérico por defecto
let avatarActual = "https://cdn-icons-png.flaticon.com/512/149/149071.png"; 
let avatarSeleccionadoTemp = avatarActual;
let avatarElegido = false; // Control para saber si ya eligió uno

let dibujando = false, ultimoPunto = null, gotas = 5, tiempo = 60, tipoPincel = "normal";

// Ajuste dinámico del canvas
function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

// Lista de tus avatares locales
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

function openAvatarModal() { 
    document.getElementById('avatar-modal').style.display = 'block'; 
    initAvatarGrid(); 
}

function closeAvatarModal() { 
    document.getElementById('avatar-modal').style.display = 'none'; 
}

function confirmAvatarSelection() {
    avatarActual = avatarSeleccionadoTemp;
    avatarElegido = true;
    const imgPreview = document.getElementById('current-avatar-img');
    imgPreview.src = avatarActual;
    imgPreview.style.opacity = "1";
    imgPreview.style.filter = "none"; // Quitamos el filtro sepia para que se vea real
    
    document.getElementById('avatar-status-text').innerText = "[ READY ]";
    document.getElementById('avatar-name-display').innerText = "UNIT_LOADED";
    closeAvatarModal();
}

// ================= LOGIN & CORE =================
function entrar() {
    usuarioActual = document.getElementById('username').value.trim();
    if(!usuarioActual) return alert("ERROR: SUBJECT ID REQUIRED");
    if(!avatarElegido) return alert("ERROR: SELECT AVATAR UNIT FIRST");

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

// ================= CHATS PRIVADOS (ARRASTRABLES) =================
function abrirVentanaPrivada(id, nombre) {
    if (id === socket.id) return; // No hablar contigo mismo
    let win = document.getElementById(`win-${id}`);
    if (!win) {
        win = document.createElement('div');
        win.id = `win-${id}`;
        win.className = 'panel private-window';
        win.style.top = "100px"; win.style.left = "100px";
        
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
    header.onmousedown = dragMouseDown;
    header.ontouchstart = dragMouseDown; // Soporte móvil para arrastrar

    function dragMouseDown(e) {
        e.preventDefault();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        pos3 = clientX; pos4 = clientY;
        document.onmouseup = closeDragElement;
        document.onmousemove = elementDrag;
        document.ontouchend = closeDragElement;
        document.ontouchmove = elementDrag;
    }

    function elementDrag(e) {
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        pos1 = pos3 - clientX; pos2 = pos4 - clientY;
        pos3 = clientX; pos4 = clientY;
        elmnt.style.top = (elmnt.offsetTop - pos2) + "px";
        elmnt.style.left = (elmnt.offsetLeft - pos1) + "px";
    }

    function closeDragElement() {
        document.onmouseup = null; document.onmousemove = null;
        document.ontouchend = null; document.ontouchmove = null;
    }
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

// ================= DIBUJO & MOUSE / TOUCH =================
function setTipo(t, el) {
    tipoPincel = t;
    document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
    el.classList.add('active');
}

function startDrawing(e) {
    if(gotas <= 0) return;
    dibujando = true;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    ultimoPunto = { x: clientX, y: clientY };
}

function moveDrawing(e) {
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    
    document.getElementById('coords').innerText = `LAT: ${(clientX/100).toFixed(4)}° N | LON: ${(clientY/100).toFixed(4)}° W`;
    
    if(usuarioActual) socket.emit('mouse-move', { x: clientX, y: clientY, user: usuarioActual, avatar: avatarActual });
    
    if (!dibujando) return;
    
    const datos = { 
        inicio: ultimoPunto, fin: {x: clientX, y: clientY}, 
        color: document.getElementById('colorPicker').value, 
        grosor: tipoPincel === 'neon' ? 10 : 3, tipo: tipoPincel, usuario: usuarioActual 
    };
    
    dibujar(datos);
    socket.emit('dibujar-linea', datos);
    ultimoPunto = { x: clientX, y: clientY };
}

function stopDrawing() {
    if(dibujando) {
        dibujando = false;
        gotas--;
        document.getElementById('drops').innerText = gotas;
        if(gotas < 5 && tiempo === 60) tiempo = 60; 
    }
}

// Eventos unificados
canvas.addEventListener('mousedown', startDrawing);
canvas.addEventListener('mousemove', moveDrawing);
window.addEventListener('mouseup', stopDrawing);

canvas.addEventListener('touchstart', (e) => { e.preventDefault(); startDrawing(e); }, { passive: false });
canvas.addEventListener('touchmove', (e) => { e.preventDefault(); moveDrawing(e); }, { passive: false });
canvas.addEventListener('touchend', stopDrawing);

function dibujar(d) {
    ctx.beginPath(); ctx.strokeStyle = d.color; ctx.lineWidth = d.grosor; ctx.lineCap = 'round';
    if(d.tipo === 'neon'){ ctx.shadowBlur = 15; ctx.shadowColor = d.color; }
    else if(d.tipo === 'spray'){
        for(let i=0; i<12; i++){ 
            ctx.fillStyle = d.color; 
            ctx.fillRect(d.fin.x + (Math.random()-0.5)*25, d.fin.y + (Math.random()-0.5)*25, 1.5, 1.5); 
        }
        return;
    }
    ctx.moveTo(d.inicio.x, d.inicio.y); ctx.lineTo(d.fin.x, d.fin.y); ctx.stroke(); ctx.shadowBlur = 0;
}

// ================= SOCKET EVENTS =================
socket.on('update-user-count', count => document.getElementById('user-count').innerText = `ONLINE: ${count}`);

socket.on('mensaje-recibido', data => {
    const m = document.getElementById('messages');
    m.innerHTML += `<div style="margin-bottom:8px;">
        <img src="${data.avatar}" style="width:18px; height:18px; border-radius:50%; vertical-align:middle; border:1px solid var(--neon); object-fit:cover;">
        <span onclick="abrirVentanaPrivada('${data.socketId}', '${data.user}')" style="color:var(--neon); cursor:pointer; font-weight:bold; text-decoration:underline;">
            ${data.user} >
        </span> 
        <span style="word-break: break-all;">${data.text.toUpperCase()}</span>
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
socket.on('cuenta-atras', s => { 
    document.getElementById('countdown-alert').style.display = 'block'; 
    document.getElementById('count-num').innerText = s; 
});
socket.on('pizarra-limpia', () => {
    ctx.clearRect(0,0,canvas.width, canvas.height);
    document.getElementById('countdown-alert').style.display = 'none';
});
socket.on('linea-received', d => dibujar(d));

// Inicialización de la rejilla de avatares al cargar
initAvatarGrid();





