const API_URL = "https://script.google.com/macros/s/AKfycbyJOqe3K6Q6Eps-eLDNSwasHfcPRadqUH7rRU5HhpcBiiszYVh9uzpaBXCsZ5OjkfhY/exec?action=getAppData";
let allProducts = [], cart = [], mode = 'individual', deliveryMethod = 'tienda';

// INICIO Y BLOQUEO DE SPLASh
window.onload = async () => {
    document.body.style.overflow = 'hidden'; 
    loadCart(); 
    await loadData();
    setTimeout(() => {
        document.getElementById('splash').style.transform = 'translateY(-100%)';
        document.body.style.overflow = 'auto'; 
    }, 1200);
};

// OPTIMIZADOR DE IMÁGENES DRIVE
function getThumb(url) {
    if(!url) return 'https://via.placeholder.com/300';
    let id = url.split('id=')[1] || url.split('/d/')[1]?.split('/')[0];
    return id ? `https://drive.google.com/thumbnail?id=${id}&sz=w600` : url;
}

// PERSISTENCIA 1 HORA
function saveCart() {
    localStorage.setItem('combox_cart', JSON.stringify({t: Date.now(), items: cart}));
}
function loadCart() {
    const saved = JSON.parse(localStorage.getItem('combox_cart'));
    if (saved && Date.now() - saved.t < 3600000) { cart = saved.items; updateUI(); }
}

// FEEDBACK HÁPTICO Y SONORO
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playTap() {
    if (navigator.vibrate) navigator.vibrate(15);
    const osc = audioCtx.createOscillator(), gain = audioCtx.createGain();
    osc.type = 'sine'; osc.frequency.setValueAtTime(800, audioCtx.currentTime);
    gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
    osc.connect(gain); gain.connect(audioCtx.destination);
    osc.start(); osc.stop(audioCtx.currentTime + 0.05);
}

async function loadData() {
    try {
        const res = await fetch(API_URL);
        allProducts = await res.json();
        render();
    } catch (e) { console.error(e); }
}

function render() {
    const grid = document.getElementById('productGrid');
    const search = document.getElementById('searchInput').value.toLowerCase();
    
    const filtered = allProducts.filter(p => {
        const isC = p.nombre.toLowerCase().includes('combo') || p.categoria.toLowerCase().includes('combo');
        const isS = p.categoria.toLowerCase().includes('servicio');
        let m = (mode === 'combos' ? isC : mode === 'servicios' ? isS : !isC && !isS);
        return m && p.nombre.toLowerCase().includes(search);
    });

    grid.innerHTML = filtered.map(p => {
        const item = cart.find(i => i.nombre === p.nombre);
        return `
            <div class="card">
                <div class="img-box"><img src="${getThumb(p.imagen)}" loading="lazy"></div>
                <div class="p-name">${p.nombre.toUpperCase()}</div>
                <div class="p-price">$${parseFloat(p.precio).toFixed(2)}</div>
                <button class="btn-add ${item ? 'added' : ''}" onclick="addToCart('${p.nombre.replace(/'/g,"")}', ${p.precio})">
                    ${item ? '<i class="fa fa-check"></i> AGREGADO' : '+ AGREGAR'}
                    ${item ? `<span class="item-counter">${item.qty}</span>` : ''}
                </button>
            </div>`;
    }).join('');
}

function addToCart(name, price) {
    playTap();
    const item = cart.find(i => i.nombre === name);
    if(item) item.qty++; else cart.push({nombre: name, precio: price, qty: 1});
    saveCart(); updateUI(); render();
}

function updateUI() {
    const total = cart.reduce((a, i) => a + (i.precio * i.qty), 0);
    const count = cart.reduce((a, i) => a + i.qty, 0);
    document.getElementById('floatTotal').innerText = `$${total.toFixed(2)}`;
    document.getElementById('modalTotal').innerText = `$${total.toFixed(2)}`;
    document.getElementById('floatCount').innerText = `${count} ${count === 1 ? 'PRODUCTO' : 'PRODUCTOS'}`;
    document.getElementById('cartFloating').classList.toggle('visible', count > 0);
    renderCartItems();
}

function renderCartItems() {
    const cont = document.getElementById('cartItems');
    cont.innerHTML = cart.map((item, idx) => `
        <div class="cart-item-row">
            <div><div class="cart-item-name">${item.nombre.toUpperCase()}</div><div class="cart-item-price">$${item.precio}</div></div>
            <div class="qty-control">
                <button onclick="updateQty(${idx}, -1)">-</button>
                <span>${item.qty}</span>
                <button onclick="updateQty(${idx}, 1)">+</button>
            </div>
        </div>`).join('');
}

function updateQty(idx, d) {
    playTap(); cart[idx].qty += d;
    if(cart[idx].qty <= 0) cart.splice(idx, 1);
    saveCart(); updateUI(); render();
}

// GPS NATIVO CORREGIDO
function getLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(pos => {
            playTap();
            const link = `http://maps.google.com/?q=${pos.coords.latitude},${pos.coords.longitude}`;
            document.getElementById('deliveryLink').value = link;
        });
    }
}

// MENSAJE WHATSAPP EXACTO SEGÚN INSTRUCCIÓN
function sendWhatsApp() {
    const name = deliveryMethod === 'tienda' ? document.getElementById('clientNameTienda').value : document.getElementById('clientNameDelivery').value;
    if(!name) return alert("Por favor ingresa tu nombre");

    const items = cart.map(i => `- *${i.nombre.toUpperCase()}*\n\`Cant:\`  *${i.qty}* |  *$\`${(i.precio * i.qty).toFixed(2)}\`*`).join('\n\n');
    const total = document.getElementById('modalTotal').innerText;
    
    let msg = "";
    if(deliveryMethod === 'delivery') {
        msg = `Hola! Soy *${name}*, quiero este pedido.\n\n${items}\n\n💵 *SUBTOTAL:* *${total}*\n\n______________________________________\n\n🛵 *ENTREGA POR DELIVERY:*\n\nPor favor dime cuánto sale para esta zona.\n\n${document.getElementById('deliveryLink').value}`;
    } else {
        msg = `Hola! Soy *${name}*, Confirmame La disponibilidad para este pedido. Quiero recogerlo en la sede de *Naguanagua*\n\n${items}\n\n_______________________________________\n\n💵 *SUBTOTAL:* *${total}*`;
    }
    window.open(`https://wa.me/584244701273?text=${encodeURIComponent(msg)}`);
}

// INTERFAZ DE NAVEGACIÓN
function toggleSearch(s) {
    document.getElementById('search-box').style.display = s ? 'flex' : 'none';
    document.getElementById('modeContainer').style.display = s ? 'none' : 'flex';
}
function setMode(m, p) {
    playTap(); mode = m;
    document.querySelectorAll('.mode-opt').forEach((o, i) => o.classList.toggle('active', i === p));
    document.getElementById('modeSlider').style.transform = `translateX(${p * 100}%)`;
    render();
}
function toggleModal(s) { playTap(); document.getElementById('cartModal').classList.toggle('active', s); if(!s) goToStep(1); }
function goToStep(s) { playTap(); document.querySelectorAll('.modal-step').forEach(x => x.classList.remove('active')); document.getElementById(`step-${s}`).classList.add('active'); }
function selectDelivery(t) {
    playTap(); deliveryMethod = t;
    document.querySelectorAll('.delivery-opt').forEach(o => o.classList.toggle('active', o.id === `opt-${t}`));
    document.querySelectorAll('.form-group').forEach(f => f.classList.toggle('active', f.id === `form-${t}`));
}
function clearCart() { if(confirm("¿Vaciar carrito?")){cart=[]; localStorage.removeItem('combox_cart'); updateUI(); render(); toggleModal(false);}}

window.addEventListener('scroll', () => {
    const h = document.getElementById('mainHeader'), i = document.getElementById('islandsWrapper');
    if(window.scrollY > 80) { h.classList.add('hidden'); i.classList.add('sticky'); }
    else { h.classList.remove('hidden'); i.classList.remove('sticky'); }
});
