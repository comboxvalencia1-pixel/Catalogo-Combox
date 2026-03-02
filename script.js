const API_URL = "https://script.google.com/macros/s/AKfycbwBSKJ8SJCZKLaDC15TLOwo5yq3a8lzkW_VIiCojWTsCCvCz4N_HfDKHDIENibTA6BT/exec?action=getProducts";
let allProducts = [], cart = [], mode = 'individual', category = 'Todas', deliveryMethod = 'Tienda';

// Audio Context mejorado para evitar suspensión
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
    osc.frequency.setValueAtTime(800, audioCtx.currentTime);
    gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
    osc.connect(gain); 
    gain.connect(audioCtx.destination);
    osc.start(); osc.stop(audioCtx.currentTime + 0.1);
    if (navigator.vibrate) navigator.vibrate(30); 
}

// Persistencia con expiración de 1 hora
function saveCart() {
    const data = { cart, timestamp: Date.now() };
    localStorage.setItem('combox_data', JSON.stringify(data));
}

function loadCart() {
    const saved = localStorage.getItem('combox_data');
    if (saved) {
        const parsed = JSON.parse(saved);
        const oneHour = 60 * 60 * 1000;
        if (Date.now() - parsed.timestamp < oneHour) {
            cart = parsed.cart;
        } else {
            localStorage.removeItem('combox_data');
        }
    }
}

async function loadData() {
    loadCart();
    // Splash sale a los 1.5s pase lo que pase
    setTimeout(() => {
        const splash = document.getElementById('splash');
        if(splash) splash.classList.add('exit');
        setTimeout(() => splash.style.display = 'none', 900);
    }, 1500);

    try {
        const res = await fetch(API_URL);
        allProducts = await res.json();
        render(); 
        renderCats();
        updateUI(false); 
    } catch (e) {
        console.log("Modo offline o error de red");
        render(); 
    }
}

function addToCart(name, price, btnID) {
    playTap();
    let item = cart.find(i => i.nombre === name);
    if (item) item.qty++; else cart.push({ nombre: name, precio: price, qty: 1 });
    
    // Actualización visual inmediata sin parpadeo
    const btn = document.getElementById(btnID);
    btn.classList.add('added');
    btn.innerHTML = `<i class="fa fa-check"></i> AGREGADO <span class="item-counter">${item ? item.qty : 1}</span>`;
    
    updateUI(false); 
}

function updateUI(shouldRender = true) {
    const total = cart.reduce((acc, i) => acc + (i.precio * i.qty), 0);
    const count = cart.reduce((acc, i) => acc + i.qty, 0);
    saveCart();
    document.getElementById('floatTotal').textContent = `$${total.toFixed(2)}`;
    document.getElementById('modalTotal').textContent = `$${total.toFixed(2)}`;
    document.getElementById('floatCount').textContent = `${count} PRODUCTOS`;
    document.getElementById('cartFloating').classList.toggle('visible', count > 0);
    renderCartItems();
    if(shouldRender) render();
}

// ... (Resto de funciones: renderCartItems, changeQty, setMode, etc. se mantienen igual)

window.addEventListener('scroll', () => {
    const h = document.getElementById('mainHeader'), isl = document.getElementById('islandsWrapper');
    if (window.scrollY > 50) { 
        h.classList.add('hidden'); 
        isl.style.top = "20px";
    } else { 
        h.classList.remove('hidden'); 
        isl.style.top = "189px";
    }
});

// Reiniciar audio al tocar cualquier parte (solución para iOS)
document.addEventListener('touchstart', initAudio, { once: true });
window.onload = loadData;
