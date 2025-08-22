import { getJSON, postJSON, patchJSON, deleteJSON } from './api.js';

export function obtenerVentas() {
  return getJSON('/ventas');
}

export function registrarVenta(venta, nuevoNumeroFactura) {
  const ventaReq = postJSON('/ventas', venta);
  const metaReq = patchJSON('/metadata', { ultimaFactura: nuevoNumeroFactura });
  return Promise.all([ventaReq, metaReq]);
}

export function eliminarVenta(id) {
  return deleteJSON(`/ventas/${id}`);
}
