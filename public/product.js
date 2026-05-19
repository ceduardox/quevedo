const CART_KEY = "eq_home_cart_v1";
const productId = window.location.pathname.split("/").filter(Boolean).pop();
const detailEl = document.querySelector("#productDetail");
const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

function loadCart() {
  try {
    return new Map(Object.entries(JSON.parse(localStorage.getItem(CART_KEY) || "{}")).map(([id, qty]) => [id, Number(qty)]));
  } catch {
    return new Map();
  }
}

function saveCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(Object.fromEntries(cart.entries())));
}

function addToCart(productId, quantity) {
  const cart = loadCart();
  cart.set(productId, (cart.get(productId) || 0) + quantity);
  saveCart(cart);
}

async function loadProduct() {
  const response = await fetch(`/api/products/${productId}`);
  if (!response.ok) {
    detailEl.innerHTML = `
      <div class="empty-checkout">
        <i class="bi bi-exclamation-circle"></i>
        <h2>Product not found</h2>
        <p>This product is not available in the catalog.</p>
        <a class="btn btn-dark" href="/">Return to store</a>
      </div>
    `;
    return;
  }

  const product = await response.json();
  document.title = `${product.name} | Importadora Quevedo LLC`;
  detailEl.innerHTML = `
    <div class="product-detail-grid">
      <div class="product-detail-media">
        <img src="${product.image}" alt="${product.name}">
      </div>
      <div class="product-detail-info">
        <p class="eyebrow">${product.category}</p>
        <h1>${product.name}</h1>
        <div class="detail-price-row">
          <strong>${money.format(product.price)}</strong>
          <span class="badge-soft">${product.badge}</span>
        </div>
        <p class="detail-copy">${product.detail || product.description}</p>
        <div class="detail-actions">
          <input class="form-control form-control-lg" type="number" id="qty" min="1" value="1" aria-label="Quantity">
          <button class="btn btn-primary btn-lg" id="addButton" type="button">
            <i class="bi bi-bag-plus"></i>
            Add to cart
          </button>
          <a class="btn btn-outline-dark btn-lg" href="/checkout">Go to checkout</a>
        </div>
        <div class="detail-specs">
          <h2>Product details</h2>
          <ul>
            ${(product.specs || []).map((item) => `<li>${item}</li>`).join("")}
          </ul>
        </div>
      </div>
    </div>
  `;

  document.querySelector("#addButton").addEventListener("click", () => {
    const quantity = Math.max(1, Number.parseInt(document.querySelector("#qty").value, 10) || 1);
    addToCart(product.id, quantity);
    document.querySelector("#addButton").innerHTML = `<i class="bi bi-check2"></i> Added`;
  });
}

loadProduct();
