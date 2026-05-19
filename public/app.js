const cart = new Map();
let products = [];
let marker;

const productsEl = document.querySelector("#products");
const totalEl = document.querySelector("#cartTotal");
const form = document.querySelector("#orderForm");
const messageEl = document.querySelector("#formMessage");
const gpsButton = document.querySelector("#gpsButton");
const mapStatus = document.querySelector("#mapStatus");
const latitudeInput = document.querySelector("#latitude");
const longitudeInput = document.querySelector("#longitude");

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const map = L.map("map").setView([-16.5, -68.15], 12);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: "&copy; OpenStreetMap",
}).addTo(map);

function setLocation(lat, lng) {
  latitudeInput.value = lat.toFixed(8);
  longitudeInput.value = lng.toFixed(8);
  if (!marker) {
    marker = L.marker([lat, lng]).addTo(map);
  } else {
    marker.setLatLng([lat, lng]);
  }
  map.setView([lat, lng], 15);
  mapStatus.textContent = `Ubicacion marcada: ${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

map.on("click", (event) => {
  setLocation(event.latlng.lat, event.latlng.lng);
});

gpsButton.addEventListener("click", () => {
  if (!navigator.geolocation) {
    mapStatus.textContent = "Este navegador no permite GPS. Puedes tocar el mapa manualmente.";
    return;
  }
  mapStatus.textContent = "Buscando tu ubicacion...";
  navigator.geolocation.getCurrentPosition(
    (position) => setLocation(position.coords.latitude, position.coords.longitude),
    () => {
      mapStatus.textContent = "No se pudo obtener GPS. Puedes tocar el mapa manualmente.";
    },
    { enableHighAccuracy: true, timeout: 10000 }
  );
});

async function loadProducts() {
  const response = await fetch("/api/products");
  products = await response.json();
  productsEl.innerHTML = products
    .map(
      (product) => `
        <article class="product-card">
          <img src="/media/${encodeURIComponent(product.image)}" alt="${product.name}">
          <div class="product-body">
            <div class="product-meta">
              <span class="badge-soft">${product.badge}</span>
              <strong>${money.format(product.price)}</strong>
            </div>
            <h3>${product.name}</h3>
            <p>${product.description}</p>
            <div class="product-actions">
              <input class="form-control" type="number" min="1" value="1" id="qty-${product.id}" aria-label="Cantidad">
              <button class="btn btn-outline-dark flex-fill" type="button" data-add="${product.id}">
                <i class="bi bi-plus-lg"></i>
                Agregar
              </button>
            </div>
          </div>
        </article>
      `
    )
    .join("");
}

productsEl.addEventListener("click", (event) => {
  const button = event.target.closest("[data-add]");
  if (!button) return;
  const productId = button.dataset.add;
  const quantity = Math.max(1, Number.parseInt(document.querySelector(`#qty-${productId}`).value, 10) || 1);
  cart.set(productId, (cart.get(productId) || 0) + quantity);
  updateTotal();
});

function updateTotal() {
  const total = products.reduce((sum, product) => sum + product.price * (cart.get(product.id) || 0), 0);
  totalEl.textContent = money.format(total);
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  messageEl.className = "form-message mt-3";
  messageEl.textContent = "Enviando pedido...";

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
    if (!response.ok) throw new Error(result.message || "No se pudo enviar el pedido.");
    messageEl.classList.add("success");
    messageEl.textContent = `Pedido #${result.orderId} recibido. Total: ${money.format(result.total)}.`;
    cart.clear();
    updateTotal();
    form.reset();
  } catch (error) {
    messageEl.classList.add("error");
    messageEl.textContent = error.message;
  }
});

loadProducts();
