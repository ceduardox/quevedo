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
    title: "Tienda online + checkout",
    label: "Vender sin friccion",
    metric: "24/7",
    detail: "Catalogo, carrito, pagos, delivery y panel de pedidos para vender todos los dias.",
    items: ["Catalogo de productos y filtros", "Carrito, checkout y comprobantes", "Panel admin para pedidos y entregas"],
    copy: "Ideal para negocios que quieren vender en linea con una experiencia clara: el cliente compra rapido y el equipo administra pedidos sin depender de mensajes manuales.",
    linkText: "Ver tienda real",
    linkHref: "#products",
    quoteName: "tienda online",
    estimate: 1800,
    visualHtml: `
      <div class="mini-store">
        <div class="mini-store-head"><strong>Store</strong><span>Checkout ready</span></div>
        <div class="mini-products">
          <div class="mini-product"><i class="bi bi-box-seam"></i><b>$750</b></div>
          <div class="mini-product"><i class="bi bi-droplet"></i><b>$180</b></div>
          <div class="mini-product"><i class="bi bi-lightning-charge"></i><b>$590</b></div>
        </div>
        <div class="mini-checkout">
          <span class="done">Cart</span>
          <span class="done">Pay</span>
          <span class="active">Admin</span>
        </div>
      </div>
    `,
  },
  crm: {
    title: "CRM y operaciones",
    label: "Seguimiento comercial",
    metric: "+34",
    detail: "Leads, clientes, tareas y estados para que ningun contacto se pierda.",
    items: ["Pipeline por etapas y responsables", "Historial de contacto y proximas acciones", "Alertas para ventas, soporte y operaciones"],
    copy: "Para equipos que atienden clientes por WhatsApp, llamadas o formularios y necesitan ordenar el seguimiento, medir avance y cerrar oportunidades con menos caos.",
    linkText: "Cotizar CRM",
    linkHref: "#quoteForm",
    quoteName: "CRM",
    estimate: 2400,
    visualHtml: `
      <div class="mini-crm">
        <div class="crm-column"><strong>Nuevo</strong><span class="lead-card">Lead web</span><span class="lead-card">Cotizacion</span></div>
        <div class="crm-column"><strong>En proceso</strong><span class="lead-card hot">Demo agendada</span><span class="lead-card">Llamar hoy</span></div>
        <div class="crm-column"><strong>Cierre</strong><span class="lead-card won">Contrato</span></div>
      </div>
    `,
  },
  dashboard: {
    title: "Dashboards y reportes",
    label: "Decisiones con datos",
    metric: "+18%",
    detail: "Ventas, inventario, finanzas y rendimiento visibles en una sola pantalla.",
    items: ["KPIs gerenciales en tiempo real", "Reportes filtrables por fecha, sede o vendedor", "Alertas de inventario, pagos y resultados"],
    copy: "Para gerentes y propietarios que necesitan ver que esta pasando sin pedir hojas de calculo: metricas claras, filtros rapidos y reportes listos para compartir.",
    linkText: "Cotizar dashboard",
    linkHref: "#quoteForm",
    quoteName: "dashboard",
    estimate: 2100,
    visualHtml: `
      <div class="mini-dashboard">
        <div class="kpi-row"><span><b>$48k</b>Ventas</span><span><b>92%</b>Stock</span></div>
        <div class="chart-bars">
          <i style="--bar: 44%"></i>
          <i style="--bar: 76%"></i>
          <i style="--bar: 58%"></i>
          <i style="--bar: 88%"></i>
        </div>
        <div class="trend-line"><span></span><span></span><span></span></div>
      </div>
    `,
  },
  portal: {
    title: "Portales y apps web",
    label: "Acceso para clientes",
    metric: "1 login",
    detail: "Usuarios, solicitudes, archivos, estados y aprobaciones en una app privada.",
    items: ["Login para clientes, alumnos o proveedores", "Formularios, tickets y aprobaciones", "Panel administrativo y permisos por rol"],
    copy: "Para empresas que quieren dejar de operar por archivos sueltos y mensajes dispersos: un portal centraliza solicitudes, documentos, estados y comunicacion.",
    linkText: "Cotizar portal",
    linkHref: "#quoteForm",
    quoteName: "portal web",
    estimate: 2600,
    visualHtml: `
      <div class="mini-portal">
        <div class="phone-frame">
          <div class="phone-top"></div>
          <div class="phone-card active">Solicitud recibida</div>
          <div class="phone-card">Archivo cargado</div>
          <button type="button">Aprobar</button>
        </div>
      </div>
    `,
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
      visual.innerHTML = demo.visualHtml;
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
    quoteResult.textContent = `${prefix}un proyecto de ${selected.quoteName} puede iniciar cerca de ${estimate}. La cotizacion final depende de usuarios, integraciones, contenido, automatizaciones y tiempos de entrega.`;
  }

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => renderDemo(tab.dataset.demoService));
  });

  quoteService.addEventListener("change", () => renderDemo(quoteService.value));
  quoteTimeline.addEventListener("change", () => updateQuote());
  quoteForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(quoteForm);
    const name = String(formData.get("name") || "").trim();
    updateQuote(name);
    quoteResult.textContent = "Enviando solicitud...";
    fetch("/api/software-leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        phone: String(formData.get("phone") || "").trim(),
        email: String(formData.get("email") || "").trim(),
        service: quoteService.value,
        timeline: quoteTimeline.value,
        notes: String(formData.get("notes") || "").trim(),
        estimate: getQuoteEstimate(),
      }),
    })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || "No se pudo enviar la solicitud.");
        quoteResult.textContent = `Solicitud #${result.leadId} recibida. Te contactaremos por telefono o email para ajustar la cotizacion.`;
        quoteForm.elements.name.value = "";
        quoteForm.elements.phone.value = "";
        quoteForm.elements.email.value = "";
        quoteForm.elements.notes.value = "";
      })
      .catch((error) => {
        quoteResult.textContent = error.message;
      });
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
