const API_URL = "https://script.google.com/macros/s/AKfycbyJOqe3K6Q6Eps-eLDNSwasHfcPRadqUH7rRU5HhpcBiiszYVh9uzpaBXCsZ5OjkfhY/exec";

// 1. ESTADO GLOBAL
let db = { productos: [], combos: [], sedes: [], params: {}, tipos: [], categorias: [], catCombos: [], etiquetas: [] };
let cart = JSON.parse(localStorage.getItem('combox_cart')) || [];
let currentSede = null, currentType = null, currentSubcat = null, deliveryMethod = 'tienda';

// 2. UTILIDADES (Audio, Toasts, Guardado)
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playTap() {
    try {
        const osc = audioCtx.createOscillator(), gain = audioCtx.createGain();
        osc.connect(gain); gain.connect(audioCtx.destination);
        osc.type = 'sine'; osc.frequency.setValueAtTime(880, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
        osc.start(); osc.stop(audioCtx.currentTime + 0.1);
        if (navigator.vibrate) navigator.vibrate(50);
    } catch(e){}
}

function saveCart() { 
    localStorage.setItem('combox_cart', JSON.stringify(cart)); 
}

function showToast(msg) {
    // Si tienes el toastContainer en tu HTML, lo usamos. Si no, un alert amigable.
    const tc = document.getElementById('toastContainer');
    if(tc) {
        const t = document.createElement('div'); t.className = 'toast show'; t.innerText = msg;
        tc.appendChild(t); setTimeout(() => t.remove(), 3000);
    } else {
        alert(msg);
    }
}

// 3. CARGA DE DATOS (OFFLINE FIRST + FETCH SIMPLE)
window.onload = async () => {
    const cache = localStorage.getItem('combox_cache');
    if(cache) { 
        db = JSON.parse(cache); 
        initApp(); 
    }

    try {
        // Fetch simple para evadir CORS
        const res = await fetch(`${API_URL}?action=getAppData&t=${Date.now()}`);
        if (!res.ok) throw new Error("Red inestable");
        
        const freshData = await res.json();
        if (freshData && freshData.productos) {
            db = freshData;
            localStorage.setItem('combox_cache', JSON.stringify(db));
            initApp();
        }
    } catch (e) { 
        console.error("Fallo API:", e);
        if(!cache) document.getElementById('productContainer').innerHTML = "<p style='text-align:center; padding:30px;'>Error de conexión. Verifica tu internet.</p>";
        else showToast("Modo sin conexión. Datos guardados mostrados.");
    } finally {
        // Ocultar splash SOLO cuando termina de cargar (éxito o fallo)
        hideSplash();
    }
};

function hideSplash() {
    const s = document.getElementById('splash');
    if(s) { s.style.opacity = '0'; setTimeout(() => s.style.display = 'none', 800); }
}

function initApp() {
    if(db.sedes && db.sedes.length > 0) currentSede = db.sedes[0];
    else currentSede = { NOMBRE_SEDE: "Sede Principal", TELEFONO: "" };

    if(db.tipos && db.tipos.length > 0 && !currentType) currentType = db.tipos[0].id_tipo_producto;

    document.getElementById('currentSedeName').innerText = currentSede.NOMBRE_SEDE;
    document.getElementById('currentSedeNameModal').innerText = currentSede.NOMBRE_SEDE;
    
    renderTypeButtons();
    renderSubcategorias();
    renderProducts();
    updateCartUI();
}

// 4. LÓGICA DE PRECIOS MEJORADA (Compara Mayorista vs Promo)
function getActivePrice(p, qty = 1) {
    let precioNormal = parseFloat(p.Precio_venta_NORMAL) || 0;
    let bestPrice = precioNormal;
    let esPromo = false;

    // A. Validar Promoción (Split por comas para sedes múltiples)
    if (p.PROMOCION_ACTIVA === "Activa" && p.Precio_promocion_TEMPORAL) {
        const hoy = new Date();
        const diaSemana = ["domingo","lunes","martes","miércoles","jueves","viernes","sábado"][hoy.getDay()];
        const diasValidos = (p.dias_promocion || "todos").toString().toLowerCase();
        
        const sedesArray = (p.PROMOCION_VALIDA_POR_SEDE_FK || "").split(',').map(s=>s.trim());
        const sedeValida = sedesArray.length === 0 || sedesArray.includes(currentSede?.NOMBRE_SEDE) || sedesArray.includes("");

        if (sedeValida && (diasValidos.includes("todos") || diasValidos.includes(diaSemana))) {
            bestPrice = parseFloat(p.Precio_promocion_TEMPORAL);
            esPromo = true;
        }
    }

    // B. Validar Mayorista y COMPARAR
    const minMayor = parseInt(p.cantidad_minima_mayor) || 0;
    const priceMayor = parseFloat(p.precio_mayor) || 0;
    
    if (minMayor > 0 && qty >= minMayor && priceMayor > 0) {
        // Solo aplica mayorista si es MÁS BARATO que la promoción activa
        if (priceMayor < bestPrice) {
            bestPrice = priceMayor;
            esPromo = false; // Ya no es promo, es precio mayorista
        }
    }

    return { price: bestPrice, esPromo, precioNormal };
}

// 5. RENDERIZADO UI (Se mantiene igual, modular y limpio)
function renderTypeButtons() {
    const container = document.getElementById('typeButtons');
    if(!db.tipos) return;
    container.innerHTML = db.tipos.map(t => `
        <button class="${currentType === t.id_tipo_producto ? 'active' : ''}" onclick="selectType('${t.id_tipo_producto}')">
            ${t.tipo_producto}
        </button>
    `).join('');
}

function selectType(id) {
    currentType = id; currentSubcat = null;
    document.getElementById('searchInput').value = "";
    renderTypeButtons(); renderSubcategorias(); renderProducts();
}

function renderSubcategorias() {
    if(!db.tipos || !currentType) return;
    const tipoActivo = db.tipos.find(t => t.id_tipo_producto === currentType);
    const isCombo = (tipoActivo?.tipo_producto || "").toLowerCase().includes('combo');
    const cats = isCombo ? (db.catCombos || []) : (db.categorias || []);
    
    let html = `<span class="subcat-pill ${!currentSubcat ? 'active' : ''}" onclick="currentSubcat=null; renderProducts();">Todos</span>`;
    cats.forEach(c => {
        const id = c.ID_CATEGORIA || c.ID_CATEGORIA_COMBO;
        const name = c.NOMBRE_CATEGORIA || c.NOMBRE_CATEGORIA_COMBO;
        html += `<span class="subcat-pill ${currentSubcat === id ? 'active' : ''}" onclick="currentSubcat='${id}'; renderSubcategorias(); renderProducts();">${name}</span>`;
    });
    document.getElementById('subcatContainer').innerHTML = html;
}

function renderProducts(filter = "") {
    const container = document.getElementById('productContainer');
    const tipoActivo = (db.tipos || []).find(t => t.id_tipo_producto === currentType);
    const isCombo = (tipoActivo?.tipo_producto || "").toLowerCase().includes('combo');
    
    let items = isCombo ? (db.combos || []) : (db.productos || []);

    items = items.filter(p => p.tipo_producto_fk === currentType);
    if(filter) {
        const search = filter.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
        items = items.filter(p => (p.PRODUCTO || p.nombre_COMBO || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().includes(search));
    }
    if(currentSubcat) items = items.filter(p => (p.ID_CATEGORIA_FK || p.CATEGORIA) === currentSubcat);
    
    items = items.filter(p => {
        const tag = (db.etiquetas || []).find(e => e.id_etiqueta === (p.etiqueta_fk || p.Etiqueta_fk))?.etiqueta;
        return tag !== "Ocultar";
    });

    // Renderizado simple en lista general para esta versión
    if(items.length === 0) {
        container.innerHTML = "<p style='text-align:center; padding:30px;'>No hay productos</p>";
        return;
    }

    container.innerHTML = `<div class="product-grid">` + items.map(p => {
        const { price, esPromo, precioNormal } = getActivePrice(p);
        const tag = (db.etiquetas || []).find(e => e.id_etiqueta === (p.etiqueta_fk || p.Etiqueta_fk))?.etiqueta;
        const isSinStock = tag === "Sin Stock";
        const id = p.ID_PRODUCTO || p.ID_PRODUCTO_VENTA;
        
        return `
            <div class="card">
                ${tag === 'Agotándose' ? '<span class="badge">⚠️ Agotándose</span>' : ''}
                <img src="${p.foto_producto || p.IMAGEN_PRODUCTO_CATALOGO || 'logo_white.png'}" loading="lazy">
                <h4>${(p.PRODUCTO || p.nombre_COMBO || "").toUpperCase()}</h4>
                <div class="price">
                    ${esPromo ? `<span style="text-decoration:line-through; color:#999; font-size:0.8rem; display:block;">$${precioNormal.toFixed(2)}</span>` : ''}
                    $${price.toFixed(2)}
                </div>
                <button class="btn-add ${isSinStock ? 'disabled' : ''}" ${isSinStock ? 'disabled' : `onclick="addToCart('${id}', this)"`}>
                    ${isSinStock ? 'SIN STOCK' : '<i class="fa-solid fa-plus"></i> AGREGAR'}
                </button>
            </div>
        `;
    }).join('') + `</div>`;
}

// 6. CARRITO
function addToCart(id, btn) {
    playTap();
    btn.classList.add('added');
    btn.innerHTML = '<i class="fa-solid fa-check"></i> AGREGADO';
    
    const item = [...(db.productos||[]), ...(db.combos||[])].find(p => (p.ID_PRODUCTO || p.ID_PRODUCTO_VENTA) === id);
    const inCart = cart.find(c => c.id === id);
    if(inCart) inCart.qty++; else cart.push({ id, raw: item, qty: 1 });
    
    updateCartUI(); saveCart();
    setTimeout(() => { btn.classList.remove('added'); btn.innerHTML = '<i class="fa-solid fa-plus"></i> AGREGAR'; }, 1500);
}

function updateCartUI() {
    let total = 0, count = 0;
    cart.forEach(c => {
        const { price } = getActivePrice(c.raw, c.qty); // Aquí qty es vital para el mayorista en el carrito
        total += price * c.qty; count += c.qty;
    });
    document.getElementById('cartTotal').innerText = `$${total.toFixed(2)}`;
    document.getElementById('cartCount').innerText = `${count} producto${count !== 1 ? 's' : ''}`;
    document.getElementById('bottomIsland').style.display = count > 0 ? 'flex' : 'none';
    if(document.getElementById('modalTotal')) document.getElementById('modalTotal').innerText = `$${total.toFixed(2)}`;
}

function openCart() { 
    const list = document.getElementById('cartItemsList');
    list.innerHTML = cart.map((c, i) => {
        const { price } = getActivePrice(c.raw, c.qty);
        return `
            <div class="cart-item">
                <div style="flex:1;">
                    <span class="item-name">${(c.raw.PRODUCTO || c.raw.nombre_COMBO).toUpperCase()}</span>
                    <span class="item-price">$${price.toFixed(2)}</span>
                </div>
                <div class="item-qty">
                    <button onclick="changeQty(${i}, -1)">-</button>
                    <span>${c.qty}</span>
                    <button onclick="changeQty(${i}, 1)">+</button>
                </div>
            </div>
        `;
    }).join('');
    updateCartUI();
    document.getElementById('cartModal').style.display = 'flex'; 
}

function changeQty(index, delta) {
    cart[index].qty += delta;
    if(cart[index].qty <= 0) cart.splice(index, 1);
    saveCart(); updateCartUI(); openCart();
    if(cart.length === 0) closeModal('cartModal');
}

function clearCart() { cart = []; saveCart(); updateCartUI(); closeModal('cartModal'); }
function closeModal(id) { document.getElementById(id).style.display = 'none'; }

// 7. CHECKOUT Y FORMULARIOS
function showDeliveryOptions() { closeModal('cartModal'); document.getElementById('deliveryModal').style.display = 'flex'; selectMethod('tienda'); }
function backToCart() { closeModal('deliveryModal'); openCart(); }

function selectMethod(m) {
    deliveryMethod = m;
    document.getElementById('btnStore').classList.toggle('active', m === 'tienda');
    document.getElementById('btnDelivery').classList.toggle('active', m === 'delivery');
    document.getElementById('storeInfo').style.display = m === 'tienda' ? 'block' : 'none';
    document.getElementById('deliveryInfo').style.display = m === 'delivery' ? 'block' : 'none';
    checkForm();
}

function getLocation() {
    if(!navigator.geolocation) return showToast("GPS no soportado");
    const btn = document.querySelector('.btn-gps');
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
    
    navigator.geolocation.getCurrentPosition(pos => {
        // CORRECCIÓN: Link universal y válido de Maps
        document.getElementById('locationLink').value = `https://maps.google.com/?q=${pos.coords.latitude},${pos.coords.longitude}`;
        btn.innerHTML = '<i class="fa-solid fa-location-crosshairs"></i> Aquí';
        checkForm();
    }, () => {
        btn.innerHTML = 'Aquí'; showToast("Activa el GPS o pega el link manualmente.");
    });
}

function checkForm() {
    const btn = document.getElementById('btnWhatsApp');
    if (deliveryMethod === 'tienda') btn.disabled = !document.getElementById('clientName').value.trim();
    else btn.disabled = !(document.getElementById('locationLink').value.trim() && document.getElementById('receiverName').value.trim());
}
document.addEventListener('input', e => { if (e.target.matches('#clientName, #locationLink, #receiverName')) checkForm(); });

function finalizarPedido() {
    const btn = document.getElementById('btnWhatsApp');
    btn.disabled = true; // CORRECCIÓN: Prevención de doble clic
    const txtOriginal = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> PROCESANDO...';

    setTimeout(() => {
        const name = (document.getElementById('clientName').value || document.getElementById('receiverName').value).trim();
        let subtotal = 0;
        let itemsTexto = cart.map(c => {
            const { price } = getActivePrice(c.raw, c.qty);
            subtotal += price * c.qty;
            return `- *${(c.raw.PRODUCTO || c.raw.nombre_COMBO).toUpperCase()}*\n\`Cant:\`  *${c.qty}* |  *$\`${(price * c.qty).toFixed(2)}\`*`;
        }).join('\n\n');

        let msg = "";
        if (deliveryMethod === 'tienda') {
            msg = `Hola! Soy *${name}*, Confirmame La disponibilidad para este pedido. Quiero recogerlo en la sede de *${currentSede.NOMBRE_SEDE}*\n\n${itemsTexto}\n\n_______________________________________\n\n💵 *SUBTOTAL:* *$\`${subtotal.toFixed(2)}\`*`;
        } else {
            const gps = document.getElementById('locationLink').value;
            msg = `Hola! Soy *${name}*, quiero este pedido.\n\n${itemsTexto}\n\n______________________________________\n\n💵 *SUBTOTAL:* *$\`${subtotal.toFixed(2)}\`*\n\n______________________________________\n\n🛵 *ENTREGA POR DELIVERY:*\n\nPor favor dime cuánto sale para esta zona.\n\n${gps}`;
        }

        const tel = (currentSede.TELEFONO || '').toString().replace(/\D/g, '');
        window.open(`https://wa.me/${tel}?text=${encodeURIComponent(msg)}`, '_blank');

        btn.innerHTML = txtOriginal;
        btn.disabled = false;
        closeModal('deliveryModal');
        clearCart();
    }, 800);
}

// 8. MODAL SEDES
function openSedeModal() {
    document.getElementById('sedeList').innerHTML = db.sedes.map(s => `
        <div class="sede-item ${currentSede && currentSede.ID_SEDE === s.ID_SEDE ? 'active' : ''}" onclick="setSede('${s.ID_SEDE}')">
            ${s.NOMBRE_SEDE}
        </div>
    `).join('');
    document.getElementById('sedeModal').style.display = 'flex';
}
function setSede(id) { currentSede = db.sedes.find(s => s.ID_SEDE === id); initApp(); closeModal('sedeModal'); }
function toggleHorarios() { alert(`🕒 HORARIOS ${currentSede.NOMBRE_SEDE}\nLunes: ${currentSede.LUNES_APERTURA}-${currentSede.LUNES_CIERRE}\nMartes: ${currentSede.MARTES_APERTURA}-${currentSede.MARTES_CIERRE}`); }
