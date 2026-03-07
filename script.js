// URL de tu App Script (Asegúrate de que este sea el link correcto y público)
const API_URL = "https://script.google.com/macros/s/AKfycbyJOqe3K6Q6Eps-eLDNSwasHfcPRadqUH7rRU5HhpcBiiszYVh9uzpaBXCsZ5OjkfhY/exec";

let db = {
    productos: [], combos: [], sedes: [], params: {}, tipos: [], etiquetas: [], categorias: [], catCombos: []
};

let cart = JSON.parse(localStorage.getItem('combox_cart')) || [];
let currentSede = null;
let currentType = null;
let currentSubcat = null;
let deliveryMethod = 'tienda';

// Audio Context para Sonido Táctil
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
    if (navigator.vibrate) navigator.vibrate(50);
}

function normalizeString(str) {
    if (!str) return "";
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

// INICIALIZACIÓN
window.onload = async () => {
    // Seguro: si en 6 segundos no carga, quitamos el splash rojo
    const safetyTimer = setTimeout(() => {
        hideSplash();
        if(db.productos.length === 0) alert("La conexión está un poco lenta.");
    }, 6000);

    try {
        // TRUCO CORS: credentials omit y redirect follow
        const res = await fetch(`${API_URL}?action=getAppData`, {
            method: "GET",
            mode: "cors",
            credentials: "omit",
            redirect: "follow"
        });
        
        if (!res.ok) throw new Error(`HTTP error! Status: ${res.status}`);
        
        db = await res.json();

        // Aplicar Parametros Dinámicos
        if(db.params.codigo_color_fk) document.documentElement.style.setProperty('--primary', db.params.codigo_color_fk);
        if(db.params.Nombre_principal) document.getElementById('brandName').innerText = db.params.Nombre_principal;

        // Si la página está en mantenimiento
        if (db.params.pagina_funcional === "no") {
            document.body.innerHTML = `<div style='padding:50px; text-align:center;'><h1>${db.params.mensaje_bienvenida || 'MANTENIMIENTO'}</h1></div>`;
            hideSplash();
            clearTimeout(safetyTimer);
            return;
        }

        initApp();
        clearTimeout(safetyTimer);
        setTimeout(hideSplash, 500);

    } catch (e) {
        console.error("Error cargando datos de la API:", e);
        hideSplash();
    }
};

function hideSplash() {
    const s = document.getElementById('splash');
    if (s) {
        s.style.opacity = '0';
        setTimeout(() => s.style.display = 'none', 800);
    }
}

function initApp() {
    // Selección por defecto: Primera sede y primer tipo
    if (db.sedes && db.sedes.length > 0) {
        currentSede = db.sedes[0];
        actualizarEnlacesSede();
    }
    if (db.tipos && db.tipos.length > 0) {
        currentType = db.tipos[0].id_tipo_producto;
    }

    renderTypeButtons();
    renderSubcategorias();
    renderProducts();
    renderPromoCarousel();
    updateCartUI();

    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js');
    }
}

// SEDES
function openSedeModal() {
    renderSedes();
    document.getElementById('sedeModal').style.display = 'flex';
}

function renderSedes() {
    const container = document.getElementById('sedeList');
    container.innerHTML = '';
    db.sedes.forEach(sede => {
        const item = document.createElement('div');
        item.className = `sede-item ${currentSede && currentSede.ID_SEDE === sede.ID_SEDE ? 'active' : ''}`;
        item.innerHTML = `<div><div class="sede-name">${sede.NOMBRE_SEDE}</div></div>`;
        item.onclick = () => setSede(sede.ID_SEDE);
        container.appendChild(item);
    });
}

function setSede(sedeId) {
    const nuevaSede = db.sedes.find(s => s.ID_SEDE === sedeId);
    if (!nuevaSede) return;
    currentSede = nuevaSede;
    actualizarEnlacesSede();
    closeModal('sedeModal');
    renderProducts();
    renderPromoCarousel();
}

function actualizarEnlacesSede() {
    if(!currentSede) return;
    document.getElementById('currentSedeName').innerText = currentSede.NOMBRE_SEDE;
    document.getElementById('currentSedeNameModal').innerText = currentSede.NOMBRE_SEDE;
    const tel = (currentSede.TELEFONO || '').toString().replace(/\D/g, '');
    document.getElementById('linkWS').href = `https://wa.me/${tel}`;
    document.getElementById('linkIG').href = currentSede.LINK_INSTAGRAM || '#';
    document.getElementById('linkMap').href = currentSede.LINK_UBICACION || '#';
}

// TIPOS Y CATEGORÍAS
function renderTypeButtons() {
    const container = document.getElementById('typeButtons');
    container.innerHTML = '';
    db.tipos.forEach(tipo => {
        const btn = document.createElement('button');
        btn.innerText = tipo.tipo_producto;
        btn.dataset.id = tipo.id_tipo_producto;
        btn.onclick = () => selectType(tipo.id_tipo_producto);
        if (tipo.id_tipo_producto === currentType) btn.classList.add('active');
        container.appendChild(btn);
    });
}

function selectType(typeId) {
    currentType = typeId;
    currentSubcat = null;
    document.querySelectorAll('#typeButtons button').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.id === typeId);
    });
    renderSubcategorias();
    renderProducts();
}

function renderSubcategorias() {
    const container = document.getElementById('subcatContainer');
    container.innerHTML = '';
    const tipo = db.tipos.find(t => t.id_tipo_producto === currentType);
    if (!tipo) return;

    const nTipo = tipo.tipo_producto.toLowerCase();
    let categorias = nTipo.includes('individual') ? db.categorias : (nTipo.includes('combo') ? db.catCombos : []);

    const allPill = document.createElement('span');
    allPill.className = `subcat-pill ${!currentSubcat ? 'active' : ''}`;
    allPill.innerText = 'Todos';
    allPill.onclick = () => { currentSubcat = null; renderSubcategorias(); renderProducts(); };
    container.appendChild(allPill);

    categorias.forEach(cat => {
        const idCat = cat.ID_CATEGORIA || cat.ID_CATEGORIA_COMBO;
        const nombreCat = cat.NOMBRE_CATEGORIA || cat.NOMBRE_CATEGORIA_COMBO;
        const pill = document.createElement('span');
        pill.className = `subcat-pill ${currentSubcat === idCat ? 'active' : ''}`;
        pill.innerText = nombreCat;
        pill.onclick = () => { currentSubcat = idCat; renderSubcategorias(); renderProducts(); };
        container.appendChild(pill);
    });
}

// PRECIOS
function getActivePrice(item, qty = 1) {
    let pNormal = parseFloat(item.Precio_venta_NORMAL || 0);
    let pFinal = pNormal;
    let label = 'NORMAL';

    if (item.PROMOCION_ACTIVA === "Activa") {
        const hoy = new Date();
        hoy.setHours(0,0,0,0);
        const fHasta = item.promocion_hasta ? new Date(item.promocion_hasta) : null;
        if(fHasta) fHasta.setHours(0,0,0,0);
        
        const fechaOk = !fHasta || fHasta >= hoy;
        const diaOk = (item.dias_promocion || "todos").toLowerCase().includes(["domingo","lunes","martes","miércoles","jueves","viernes","sábado"][hoy.getDay()]);
        
        let sedesValidas = (item.PROMOCION_VALIDA_POR_SEDE_FK || "").split(',').map(s=>s.trim());
        const sedeOk = sedesValidas.length===0 || sedesValidas.includes(currentSede?.NOMBRE_SEDE) || sedesValidas.includes(currentSede?.ID_SEDE);

        if (fechaOk && diaOk && sedeOk) {
            pFinal = parseFloat(item.Precio_promocion_TEMPORAL) || pNormal;
            label = 'PROMO';
        }
    }
    return { precio: pFinal, label };
}

// PRODUCTOS
function renderProducts(query = "") {
    const container = document.getElementById('productContainer');
    container.innerHTML = "";
    const tipo = db.tipos.find(t => t.id_tipo_producto === currentType);
    if (!tipo) return;

    let items = tipo.tipo_producto.toLowerCase().includes('combo') ? db.combos : db.productos;
    if(!tipo.tipo_producto.toLowerCase().includes('combo') && !tipo.tipo_producto.toLowerCase().includes('individual')) {
        items = db.productos.filter(p => p.tipo_producto_fk === currentType);
    }

    if (query) items = items.filter(i => normalizeString(i.PRODUCTO || i.nombre_COMBO).includes(normalizeString(query)));
    if (currentSubcat) items = items.filter(i => (i.ID_CATEGORIA_FK || i.CATEGORIA) === currentSubcat);

    const etiquetaOcultar = db.etiquetas?.find(e => e.etiqueta === 'Ocultar')?.id_etiqueta;
    items = items.filter(i => i.etiqueta_fk !== etiquetaOcultar);

    const grupos = {};
    items.forEach(i => {
        let catId = i.ID_CATEGORIA_FK || i.CATEGORIA;
        let cNombre = 'Categoría';
        if(tipo.tipo_producto.toLowerCase().includes('individual')) {
            cNombre = db.categorias.find(c=>c.ID_CATEGORIA === catId)?.NOMBRE_CATEGORIA || 'General';
        } else if(tipo.tipo_producto.toLowerCase().includes('combo')) {
            cNombre = db.catCombos.find(c=>c.ID_CATEGORIA_COMBO === catId)?.NOMBRE_CATEGORIA_COMBO || 'General';
        }
        if(!grupos[cNombre]) grupos[cNombre] = [];
        grupos[cNombre].push(i);
    });

    for (let cat in grupos) {
        const tit = document.createElement('h3');
        tit.className = "grid-category-title";
        tit.innerText = cat.toUpperCase();
        container.appendChild(tit);

        const grid = document.createElement('div');
        grid.className = "product-grid";
        grupos[cat].forEach(item => grid.appendChild(createCard(item)));
        container.appendChild(grid);
    }
}

function createCard(item) {
    const card = document.createElement('div');
    card.className = "card";
    const { precio } = getActivePrice(item);
    const est = db.etiquetas?.find(e => e.id_etiqueta === item.etiqueta_fk)?.etiqueta || 'Disponible';

    card.innerHTML = `
        <img src="${item.foto_producto || item.IMAGEN_PRODUCTO_CATALOGO || 'logo_white.png'}" loading="lazy">
        <h4>${(item.PRODUCTO || item.nombre_COMBO || '').toUpperCase()}</h4>
        ${est === 'Agotándose' ? '<span class="badge">⚠️ AGOTÁNDOSE</span>' : ''}
        <span class="price">$${precio.toFixed(2)}</span>
    `;

    const btn = document.createElement('button');
    btn.className = 'btn-add';
    if (est === 'Sin Stock') {
        btn.disabled = true; btn.classList.add('disabled'); btn.innerHTML = 'SIN STOCK';
    } else {
        btn.innerHTML = '<i class="fa-solid fa-plus"></i> AGREGAR';
        btn.onclick = (e) => { e.stopPropagation(); addToCart(item.ID_PRODUCTO || item.ID_PRODUCTO_VENTA, btn); };
    }
    card.appendChild(btn);
    return card;
}

function renderPromoCarousel() {
    const container = document.getElementById('promoCarousel');
    container.innerHTML = '';
    const promos = [...db.productos, ...db.combos].filter(i => i.PROMOCION_ACTIVA === 'Activa' && getActivePrice(i).label === 'PROMO').slice(0, 10);
    
    document.getElementById('promoSection').style.display = promos.length ? 'block' : 'none';
    promos.forEach(item => {
        const slide = document.createElement('div');
        slide.className = 'promo-slide';
        slide.innerHTML = `<img src="${item.foto_producto || item.IMAGEN_PRODUCTO_CATALOGO || 'logo_white.png'}"><h4>${(item.PRODUCTO || item.nombre_COMBO).toUpperCase()}</h4><span class="promo-price">$${getActivePrice(item).precio.toFixed(2)}</span>`;
        container.appendChild(slide);
    });
}

// CARRITO Y CHECKOUT
function addToCart(id, btn) {
    playTap();
    btn.classList.add('success');
    setTimeout(() => btn.classList.remove('success'), 300);
    const item = db.productos.find(p => p.ID_PRODUCTO === id) || db.combos.find(c => c.ID_PRODUCTO_VENTA === id);
    const ext = cart.find(c => (c.ID_PRODUCTO || c.ID_PRODUCTO_VENTA) === id);
    if (ext) ext.qty++; else cart.push({ ...item, qty: 1 });
    updateCartUI();
    localStorage.setItem('combox_cart', JSON.stringify(cart));
}

function updateCartUI() {
    const t = cart.reduce((acc, i) => acc + (getActivePrice(i, i.qty).precio * i.qty), 0);
    const c = cart.reduce((acc, i) => acc + i.qty, 0);
    document.getElementById('cartTotal').innerText = `$${t.toFixed(2)}`;
    document.getElementById('cartCount').innerText = `${c} producto(s)`;
    document.getElementById('bottomIsland').style.display = cart.length > 0 ? 'flex' : 'none';
}

function openCart() { renderCartItems(); document.getElementById('cartModal').style.display = 'flex'; }
function closeModal(id) { document.getElementById(id).style.display = 'none'; }

function renderCartItems() {
    const list = document.getElementById('cartItemsList');
    list.innerHTML = '';
    let total = 0;
    cart.forEach((item, idx) => {
        const p = getActivePrice(item, item.qty).precio;
        total += p * item.qty;
        list.innerHTML += `<div class="cart-item">
            <div class="item-info"><span class="item-name">${(item.PRODUCTO||item.nombre_COMBO).toUpperCase()}</span><span class="item-price">$${p.toFixed(2)}</span></div>
            <div class="item-qty"><button onclick="adjQty(${idx}, -1)">-</button><span>${item.qty}</span><button onclick="adjQty(${idx}, 1)">+</button></div>
        </div>`;
    });
    document.getElementById('modalTotal').innerText = `$${total.toFixed(2)}`;
}

function adjQty(idx, d) {
    cart[idx].qty += d;
    if (cart[idx].qty <= 0) cart.splice(idx, 1);
    localStorage.setItem('combox_cart', JSON.stringify(cart));
    updateCartUI(); renderCartItems();
    if(cart.length===0) closeModal('cartModal');
}

function clearCart() { cart = []; localStorage.setItem('combox_cart', '[]'); updateCartUI(); closeModal('cartModal'); }

function showDeliveryOptions() {
    closeModal('cartModal'); document.getElementById('deliveryModal').style.display = 'flex';
    selectMethod('tienda');
}
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
    if (!navigator.geolocation) return alert('No soporta GPS');
    navigator.geolocation.getCurrentPosition(p => {
        document.getElementById('locationLink').value = `https://www.google.com/maps?q=$${p.coords.latitude},${p.coords.longitude}`;
        checkForm();
    });
}

function checkForm() {
    const btn = document.getElementById('btnWhatsApp');
    if (deliveryMethod === 'tienda') btn.disabled = !document.getElementById('clientName').value.trim();
    else btn.disabled = !(document.getElementById('locationLink').value.trim() && document.getElementById('receiverName').value.trim());
}
document.addEventListener('input', e => { if (e.target.matches('#clientName, #locationLink, #receiverName')) checkForm(); });

function finalizarPedido() {
    let msg = `Hola! Soy *${(document.getElementById('clientName').value || document.getElementById('receiverName').value).trim()}*, `;
    msg += deliveryMethod === 'tienda' ? `quiero recoger en la sede de *${currentSede.NOMBRE_SEDE}*\n\n` : `quiero este pedido a domicilio.\n\n`;
    cart.forEach(i => msg += `- *${(i.PRODUCTO || i.nombre_COMBO).toUpperCase()}*\n\`Cant:\` *${i.qty}* | *$${(getActivePrice(i,i.qty).precio * i.qty).toFixed(2)}*\n\n`);
    msg += `💵 *SUBTOTAL:* *${document.getElementById('cartTotal').innerText}*\n`;
    if (deliveryMethod === 'delivery') msg += `\n🛵 *ENTREGA POR DELIVERY:*\n${document.getElementById('locationLink').value}`;
    const tel = (currentSede.TELEFONO || '').toString().replace(/\D/g, '');
    window.open(`https://wa.me/${tel}?text=${encodeURIComponent(msg)}`, '_blank');
}

function toggleHorarios() {
    if(!currentSede) return;
    alert(`Lunes: ${currentSede.LUNES_APERTURA} - ${currentSede.LUNES_CIERRE}\nMartes: ${currentSede.MARTES_APERTURA} - ${currentSede.MARTES_CIERRE}\nMiércoles: ${currentSede.MIERCOLES_APERTURA} - ${currentSede.MIERCOLES_CIERRE}`);
}
