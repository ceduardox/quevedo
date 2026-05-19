const cart = new Map();
let products = [];
let marker;
let map;

const productsEl = document.querySelector("#productsGrid");
const totalEl = document.querySelector("#cartTotal");
const drawerTotalEl = document.querySelector("#drawerTotal");
const cartCountEl = document.querySelector("#cartCount");
const cartItemsEl = document.querySelector("#cartItems");
const checkoutSection = document.querySelector("#checkoutSection");
const checkoutButton = document.querySelector("#checkoutButton");
const form = document.querySelector("#orderForm");
const messageEl = document.querySelector("#formMessage");
const gpsButton = document.querySelector("#gpsButton");
const mapStatus = document.querySelector("#mapStatus");
const latitudeInput = document.querySelector("#latitude");
const longitudeInput = document.querySelector("#longitude");
const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

function initMap() {
  if (map) return;
  map = L.map("map").setView([-16.5, -68.15], 12);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap",
  }).addTo(map);
  map.on("click", (event) => setLocation(event.latlng.lat, event.latlng.lng));
}

function setLocation(lat, lng) {
  latitudeInput.value = lat.toFixed(8);
  longitudeInput.value = lng.toFixed(8);
  if (!marker) marker = L.marker([lat, lng]).addTo(map);
  else marker.setLatLng([lat, lng]);
  map.setView([lat, lng], 15);
  mapStatus.textContent = `Delivery point marked: ${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

gpsButton.addEventListener("click", () => {
  initMap();
  if (!navigator.geolocation) {
    mapStatus.textContent = "This browser does not allow GPS. Tap the map manually.";
    return;
  }
  mapStatus.textContent = "Finding your location...";
  navigator.geolocation.getCurrentPosition(
    (position) => setLocation(position.coords.latitude, position.coords.longitude),
    () => {
      mapStatus.textContent = "GPS was not available. Tap the map manually.";
    },
    { enableHighAccuracy: true, timeout: 10000 }
  );
});

async function loadProducts() {
  const response = await fetch("/api/products");
  products = await response.json();
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
  checkoutSection.hidden = false;
  initMap();
  bootstrap.Offcanvas.getOrCreateInstance(document.querySelector("#cartDrawer")).hide();
  setTimeout(() => map.invalidateSize(), 250);
  checkoutSection.scrollIntoView({ behavior: "smooth", block: "start" });
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

  if (!rows.length) {
    cartItemsEl.innerHTML = `<div class="empty-cart">Your cart is empty. Add products to continue.</div>`;
    checkoutSection.hidden = true;
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

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  messageEl.className = "form-message mt-3";
  messageEl.textContent = "Sending order...";

  const items = Array.from(cart.entries()).map(([productId, quantity]) => ({ productId, quantity }));
  const formData = new FormData(form);
  const payload = Object.fromEntries(formData.entries());
  payload.items = items;

  try {
    const response = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || "Order could not be sent.");
    messageEl.classList.add("success");
    messageEl.textContent = `Order #${result.orderId} received. Total: ${money.format(result.total)}.`;
    cart.clear();
    updateCart();
    form.reset();
  } catch (error) {
    messageEl.classList.add("error");
    messageEl.textContent = error.message;
  }
});

loadProducts();
