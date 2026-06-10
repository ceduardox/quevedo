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
const softwareDemos = {
  ecommerce: {
    title: "Ecommerce and checkout",
    label: "Cart conversion",
    metric: "$12.4k",
    detail: "Live catalog, cart, checkout and admin orders.",
    bars: ["58%", "82%", "46%"],
    items: ["Product filters", "Delivery location", "Admin order queue"],
    copy: "A simple online sales flow: customers browse, add products, pay or request delivery, and the business reviews every order from an admin panel.",
    linkText: "Open ecommerce demo",
    linkHref: "#products",
    estimate: 1800,
  },
  crm: {
    title: "CRM and operations",
    label: "Lead pipeline",
    metric: "34",
    detail: "New leads organized by status, owner and next action.",
    bars: ["42%", "68%", "88%"],
    items: ["Kanban stages", "Customer notes", "Follow-up reminders"],
    copy: "A CRM demo for sales and operations teams: assign prospects, track conversations, move deals and keep work visible.",
    linkText: "Generate CRM quote",
    linkHref: "#quoteForm",
    estimate: 2400,
  },
  dashboard: {
    title: "Dashboard and reports",
    label: "Monthly insight",
    metric: "+18%",
    detail: "KPIs, inventory, sales and finance views in one place.",
    bars: ["64%", "38%", "92%"],
    items: ["Sales charts", "Inventory alerts", "Exportable reports"],
    copy: "A reporting demo for owners and managers who need clean numbers, fast filters and mobile-friendly summaries.",
    linkText: "Generate dashboard quote",
    linkHref: "#quoteForm",
    estimate: 2100,
  },
  portal: {
    title: "Web app or portal",
    label: "Client access",
    metric: "4.8",
    detail: "Private logins, requests, files and workflow screens.",
    bars: ["76%", "52%", "70%"],
    items: ["User accounts", "Request forms", "Admin approvals"],
    copy: "A portal demo for booking, client access, internal operations or custom business workflows with clear UI/UX.",
    linkText: "Generate portal quote",
    linkHref: "#quoteForm",
    estimate: 2600,
  },
};

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
        <img src="${product.image}" alt="${product.name}" loading="lazy">
        <span class="badge-soft">${product.badge}</span>
      </div>
      <div class="product-body">
        <div class="product-meta">
          <span>${product.category}</span>
          <strong>${money.format(product.price)}</strong>
        </div>
        <h3><a href="/product/${product.id}">${product.name}</a></h3>
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
        <a class="product-detail-link" href="/product/${product.id}">View details</a>
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

function setupSoftwareDemos() {
  const tabs = document.querySelectorAll("[data-demo-service]");
  const stage = document.querySelector("#demoStage");
  const title = document.querySelector("#demoTitle");
  const label = document.querySelector("#demoLabel");
  const metric = document.querySelector("#demoMetric");
  const detail = document.querySelector("#demoDetail");
  const visual = document.querySelector("#demoVisual");
  const list = document.querySelector("#demoList");
  const copy = document.querySelector("#demoCopy");
  const link = document.querySelector("#demoLink");
  const quoteForm = document.querySelector("#quoteForm");
  const quoteService = document.querySelector("#quoteService");
  const quoteTimeline = document.querySelector("#quoteTimeline");
  const quoteResult = document.querySelector("#quoteResult");

  if (!tabs.length || !stage || !quoteForm) return;

  function renderDemo(serviceKey) {
    const demo = softwareDemos[serviceKey] || softwareDemos.ecommerce;
    stage.classList.add("is-changing");
    tabs.forEach((tab) => tab.classList.toggle("active", tab.dataset.demoService === serviceKey));
    setTimeout(() => {
      title.textContent = demo.title;
      label.textContent = demo.label;
      metric.textContent = demo.metric;
      detail.textContent = demo.detail;
      visual.innerHTML = demo.bars.map((height) => `<span style="--height: ${height}"></span>`).join("");
      list.innerHTML = demo.items.map((item) => `<span><i class="bi bi-check-circle-fill"></i> ${item}</span>`).join("");
      copy.textContent = demo.copy;
      link.textContent = demo.linkText;
      link.href = demo.linkHref;
      quoteService.value = serviceKey;
      updateQuote();
      stage.classList.remove("is-changing");
    }, 180);
  }

  function getQuoteEstimate() {
    const demo = softwareDemos[quoteService.value] || softwareDemos.ecommerce;
    const timelineMultiplier = {
      standard: 1,
      fast: 1.25,
      full: 1.65,
    };
    return Math.round(demo.estimate * (timelineMultiplier[quoteTimeline.value] || 1));
  }

  function updateQuote(name = "") {
    const selected = softwareDemos[quoteService.value] || softwareDemos.ecommerce;
    const estimate = money.format(getQuoteEstimate());
    const prefix = name ? `${name}, ` : "";
    quoteResult.textContent = `${prefix}${selected.title} starts around ${estimate}. Final quote depends on integrations, users, content and launch timing.`;
  }

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => renderDemo(tab.dataset.demoService));
  });

  quoteService.addEventListener("change", () => renderDemo(quoteService.value));
  quoteTimeline.addEventListener("change", () => updateQuote());
  quoteForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(quoteForm);
    updateQuote(String(formData.get("name") || "").trim());
  });

  updateQuote();
}

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
          <img src="${product.image}" alt="${product.name}" loading="lazy">
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
setupSoftwareDemos();
