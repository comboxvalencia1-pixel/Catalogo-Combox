const API_URL = "https://script.google.com/macros/s/AKfycbwBSKJ8SJCZKLaDC15TLOwo5yq3a8lzkW_VIiCojWTsCCvCz4N_HfDKHDIENibTA6BT/exec?action=getProducts";
let allProducts = [], cart = [], mode = 'individual', category = 'Todas', deliveryMethod = 'Tienda';

// --- SISTEMA DE SONIDO Y VIBRACIÓN (Fix iPad Pro) ---
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
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.1);
    if (navigator.vibrate) navigator.vibrate(20);
}

// --- GESTIÓN DE CACHÉ DE 1 HORA ---
function saveCartToCache() {
    const data = { cart: cart, expiry: Date.now() + (60 * 60 * 1000) };
    localStorage.setItem('combox_session', JSON.stringify(data));
}

function loadCartFromCache() {
    const cached = localStorage.getItem('combox_session');
    if (cached) {
        const data = JSON.parse(cached);
        if (Date.now() < data.expiry) cart = data.cart;
        else localStorage.removeItem('combox_session');
    }
}

// --- CARGA DE DATOS ---
async function loadData() {
    loadCartFromCache();
    const splashTimer = new Promise(resolve => setTimeout(resolve, 1500));
    try {
        const fetchTask = fetch(API_URL).then(res => res.json());
        const [data] = await Promise.all([fetchTask, splashTimer]);
        allProducts = data;
        render(); 
        renderCats();
        updateUI(false);
    } catch (e) {
        console.error("Modo Offline");
        await splashTimer;
        render(); 
    } finally {
        const splash = document.getElementById('splash');
        if(splash) {
            splash.classList.add('exit');
            setTimeout(() => splash.style.display = 'none', 1200);
        }
    }
}

// --- LÓGICA DE RENDERIZADO (Diseño Estable) ---
function render() {
    const container = document.getElementById('mainContent');
    if (!container) return;
    const search = document.getElementById('searchInput').value.toLowerCase();
    const filtered = allProducts.filter(p => {
        const isCombo = p.nombre.toLowerCase().includes('combo') || (p.categoria && p.categoria.toLowerCase().includes('combo'));
        const isServicio = p.categoria && p.categoria.toLowerCase().includes('servicio');
        let matchesMode = (mode === 'combos' ? isCombo : mode === 'servicios' ? isServicio : !isCombo && !isServicio);
        return matchesMode && (category === 'Todas' || p.categoria === category) && p.nombre.toLowerCase().includes(search);
    });
    const groups = filtered.reduce((acc, p) => { (acc[p.categoria] = acc[p.categoria] || []).push(p); return acc; }, {});
    container.innerHTML = Object.keys(groups).map(catName => `
        <div class="category-section">
            <h2 class="category-title">${catName}</h2>
            <div class="grid">
                ${groups[catName].map(p => {
                    const item = cart.find(i => i.nombre === p.nombre);
                    const qty = item ? item.qty : 0;
                    const btnID = `btn-${p.nombre.replace(/\s+/g, '')}`;
                    return `
                    <div class="card">
                        <div class="img-box"><img src="${p.imagen || ''}"></div>
                        <div style="font-size:0.8rem; font-weight:700; height:35px; text-align:center;">${p.nombre}</div>
                        <div style="color:var(--primary-neon); font-weight:900; font-size:1.3rem; margin:10px 0;">$${(parseFloat(p.precio) || 0).toFixed(2)}</div>
                        <button id="${btnID}" class="btn-add ${qty > 0 ? 'added' : ''}" onclick="addToCart('${p.nombre.replace(/'/g, "\\'")}', ${parseFloat(p.precio) || 0}, '${btnID}')">
                            ${qty > 0 ? `<i class="fa fa-check"></i> AGREGADO` : `<i class="fa fa-plus"></i> AGREGAR`}
                            ${qty > 0 ? `<span class="item-counter">${qty}</span>` : ''}
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
    // Actualización rápida del botón
    const btn = document.getElementById(btnID);
    if(btn) {
        btn.classList.add('added');
        btn.innerHTML = `<i class="fa fa-check"></i> AGREGADO <span class="item-counter">${item ? item.qty : 1}</span>`;
    }
}

function updateUI(shouldRender = true) {
    saveCartToCache();
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
    const container = document.getElementById('cartItems');
    if(!container) return;
    container.innerHTML = cart.map((item, idx) => `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:15px 0; border-bottom:1px solid #eee;">
            <div><div style="font-weight:800;">${item.nombre}</div><div style="color:var(--primary-neon); font-weight:800;">$${item.precio.toFixed(2)}</div></div>
            <div style="display:flex; align-items:center; gap:15px; background:#f5f5f5; padding:8px 15px; border-radius:20px; font-weight:900;">
                <span onclick="changeQty(${idx}, -1)" style="cursor:pointer;">-</span><span>${item.qty}</span><span onclick="changeQty(${idx}, 1)" style="cursor:pointer;">+</span>
            </div>
        </div>`).join('');
}

function changeQty(idx, d) { playTap(); cart[idx].qty += d; if (cart[idx].qty <= 0) cart.splice(idx, 1); updateUI(true); }
function clearCart() { playTap(); cart = []; updateUI(true); toggleModal(false); }
function setMode(m, idx) { playTap(); mode = m; document.querySelectorAll('.mode-opt').forEach(opt => opt.classList.remove('active')); document.querySelectorAll('.mode-opt')[idx].classList.add('active'); document.getElementById('modeSlider').style.transform = `translateX(${idx * 100}%)`; render(); }
function renderCats() { const cats = ['Todas', ...new Set(allProducts.map(p => p.categoria).filter(Boolean))]; document.getElementById('catIsland').innerHTML = cats.map(c => `<div class="pill-cat ${c === category ? 'active' : ''}" onclick="setCat('${c}')">${c}</div>`).join(''); }
function setCat(c) { playTap(); category = c; renderCats(); render(); }
function toggleSearch(s) { playTap(); document.getElementById('search-box').style.display = s ? 'flex' : 'none'; document.getElementById('modeContainer').style.display = s ? 'none' : 'flex'; document.getElementById('catIsland').classList.toggle('active', s); }
function toggleModal(s) { playTap(); document.getElementById('cartModal').style.display = s ? 'flex' : 'none'; if(s) showStep('cart'); }
function showStep(s) { playTap(); document.getElementById('step-cart').style.display = s === 'cart' ? 'block' : 'none'; document.getElementById('step-delivery').style.display = s === 'delivery' ? 'block' : 'none'; }
function setDelivery(m) { playTap(); deliveryMethod = m; document.getElementById('opt-tienda').classList.toggle('active', m === 'Tienda'); document.getElementById('opt-delivery').classList.toggle('active', m === 'Delivery'); document.getElementById('delivery-fields').style.display = m === 'Delivery' ? 'block' : 'none'; }

function sendWhatsApp() {
    const total = cart.reduce((acc, i) => acc + (i.precio * i.qty), 0).toFixed(2);
    let msg = `*NUEVO PEDIDO COMBOX*%0A%0A`;
    cart.forEach(i => msg += `• ${i.qty}x ${i.nombre} ($${(i.precio * i.qty).toFixed(2)})%0A`);
    msg += `%0A*TOTAL: $${total}*%0A*ENTREGA:* ${deliveryMethod}`;
    const link = document.getElementById('deliveryLink').value;
    if(link) msg += `%0A*UBICACIÓN:* ${link}`;
    window.open(`https://wa.me/584244701273?text=${msg}`);
}

window.addEventListener('scroll', () => {
    const h = document.getElementById('mainHeader'), isl = document.getElementById('islandsWrapper');
    if (window.scrollY > 60) { h.classList.add('hidden'); isl.classList.add('sticky'); }
    else { h.classList.remove('hidden'); isl.classList.remove('sticky'); }
});

document.addEventListener('touchstart', initAudio, { once: true });
document.getElementById('searchInput').oninput = render;

if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(err => console.log(err));
}

window.onload = loadData;
