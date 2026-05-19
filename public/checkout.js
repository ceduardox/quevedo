const CART_KEY = "eq_home_cart_v1";
const cart = new Map();
let products = [];
let marker;
let map;

const emptyCheckout = document.querySelector("#emptyCheckout");
const checkoutLayout = document.querySelector("#checkoutLayout");
const summaryItems = document.querySelector("#summaryItems");
const subtotalValue = document.querySelector("#subtotalValue");
const totalValue = document.querySelector("#totalValue");
const form = document.querySelector("#orderForm");
const messageEl = document.querySelector("#formMessage");
const gpsButton = document.querySelector("#gpsButton");
const mapStatus = document.querySelector("#mapStatus");
const latitudeInput = document.querySelector("#latitude");
const longitudeInput = document.querySelector("#longitude");
const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

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

function getCartRows() {
  return products
    .map((product) => ({ product, quantity: cart.get(product.id) || 0 }))
    .filter((row) => row.quantity > 0);
}

function initMap() {
  if (map) return;
  map = L.map("map").setView([-16.5, -68.15], 12);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap",
  }).addTo(map);
  map.on("click", (event) => setLocation(event.latlng.lat, event.latlng.lng));
  setTimeout(() => map.invalidateSize(), 250);
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

function renderSummary() {
  const rows = getCartRows();
  if (!rows.length) {
    emptyCheckout.hidden = false;
    checkoutLayout.hidden = true;
    return;
  }

  emptyCheckout.hidden = true;
  checkoutLayout.hidden = false;
  const total = rows.reduce((sum, row) => sum + row.product.price * row.quantity, 0);
  subtotalValue.textContent = money.format(total);
  totalValue.textContent = money.format(total);
  summaryItems.innerHTML = rows
    .map(
      ({ product, quantity }) => `
        <article class="summary-item">
          <img src="${product.image}" alt="${product.name}" loading="lazy">
          <div>
            <strong>${product.name}</strong>
            <span>${quantity} x ${money.format(product.price)}</span>
          </div>
          <b>${money.format(product.price * quantity)}</b>
        </article>
      `
    )
    .join("");
  initMap();
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  messageEl.className = "form-message mt-3";
  messageEl.textContent = "Sending order...";

  const items = Array.from(cart.entries()).map(([productId, quantity]) => ({ productId, quantity }));
  const payload = new FormData(form);
  const addressParts = [
    payload.get("street"),
    payload.get("streetNumber"),
    payload.get("apartment"),
    payload.get("city"),
    payload.get("department"),
  ]
    .map((item) => String(item || "").trim())
    .filter(Boolean);
  payload.set("address", addressParts.join(", "));
  payload.set("items", JSON.stringify(items));

  try {
    const response = await fetch("/api/orders", {
      method: "POST",
      body: payload,
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || "Order could not be sent.");
    messageEl.classList.add("success");
    messageEl.textContent = `Order #${result.orderId} created. Redirecting to your account...`;
    cart.clear();
    saveCart();
    form.reset();
    setTimeout(() => {
      window.location.href = "/account";
    }, 900);
  } catch (error) {
    messageEl.classList.add("error");
    messageEl.textContent = error.message;
  }
});

async function boot() {
  const response = await fetch("/api/products");
  products = await response.json();
  loadCart();
  renderSummary();
}

boot();
