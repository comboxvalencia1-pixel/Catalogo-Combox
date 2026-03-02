const API_URL = "https://script.google.com/macros/s/AKfycbwBSKJ8SJCZKLaDC15TLOwo5yq3a8lzkW_VIiCojWTsCCvCz4N_HfDKHDIENibTA6BT/exec?action=getProducts";
let allProducts = [], cart = [], mode = 'individual', category = 'Todas', deliveryMethod = 'Tienda';

// --- AUDIO Y VIBRACIÓN (Fix para iPad) ---
let audioCtx;
function initAudio() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
}

function playTap() {
    initAudio();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1000, audioCtx.currentTime);
    gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
    osc.connect(gain); gain.connect(audioCtx.destination);
    osc.start(); osc.stop(audioCtx.currentTime + 0.1);
    if (navigator.vibrate) navigator.vibrate(20);
}

// --- CACHÉ 1 HORA ---
function saveCart() {
    localStorage.setItem('combox_session', JSON.stringify({ cart, expiry: Date.now() + 3600000 }));
}

function loadCart() {
    const session = JSON.parse(localStorage.getItem('combox_session'));
    if (session && Date.now() < session.expiry) cart = session.cart;
}

// --- CARGA Y SPLASH ---
async function loadData() {
    loadCart();
    const timer = new Promise(r => setTimeout(r, 1500));
    try {
        const res = await fetch(API_URL);
        allProducts = await res.json();
        render(); renderCats(); updateUI(false);
    } catch (e) { console.error("Offline"); render(); }
    
    await timer;
    const s = document.getElementById('splash');
    if(s) { s.classList.add('exit'); setTimeout(() => s.style.display = 'none', 1200); }
}

function render() {
    const container = document.getElementById('mainContent');
    const search = document.getElementById('searchInput').value.toLowerCase();
    const filtered = allProducts.filter(p => {
        const isC = p.nombre.toLowerCase().includes('combo') || (p.categoria && p.categoria.toLowerCase().includes('combo'));
        const isS = p.categoria && p.categoria.toLowerCase().includes('servicio');
        let mMatch = (mode === 'combos' ? isC : mode === 'servicios' ? isS : !isC && !isS);
        return mMatch && (category === 'Todas' || p.categoria === category) && p.nombre.toLowerCase().includes(search);
    });
    const groups = filtered.reduce((acc, p) => { (acc[p.categoria] = acc[p.categoria] || []).push(p); return acc; }, {});
    container.innerHTML = Object.keys(groups).map(cat => `
        <div class="category-section">
            <h2 class="category-title">${cat}</h2>
            <div class="grid">
                ${groups[cat].map(p => {
                    const item = cart.find(i => i.nombre === p.nombre);
                    const btnID = `btn-${p.nombre.replace(/\s+/g, '')}`;
                    return `
                    <div class="card">
                        <div class="img-box"><img src="${p.imagen || ''}"></div>
                        <div style="font-size:0.8rem; font-weight:700; height:35px; text-align:center;">${p.nombre}</div>
                        <div style="color:var(--primary-neon); font-weight:900; font-size:1.3rem; margin:10px 0;">$${(parseFloat(p.precio) || 0).toFixed(2)}</div>
                        <button id="${btnID}" class="btn-add ${item ? 'added' : ''}" onclick="addToCart('${p.nombre.replace(/'/g, "\\'")}', ${parseFloat(p.precio) || 0}, '${btnID}')">
                            ${item ? `<i class="fa fa-check"></i> AGREGADO` : `<i class="fa fa-plus"></i> AGREGAR`}
                        </button>
                    </div>`;
                }).join('')}
            </div>
        </div>`).join('');
}

function addToCart(name, price, btnID) {
    playTap();
    let item = cart.find(i => i.nombre === name);
    if (item) item.qty++; else cart.push({ nombre: name, precio: price, qty: 1 });
    updateUI(false);
    const b = document.getElementById(btnID);
    if(b) { b.classList.add('added'); b.innerHTML = `<i class="fa fa-check"></i> AGREGADO`; }
}

function updateUI(shouldRender = true) {
    saveCart();
    const total = cart.reduce((acc, i) => acc + (i.precio * i.qty), 0);
    const count = cart.reduce((acc, i) => acc + i.qty, 0);
    document.getElementById('floatTotal').textContent = `$${total.toFixed(2)}`;
    document.getElementById('modalTotal').textContent = `$${total.toFixed(2)}`;
    document.getElementById('floatCount').textContent = `${count} PRODUCTOS`;
    document.getElementById('cartFloating').classList.toggle('visible', count > 0);
    renderCartItems();
    if(shouldRender) render();
}

function renderCartItems() {
    document.getElementById('cartItems').innerHTML = cart.map((item, idx) => `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:15px 0; border-bottom:1px solid #eee;">
            <div><div style="font-weight:800;">${item.nombre}</div><div style="color:var(--primary-neon); font-weight:800;">$${item.precio.toFixed(2)}</div></div>
            <div style="display:flex; align-items:center; gap:15px; background:#f5f5f5; padding:8px 15px; border-radius:20px; font-weight:900;">
                <span onclick="changeQty(${idx}, -1)">-</span><span>${item.qty}</span><span onclick="changeQty(${idx}, 1)">+</span>
            </div>
        </div>`).join('');
}

function changeQty(i, d) { playTap(); cart[i].qty += d; if (cart[i].qty <= 0) cart.splice(i, 1); updateUI(true); }
function setMode(m, i) { playTap(); mode = m; document.getElementById('modeSlider').style.transform = `translateX(${i * 100}%)`; render(); }
function setCat(c) { playTap(); category = c; renderCats(); render(); }
function renderCats() { const cats = ['Todas', ...new Set(allProducts.map(p => p.categoria).filter(Boolean))]; document.getElementById('catIsland').innerHTML = cats.map(c => `<div class="pill-cat ${c === category ? 'active' : ''}" onclick="setCat('${c}')">${c}</div>`).join(''); }
function toggleModal(s) { playTap(); document.getElementById('cartModal').style.display = s ? 'flex' : 'none'; }
function showStep(s) { document.getElementById('step-cart').style.display = s === 'cart' ? 'block' : 'none'; document.getElementById('step-delivery').style.display = s === 'delivery' ? 'block' : 'none'; }
function setDelivery(m) { deliveryMethod = m; document.getElementById('delivery-fields').style.display = m === 'Delivery' ? 'block' : 'none'; }

function sendWhatsApp() {
    let msg = `*NUEVO PEDIDO COMBOX*%0A%0A`;
    cart.forEach(i => msg += `• ${i.qty}x ${i.nombre} ($${(i.precio * i.qty).toFixed(2)})%0A`);
    msg += `%0A*TOTAL: $${cart.reduce((a, i) => a + (i.precio * i.qty), 0).toFixed(2)}*%0A*ENTREGA:* ${deliveryMethod}`;
    window.open(`https://wa.me/584244701273?text=${msg}`);
}

window.addEventListener('scroll', () => {
    const h = document.getElementById('mainHeader'), isl = document.getElementById('islandsWrapper');
    if (window.scrollY > 60) { h.classList.add('hidden'); isl.classList.add('sticky'); }
    else { h.classList.remove('hidden'); isl.classList.remove('sticky'); }
});

document.addEventListener('touchstart', initAudio, { once: true });
window.onload = loadData;
