// Módulo de alertas para integração com o backend Python.
// TODO: consumir alertas de estoque baixo e validade próxima.

import apiClient from './client.js';
import { API_ENDPOINTS } from './types.js';

export async function listAlerts() {
  return apiClient.get(API_ENDPOINTS.alerts);
}

export async function markAlertAsViewed(alertId) {
  return apiClient.put(`${API_ENDPOINTS.alerts}/${alertId}/visualizar`, { visualizado: true });
}
