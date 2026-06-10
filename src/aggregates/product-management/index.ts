// Cross-domain product-management orchestration — the seam that keeps the
// `product` and `application` domains from importing each other. It composes
// each domain's own use cases (product commitment/lifecycle + dashboard
// cards/folders) into the coherent "add to dashboard" / "forget product" flows
// consumed across features.
//
// Note: this aggregate is pure orchestration and owns no runtime `state/` yet.
// The flows are cross-domain and consumed by multiple features, which is the
// aggregate layer's purpose; state (e.g. in-flight install/forget status) can be
// added here later without moving the flows.
export { productManagementUseCase } from './productManagementUseCase';
export { useAddProductToDashboard, useForgetProduct } from './hooks';
