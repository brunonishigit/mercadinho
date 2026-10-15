// Módulo de movimentações para integração com o backend Python.
// TODO: implementar entradas, saídas, ajustes e cálculo do estoque por lote.

import apiClient from './client.js';
import { API_ENDPOINTS } from './types.js';

export async function listMovements() {
  return apiClient.get(API_ENDPOINTS.movements);
}

export async function createMovement(movementData) {
  return apiClient.post(API_ENDPOINTS.movements, movementData);
}

export async function createEntry(entryData) {
  return apiClient.post(`${API_ENDPOINTS.movements}/entrada`, entryData);
}

export async function createExit(exitData) {
  return apiClient.post(`${API_ENDPOINTS.movements}/saida`, exitData);
}
