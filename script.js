/* (Mismas constantes anteriores) */
const API_URL = "https://script.google.com/macros/s/AKfycbwBSKJ8SJCZKLaDC15TLOwo5yq3a8lzkW_VIiCojWTsCCvCz4N_HfDKHDIENibTA6BT/exec?action=getProducts";
let allProducts = [], cart = [], mode = 'individual', deliveryMethod = 'Tienda';

/* BLOQUEO DE DOBLE TAP ZOOM */
document.addEventListener('touchstart', function (event) {
    if (event.touches.length > 1) { event.preventDefault(); }
}, { passive: false });

/* AUDIO Y VIBRACIÓN PULIDA */
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playTap() {
    const osc = audioCtx.createOscillator(), gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(850, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(400, audioCtx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
    gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.1);
    osc.connect(gain); gain.connect(audioCtx.destination);
    osc.start(); osc.stop(audioCtx.currentTime + 0.1);
    if(navigator.vibrate) navigator.vibrate(15); 
}

/* CARGA Y RENDER (Sin cambios estructurales, solo estética) */
async function loadData() {
    try {
        const res = await fetch(API_URL + "&t=" + Date.now());
        allProducts = await res.json();
        render();
        updateUI();
        setTimeout(() => { 
            document.getElementById('splash').style.transform = 'translateY(-100%)'; 
            document.body.style.position = 'relative'; // Reactiva scroll
        }, 1200);
    } catch(e) { console.error("Error:", e); }
}

function updateUI() {
    const total = cart.reduce((a, i) => a + (parseFloat(i.precio) * i.qty), 0);
    const count = cart.reduce((a, i) => a + i.qty, 0);
    document.getElementById('floatTotal').textContent = `$${total.toFixed(2)}`;
    document.getElementById('modalTotal').textContent = `$${total.toFixed(2)}`;
    document.getElementById('floatCount').textContent = `${count} PRODUCTOS AGREGADOS`;
    document.getElementById('cartFloating').classList.toggle('visible', count > 0);
    renderCartItems();
}

function toggleSearch(s) {
    playTap();
    const box = document.getElementById('search-box');
    const menu = document.getElementById('modeContainer');
    const master = document.querySelector('.island-master');
    
    if(s) {
        box.style.display = 'flex';
        menu.style.display = 'none';
        master.style.maxWidth = '300px';
        setTimeout(() => document.getElementById('searchInput').focus(), 100);
    } else {
        box.style.display = 'none';
        menu.style.display = 'flex';
        master.style.maxWidth = '420px';
        document.getElementById('searchInput').value = '';
        render();
    }
}

/* Resto de funciones (addToCart, changeQty, sendWhatsApp, etc.) se mantienen igual según tu código original */
// ... (Aquí pegas tus funciones de lógica que ya tenías) ...
function render() {
    const container = document.getElementById('mainContent');
    const search = (document.getElementById('searchInput')?.value || '').toLowerCase();
    
    const filtered = allProducts.filter(p => {
        const name = p.nombre.toLowerCase();
        const cat = (p.categoria || '').toLowerCase();
        const isC = name.includes('combo') || cat.includes('combo');
        const isS = cat.includes('servicio');
        let m = (mode === 'combos' ? isC : mode === 'servicios' ? isS : !isC && !isS);
        return m && name.includes(search);
    });

    const groups = filtered.reduce((acc, p) => { (acc[p.categoria] = acc[p.categoria] || []).push(p); return acc; }, {});
    
    container.innerHTML = Object.keys(groups).map(catName => `
        <h2 class="cat-title">${catName}</h2>
        <div class="grid">
            ${groups[catName].map((p, index) => {
                const item = cart.find(i => i.nombre === p.nombre);
                const qty = item ? item.qty : 0;
                const bID = "btn-" + btoa(encodeURIComponent(p.nombre)).substring(0,8) + index;
                return `
                    <div class="card">
                        <div class="img-box"><img src="${p.imagen ? p.imagen : 'https://via.placeholder.com/300'}" loading="lazy"></div>
                        <div class="p-name">${p.nombre}</div>
                        <div class="p-price">$${parseFloat(p.precio).toFixed(2)}</div>
                        <button id="${bID}" class="btn-add ${qty > 0 ? 'added' : ''}" 
                                onclick="addToCart('${p.nombre.replace(/'/g,"\\'")}', ${p.precio}, '${bID}')">
                            ${qty > 0 ? `<i class="fa fa-check"></i> LISTO <span class="item-counter">${qty}</span>` : `<i class="fa fa-plus"></i> AGREGAR`}
                        </button>
                    </div>`;
            }).join('')}
        </div>`).join('');
}
// (Seguir con tus funciones de carrito)
window.onload = loadData;
