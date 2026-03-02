const API_URL = "https://script.google.com/macros/s/AKfycbwBSKJ8SJCZKLaDC15TLOwo5yq3a8lzkW_VIiCojWTsCCvCz4N_HfDKHDIENibTA6BT/exec?action=getProducts";
let allProducts = [], cart = [], mode = 'individual', category = 'Todas', deliveryMethod = 'Tienda';

// SONIDO Y VIBRACIÓN SINCRONIZADOS
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playTap() {
    const osc = audioCtx.createOscillator(); 
    const gain = audioCtx.createGain();
    osc.type = 'sine'; 
    osc.frequency.setValueAtTime(1000, audioCtx.currentTime);
    gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
    osc.connect(gain); 
    gain.connect(audioCtx.destination);
    osc.start(); 
    osc.stop(audioCtx.currentTime + 0.05);
    if (navigator.vibrate) navigator.vibrate(25); 
}

async function loadData() {
    document.body.style.overflow = 'hidden'; // Bloquea scroll durante el splash
    try {
        const saved = localStorage.getItem('combox_cart');
        if (saved) cart = JSON.parse(saved);
        const res = await fetch(API_URL);
        allProducts = await res.json();
        render(); 
        renderCats();
        updateUI(false); 

        // SALIDA ELEGANTE A LOS 3 SEGUNDOS
        setTimeout(() => {
            const splash = document.getElementById('splash');
            if(splash) {
                splash.style.transform = 'translateY(-100%)';
                splash.style.opacity = '0';
                document.body.style.overflow = 'auto'; // Habilita scroll
                setTimeout(() => splash.style.display = 'none', 1200);
            }
        }, 3000);
    } catch (e) { 
        document.getElementById('splash').style.display = 'none';
        document.body.style.overflow = 'auto';
    }
}

function render() {
    const container = document.getElementById('mainContent');
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

// ACTUALIZACIÓN DE BOTÓN INDIVIDUAL (SIN PARPADEO)
function addToCart(name, price, btnID) {
    playTap();
    let item = cart.find(i => i.nombre === name);
    if (item) item.qty++; else cart.push({ nombre: name, precio: price, qty: 1 });
    
    updateUI(false); 
    const btn = document.getElementById(btnID);
    if (btn) {
        btn.classList.add('added');
        btn.innerHTML = `<i class="fa fa-check"></i> AGREGADO <span class="item-counter">${item ? item.qty : 1}</span>`;
    }
}

function updateUI(shouldRender = true) {
    const total = cart.reduce((acc, i) => acc + (i.precio * i.qty), 0);
    const count = cart.reduce((acc, i) => acc + i.qty, 0);
    localStorage.setItem('combox_cart', JSON.stringify(cart));
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

function changeQty(idx, d) { cart[idx].qty += d; if (cart[idx].qty <= 0) cart.splice(idx, 1); updateUI(true); }
function clearCart() { cart = []; updateUI(true); toggleModal(false); }
function setMode(m, idx) { mode = m; document.querySelectorAll('.mode-opt').forEach(opt => opt.classList.remove('active')); document.querySelectorAll('.mode-opt')[idx].classList.add('active'); document.getElementById('modeSlider').style.transform = `translateX(${idx * 100}%)`; render(); }
function renderCats() { const cats = ['Todas', ...new Set(allProducts.map(p => p.categoria).filter(Boolean))]; document.getElementById('catIsland').innerHTML = cats.map(c => `<div class="pill-cat ${c === category ? 'active' : ''}" onclick="setCat('${c}')">${c}</div>`).join(''); }
function setCat(c) { category = c; renderCats(); render(); }
function toggleSearch(s) { document.getElementById('search-box').style.display = s ? 'flex' : 'none'; document.getElementById('modeContainer').style.display = s ? 'none' : 'flex'; document.getElementById('catIsland').classList.toggle('active', s); }
function toggleModal(s) { document.getElementById('cartModal').style.display = s ? 'flex' : 'none'; if(s) showStep('cart'); }
function closeModalExterno(e) { if(e.target.id === 'cartModal') toggleModal(false); }
function showStep(s) { document.getElementById('step-cart').style.display = s === 'cart' ? 'block' : 'none'; document.getElementById('step-delivery').style.display = s === 'delivery' ? 'block' : 'none'; }
function setDelivery(m) { deliveryMethod = m; document.getElementById('opt-tienda').classList.toggle('active', m === 'Tienda'); document.getElementById('opt-delivery').classList.toggle('active', m === 'Delivery'); document.getElementById('delivery-fields').style.display = m === 'Delivery' ? 'block' : 'none'; }
function getLocation() { if (navigator.geolocation) { navigator.geolocation.getCurrentPosition(pos => { document.getElementById('deliveryLink').value = `https://www.google.com/maps?q=${pos.coords.latitude},${pos.coords.longitude}`; }); } }
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
    if (window.scrollY > 80) { h.classList.add('hidden'); isl.classList.add('sticky'); }
    else { h.classList.remove('hidden'); isl.classList.remove('sticky'); }
});
document.getElementById('searchInput').oninput = render;
window.onload = loadData;
