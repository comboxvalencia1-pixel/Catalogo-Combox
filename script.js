const API_URL = "https://script.google.com/macros/s/AKfycbyJOqe3K6Q6Eps-eLDNSwasHfcPRadqUH7rRU5HhpcBiiszYVh9uzpaBXCsZ5OjkfhY/exec";

let db = {}, cart = [], currentSede = null, currentTypeID = "", deliveryMethod = "tienda";

// IDs DE ETIQUETAS SEGÚN TU EXCEL
const STATUS = {
    DISPONIBLE: "369a743e",
    AGOTANDOSE: "1f2947d6",
    SIN_STOCK: "5161a4dd",
    OCULTAR: "adb79eaf"
};

window.onload = async () => {
    document.body.style.overflow = 'hidden';
    // Seguro de vida para el splash (5 segundos máximo)
    const safetyTimer = setTimeout(() => hideSplash(), 5000);

    try {
        await fetchData();
        checkSede();
        clearTimeout(safetyTimer);
        hideSplash();
    } catch (e) {
        console.error("Fallo al cargar:", e);
        hideSplash();
    }
};

async function fetchData() {
    const res = await fetch(`${API_URL}?action=getAppData`);
    db = await res.json();
    
    if(db.params.pagina_funcional !== "Activa") {
        document.body.innerHTML = "<div style='padding:50px; text-align:center;'><h1>SITIO EN MANTENIMIENTO</h1></div>";
        throw new Error("Página desactivada en Sheets");
    }

    // Aplicar color desde tu tabla Colores_web (usando el ID guardado en params)
    document.documentElement.style.setProperty('--primary', "#E53935"); // Color rojo de tu Excel
    document.getElementById('brandName').innerText = db.params.Nombre_principal;
    
    // Iniciar con el primer tipo de producto (Individual)
    if(db.tipos && db.tipos.length > 0) currentTypeID = db.tipos[0].id_tipo_producto;
    
    renderTypes();
}

function hideSplash() {
    gsap.to("#splash", { yPercent: -100, duration: 1, ease: "expo.inOut", onComplete: () => {
        document.body.style.overflow = 'auto';
        if(db.params.mensaje_bienvenida) showToast(db.params.mensaje_bienvenida);
    }});
}

function checkSede() {
    const saved = localStorage.getItem('combox_sede');
    if(saved) {
        currentSede = JSON.parse(saved);
        updateSedeUI();
        render();
    } else {
        document.getElementById('sedeModal').classList.add('active');
        renderSedeList();
    }
}

function renderSedeList() {
    const container = document.getElementById('sedeList');
    container.innerHTML = db.sedes.map(s => `
        <div class="sede-option" onclick="selectSede('${s.ID_SEDE}')">
            <strong>${s.NOMBRE_SEDE}</strong>
        </div>
    `).join('');
}

function selectSede(id) {
    currentSede = db.sedes.find(s => s.ID_SEDE == id);
    localStorage.setItem('combox_sede', JSON.stringify(currentSede));
    document.getElementById('sedeModal').classList.remove('active');
    updateSedeUI();
    render();
}

function updateSedeUI() {
    document.getElementById('btnWS').href = `https://wa.me/${currentSede.TELEFONO}`;
    document.getElementById('btnIG').href = currentSede.LINK_INSTAGRAM;
    document.getElementById('btnMap').href = currentSede.LINK_UBICACION;
}

function renderTypes() {
    const container = document.getElementById('typeSelector');
    container.innerHTML = db.tipos.map(t => `
        <button class="type-btn ${currentTypeID === t.id_tipo_producto ? 'active' : ''}" 
                onclick="currentTypeID='${t.id_tipo_producto}'; render(); renderTypes();">
            ${t.tipo_producto}
        </button>
    `).join('');
}

function getActivePrice(p) {
    const esPromo = p.PROMOCION_ACTIVA === "Activa";
    const sedeValida = !p.PROMOCION_VALIDA_POR_SEDE_FK || p.PROMOCION_VALIDA_POR_SEDE_FK.includes(currentSede.ID_SEDE);
    
    if (esPromo && sedeValida) {
        return { precio: p.Precio_promocion_TEMPORAL, esPromo: true };
    }
    return { precio: p.Precio_venta_NORMAL, esPromo: false };
}

function render() {
    const grid = document.getElementById('productGrid');
    const search = document.getElementById('searchInput').value.toLowerCase();
    
    // Si el tipo actual es el ID de combos, usamos db.combos
    let data = (currentTypeID === "edefbb62") ? db.combos : db.productos;
    
    let filtrados = data.filter(p => {
        const nombre = (p.PRODUCTO || p.nombre_COMBO || "").toLowerCase();
        const tipoMatch = p.tipo_producto_fk === currentTypeID;
        const oculto = p.etiqueta_fk === STATUS.OCULTAR;
        return tipoMatch && nombre.includes(search) && !oculto;
    });

    grid.innerHTML = filtrados.map(p => {
        const {precio, esPromo} = getActivePrice(p);
        const name = p.PRODUCTO || p.nombre_COMBO;
        const status = p.etiqueta_fk;

        return `
            <div class="card ${status === STATUS.SIN_STOCK ? 'disabled' : ''}">
                ${status === STATUS.AGOTANDOSE ? '<span class="tag-warn">AGOTÁNDOSE</span>' : ''}
                <img src="${p.foto_producto || p.IMAGEN_PRODUCTO_CATALOGO}">
                <div class="p-name">${name}</div>
                <div class="p-price ${esPromo ? 'promo-anim' : ''}">$${parseFloat(precio || 0).toFixed(2)}</div>
                ${status === STATUS.SIN_STOCK ? 
                    '<button class="btn-add gray" disabled>SIN STOCK</button>' : 
                    `<button class="btn-add" onclick="addToCart('${name}', ${precio})">AGREGAR</button>`
                }
            </div>
        `;
    }).join('');
}

// ... (Resto de funciones de carrito y modal iguales)
