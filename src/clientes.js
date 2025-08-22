import { getJSON, postJSON, patchJSON, deleteJSON } from './api.js';

export function obtenerClientes() {
  return getJSON('/clientes');
}

export function guardarCliente(id, datos) {
  return id ? patchJSON(`/clientes/${id}`, datos) : postJSON('/clientes', datos);
}

export function eliminarCliente(id) {
  return deleteJSON(`/clientes/${id}`);
}
