import { getJSON, postJSON, patchJSON, deleteJSON } from './api.js';

export function obtenerProductos() {
  return getJSON('/productos');
}

export function guardarProducto(id, datos) {
  return id ? patchJSON(`/productos/${id}`, datos) : postJSON('/productos', datos);
}

export function eliminarProducto(id) {
  return deleteJSON(`/productos/${id}`);
}

export function actualizarStock(id, nuevoStock) {
  return patchJSON(`/productos/${id}`, { stock: nuevoStock });
}
