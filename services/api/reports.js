// Módulo de relatórios para integração com o backend Python.
// TODO: gerar resumo por categoria, vencimento, estoque mínimo e histórico.

import apiClient from './client.js';
import { API_ENDPOINTS } from './types.js';

export async function getDashboardSummary() {
  return apiClient.get(`${API_ENDPOINTS.reports}/resumo`);
}

export async function getInventoryReport() {
  return apiClient.get(`${API_ENDPOINTS.reports}/estoque`);
}

export async function getExpiringProductsReport() {
  return apiClient.get(`${API_ENDPOINTS.reports}/validade`);
}
