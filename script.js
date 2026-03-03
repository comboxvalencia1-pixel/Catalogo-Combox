const API_URL = "https://script.google.com/macros/s/AKfycbwBSKJ8SJCZKLaDC15TLOwo5yq3a8lzkW_VIiCojWTsCCvCz4N_HfDKHDIENibTA6BT/exec?action=getProducts";
let allProducts = [], cart = [], mode = 'individual', deliveryMethod = 'Tienda';

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playTap() {
    const osc = audioCtx.createOscillator(), gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(850, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(400, audioCtx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.12);
    osc.connect(gain); gain.connect(audioCtx.destination);
    osc.start(); osc.stop(audioCtx.currentTime + 0.12);
    if(navigator.vibrate) navigator.vibrate([15, 25]); 
}

function parsePrice(val) {
    let n = parseFloat(val);
    return isNaN(n) ? 0 : n;
}

function saveSession() { 
    localStorage.setItem('combox_elite_session', JSON.stringify({ time: Date.now(), items: cart })); 
}

function loadSession() {
    const saved = JSON.parse(localStorage.getItem('combox_elite_session'));
    if (saved && (Date.now() - saved.time < 7200000)) cart = saved.items;
}

async function loadData() {
    try {
        loadSession();
        const res = await fetch(API_URL + "&t=" + Date.now());
        allProducts = await res.json();
        render();
        updateUI(false);
        setTimeout(() => { document.getElementById('splash').style.transform = 'translateY(-100%)'; }, 1000);
    } catch(e) { console.error("Error:", e); }
}

function getOptimizedUrl(url) {
    if(!url) return 'https://via.placeholder.com/300?text=COMBOX';
    const id = url.match(/[-\w]{25,}/);
    return id ? `https://drive.google.com/thumbnail?id=${id[0]}&sz=w600` : url;
}

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
                        <div class="img-box"><img src="${getOptimizedUrl(p.imagen)}" loading="lazy"></div>
                        <div class="p-name">${p.nombre}</div>
                        <div class="p-price">$${parsePrice(p.precio).toFixed(2)}</div>
                        <button id="${bID}" class="btn-add ${qty > 0 ? 'added' : ''}" 
                                onclick="addToCart('${p.nombre.replace(/'/g,"\\'")}', ${parsePrice(p.precio)}, '${bID}')">
                            ${qty > 0 ? `<i class="fa fa-check"></i> LISTO <span class="item-counter">${qty}</span>` : `<i class="fa fa-plus"></i> AGREGAR`}
                        </button>
                    </div>`;
            }).join('')}
        </div>`).join('');
}

function addToCart(name, price, bID) {
    playTap();
    let item = cart.find(i => i.nombre === name);
    if (item) item.qty++; else cart.push({nombre: name, precio: price, qty: 1});
    saveSession();
    updateUI(false);
    const btn = document.getElementById(bID);
    if(btn) {
        btn.classList.add('added');
        btn.innerHTML = `<i class="fa fa-check"></i> LISTO <span class="item-counter">${cart.find(i => i.nombre === name).qty}</span>`;
    }
}

function updateUI(full) {
    const total = cart.reduce((a, i) => a + (parsePrice(i.precio) * i.qty), 0);
    const count = cart.reduce((a, i) => a + i.qty, 0);
    document.getElementById('floatTotal').textContent = `$${total.toFixed(2)}`;
    document.getElementById('modalTotal').textContent = `$${total.toFixed(2)}`;
    document.getElementById('floatCount').textContent = `${count} PRODUCTOS`;
    document.getElementById('cartFloating').classList.toggle('visible', count > 0);
    renderCartItems();
    if (full) render();
}

function renderCartItems() {
    document.getElementById('cartItems').innerHTML = cart.map((i, idx) => `
        <div class="cart-item-row">
            <div>
                <div style="font-weight:800;">${i.nombre}</div>
                <div style="color:var(--primary); font-weight:900;">$${(parsePrice(i.precio) * i.qty).toFixed(2)}</div>
            </div>
            <div class="qty-control">
                <span onclick="changeQty(${idx}, -1)">-</span>
                <span>${i.qty}</span>
                <span onclick="changeQty(${idx}, 1)">+</span>
            </div>
        </div>`).join('');
}

function changeQty(idx, d) { playTap(); cart[idx].qty += d; if(cart[idx].qty <= 0) cart.splice(idx,1); saveSession(); updateUI(true); if(cart.length===0) toggleModal(false); }
function clearCart() { playTap(); cart = []; saveSession(); updateUI(true); toggleModal(false); }

function setMode(m, i) { 
    playTap(); mode = m; 
    document.querySelectorAll('.mode-opt').forEach(o => o.classList.remove('active')); 
    document.querySelectorAll('.mode-opt')[i].classList.add('active'); 
    document.getElementById('modeSlider').style.transform = `translateX(${i*100}%)`; 
    render(); 
}

function toggleSearch(s) {
    playTap();
    document.getElementById('search-box').style.display = s ? 'flex' : 'none';
    document.getElementById('modeContainer').style.display = s ? 'none' : 'flex';
    if(s) setTimeout(() => document.getElementById('searchInput').focus(), 100);
}

function handleSearch() { render(); }

function toggleModal(s) { playTap(); document.getElementById('cartModal').style.display = s?'flex':'none'; if(s) showStep('cart'); }
function showStep(s) { playTap(); document.getElementById('step-cart').style.display = s==='cart'?'block':'none'; document.getElementById('step-delivery').style.display = s==='delivery'?'block':'none'; }
function closeModalExterno(e) { if (e.target.id === 'cartModal') toggleModal(false); }

function setDelivery(m) { 
    playTap(); deliveryMethod = m; 
    document.getElementById('opt-tienda').classList.toggle('active', m==='Tienda'); 
    document.getElementById('opt-delivery').classList.toggle('active', m==='Delivery'); 
    document.getElementById('delivery-fields').style.display = m==='Delivery'?'block':'none'; 
}

function getLocation() {
    playTap();
    const btn = document.querySelector('.btn-gps-fix');
    if (navigator.geolocation) {
        btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i>';
        navigator.geolocation.getCurrentPosition(p => {
            document.getElementById('deliveryLink').value = `https://www.google.com/maps?q=${p.coords.latitude},${p.coords.longitude}`;
            btn.innerHTML = 'OK';
            btn.style.background = "var(--neon)";
        }, () => { alert("Activa el GPS"); btn.innerHTML = "GPS"; });
    }
}

function sendWhatsApp() {
    if(cart.length === 0) return;
    let msg = `*📦 NUEVO PEDIDO COMBOX ELITE*\n--------------------------\n`;
    cart.forEach(i => msg += `• *${i.qty}x* ${i.nombre} ($${(parsePrice(i.precio)*i.qty).toFixed(2)})\n`);
    const total = cart.reduce((a, i) => a + (parsePrice(i.precio) * i.qty), 0);
    msg += `--------------------------\n*TOTAL: $${total.toFixed(2)}*\n\n*ENTREGA:* ${deliveryMethod}`;
    const gps = document.getElementById('deliveryLink').value;
    if(deliveryMethod === 'Delivery' && gps) msg += `\n*UBICACIÓN:* ${gps}`;
    window.open(`https://wa.me/584244701273?text=${encodeURIComponent(msg)}`);
}

window.addEventListener('scroll', () => {
    window.requestAnimationFrame(() => {
        const h = document.getElementById('mainHeader'), isl = document.getElementById('islandsWrapper');
        if (window.scrollY > 80) { h.classList.add('hidden'); isl.classList.add('sticky'); }
        else { h.classList.remove('hidden'); isl.classList.remove('sticky'); }
    });
});

window.onload = loadData;
