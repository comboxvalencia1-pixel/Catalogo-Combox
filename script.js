const API_URL = "https://script.google.com/macros/s/AKfycbwBSKJ8SJCZKLaDC15TLOwo5yq3a8lzkW_VIiCojWTsCCvCz4N_HfDKHDIENibTA6BT/exec?action=getProducts";
let allProducts = [], cart = [], mode = 'individual', category = 'Todas', deliveryMethod = 'Tienda';

// --- SISTEMA DE SONIDO Y VIBRACIÓN BLINDADO ---
let audioCtx;
function initAudio() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
}

function playTap() {
    initAudio(); // Reactiva el contexto en cada toque (Fix para iPadOS)
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
    const data = {
        cart: cart,
        expiry: Date.now() + (60 * 60 * 1000) // 1 hora desde ahora
    };
    localStorage.setItem('combox_session', JSON.stringify(data));
}

function loadCartFromCache() {
    const cached = localStorage.getItem('combox_session');
    if (cached) {
        const data = JSON.parse(cached);
        if (Date.now() < data.expiry) {
            cart = data.cart;
        } else {
            localStorage.removeItem('combox_session');
        }
    }
}

// --- CARGA DE DATOS Y SPLASH (1.5s) ---
async function loadData() {
    loadCartFromCache();
    
    // Timeout forzado de 1.5s para el splash
    const splashTimer = new Promise(resolve => setTimeout(resolve, 1500));
    
    try {
        const fetchTask = fetch(API_URL).then(res => res.json());
        // Esperamos a que ambas cosas terminen (datos + los 1.5s del splash)
        const [data] = await Promise.all([fetchTask, splashTimer]);
        allProducts = data;
        render(); 
        renderCats();
        updateUI(false);
    } catch (e) {
        console.error("Error cargando o modo offline");
        await splashTimer;
    } finally {
        const splash = document.getElementById('splash');
        splash.classList.add('exit'); // Animación de libro
        setTimeout(() => splash.style.display = 'none', 1200);
    }
}

// --- ACTUALIZACIÓN DE UI (Inyectamos la caché aquí) ---
function updateUI(shouldRender = true) {
    saveCartToCache(); // Guardamos en cada cambio
    // ... (Tu lógica de updateUI estable) ...
    const total = cart.reduce((acc, i) => acc + (i.precio * i.qty), 0);
    const count = cart.reduce((acc, i) => acc + i.qty, 0);
    document.getElementById('floatTotal').textContent = `$${total.toFixed(2)}`;
    document.getElementById('modalTotal').textContent = `$${total.toFixed(2)}`;
    document.getElementById('floatCount').textContent = `${count} PRODUCTOS`;
    document.getElementById('cartFloating').classList.toggle('visible', count > 0);
    renderCartItems();
    if(shouldRender) render();
}

// --- FIX PARA EL HEADER ---
window.addEventListener('scroll', () => {
    const h = document.getElementById('mainHeader'), isl = document.getElementById('islandsWrapper');
    // Si bajamos más de 60px, ocultamos totalmente
    if (window.scrollY > 60) {
        h.classList.add('hidden');
        isl.classList.add('sticky');
    } else {
        h.classList.remove('hidden');
        isl.classList.remove('sticky');
    }
});

// Desbloqueo de audio para iOS al primer toque
document.addEventListener('touchstart', initAudio, { once: true });

// Registro de Service Worker para PWA
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(err => console.log(err));
}

window.onload = loadData;
