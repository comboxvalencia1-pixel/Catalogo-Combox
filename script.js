const API_URL = "https://script.google.com/macros/s/AKfycbyJOqe3K6Q6Eps-eLDNSwasHfcPRadqUH7rRU5HhpcBiiszYVh9uzpaBXCsZ5OjkfhY/exec";

let db = { productos: [], combos: [], sedes: [], params: {}, tipos: [], categorias: [], catCombos: [], etiquetas: [] };
let cart = JSON.parse(localStorage.getItem('combox_cart')) || [];
let currentSede = null, currentType = null, currentSubcat = null, deliveryMethod = 'tienda';

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

window.onload = async () => {
    // Si la API falla, a los 8 segundos quita el splash rojo
    const timer = setTimeout(hideSplash, 8000); 

    try {
        const res = await fetch(`${API_URL}?action=getAppData`, { mode: 'cors', redirect: 'follow' });
        if(!res.ok) throw new Error("Fallo de red");
        
        db = await res.json();
        console.log("Datos recibidos:", db); // <-- Útil para diagnosticar en F12
        
        if (db.error) {
            document.getElementById('productContainer').innerHTML = `<p style="padding:20px; text-align:center; color:red;">Error de Base de Datos: ${db.error}</p>`;
            hideSplash(); return;
        }

        initApp();
        clearTimeout(timer);
        setTimeout(hideSplash, 800);
    } catch (e) { 
        hideSplash();
        document.getElementById('productContainer').innerHTML = "<p style='text-align:center; padding:20px;'>Error de conexión. Recarga la página.</p>";
    }
};

function hideSplash() {
    const s = document.getElementById('splash');
    if(s) { s.style.opacity = '0'; setTimeout(() => s.style.display = 'none', 800); }
}

function initApp() {
    // PROTECCIÓN: Si no hay sedes, creamos una falsa para que no explote
    if(db.sedes && db.sedes.length > 0) {
        currentSede = db.sedes[0];
    } else {
        currentSede = { NOMBRE_SEDE: "General", TELEFONO: "" };
    }

    if(db.tipos && db.tipos.length > 0) {
        currentType = db.tipos[0].id_tipo_producto;
    }

    document.getElementById('currentSedeName').innerText = currentSede.NOMBRE_SEDE;
    document.getElementById('currentSedeNameModal').innerText = currentSede.NOMBRE_SEDE;
    
    renderTypeButtons();
    renderSubcategorias();
    renderProducts();
    updateCartUI();
}

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

function getActivePrice(p) {
    let precioNormal = parseFloat(p.Precio_venta_NORMAL) || 0;
    let price = precioNormal;
    let esPromo = false;

    if (p.PROMOCION_ACTIVA === "Activa" && p.Precio_promocion_TEMPORAL) {
        const hoy = new Date();
        const diaSemana = ["domingo","lunes","martes","miércoles","jueves","viernes","sábado"][hoy.getDay()];
        const diasValidos = (p.dias_promocion || "todos").toString().toLowerCase();
        const sedeValida = (p.PROMOCION_VALIDA_POR_SEDE_FK || "").includes(currentSede.NOMBRE_SEDE);

        if (sedeValida && (diasValidos.includes("todos") || diasValidos.includes(diaSemana))) {
            price = parseFloat(p.Precio_promocion_TEMPORAL);
            esPromo = true;
        }
    }
    return { price, esPromo, precioNormal };
}

function renderProducts(filter = "") {
    const container = document.getElementById('productContainer');
    const tipoActivo = (db.tipos || []).find(t => t.id_tipo_producto === currentType);
    const isCombo = (tipoActivo?.tipo_producto || "").toLowerCase().includes('combo');
    
    let items = isCombo ? (db.combos || []) : (db.productos || []);

    // 1. Filtrar por Tipo
    items = items.filter(p => p.tipo_producto_fk === currentType);
    
    // 2. Filtrar Búsqueda (A prueba de nulos)
    if(filter) {
        const search = filter.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
        items = items.filter(p => (p.PRODUCTO || p.nombre_COMBO || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().includes(search));
    }
    
    // 3. Filtrar Subcategoría
    if(currentSubcat) items = items.filter(p => (p.ID_CATEGORIA_FK || p.CATEGORIA) === currentSubcat);

    // 4. Filtrar Etiquetas "Ocultar"
    items = items.filter(p => {
        const tag = (db.etiquetas || []).find(e => e.id_etiqueta === (p.etiqueta_fk || p.Etiqueta_fk))?.etiqueta;
        return tag !== "Ocultar";
    });

    if(items.length === 0) {
        container.innerHTML = "<p style='text-align:center; padding:30px; font-weight:bold; color:#666;'>No hay productos en esta categoría</p>";
        return;
    }

    container.innerHTML = `<div class="product-grid">` + items.map(p => {
        const { price, esPromo, precioNormal } = getActivePrice(p);
        const tag = (db.etiquetas || []).find(e => e.id_etiqueta === (p.etiqueta_fk || p.Etiqueta_fk))?.etiqueta;
        const isSinStock = tag === "Sin Stock";
        const id = p.ID_PRODUCTO || p.ID_PRODUCTO_VENTA;
        const nombre = (p.PRODUCTO || p.nombre_COMBO || "Producto sin nombre").toUpperCase();
        
        return `
            <div class="card">
                ${tag === 'Agotándose' ? '<span class="badge">⚠️ Agotándose</span>' : ''}
                <img src="${p.foto_producto || p.IMAGEN_PRODUCTO_CATALOGO || 'logo_white.png'}" loading="lazy">
                <h4>${nombre}</h4>
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

function addToCart(id, btn) {
    playTap();
    btn.classList.add('added');
    btn.innerHTML = '<i class="fa-solid fa-check"></i> AGREGADO';
    
    const item = [...db.productos, ...db.combos].find(p => (p.ID_PRODUCTO || p.ID_PRODUCTO_VENTA) === id);
    const inCart = cart.find(c => c.id === id);
    if(inCart) inCart.qty++; else cart.push({ id, raw: item, qty: 1 });
    
    updateCartUI();
    saveCart();
    setTimeout(() => { btn.classList.remove('added'); btn.innerHTML = '<i class="fa-solid fa-plus"></i> AGREGAR'; }, 1500);
}

function updateCartUI() {
    let total = 0, count = 0;
    cart.forEach(c => {
        const { price } = getActivePrice(c.raw);
        total += price * c.qty; count += c.qty;
    });
    document.getElementById('cartTotal').innerText = `$${total.toFixed(2)}`;
    document.getElementById('cartCount').innerText = `${count} producto${count !== 1 ? 's' : ''}`;
    document.getElementById('bottomIsland').style.display = count > 0 ? 'flex' : 'none';
    if(document.getElementById('modalTotal')) document.getElementById('modalTotal').innerText = `$${total.toFixed(2)}`;
}

function saveCart() { localStorage.setItem('combox_cart', JSON.stringify(cart)); }
function clearCart() { cart = []; saveCart(); updateCartUI(); closeModal('cartModal'); }
function closeModal(id) { document.getElementById(id).style.display = 'none'; }
function openCart() { document.getElementById('cartModal').style.display = 'flex'; }
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

function checkForm() {
    const btn = document.getElementById('btnWhatsApp');
    if (deliveryMethod === 'tienda') btn.disabled = !document.getElementById('clientName').value.trim();
    else btn.disabled = !(document.getElementById('locationLink').value.trim() && document.getElementById('receiverName').value.trim());
}
document.addEventListener('input', e => { if (e.target.matches('#clientName, #locationLink, #receiverName')) checkForm(); });

function finalizarPedido() {
    const name = (document.getElementById('clientName').value || document.getElementById('receiverName').value).trim();
    let subtotal = 0;
    let itemsTexto = cart.map(c => {
        const { price } = getActivePrice(c.raw);
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
}
