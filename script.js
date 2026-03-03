const API_URL = "https://script.google.com/macros/s/AKfycbwBSKJ8SJCZKLaDC15TLOwo5yq3a8lzkW_VIiCojWTsCCvCz4N_HfDKHDIENibTA6BT/exec?action=getProducts";
let allProducts = [], cart = [], mode = 'individual', category = 'Todas', deliveryMethod = 'Tienda';

// MOTOR SENSORIAL FUSIONADO
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

// PERSISTENCIA
function saveSession() { localStorage.setItem('combox_v_max_ultra', JSON.stringify({ time: Date.now(), items: cart })); }
function loadSession() {
    const saved = JSON.parse(localStorage.getItem('combox_v_max_ultra'));
    if (saved && (Date.now() - saved.time < 3600000)) cart = saved.items;
}

async function loadData() {
    try {
        loadSession();
        const res = await fetch(API_URL + "&t=" + Date.now());
        allProducts = await res.json();
        render();
        updateUI(false);
        setTimeout(() => document.getElementById('splash').style.transform='translateY(-100%)', 1000);
    } catch(e) { console.error("Error API:", e); }
}

function render() {
    const container = document.getElementById('mainContent');
    const search = (document.getElementById('searchInput')?.value || '').toLowerCase();
    
    const filtered = allProducts.filter(p => {
        const isC = p.nombre.toLowerCase().includes('combo') || (p.categoria||'').toLowerCase().includes('combo');
        const isS = (p.categoria||'').toLowerCase().includes('servicio');
        let m = (mode==='combos'?isC:mode==='servicios'?isS:!isC&&!isS);
        return m && (category==='Todas'||p.categoria===category) && p.nombre.toLowerCase().includes(search);
    });

    const groups = filtered.reduce((acc,p)=>{(acc[p.categoria]=acc[p.categoria]||[]).push(p); return acc;},{});
    
    container.innerHTML = Object.keys(groups).map(catName => `
        <h2 style="font-weight:900; margin:30px 0 15px; text-transform:uppercase; font-size:1rem; color:#888; border-left:4px solid var(--primary); padding-left:10px;">${catName}</h2>
        <div class="grid">
            ${groups[catName].map(p => {
                const item = cart.find(i => i.nombre === p.nombre);
                const qty = item ? item.qty : 0;
                const bID = "btn-" + btoa(encodeURIComponent(p.nombre)).substring(0,8).replace(/[^a-z0-9]/gi, '');
                return `
                    <div class="card">
                        <div class="img-box"><img src="${getOptimizedUrl(p.imagen)}" loading="lazy"></div>
                        <div style="font-size:0.8rem; font-weight:800; text-align:center; height:35px; overflow:hidden;">${p.nombre}</div>
                        <div style="color:var(--primary); font-weight:900; font-size:1.4rem; text-align:center; margin:10px 0;">$${parseFloat(p.precio).toFixed(2)}</div>
                        <button id="${bID}" class="btn-add ${qty > 0 ? 'added' : ''}" 
                                onclick="addToCart('${p.nombre.replace(/'/g,"\\'")}', ${p.precio}, '${bID}')">
                            ${qty > 0 ? `<i class="fa fa-check"></i> LISTO <span class="item-counter">${qty}</span>` : `<i class="fa fa-plus"></i> AGREGAR`}
                        </button>
                    </div>`;
            }).join('')}
        </div>`).join('');
}

function getOptimizedUrl(url) {
    if(!url) return '';
    const id = url.match(/[-\w]{25,}/);
    return id ? `https://drive.google.com/thumbnail?id=${id[0]}&sz=w600` : url;
}

function addToCart(name, price, bID) {
    playTap();
    let item = cart.find(i => i.nombre === name);
    if (item) item.qty++; else cart.push({nombre: name, precio: price, qty: 1});
    saveSession();
    const btn = document.getElementById(bID);
    if(btn) {
        btn.classList.add('added');
        btn.innerHTML = `<i class="fa fa-check"></i> LISTO <span class="item-counter">${cart.find(i => i.nombre === name).qty}</span>`;
    }
    updateUI(false);
}

function updateUI(full) {
    const total = cart.reduce((a, i) => a + i.precio * i.qty, 0);
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
        <div style="display:flex; justify-content:space-between; padding:20px 0; border-bottom:1px solid #eee; align-items:center;">
            <div><div style="font-weight:800;">${i.nombre}</div><div style="color:var(--primary); font-weight:900;">$${(i.precio * i.qty).toFixed(2)}</div></div>
            <div style="display:flex; align-items:center; gap:15px; background:#f5f5f5; padding:10px 15px; border-radius:20px; font-weight:900;">
                <span onclick="changeQty(${idx}, -1)" style="cursor:pointer; padding:5px;">-</span>
                <span>${i.qty}</span>
                <span onclick="changeQty(${idx}, 1)" style="cursor:pointer; padding:5px;">+</span>
            </div>
        </div>`).join('');
}

function changeQty(idx, d) { playTap(); cart[idx].qty += d; if(cart[idx].qty <= 0) cart.splice(idx,1); saveSession(); updateUI(true); if(cart.length===0) toggleModal(false); }
function clearCart() { playTap(); cart = []; saveSession(); updateUI(true); toggleModal(false); }

function getLocation() {
    playTap();
    const btn = document.querySelector('.btn-gps-fix');
    if (navigator.geolocation) {
        btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i>';
        navigator.geolocation.getCurrentPosition(p => {
            document.getElementById('deliveryLink').value = `https://www.google.com/maps?q=${p.coords.latitude},${p.coords.longitude}`;
            btn.innerHTML = 'OK';
            btn.style.background = "var(--neon)";
            btn.style.color = "#000";
        }, () => { alert("Activa el GPS"); btn.innerHTML = "GPS"; });
    }
}

function sendWhatsApp() {
    if(cart.length === 0) return;
    let msg = `*📦 NUEVO PEDIDO COMBOX 2026*\n--------------------------\n`;
    cart.forEach(i => msg += `• *${i.qty}x* ${i.nombre} ($${(i.precio*i.qty).toFixed(2)})\n`);
    const total = cart.reduce((a, i) => a + (i.precio * i.qty), 0);
    msg += `--------------------------\n*TOTAL: $${total.toFixed(2)}*\n\n*ENTREGA:* ${deliveryMethod}`;
    const gps = document.getElementById('deliveryLink').value;
    if(deliveryMethod === 'Delivery' && gps) msg += `\n*UBICACIÓN:* ${gps}`;
    window.open(`https://wa.me/584244701273?text=${encodeURIComponent(msg)}`);
}

let sTimeout;
function handleSearch() { clearTimeout(sTimeout); sTimeout = setTimeout(() => render(), 300); }
function setMode(m, i) { playTap(); mode=m; document.querySelectorAll('.mode-opt').forEach(o=>o.classList.remove('active')); document.querySelectorAll('.mode-opt')[i].classList.add('active'); document.getElementById('modeSlider').style.transform=`translateX(${i*100}%)`; render(); }
function toggleSearch(s) { playTap(); document.getElementById('search-box').style.display = s?'flex':'none'; document.getElementById('modeContainer').style.display = s?'none':'flex'; }
function toggleModal(s) { playTap(); document.getElementById('cartModal').style.display = s?'flex':'none'; if(s) showStep('cart'); }
function showStep(s) { playTap(); document.getElementById('step-cart').style.display = s==='cart'?'block':'none'; document.getElementById('step-delivery').style.display = s==='delivery'?'block':'none'; }
function setDelivery(m) { playTap(); deliveryMethod=m; document.getElementById('opt-tienda').classList.toggle('active', m==='Tienda'); document.getElementById('opt-delivery').classList.toggle('active', m==='Delivery'); document.getElementById('delivery-fields').style.display = m==='Delivery'?'block':'none'; }
function closeModalExterno(e) { if (e.target.id === 'cartModal') toggleModal(false); }

window.addEventListener('scroll', () => {
    window.requestAnimationFrame(() => {
        const h = document.getElementById('mainHeader'), isl = document.getElementById('islandsWrapper');
        if (window.scrollY > 80) { h.classList.add('hidden'); isl.classList.add('sticky'); }
        else { h.classList.remove('hidden'); isl.classList.remove('sticky'); }
    });
});

window.onload = loadData;
