// Módulo de produtos para integração com o backend Python.
// TODO: implementar listagem, cadastro, edição e inativação de produtos.

import apiClient from './client.js';
import { API_ENDPOINTS } from './types.js';

export async function listProducts() {
  return apiClient.get(API_ENDPOINTS.products);
}

export async function createProduct(productData) {
  return apiClient.post(API_ENDPOINTS.products, productData);
}

export async function updateProduct(productId, productData) {
  return apiClient.put(`${API_ENDPOINTS.products}/${productId}`, productData);
}

export async function deactivateProduct(productId) {
  return apiClient.delete(`${API_ENDPOINTS.products}/${productId}`);
}
