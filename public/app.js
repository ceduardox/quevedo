const cart = new Map();
let products = [];

const productsEl = document.querySelector("#productsGrid");
const totalEl = document.querySelector("#cartTotal");
const drawerTotalEl = document.querySelector("#drawerTotal");
const cartCountEl = document.querySelector("#cartCount");
const cartItemsEl = document.querySelector("#cartItems");
const checkoutButton = document.querySelector("#checkoutButton");
const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const CART_KEY = "eq_home_cart_v1";

function loadCart() {
  try {
    const saved = JSON.parse(localStorage.getItem(CART_KEY) || "{}");
    Object.entries(saved).forEach(([productId, quantity]) => {
      if (Number(quantity) > 0) cart.set(productId, Number(quantity));
    });
  } catch {
    localStorage.removeItem(CART_KEY);
  }
}

function saveCart() {
  localStorage.setItem(CART_KEY, JSON.stringify(Object.fromEntries(cart.entries())));
}

async function loadProducts() {
  const response = await fetch("/api/products");
  products = await response.json();
  loadCart();
  productsEl.innerHTML = products.map(renderProduct).join("");
  updateCart();
}

function renderProduct(product) {
  return `
    <article class="product-card">
      <div class="product-media">
        <img src="/media/${encodeURIComponent(product.image)}" alt="${product.name}">
        <span class="badge-soft">${product.badge}</span>
      </div>
      <div class="product-body">
        <div class="product-meta">
          <span>${product.category}</span>
          <strong>${money.format(product.price)}</strong>
        </div>
        <h3>${product.name}</h3>
        <p>${product.description}</p>
        <div class="product-actions">
          <button class="btn btn-outline-dark icon-btn" type="button" data-minus="${product.id}" aria-label="Decrease quantity">
            <i class="bi bi-dash"></i>
          </button>
          <input class="form-control" type="number" min="1" value="1" id="qty-${product.id}" aria-label="Quantity">
          <button class="btn btn-outline-dark icon-btn" type="button" data-plus="${product.id}" aria-label="Increase quantity">
            <i class="bi bi-plus"></i>
          </button>
          <button class="btn btn-dark flex-fill" type="button" data-add="${product.id}">
            <i class="bi bi-bag-plus"></i>
            Add
          </button>
        </div>
      </div>
    </article>
  `;
}

productsEl.addEventListener("click", (event) => {
  const addButton = event.target.closest("[data-add]");
  const plusButton = event.target.closest("[data-plus]");
  const minusButton = event.target.closest("[data-minus]");
  const productId = addButton?.dataset.add || plusButton?.dataset.plus || minusButton?.dataset.minus;
  if (!productId) return;
  const input = document.querySelector(`#qty-${productId}`);
  const current = Math.max(1, Number.parseInt(input.value, 10) || 1);
  if (plusButton) input.value = current + 1;
  if (minusButton) input.value = Math.max(1, current - 1);
  if (addButton) {
    const quantity = Math.max(1, Number.parseInt(input.value, 10) || 1);
    cart.set(productId, (cart.get(productId) || 0) + quantity);
    updateCart();
  }
});

document.querySelector("[data-add-combo]").addEventListener("click", () => {
  cart.set("professional-kitchen-faucet", (cart.get("professional-kitchen-faucet") || 0) + 1);
  cart.set("satin-finish-kitchen-sink", (cart.get("satin-finish-kitchen-sink") || 0) + 1);
  updateCart();
  bootstrap.Offcanvas.getOrCreateInstance(document.querySelector("#cartDrawer")).show();
});

cartItemsEl.addEventListener("click", (event) => {
  const removeButton = event.target.closest("[data-remove]");
  const changeButton = event.target.closest("[data-cart-qty]");
  if (removeButton) cart.delete(removeButton.dataset.remove);
  if (changeButton) {
    const productId = changeButton.dataset.cartQty;
    const next = (cart.get(productId) || 0) + Number(changeButton.dataset.delta);
    if (next <= 0) cart.delete(productId);
    else cart.set(productId, next);
  }
  updateCart();
});

checkoutButton.addEventListener("click", () => {
  if (!cart.size) return;
  window.location.href = "/checkout";
});

function getCartRows() {
  return products
    .map((product) => ({ product, quantity: cart.get(product.id) || 0 }))
    .filter((row) => row.quantity > 0);
}

function updateCart() {
  const rows = getCartRows();
  const total = rows.reduce((sum, row) => sum + row.product.price * row.quantity, 0);
  const count = rows.reduce((sum, row) => sum + row.quantity, 0);
  totalEl.textContent = money.format(total);
  drawerTotalEl.textContent = money.format(total);
  cartCountEl.textContent = count;
  checkoutButton.disabled = rows.length === 0;
  saveCart();

  if (!rows.length) {
    cartItemsEl.innerHTML = `<div class="empty-cart">Your cart is empty. Add products to continue.</div>`;
    return;
  }

  cartItemsEl.innerHTML = rows
    .map(
      ({ product, quantity }) => `
        <article class="cart-item">
          <img src="/media/${encodeURIComponent(product.image)}" alt="${product.name}">
          <div>
            <strong>${product.name}</strong>
            <span>${money.format(product.price)} each</span>
            <div class="cart-qty">
              <button type="button" data-cart-qty="${product.id}" data-delta="-1" aria-label="Decrease ${product.name}">
                <i class="bi bi-dash"></i>
              </button>
              <b>${quantity}</b>
              <button type="button" data-cart-qty="${product.id}" data-delta="1" aria-label="Increase ${product.name}">
                <i class="bi bi-plus"></i>
              </button>
              <button type="button" data-remove="${product.id}" class="remove-link">Remove</button>
            </div>
          </div>
          <strong>${money.format(product.price * quantity)}</strong>
        </article>
      `
    )
    .join("");
}

loadProducts();
