const API_URL = "https://script.google.com/macros/s/AKfycbwBSKJ8SJCZKLaDC15TLOwo5yq3a8lzkW_VIiCojWTsCCvCz4N_HfDKHDIENibTA6BT/exec?action=getProducts";
let allProducts = [], cart = [], mode = 'individual', category = 'Todas', deliveryMethod = 'Tienda';

// SISTEMA DE AUDIO REFORZADO (No muere al salir)
let audioCtx;
function unlockAudio() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
}

function playTap() {
    unlockAudio();
    const osc = audioCtx.createOscillator(); 
    const gain = audioCtx.createGain();
    osc.type = 'sine'; 
    osc.frequency.setValueAtTime(900, audioCtx.currentTime);
    gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
    osc.connect(gain); 
    gain.connect(audioCtx.destination);
    osc.start(); 
    osc.stop(audioCtx.currentTime + 0.1);
    if (navigator.vibrate) navigator.vibrate(35); 
}

// CACHÉ DE 1 HORA
function saveCart() {
    const data = { cart, expires: Date.now() + (60 * 60 * 1000) };
    localStorage.setItem('combox_session', JSON.stringify(data));
}

function loadCart() {
    const saved = localStorage.getItem('combox_session');
    if (saved) {
        const data = JSON.parse(saved);
        if (Date.now() < data.expires) cart = data.cart;
        else localStorage.removeItem('combox_session');
    }
}

async function loadData() {
    loadCart();
    // Splash sale exactamente a los 1.5 segundos
    setTimeout(() => {
        const splash = document.getElementById('splash');
        if(splash) splash.classList.add('hide');
    }, 1500);

    try {
        const res = await fetch(API_URL);
        allProducts = await res.json();
        render(); renderCats(); updateUI(false); 
    } catch (e) {
        console.error("Offline mode");
        render(); 
    }
}

function addToCart(name, price, btnID) {
    playTap(); // Sonido y vibración al mismo tiempo
    let item = cart.find(i => i.nombre === name);
    if (item) item.qty++; else cart.push({ nombre: name, precio: price, qty: 1 });
    
    // Transición fluida del botón sin recargar todo
    const btn = document.getElementById(btnID);
    if(btn) {
        btn.classList.add('added');
        btn.innerHTML = `<i class="fa fa-check"></i> AGREGADO <span class="item-counter">${item ? item.qty : 1}</span>`;
    }
    updateUI(false); 
}

// ... (Las funciones de updateUI, render, toggleModal se mantienen para que funcione la lógica)
// Solo asegúrate de llamar a saveCart() dentro de updateUI

function updateUI(shouldRender = true) {
    const total = cart.reduce((acc, i) => acc + (i.precio * i.qty), 0);
    const count = cart.reduce((acc, i) => acc + i.qty, 0);
    saveCart();
    document.getElementById('floatTotal').textContent = `$${total.toFixed(2)}`;
    document.getElementById('modalTotal').textContent = `$${total.toFixed(2)}`;
    document.getElementById('floatCount').textContent = `${count} PRODUCTOS`;
    document.getElementById('cartFloating').classList.toggle('visible', count > 0);
    if(shouldRender) render();
}

window.addEventListener('scroll', () => {
    const h = document.getElementById('mainHeader'), isl = document.getElementById('islandsWrapper');
    if (window.scrollY > 60) { 
        h.classList.add('hidden'); 
        isl.style.top = "20px";
    } else { 
        h.classList.remove('hidden'); 
        isl.style.top = "189px";
    }
});

// Desbloqueo inicial para iOS
document.addEventListener('touchstart', unlockAudio, { once: true });
window.onload = loadData;
