const API_URL = "https://script.google.com/macros/s/AKfycbyJOqe3K6Q6Eps-eLDNSwasHfcPRadqUH7rRU5HhpcBiiszYVh9uzpaBXCsZ5OjkfhY/exec";

let db = { productos: [], combos: [], sedes: [], params: {}, tipos: [] };
let cart = JSON.parse(localStorage.getItem('combox_cart')) || [];
let currentSede = null;
let currentType = null;
let deliveryMethod = 'tienda';

// Audio Context para Sonido
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playTap() {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.1);
}

window.onload = async () => {
    try {
        const response = await fetch(`${API_URL}?action=getAppData`);
        db = await response.json();
        
        document.getElementById('brandName').innerText = db.params.Nombre_principal || "COMBOX";
        
        if(db.params.pagina_funcional === "no") {
            document.body.innerHTML = "<h1 style='color:white; text-align:center; margin-top:50px;'>SITIO EN MANTENIMIENTO</h1>";
            return;
        }

        initApp();
        setTimeout(hideSplash, 1000);
    } catch (e) {
        console.error("Error cargando DB", e);
    }
};

function hideSplash() {
    const s = document.getElementById('splash');
    if(s) {
        s.style.opacity = '0';
        setTimeout(() => s.style.display = 'none', 800);
    }
}

function initApp() {
    currentSede = db.sedes[0]; // Aquí se selecciona Naguanagua automáticamente
    currentType = db.tipos[0]?.id_tipo_producto;
    
    // Actualizar UI inicial
    document.getElementById('currentSedeName').innerText = currentSede.NOMBRE_SEDE;
    
    renderTypeButtons();
    renderProducts();
    updateCartUI();
}

// --- FUNCIONES DE RENDERIZADO (LAS QUE FALTABAN) ---

function renderTypeButtons() {
    const container = document.getElementById('typeButtons');
    container.innerHTML = db.tipos.map(t => `
        <button class="type-pill ${currentType === t.id_tipo_producto ? 'active' : ''}" 
                onclick="currentType='${t.id_tipo_producto}'; renderTypeButtons(); renderProducts();">
            ${t.nombre_tipo}
        </button>
    `).join('');
}

function renderProducts(filter = "") {
    const container = document.getElementById('productContainer');
    // Filtramos productos por Tipo y por Buscador
    const listado = db.productos.filter(p => 
        p.tipo_producto_fk === currentType && 
        p.PRODUCTO.toLowerCase().includes(filter.toLowerCase())
    );

    container.innerHTML = listado.map(p => {
        const { precio, esPromo } = getActivePrice(p);
        return `
            <div class="card">
                <img src="${p.IMAGEN_URL_1 || 'placeholder.png'}" loading="lazy">
                <div class="card-info">
                    <h3>${p.PRODUCTO}</h3>
                    <div class="price-tag">
                        ${esPromo ? `<span class="old-price">$${p.Precio_venta_NORMAL}</span>` : ''}
                        <span class="current-price">$${precio.toFixed(2)}</span>
                    </div>
                    <button class="btn-add" onclick="addToCart('${p.ID_PRODUCTO}')">AGREGAR</button>
                </div>
            </div>
        `;
    }).join('');
}

function showSedes() {
    // Esta función debe mostrar un modal o alerta con las sedes
    const nombres = db.sedes.map(s => s.NOMBRE_SEDE).join(", ");
    alert("Sedes disponibles: " + nombres);
}

// --- LÓGICA DE PRECIOS Y CARRITO ---

function getActivePrice(p, qty = 1) {
    let precio = parseFloat(p.Precio_venta_NORMAL || 0);
    let esPromo = false;

    if (p.PROMOCION_ACTIVA === "Activa") {
        precio = parseFloat(p.Precio_promocion_TEMPORAL);
        esPromo = true;
    }
    return { precio, esPromo };
}

function addToCart(id) {
    playTap();
    const item = db.productos.find(x => x.ID_PRODUCTO === id);
    const inCart = cart.find(x => x.ID_PRODUCTO === id);
    if (inCart) inCart.qty++; else cart.push({ ...item, qty: 1 });
    updateCartUI();
    saveCart();
}

function updateCartUI() {
    const total = cart.reduce((acc, curr) => {
        const { precio } = getActivePrice(curr, curr.qty);
        return acc + (precio * curr.qty);
    }, 0);
    const count = cart.reduce((acc, curr) => acc + curr.qty, 0);
    document.getElementById('cartTotal').innerText = `$${total.toFixed(2)}`;
    document.getElementById('cartCount').innerText = `${count} producto(s)`;
    document.getElementById('bottomIsland').style.display = cart.length > 0 ? 'flex' : 'none';
}

function saveCart() { localStorage.setItem('combox_cart', JSON.stringify(cart)); }

function getLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(pos => {
            // CORREGIDO: Uso de ${} para variables
            const link = `https://www.google.com/maps?q=${pos.coords.latitude},${pos.coords.longitude}`;
            document.getElementById('locationLink').value = link;
        });
    }
}
