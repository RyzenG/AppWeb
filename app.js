// app.js - Versión optimizada e integrada

// ---- CONFIG ----
const API_URL = window.location.hostname === 'localhost' ? 'http://localhost:3000' : window.location.origin;
const IMAGE_BASE_PATH = './';
function buildImageSrc(imagenUrl) {
    if (!imagenUrl) return '';
    if (imagenUrl.startsWith('http://') || imagenUrl.startsWith('https://') || imagenUrl.startsWith('./') || imagenUrl.startsWith('/')) {
        return imagenUrl;
    }
    return `${IMAGE_BASE_PATH}${imagenUrl}`;
}

// ---- ESTADO GLOBAL ----
let productos = [];
let clientes = [];
let ventas = [];
let categorias = [];
let metadata = {};
let stockChartInstance = null;
let topProductosChartInstance = null;
let vistaClientesActual = 'tarjetas';
let vistaProductosActual = 'tarjetas';
let paginacion = {
    productos: { paginaActual: 1, itemsPorPagina: 8 },
    clientes: { paginaActual: 1, itemsPorPagina: 8 },
    reportes: { paginaActual: 1, itemsPorPagina: 10 }
};
let ventaActual = [];

// ---- DOM SELECTORS (para rendimiento) ----
const modalProducto = document.getElementById('modal-producto');
const formProducto = document.getElementById('form-producto');
const modalProductoTitulo = document.getElementById('modal-titulo');
const modalCliente = document.getElementById('modal-cliente');
const formCliente = document.getElementById('form-cliente');
const modalClienteTitulo = document.getElementById('modal-cliente-titulo');
const modalDetalleVenta = document.getElementById('modal-detalle-venta');
const modalImagen = document.getElementById('modal-imagen');
const imagenExpandida = document.getElementById('imagen-expandida');
const loadingOverlay = document.getElementById('loading-overlay');
const formCategoria = document.getElementById('form-categoria');

// ---- HELPERS UI (Notificaciones y Loader) ----
function mostrarLoader() { loadingOverlay.style.display = 'flex'; }
function ocultarLoader() { loadingOverlay.style.display = 'none'; }
function toastSuccess(title = 'Hecho') { Swal.fire({ toast: true, position: 'top-end', icon: 'success', title, showConfirmButton: false, timer: 1600 }); }
function toastError(title = 'Error') { Swal.fire({ toast: true, position: 'top-end', icon: 'error', title, showConfirmButton: false, timer: 2200 }); }
function toastInfo(title = 'Info') { Swal.fire({ toast: true, position: 'top-end', icon: 'info', title, showConfirmButton: false, timer: 1600 }); }
async function askConfirm(title = '¿Estás seguro?', text = 'Confirma la acción') {
    const res = await Swal.fire({ title, text, icon: 'warning', showCancelButton: true, confirmButtonText: 'Sí', cancelButtonText: 'No' });
    return !!res.isConfirmed;
}

// --- UTILIDADES VARIAS ---
function formatearCOP(valor) { return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(valor); }
function formatearNumeroFactura(numero) { return numero.toString().padStart(4, '0'); }
function safeParseFloat(v) { const n = parseFloat(v); return isNaN(n) ? 0 : n; }
function safeParseInt(v) { const n = parseInt(v); return isNaN(n) ? 0 : n; }

// ---- MODALES ----
function abrirModalProducto() { formProducto.reset(); document.getElementById('producto-id').value = ''; modalProductoTitulo.innerText = "Agregar Nuevo Producto"; popularSelectCategorias('producto-categoria'); modalProducto.style.display = 'block'; }
function cerrarModalProducto() { modalProducto.style.display = 'none'; }
function abrirModalCliente() { formCliente.reset(); document.getElementById('cliente-id').value = ''; modalClienteTitulo.innerText = "Agregar Nuevo Cliente"; modalCliente.style.display = 'block'; }
function cerrarModalCliente() { modalCliente.style.display = 'none'; }
function abrirModalDetalleVenta(ventaId) {
    const venta = ventas.find(v => v.id === ventaId);
    if (!venta) return;
    const cliente = clientes.find(c => c.id == venta.clienteId);
    const fecha = new Date(venta.fecha).toLocaleString('es-CO');
    document.getElementById('detalle-id').innerText = venta.id;
    document.getElementById('detalle-cliente').innerText = cliente ? cliente.nombre : 'N/A';
    document.getElementById('detalle-fecha').innerText = fecha;
    const productosBody = document.getElementById('detalle-venta-productos-body');
    productosBody.innerHTML = '';
    venta.productosVendidos.forEach(item => { const subtotal = item.precio * item.cantidad; productosBody.innerHTML += `<tr><td>${item.nombre}</td><td>${item.cantidad}</td><td>${formatearCOP(item.precio)}</td><td>${formatearCOP(subtotal)}</td></tr>`; });
    document.getElementById('detalle-total').innerText = formatearCOP(venta.total);
    document.getElementById('btn-generar-factura').onclick = () => generarFacturaPDF(ventaId);
    modalDetalleVenta.style.display = 'block';
}
function cerrarModalDetalleVenta() { modalDetalleVenta.style.display = 'none'; }
function abrirModalImagen(url) { modalImagen.style.display = 'block'; imagenExpandida.src = url; }
function cerrarModalImagen() { modalImagen.style.display = 'none'; }

window.onclick = function(event) {
    if (event.target == modalProducto) cerrarModalProducto();
    if (event.target == modalCliente) cerrarModalCliente();
    if (event.target == modalDetalleVenta) cerrarModalDetalleVenta();
    if (event.target == modalImagen) cerrarModalImagen();
};

// ---- CARGA DE DATOS ----
async function cargarDatos() {
    mostrarLoader();
    try {
        const [resProductos, resClientes, resVentas, resMetadata, resCategorias] = await Promise.all([
            fetch(`${API_URL}/productos`), fetch(`${API_URL}/clientes`), fetch(`${API_URL}/ventas`), fetch(`${API_URL}/metadata`), fetch(`${API_URL}/categorias`)
        ]);
        productos = await resProductos.json();
        clientes = await resClientes.json();
        ventas = await resVentas.json();
        metadata = await resMetadata.json();
        categorias = await resCategorias.json();
        
        popularSelectCategorias('filtro-categoria', true);
        actualizarVistas();
    } catch (error) {
        console.error("Error al cargar los datos:", error);
        toastError("Error al cargar datos.");
    } finally {
        ocultarLoader();
    }
}

// ---- CATEGORÍAS (SECCIÓN) ----
function renderizarVistaCategorias() {
    const lista = document.getElementById('lista-categorias');
    lista.innerHTML = categorias.map(cat => `
        <div class="categoria-item">
            <span>${cat.nombre}</span>
            <div class="categoria-item-acciones">
                <button class="btn-secundario" onclick="editarCategoria(${cat.id}, '${cat.nombre}')">Editar</button>
                <button class="btn-peligro" onclick="eliminarCategoria(${cat.id})">Eliminar</button>
            </div>
        </div>
    `).join('');
}

function cancelarEdicionCategoria() {
    document.getElementById('form-categoria-titulo').innerText = "Agregar Categoría";
    document.getElementById('btn-cancelar-edicion-categoria').style.display = 'none';
    formCategoria.reset();
    document.getElementById('categoria-id').value = '';
}

formCategoria.addEventListener('submit', async function(e) {
    e.preventDefault();
    const id = document.getElementById('categoria-id').value;
    const nombre = document.getElementById('categoria-nombre').value.trim();
    if (!nombre) return;
    mostrarLoader();
    try {
        const url = id ? `${API_URL}/categorias/${id}` : `${API_URL}/categorias`;
        const method = id ? 'PATCH' : 'POST';
        const response = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nombre }) });
        if (response.ok) {
            toastSuccess(`Categoría ${id ? 'actualizada' : 'creada'}`);
            cancelarEdicionCategoria();
            await cargarDatos();
        } else {
            throw new Error('Error al guardar categoría');
        }
    } catch (err) {
        toastError('Error al guardar');
        console.error(err);
    } finally {
        ocultarLoader();
    }
});

function editarCategoria(id, nombre) {
    document.getElementById('form-categoria-titulo').innerText = "Editando Categoría";
    document.getElementById('categoria-id').value = id;
    document.getElementById('categoria-nombre').value = nombre;
    document.getElementById('btn-cancelar-edicion-categoria').style.display = 'inline-block';
    document.getElementById('categoria-nombre').focus();
}

async function eliminarCategoria(id) {
    const productosEnCategoria = productos.filter(p => p.categoriaId == id).length;
    if (productosEnCategoria > 0) {
        return Swal.fire('Acción denegada', `No se puede eliminar la categoría porque hay ${productosEnCategoria} producto(s) asociado(s) a ella.`, 'error');
    }
    if (!await askConfirm('¿Eliminar categoría?', 'Esta acción es permanente.')) return;
    mostrarLoader();
    try {
        const response = await fetch(`${API_URL}/categorias/${id}`, { method: 'DELETE' });
        if (response.ok) {
            toastSuccess('Categoría eliminada');
            await cargarDatos();
        } else {
            throw new Error('Error al eliminar');
        }
    } catch (err) {
        toastError('Error al eliminar');
        console.error(err);
    } finally {
        ocultarLoader();
    }
}

function popularSelectCategorias(selectId, conOpcionTodos = false) {
    const select = document.getElementById(selectId);
    let options = conOpcionTodos ? '<option value="todos">Todas las categorías</option>' : '<option value="">-- Seleccione una categoría --</option>';
    options += categorias.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('');
    select.innerHTML = options;
}

// ---- PRODUCTOS ----
formProducto.addEventListener('submit', async function(event) {
    event.preventDefault();
    mostrarLoader();
    const productoId = document.getElementById('producto-id').value;
    const categoriaIdValue = document.getElementById('producto-categoria').value;
    
    const datosProducto = {
        nombre: document.getElementById('producto-nombre').value.trim(),
        descripcion: document.getElementById('producto-descripcion').value.trim(),
        precio: safeParseFloat(document.getElementById('producto-precio').value),
        stock: safeParseInt(document.getElementById('producto-stock').value),
        stockMinimo: safeParseInt(document.getElementById('producto-stock-minimo').value),
        imagenUrl: document.getElementById('producto-imagen-url').value.trim(),
        // CORRECCIÓN: Asegurar que el ID de la categoría se guarde como número o null.
        categoriaId: categoriaIdValue ? safeParseInt(categoriaIdValue) : null
    };
    
    try {
        let response;
        if (productoId) {
            response = await fetch(`${API_URL}/productos/${productoId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(datosProducto) });
            if (response.ok) toastSuccess("Producto actualizado");
        } else {
            response = await fetch(`${API_URL}/productos`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(datosProducto) });
            if (response.ok) toastSuccess("Producto agregado");
        }
        if (!response.ok) throw new Error('Error guardando producto');
        cerrarModalProducto();
        await cargarDatos();
    } catch (err) {
        console.error(err);
        toastError("Error al guardar producto.");
    } finally {
        ocultarLoader();
    }
});

async function eliminarProducto(id) {
    if (!await askConfirm('Eliminar producto', '¿Seguro que quieres eliminar este producto?')) return;
    mostrarLoader();
    try {
        const response = await fetch(`${API_URL}/productos/${id}`, { method: 'DELETE' });
        if (response.ok) { toastSuccess('Producto eliminado.'); await cargarDatos(); } 
        else { toastError('Error al eliminar.'); }
    } catch (err) {
        console.error(err);
        toastError('Error al eliminar producto.');
    } finally {
        ocultarLoader();
    }
}

// ---- CLIENTES ----
formCliente.addEventListener('submit', async function(event) {
    event.preventDefault();
    mostrarLoader();
    const clienteId = document.getElementById('cliente-id').value;
    const datosCliente = {
        nombre: document.getElementById('cliente-nombre').value.trim(),
        email: document.getElementById('cliente-email').value.trim(),
        telefono: document.getElementById('cliente-telefono').value.trim(),
        direccion: document.getElementById('cliente-direccion') ? document.getElementById('cliente-direccion').value.trim() : ''
    };
    try {
        let response;
        if (clienteId) {
            response = await fetch(`${API_URL}/clientes/${clienteId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(datosCliente) });
            if (response.ok) toastSuccess("Cliente actualizado");
        } else {
            response = await fetch(`${API_URL}/clientes`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(datosCliente) });
            if (response.ok) toastSuccess("Cliente agregado");
        }
        if (!response.ok) throw new Error('Error guardando cliente');
        cerrarModalCliente();
        await cargarDatos();
    } catch (err) {
        console.error(err);
        toastError("Error al guardar cliente.");
    } finally {
        ocultarLoader();
    }
});

async function eliminarCliente(id) {
    if (!await askConfirm('Eliminar cliente', '¿Seguro que quieres eliminar este cliente?')) return;
    mostrarLoader();
    try {
        const response = await fetch(`${API_URL}/clientes/${id}`, { method: 'DELETE' });
        if (response.ok) { toastSuccess('Cliente eliminado.'); await cargarDatos(); } 
        else { toastError('Error al eliminar.'); }
    } catch (err) {
        console.error(err);
        toastError('Error al eliminar cliente.');
    } finally {
        ocultarLoader();
    }
}

// ---- VENTAS ----
function agregarProductoAVenta() {
    const productoId = document.getElementById('venta-producto').value;
    const cantidad = safeParseInt(document.getElementById('venta-cantidad').value);
    const producto = productos.find(p => p.id.toString() === productoId);
    if (!producto) return toastError("Selecciona un producto válido.");
    if (cantidad <= 0) return toastError("La cantidad debe ser mayor a cero.");
    if (cantidad > producto.stock) return toastError("Stock insuficiente.");
    const enVenta = ventaActual.find(item => item.id.toString() === productoId);
    if (enVenta) { enVenta.cantidad += cantidad; }
    else { ventaActual.push({ ...producto, cantidad }); }
    renderizarResumenVenta();
}

document.getElementById('form-venta').addEventListener('submit', async function(event) {
    event.preventDefault();
    const clienteId = document.getElementById('venta-cliente').value;
    if (ventaActual.length === 0 || !clienteId) return toastError("Selecciona un cliente y productos.");
    
    mostrarLoader();
    try {
        const promesasStock = ventaActual.map(item => {
            const nuevoStock = item.stock - item.cantidad;
            return fetch(`${API_URL}/productos/${item.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ stock: nuevoStock }) });
        });
        await Promise.all(promesasStock);
        
        const nuevoNumeroFactura = metadata.ultimaFactura + 1;
        const totalVenta = ventaActual.reduce((sum, item) => sum + item.precio * item.cantidad, 0);
        const nuevaVenta = {
            id: `VTA-${formatearNumeroFactura(nuevoNumeroFactura)}`,
            clienteId: clienteId,
            productosVendidos: ventaActual.map(({ id, nombre, precio, cantidad }) => ({ id, nombre, precio, cantidad })),
            total: totalVenta,
            fecha: new Date().toISOString()
        };
        
        await fetch(`${API_URL}/ventas`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(nuevaVenta) });
        await fetch(`${API_URL}/metadata`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ultimaFactura: nuevoNumeroFactura }) });
        
        Swal.fire({ icon: 'success', title: `Venta registrada`, text: `Factura Nº ${nuevaVenta.id}` });
        ventaActual = [];
        document.getElementById('form-venta').reset();
        renderizarResumenVenta();
        await cargarDatos();
    } catch (err) {
        console.error(err);
        toastError('Error al registrar venta.');
    } finally {
        ocultarLoader();
    }
});

async function eliminarVenta(ventaId) {
    const advertencia = "¡ADVERTENCIA! Esta acción eliminará permanentemente el registro de la venta. El stock de los productos NO será devuelto al inventario. ¿Estás seguro de que quieres continuar?";
    const ok = await askConfirm('Eliminar registro de venta', advertencia);
    
    if (!ok) return;

    mostrarLoader();
    try {
        const response = await fetch(`${API_URL}/ventas/${ventaId}`, { method: 'DELETE' });
        if (response.ok) {
            toastSuccess('Registro de venta eliminado.');
            await cargarDatos();
        } else {
            toastError('Error al eliminar el registro.');
        }
    } catch (err) {
        console.error(err);
        toastError('Error al eliminar venta.');
    } finally {
        ocultarLoader();
    }
}

// ---- PDF (Factura) ----
function generarFacturaPDF(ventaId) {
    const venta = ventas.find(v => v.id === ventaId);
    const cliente = clientes.find(c => c.id == venta.clienteId);
    if (!venta || !cliente) return toastError("No se encontraron datos para generar la factura.");
    document.getElementById('factura-id-plantilla').innerText = venta.id;
    document.getElementById('factura-fecha-plantilla').innerText = new Date(venta.fecha).toLocaleDateString('es-CO');
    document.getElementById('factura-cliente-nombre').innerText = cliente.nombre;
    document.getElementById('factura-cliente-email').innerText = cliente.email || '';
    document.getElementById('factura-cliente-telefono').innerText = cliente.telefono || '';
    const tablaBody = document.getElementById('factura-tabla-body');
    tablaBody.innerHTML = '';
    venta.productosVendidos.forEach(item => { tablaBody.innerHTML += `<tr><td>${item.nombre}</td><td>${item.cantidad}</td><td>${formatearCOP(item.precio)}</td><td>${formatearCOP(item.precio * item.cantidad)}</td></tr>`; });
    document.getElementById('factura-total-valor').innerText = formatearCOP(venta.total);
    const elemento = document.getElementById('plantilla-factura');
    const opt = { margin: 0, filename: `Factura-${venta.id}.pdf`, image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 3, useCORS: true }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } };
    html2pdf().from(elemento).set(opt).save();
}

// ---- BACKUP Y EXPORTACIÓN ----
function exportarProductosAExcel() {
    if (productos.length === 0) return toastInfo('No hay productos para exportar.');
    const ws = XLSX.utils.json_to_sheet(productos);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Productos");
    XLSX.writeFile(wb, "ReporteProductos.xlsx");
    toastSuccess('Reporte de productos descargado');
}
function exportarClientesAExcel() {
    if (clientes.length === 0) return toastInfo('No hay clientes para exportar.');
    const ws = XLSX.utils.json_to_sheet(clientes);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Clientes");
    XLSX.writeFile(wb, "ReporteClientes.xlsx");
    toastSuccess('Reporte de clientes descargado');
}
function exportarVentasAExcel() {
    if (ventas.length === 0) return toastInfo('No hay ventas para exportar.');
    const datosParaExportar = ventas.map(venta => {
        const cliente = clientes.find(c => c.id == venta.clienteId);
        return { 'ID Venta': venta.id, 'Fecha': new Date(venta.fecha).toLocaleDateString('es-CO'), 'Cliente': cliente ? cliente.nombre : 'N/A', 'Total': venta.total, 'Productos': venta.productosVendidos.map(p => `${p.cantidad}x ${p.nombre}`).join(', ') };
    });
    const ws = XLSX.utils.json_to_sheet(datosParaExportar);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Ventas");
    XLSX.writeFile(wb, "ReporteVentas.xlsx");
    toastSuccess('Reporte de ventas descargado');
}
function exportarBackup() {
    const fecha = new Date().toISOString().slice(0, 10);
    const backupData = JSON.stringify({ productos, clientes, ventas, metadata, categorias }, null, 2);
    const blob = new Blob([backupData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `amazonia-backup-${fecha}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toastSuccess('Copia de seguridad descargada.');
}
async function importarBackup(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const data = JSON.parse(e.target.result);
            if (!data.productos || !data.clientes || !data.ventas || !data.metadata || !data.categorias) {
                throw new Error('Formato de archivo inválido.');
            }

            const ok = await askConfirm('¿Importar copia de seguridad?', '¡ADVERTENCIA! Esto borrará todos los datos actuales y los reemplazará con los del archivo. Esta acción es irreversible.');
            if (!ok) return;
            
            mostrarLoader();
            await Promise.all([
                ...productos.map(p => fetch(`${API_URL}/productos/${p.id}`, { method: 'DELETE' })),
                ...clientes.map(c => fetch(`${API_URL}/clientes/${c.id}`, { method: 'DELETE' })),
                ...ventas.map(v => fetch(`${API_URL}/ventas/${v.id}`, { method: 'DELETE' })),
                ...categorias.map(cat => fetch(`${API_URL}/categorias/${cat.id}`, { method: 'DELETE' }))
            ]);

            await Promise.all([
                ...data.productos.map(p => fetch(`${API_URL}/productos`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(p) })),
                ...data.clientes.map(c => fetch(`${API_URL}/clientes`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(c) })),
                ...data.ventas.map(v => fetch(`${API_URL}/ventas`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(v) })),
                ...data.categorias.map(cat => fetch(`${API_URL}/categorias`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cat) }))
            ]);
            await fetch(`${API_URL}/metadata`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data.metadata) });

            toastSuccess('Datos importados con éxito.');
            await cargarDatos();

        } catch (error) {
            toastError('Error al importar el archivo.');
            console.error(error);
        } finally {
            ocultarLoader();
            event.target.value = null;
        }
    };
    reader.readAsText(file);
}

// ---- CONFIGURACIÓN Y ZONA DE PELIGRO ----
async function reiniciarAplicacion() {
    const ok = await askConfirm('¿Reiniciar aplicación?', '¿Estás SEGURO de que quieres borrar TODOS los datos? Esta acción es irreversible.');
    if (!ok) return;

    const confirmacionTexto = await Swal.fire({ title: "Para confirmar, escribe 'REINICIAR':", input: 'text', showCancelButton: true, inputPlaceholder: 'REINICIAR' });
    if (confirmacionTexto.isDismissed || confirmacionTexto.value !== "REINICIAR") {
        return toastInfo('Operación cancelada.');
    }

    mostrarLoader();
    try {
        await Promise.all([
            ...productos.map(p => fetch(`${API_URL}/productos/${p.id}`, { method: 'DELETE' })),
            ...clientes.map(c => fetch(`${API_URL}/clientes/${c.id}`, { method: 'DELETE' })),
            ...ventas.map(v => fetch(`${API_URL}/ventas/${v.id}`, { method: 'DELETE' })),
            ...categorias.map(c => fetch(`${API_URL}/categorias/${c.id}`, { method: 'DELETE' }))
        ]);
        await fetch(`${API_URL}/metadata`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ultimaFactura: 0 }) });
        Swal.fire('¡Hecho!', 'Aplicación reiniciada con éxito.', 'success');
        await cargarDatos();
    } catch (error) {
        console.error("Error durante el reinicio:", error);
        toastError("Error al reiniciar la aplicación.");
    } finally {
        ocultarLoader();
    }
}
const mapaDeColores = { 'color-sidebar': '--color-sidebar', 'color-texto-sidebar': '--color-texto-sidebar', 'color-botones-primario': '--color-primario', 'color-botones-secundario': '--color-secundario', 'color-botones-peligro': '--color-peligro' };
function aplicarConfiguracionGuardada() {
    for (const [id, variableCSS] of Object.entries(mapaDeColores)) {
        const colorGuardado = localStorage.getItem(id);
        if (colorGuardado) { document.documentElement.style.setProperty(variableCSS, colorGuardado); const inputColor = document.getElementById(id); if (inputColor) inputColor.value = colorGuardado; }
    }
}
function configurarEventListenersDeColores() {
    for (const [id, variableCSS] of Object.entries(mapaDeColores)) {
        const inputColor = document.getElementById(id);
        if (inputColor) { inputColor.addEventListener('input', (event) => { const nuevoColor = event.target.value; document.documentElement.style.setProperty(variableCSS, nuevoColor); localStorage.setItem(id, nuevoColor); }); }
    }
}
async function restaurarColores() {
    const ok = await askConfirm('¿Restaurar colores?', 'Esto eliminará tus personalizaciones y volverá al tema original.');
    if (ok) { for (const id of Object.keys(mapaDeColores)) { localStorage.removeItem(id); } Swal.fire('¡Restaurado!', 'Los colores han vuelto a su estado original.', 'success').then(() => location.reload()); }
}

// ---- RENDERIZADO Y VISTAS ----
function renderizarDashboard() {
    const totalIngresos = ventas.reduce((sum, venta) => sum + venta.total, 0);
    const totalVentas = ventas.length;
    const ticketPromedio = totalVentas > 0 ? totalIngresos / totalVentas : 0;
    document.getElementById('kpi-ingresos-totales').innerText = formatearCOP(totalIngresos);
    document.getElementById('kpi-ventas-realizadas').innerText = totalVentas;
    document.getElementById('kpi-ticket-promedio').innerText = formatearCOP(ticketPromedio);
    const conteoProductos = {};
    ventas.forEach(v => { v.productosVendidos.forEach(p => { conteoProductos[p.nombre] = (conteoProductos[p.nombre] || 0) + p.cantidad; }); });
    const productosOrdenados = Object.entries(conteoProductos).sort(([, a], [, b]) => b - a).slice(0, 5);
    if (stockChartInstance) stockChartInstance.destroy();
    stockChartInstance = new Chart(document.getElementById('stockChart'), { type: 'bar', data: { labels: productos.map(p => p.nombre), datasets: [{ label: 'Stock', data: productos.map(p => p.stock), backgroundColor: 'rgba(85, 107, 47, 0.5)', borderColor: 'rgba(85, 107, 47, 1)', borderWidth: 1 }] }, options: { scales: { y: { beginAtZero: true } } } });
    if (topProductosChartInstance) topProductosChartInstance.destroy();
    topProductosChartInstance = new Chart(document.getElementById('topProductosChart'), { type: 'doughnut', data: { labels: productosOrdenados.map(p => p[0]), datasets: [{ label: 'Unidades Vendidas', data: productosOrdenados.map(p => p[1]), backgroundColor: ['rgba(85, 107, 47, 0.7)', 'rgba(189, 183, 107, 0.7)', 'rgba(205, 92, 92, 0.7)', 'rgba(100, 149, 237, 0.7)', 'rgba(128, 128, 128, 0.7)'], borderColor: '#fff', borderWidth: 2 }] } });
}
function renderizarControlesPaginacion({ contenedorId, paginaActual, itemsPorPagina, totalItems, callback, tipo }) {
    const contenedor = document.getElementById(contenedorId);
    contenedor.innerHTML = '';
    const totalPaginas = Math.ceil(totalItems / itemsPorPagina);
    if (totalPaginas <= 1) return;
    const wrapper = document.createElement('div');
    wrapper.className = 'paginacion-controles';
    wrapper.innerHTML += `<button ${paginaActual === 1 ? 'disabled' : ''} onclick="cambiarPagina('${tipo}', ${paginaActual - 1})">Anterior</button>`;
    for (let i = 1; i <= totalPaginas; i++) { wrapper.innerHTML += `<button class="${i === paginaActual ? 'activo' : ''}" onclick="cambiarPagina('${tipo}', ${i})">${i}</button>`; }
    wrapper.innerHTML += `<button ${paginaActual === totalPaginas ? 'disabled' : ''} onclick="cambiarPagina('${tipo}', ${paginaActual + 1})">Siguiente</button>`;
    contenedor.appendChild(wrapper);
}
function cambiarPagina(tipo, nuevaPagina) {
    if (tipo === 'productos') actualizarVistaProductos(nuevaPagina);
    if (tipo === 'clientes') actualizarVistaClientes(nuevaPagina);
    if (tipo === 'reportes') renderizarReportes(nuevaPagina);
}
function actualizarVistaProductos(nuevaPagina = paginacion.productos.paginaActual) {
    paginacion.productos.paginaActual = nuevaPagina;
    const { paginaActual, itemsPorPagina } = paginacion.productos;
    const terminoBusqueda = document.getElementById('buscador-productos').value.toLowerCase();
    const categoriaSeleccionada = document.getElementById('filtro-categoria').value;
    
    const productosFiltrados = productos.filter(p => {
        const coincideBusqueda = (p.nombre || '').toLowerCase().includes(terminoBusqueda);
        const coincideCategoria = categoriaSeleccionada === 'todos' || p.categoriaId == categoriaSeleccionada;
        return coincideBusqueda && coincideCategoria;
    });

    const productosPaginados = productosFiltrados.slice((paginaActual - 1) * itemsPorPagina, paginaActual * itemsPorPagina);
    if (vistaProductosActual === 'tarjetas') { document.getElementById('lista-productos-tarjetas').style.display = 'grid'; document.getElementById('tabla-productos').style.display = 'none'; renderizarProductosEnTarjetas(productosPaginados); } 
    else { document.getElementById('lista-productos-tarjetas').style.display = 'none'; document.getElementById('tabla-productos').style.display = 'table'; renderizarProductosEnLista(productosPaginados); }
    renderizarControlesPaginacion({ contenedorId: 'paginacion-productos', paginaActual, itemsPorPagina, totalItems: productosFiltrados.length, callback: cambiarPagina, tipo: 'productos' });
}
function renderizarProductosEnTarjetas(productosParaMostrar) {
    const contenedor = document.getElementById('lista-productos-tarjetas');
    contenedor.innerHTML = '';
    productosParaMostrar.forEach(p => {
        const categoria = categorias.find(c => c.id == p.categoriaId);
        const tarjeta = document.createElement('div');
        tarjeta.className = 'tarjeta-producto';
        const alerta = p.stock <= p.stockMinimo ? `<p style="color: var(--color-peligro); font-weight: bold;">¡Stock bajo!</p>` : '';
        const imagenSrc = buildImageSrc(p.imagenUrl);
        const imagenHTML = imagenSrc ? `<img src="${imagenSrc}" alt="${p.nombre}" class="tarjeta-imagen" loading="lazy" onclick="abrirModalImagen('${imagenSrc}')">` : '';
        const categoriaBadge = categoria ? `<div class="categoria-badge">${categoria.nombre}</div>` : '';
        tarjeta.innerHTML = `${categoriaBadge}${imagenHTML}<div class="tarjeta-contenido"><h4>${p.nombre}</h4><p>${p.descripcion}</p><p class="precio">${formatearCOP(p.precio)}</p><p class="stock">Disponibles: ${p.stock}</p>${alerta}<div class="tarjeta-acciones"><button class="btn-secundario" onclick="abrirModalParaEditar('${p.id}')">Editar</button><button class="btn-peligro" onclick="eliminarProducto('${p.id}')">Eliminar</button></div></div>`;
        contenedor.appendChild(tarjeta);
    });
}
function renderizarProductosEnLista(productosParaMostrar) {
    const tbody = document.getElementById('tabla-productos-body');
    tbody.innerHTML = '';
    productosParaMostrar.forEach(p => { 
        const categoria = categorias.find(c => c.id == p.categoriaId);
        const tr = document.createElement('tr'); 
        tr.innerHTML = `<td><strong>${p.nombre}</strong></td><td>${categoria ? categoria.nombre : 'N/A'}</td><td>${p.descripcion}</td><td>${formatearCOP(p.precio)}</td><td>${p.stock}</td><td><div class="tarjeta-acciones" style="border-top: none; padding-top: 0;"><button class="btn-secundario" onclick="abrirModalParaEditar('${p.id}')">Editar</button><button class="btn-peligro" onclick="eliminarProducto('${p.id}')">Eliminar</button></div></td>`; 
        tbody.appendChild(tr); 
    });
}
function actualizarVistaClientes(nuevaPagina = paginacion.clientes.paginaActual) {
    paginacion.clientes.paginaActual = nuevaPagina;
    const { paginaActual, itemsPorPagina } = paginacion.clientes;
    const terminoBusqueda = document.getElementById('buscador-clientes').value.toLowerCase();
    const clientesFiltrados = clientes.filter(c => (c.nombre || '').toLowerCase().includes(terminoBusqueda));
    const clientesPaginados = clientesFiltrados.slice((paginaActual - 1) * itemsPorPagina, paginaActual * itemsPorPagina);
    if (vistaClientesActual === 'tarjetas') { document.getElementById('lista-clientes-tarjetas').style.display = 'grid'; document.getElementById('tabla-clientes').style.display = 'none'; renderizarClientesEnTarjetas(clientesPaginados); } 
    else { document.getElementById('lista-clientes-tarjetas').style.display = 'none'; document.getElementById('tabla-clientes').style.display = 'table'; renderizarClientesEnLista(clientesPaginados); }
    renderizarControlesPaginacion({ contenedorId: 'paginacion-clientes', paginaActual, itemsPorPagina, totalItems: clientesFiltrados.length, callback: cambiarPagina, tipo: 'clientes' });
}
function renderizarClientesEnTarjetas(clientesParaMostrar) {
    const contenedor = document.getElementById('lista-clientes-tarjetas');
    contenedor.innerHTML = '';
    clientesParaMostrar.forEach(c => { const tarjeta = document.createElement('div'); tarjeta.className = 'tarjeta-producto'; tarjeta.innerHTML = `<div class="tarjeta-contenido"><h4>${c.nombre}</h4><p>Email: ${c.email || 'N/A'}</p><p>Teléfono: ${c.telefono || 'N/A'}</p><div class="tarjeta-acciones"><button class="btn-secundario" onclick="abrirModalParaEditarCliente('${c.id}')">Editar</button><button class="btn-peligro" onclick="eliminarCliente('${c.id}')">Eliminar</button></div></div>`; contenedor.appendChild(tarjeta); });
}
function renderizarClientesEnLista(clientesParaMostrar) {
    const tbody = document.getElementById('tabla-clientes-body');
    tbody.innerHTML = '';
    clientesParaMostrar.forEach(c => { const tr = document.createElement('tr'); tr.innerHTML = `<td>${c.nombre}</td><td>${c.email || 'N/A'}</td><td>${c.telefono || 'N/A'}</td><td><button class="btn-secundario" onclick="abrirModalParaEditarCliente('${c.id}')" style="margin-right: 5px;">Editar</button><button class="btn-peligro" onclick="eliminarCliente('${c.id}')">Eliminar</button></td>`; tbody.appendChild(tr); });
}
function renderizarReportes(nuevaPagina = paginacion.reportes.paginaActual) {
    paginacion.reportes.paginaActual = nuevaPagina;
    const { paginaActual, itemsPorPagina } = paginacion.reportes;
    const tbody = document.getElementById('tabla-reportes-body');
    const ventasPaginadas = ventas.slice().reverse().slice((paginaActual - 1) * itemsPorPagina, paginaActual * itemsPorPagina);
    tbody.innerHTML = ventasPaginadas.map(venta => {
        const cliente = clientes.find(c => c.id == venta.clienteId);
        return `<tr>
            <td>${venta.id}</td>
            <td>${cliente ? cliente.nombre : 'N/A'}</td>
            <td>${new Date(venta.fecha).toLocaleDateString('es-CO')}</td>
            <td>${formatearCOP(venta.total)}</td>
            <td>
                <button class="btn-secundario" style="width:auto; margin-right: 5px;" onclick="abrirModalDetalleVenta('${venta.id}')">Ver</button>
                <button class="btn-peligro" style="width:auto;" onclick="eliminarVenta('${venta.id}')">Eliminar</button>
            </td>
        </tr>`;
    }).join('');
    renderizarControlesPaginacion({ contenedorId: 'paginacion-reportes', paginaActual, itemsPorPagina, totalItems: ventas.length, callback: cambiarPagina, tipo: 'reportes' });
}
function renderizarInventario() {
    const tbody = document.getElementById('tabla-inventario-body');
    tbody.innerHTML = productos.map(p => `<tr><td>${p.nombre}</td><td>${p.stock}</td><td>${p.stockMinimo}</td><td><span class="estado-tag ${p.stock > p.stockMinimo ? 'estado-ok' : 'estado-bajo'}">${p.stock > p.stockMinimo ? 'OK' : 'Bajo'}</span></td><td><input type="number" class="input-ajuste-stock" id="ajuste-stock-${p.id}" placeholder="0"><button class="btn-secundario" onclick="ajustarStock('${p.id}', 'sumar')" style="padding: 5px 10px;">+</button><button class="btn-peligro" onclick="ajustarStock('${p.id}', 'restar')" style="padding: 5px 10px;">-</button></td></tr>`).join('');
}
function renderizarFormularioVenta() {
    const selectCliente = document.getElementById('venta-cliente');
    selectCliente.innerHTML = '<option value="">-- Seleccione un cliente --</option>' + clientes.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('');
    const selectProducto = document.getElementById('venta-producto');
    selectProducto.innerHTML = '<option value="">-- Seleccione un producto --</option>' + productos.filter(p => p.stock > 0).map(p => `<option value="${p.id}">${p.nombre} (${formatearCOP(p.precio)})</option>`).join('');
}
function renderizarResumenVenta() {
    const tbody = document.getElementById('resumen-venta-body');
    let total = 0;
    tbody.innerHTML = ventaActual.map(item => { const subtotal = item.precio * item.cantidad; total += subtotal; return `<tr><td>${item.nombre}</td><td>${item.cantidad}</td><td>${formatearCOP(item.precio)}</td><td>${formatearCOP(subtotal)}</td></tr>`; }).join('');
    document.getElementById('venta-total').innerText = formatearCOP(total);
}
function actualizarVistas() {
    renderizarDashboard();
    actualizarVistaProductos();
    renderizarInventario();
    actualizarVistaClientes();
    renderizarFormularioVenta();
    renderizarReportes();
    renderizarVistaCategorias(); // Renderizar la nueva sección de categorías
}

// ---- INICIALIZACIÓN ----
document.addEventListener('DOMContentLoaded', () => {
    aplicarConfiguracionGuardada();
    configurarEventListenersDeColores();
    
    document.getElementById('buscador-productos').addEventListener('input', () => actualizarVistaProductos(1));
    document.getElementById('filtro-categoria').addEventListener('change', () => actualizarVistaProductos(1));
    document.getElementById('buscador-clientes').addEventListener('input', () => actualizarVistaClientes(1));
    document.getElementById('btn-cancelar-edicion-categoria').addEventListener('click', cancelarEdicionCategoria);
    
    document.getElementById('btn-vista-tarjetas-productos').addEventListener('click', () => { vistaProductosActual = 'tarjetas'; actualizarVistaProductos(1); });
    document.getElementById('btn-vista-lista-productos').addEventListener('click', () => { vistaProductosActual = 'lista'; actualizarVistaProductos(1); });
    document.getElementById('btn-vista-tarjetas-clientes').addEventListener('click', () => { vistaClientesActual = 'tarjetas'; actualizarVistaClientes(1); });
    document.getElementById('btn-vista-lista-clientes').addEventListener('click', () => { vistaClientesActual = 'lista'; actualizarVistaClientes(1); });
    
    document.getElementById('btn-exportar-productos').addEventListener('click', exportarProductosAExcel);
    document.getElementById('btn-exportar-clientes').addEventListener('click', exportarClientesAExcel);
    document.getElementById('btn-exportar-ventas').addEventListener('click', exportarVentasAExcel);
    document.getElementById('btn-exportar-backup').addEventListener('click', exportarBackup);
    document.getElementById('btn-importar-backup').addEventListener('click', () => document.getElementById('importar-backup-input').click());
    document.getElementById('importar-backup-input').addEventListener('change', importarBackup);
    
    document.getElementById('btn-abrir-modal-producto').addEventListener('click', abrirModalProducto);
    document.getElementById('btn-abrir-modal-cliente').addEventListener('click', abrirModalCliente);
    document.getElementById('btn-reiniciar-app').addEventListener('click', reiniciarAplicacion);
    document.getElementById('btn-restaurar-colores').addEventListener('click', restaurarColores);
    document.getElementById('btn-agregar-a-venta').addEventListener('click', agregarProductoAVenta);
    
    document.getElementById('btn-menu').addEventListener('click', () => { document.getElementById('sidebar').classList.toggle('abierto'); document.body.classList.toggle('menu-abierto'); });
    document.getElementById('menu-links').addEventListener('click', (e) => {
        if (e.target.tagName === 'A' && e.target.dataset.section) {
            e.preventDefault();
            mostrarSeccion(e.target.dataset.section);
            if (window.innerWidth <= 768) { document.getElementById('sidebar').classList.remove('abierto'); document.body.classList.remove('menu-abierto'); }
        }
    });
    
    const darkBtn = document.getElementById('toggle-darkmode');
    if (localStorage.getItem('amazonia_dark') === 'true') document.body.classList.add('dark');
    darkBtn.addEventListener('click', () => {
        const isDark = document.body.classList.toggle('dark');
        localStorage.setItem('amazonia_dark', isDark);
        toastInfo(isDark ? 'Tema oscuro activado' : 'Tema claro activado');
    });
    
    mostrarSeccion('dashboard');
    cargarDatos();
});

function mostrarSeccion(idSeccion) {
    document.querySelectorAll('.seccion').forEach(s => s.classList.remove('activa'));
    document.getElementById(idSeccion)?.classList.add('activa');
}

// ---- Exponer funciones globales para onclicks en HTML ----
window.abrirModalParaEditar = (id) => {
    const producto = productos.find(p => p.id == id);
    if (!producto) return;
    document.getElementById('producto-id').value = producto.id;
    document.getElementById('producto-nombre').value = producto.nombre;
    document.getElementById('producto-descripcion').value = producto.descripcion;
    document.getElementById('producto-precio').value = producto.precio;
    document.getElementById('producto-stock').value = producto.stock;
    document.getElementById('producto-stock-minimo').value = producto.stockMinimo;
    document.getElementById('producto-imagen-url').value = producto.imagenUrl || '';
    
    popularSelectCategorias('producto-categoria');
    document.getElementById('producto-categoria').value = producto.categoriaId;
    
    modalProductoTitulo.innerText = 'Editar Producto';
    modalProducto.style.display = 'block';
};
window.abrirModalParaEditarCliente = (id) => {
    const cliente = clientes.find(c => c.id == id);
    if (!cliente) return;
    document.getElementById('cliente-id').value = cliente.id;
    document.getElementById('cliente-nombre').value = cliente.nombre;
    document.getElementById('cliente-email').value = cliente.email;
    document.getElementById('cliente-telefono').value = cliente.telefono;
    if (document.getElementById('cliente-direccion')) { document.getElementById('cliente-direccion').value = cliente.direccion || ''; }
    modalClienteTitulo.innerText = 'Editar Cliente';
    modalCliente.style.display = 'block';
};
window.ajustarStock = (productoId, operacion) => {
    const input = document.getElementById(`ajuste-stock-${productoId}`);
    const cantidad = safeParseInt(input.value);
    const producto = productos.find(p => p.id == productoId);
    if (isNaN(cantidad) || cantidad <= 0 || !producto) return;
    let nuevoStock = producto.stock;
    if (operacion === 'sumar') nuevoStock += cantidad;
    else if (operacion === 'restar') {
        if (producto.stock < cantidad) {
            toastError("Stock insuficiente.");
            return;
        }
        nuevoStock -= cantidad;
    }
    fetch(`${API_URL}/productos/${productoId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ stock: nuevoStock }) })
    .then(res => {
        if (res.ok) { input.value = ''; toastSuccess("Stock actualizado"); cargarDatos(); }
        else { toastError("Error al actualizar stock"); }
    })
    .catch(err => { console.error(err); toastError("Error al actualizar stock"); });
};
window.eliminarProducto = eliminarProducto;
window.eliminarCliente = eliminarCliente;
window.eliminarVenta = eliminarVenta;
window.cerrarModalProducto = cerrarModalProducto;
window.cerrarModalCliente = cerrarModalCliente;
window.abrirModalDetalleVenta = abrirModalDetalleVenta;
window.cerrarModalDetalleVenta = cerrarModalDetalleVenta;
window.abrirModalImagen = abrirModalImagen;
window.cerrarModalImagen = cerrarModalImagen;
window.generarFacturaPDF = generarFacturaPDF;
window.cambiarPagina = cambiarPagina;
window.editarCategoria = editarCategoria;
window.eliminarCategoria = eliminarCategoria;

// === Overrides agregados ===
(function(){
  // Clientes tarjetas (incluye dirección)
  const oldTarjetas = window.renderizarClientesEnTarjetas;
  window.renderizarClientesEnTarjetas = function(clientesParaMostrar){
    const contenedor = document.getElementById('lista-clientes-tarjetas');
    if (!contenedor) return oldTarjetas && oldTarjetas(clientesParaMostrar);
    contenedor.innerHTML = '';
    clientesParaMostrar.forEach(c => {
      const tarjeta = document.createElement('div');
      tarjeta.className = 'tarjeta';
      tarjeta.innerHTML = `
        <div class="tarjeta-contenido">
          <h4>${c.nombre||''}</h4>
          <p>${c.email||''}</p>
          <p>${c.telefono||''}</p>
          ${c.direccion ? `<p>${c.direccion}</p>` : ''}
          <div class="tarjeta-acciones">
            <button class="btn-secundario" onclick="abrirModalParaEditarCliente('${c.id}')">Editar</button>
            <button class="btn-peligro" onclick="eliminarCliente('${c.id}')">Eliminar</button>
          </div>
        </div>`;
      contenedor.appendChild(tarjeta);
    });
  };

  // Clientes lista (añade columna Dirección)
  const oldLista = window.renderizarClientesEnLista;
  window.renderizarClientesEnLista = function(clientesParaMostrar){
    const tbody = document.getElementById('tabla-clientes-body');
    if (!tbody) return oldLista && oldLista(clientesParaMostrar);
    tbody.innerHTML = clientesParaMostrar.map(c => `
      <tr>
        <td>${c.nombre||''}</td>
        <td>${c.email||''}</td>
        <td>${c.telefono||''}</td>
        <td>${c.direccion||''}</td>
        <td>
          <button class="btn-secundario" onclick="abrirModalParaEditarCliente('${c.id}')">Editar</button>
          <button class="btn-peligro" onclick="eliminarCliente('${c.id}')">Eliminar</button>
        </td>
      </tr>`).join('');
  };

  // Inventario con filtros
  const oldInv = window.renderizarInventario;
  window.renderizarInventario = function(){
    const tbody = document.getElementById('tabla-inventario-body');
    if (!tbody) return oldInv && oldInv();
    const q = (document.getElementById('inv-buscar')?.value || '').toLowerCase();
    const estado = document.getElementById('inv-estado')?.value || 'todos';
    const prods = (window.productos || []).filter(p => {
      const okQ = (p.nombre||'').toLowerCase().includes(q);
      const okE = estado==='todos' ? true : (estado==='ok' ? p.stock > p.stockMinimo : p.stock <= p.stockMinimo);
      return okQ && okE;
    });
    tbody.innerHTML = prods.map(p => `
      <tr>
        <td>${p.nombre}</td>
        <td>${p.stock}</td>
        <td>${p.stockMinimo}</td>
        <td>${p.stock <= p.stockMinimo ? '<span class="estado-tag stock-bajo">BAJO</span>' : '<span class="estado-tag stock-ok">OK</span>'}</td>
        <td>
          <div class="ajuste-stock">
            <input type="number" id="ajuste-stock-${p.id}" placeholder="0" class="input-ajuste">
            <button class="btn-secundario" onclick="ajustarStock('${p.id}', 'sumar')" style="padding:5px 10px;">+</button>
            <button class="btn-peligro" onclick="ajustarStock('${p.id}', 'restar')" style="padding:5px 10px;">-</button>
          </div>
        </td>
      </tr>`).join('');
  };

  window.addEventListener('DOMContentLoaded', () => {
    const b = document.getElementById('inv-buscar');
    const s = document.getElementById('inv-estado');
    if (b) b.addEventListener('input', () => window.renderizarInventario());
    if (s) s.addEventListener('change', () => window.renderizarInventario());
  });
})();
