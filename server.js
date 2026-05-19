require("dotenv").config();

const path = require("path");
const crypto = require("crypto");
const express = require("express");
const multer = require("multer");
const { Pool } = require("pg");

const app = express();
const PORT = process.env.PORT || 3000;
const DATABASE_URL = process.env.DATABASE_URL || "postgres://postgres:postgres@localhost:5432/eduardo_store";
const ADMIN_USER = process.env.ADMIN_USER || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";
const SESSION_SECRET = process.env.SESSION_SECRET || "dev-session-secret";

const products = [
  {
    id: "professional-kitchen-faucet",
    name: "Professional Kitchen Faucet",
    category: "Pro Collection",
    price: 750,
    badge: "Pro",
    image: "/assets/professional-kitchen-faucet.webp",
    description: "Polished professional faucet for premium kitchen projects.",
    detail:
      "A clean, professional-style kitchen faucet designed for modern countertops, premium sinks and daily use. Its polished finish makes it easy to pair with stainless steel appliances and contemporary kitchen designs.",
    specs: ["Premium polished finish", "Modern kitchen profile", "Pairs well with stainless sinks", "Recommended for residential projects"],
  },
  {
    id: "satin-finish-kitchen-sink",
    name: "Satin Finish Kitchen Sink",
    category: "Pro Collection",
    price: 750,
    badge: "Pro",
    image: "/assets/satin-finish-kitchen-sink.webp",
    description: "Premium satin sink with a durable, refined finish.",
    detail:
      "A refined satin-finish sink built for a modern kitchen installation. The deep metallic look gives the counter a professional finish while keeping the design simple and easy to combine with different faucet styles.",
    specs: ["Satin stainless look", "Clean rectangular design", "Durable work area", "Ideal for premium kitchen remodels"],
  },
  {
    id: "stainless-steel-kitchen-mixer",
    name: "Stainless Steel Kitchen Mixer",
    category: "Kitchen",
    price: 590,
    badge: "Best Seller",
    image: "/assets/stainless-steel-kitchen-mixer.webp",
    description: "High-flow stainless mixer built for daily use.",
    detail:
      "A stainless steel kitchen mixer with a practical silhouette for everyday preparation, washing and cleaning. It is a strong add-on for kitchen sets that need a functional but elevated finish.",
    specs: ["Stainless steel style", "Daily-use kitchen mixer", "High-flow profile", "Easy to combine with chrome accessories"],
  },
  {
    id: "chrome-soap-dispenser",
    name: "Chrome Soap Dispenser",
    category: "Accessories",
    price: 180,
    badge: "Add-on",
    image: "/assets/chrome-soap-dispenser.webp",
    description: "Chrome dispenser to complete a kitchen or bath set.",
    detail:
      "A chrome soap dispenser made to complete a coordinated kitchen or bathroom installation. It keeps the counter cleaner and gives the final project a more integrated look.",
    specs: ["Chrome finish", "Countertop accessory", "Useful for soap or detergent", "Complements faucets and sinks"],
  },
  {
    id: "tramontina-new-dritta-isla-90",
    name: "Tramontina New Dritta Isla 90 Island Hood",
    category: "Tramontina Appliances",
    price: 1290,
    badge: "Tramontina",
    image: "/assets/tramontina-island-hood.webp",
    description: "90 cm stainless steel island range hood for open kitchen layouts.",
    detail:
      "The Tramontina New Dritta Isla 90 is a stainless steel island hood designed for kitchens where the cooktop sits away from the wall. It gives the room a professional focal point while helping extract smoke, steam and cooking odors above the island area.",
    specs: ["90 cm island installation", "Stainless steel finish", "Extractor / purifier function", "Recommended for cooktops up to 90 cm", "LED lighting", "Multiple speed control"],
    sourceUrl: "https://global.tramontina.com/en/p/tramontina-90-cm-stainless-steel-island-range-hood-220-v-95800018",
  },
  {
    id: "tramontina-new-dritta-wall-90",
    name: "Tramontina New Dritta Wall 90 Range Hood",
    category: "Tramontina Appliances",
    price: 950,
    badge: "Tramontina",
    image: "/assets/tramontina-wall-hood.webp",
    description: "90 cm stainless steel wall-mounted hood with a clean modern profile.",
    detail:
      "The Tramontina New Dritta Wall 90 brings a straight stainless steel design for wall-mounted kitchen installations. It is a strong option for remodels that need ventilation, washable filters and a premium visual finish above a stove or cooktop.",
    specs: ["90 cm wall installation", "Stainless steel finish", "Extractor / purifier function", "LED lighting", "Washable metallic filters", "Modern straight-line design"],
    sourceUrl: "https://global.tramontina.com/en/p/tramontina-90-cm-220-v-stainless-steel-wall-mounted-range-hood-95800004",
  },
  {
    id: "tramontina-penta-glass-flat-5gg-90",
    name: "Tramontina Penta Glass Flat 5GG 90 Cooktop",
    category: "Tramontina Appliances",
    price: 680,
    badge: "Tramontina",
    image: "/assets/tramontina-penta-cooktop.webp",
    description: "Black tempered glass gas cooktop with 5 burners and cast iron trivets.",
    detail:
      "The Tramontina Penta Glass Flat 5GG 90 is a 5-burner gas cooktop with black tempered glass and a wide cooking surface. It is designed for premium kitchens that need more burner capacity, a clean visual finish and sturdy support for everyday cookware.",
    specs: ["90 cm gas cooktop", "5 burners", "Black tempered glass", "Cast iron trivets", "Auto spark ignition", "Safestop safety system"],
    sourceUrl:
      "https://global.tramontina.com/en/p/tramontina-design-collection-penta-glass-flat-5gg-90-safestop-black-tempered-glass-gas-cooktop-with-cast-iron-trivets-auto-spark-and-5-burners-94731104",
  },
];

function getSeedPaymentOrder() {
  if (!process.env.SEED_PAYMENT_TRANSACTION_ID) return null;
  return {
    transactionId: process.env.SEED_PAYMENT_TRANSACTION_ID,
    payerName: process.env.SEED_PAYMENT_PAYER_NAME || "Payment customer",
    paymentDate: process.env.SEED_PAYMENT_DATE || new Date().toISOString(),
    total: Number(process.env.SEED_PAYMENT_TOTAL || 0),
    paymentReference: process.env.SEED_PAYMENT_REFERENCE || "Imported payment",
    itemName: process.env.SEED_PAYMENT_ITEM_NAME || "Imported paid order",
  };
}

let pool;
let dbReady = false;
const memory = { customers: [], orders: [], items: [], nextCustomerId: 1, nextOrderId: 1 };
const upload = multer({
  dest: path.join(__dirname, "public", "uploads"),
  limits: { fileSize: 5 * 1024 * 1024 },
});

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, "public")));
app.use("/media", express.static(__dirname));
app.use("/vendor/bootstrap", express.static(path.join(__dirname, "node_modules", "bootstrap", "dist")));
app.use("/vendor/bootstrap-icons", express.static(path.join(__dirname, "node_modules", "bootstrap-icons", "font")));
app.use("/vendor/leaflet", express.static(path.join(__dirname, "node_modules", "leaflet", "dist")));

function getProduct(productId) {
  return products.find((product) => product.id === productId);
}

function normalizeItems(items) {
  if (!Array.isArray(items)) return [];
  return items
    .map((item) => {
      const product = getProduct(item.productId);
      const quantity = Math.max(1, Number.parseInt(item.quantity, 10) || 1);
      return product ? { product, quantity } : null;
    })
    .filter(Boolean);
}

function hashPassword(password) {
  if (!password) return null;
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(password, salt, 120000, 32, "sha256").toString("hex");
  return `pbkdf2_sha256$120000$${salt}$${hash}`;
}

function verifyPassword(password, stored) {
  if (!password || !stored) return false;
  const [method, rounds, salt, originalHash] = String(stored).split("$");
  if (method !== "pbkdf2_sha256" || !rounds || !salt || !originalHash) return false;
  const hash = crypto.pbkdf2Sync(password, salt, Number(rounds), 32, "sha256").toString("hex");
  return originalHash.length === hash.length && crypto.timingSafeEqual(Buffer.from(originalHash), Buffer.from(hash));
}

function createAdminToken() {
  const payload = Buffer.from(JSON.stringify({ user: ADMIN_USER, exp: Date.now() + 1000 * 60 * 60 * 12 })).toString("base64url");
  const signature = crypto.createHmac("sha256", SESSION_SECRET).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

function createCustomerToken(customer) {
  const payload = Buffer.from(JSON.stringify({ id: customer.id, email: customer.email, exp: Date.now() + 1000 * 60 * 60 * 24 * 30 })).toString("base64url");
  const signature = crypto.createHmac("sha256", SESSION_SECRET).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

function parseCookies(req) {
  return String(req.headers.cookie || "")
    .split(";")
    .map((item) => item.trim())
    .filter(Boolean)
    .reduce((cookies, item) => {
      const index = item.indexOf("=");
      if (index > -1) cookies[item.slice(0, index)] = decodeURIComponent(item.slice(index + 1));
      return cookies;
    }, {});
}

function verifyAdminToken(token) {
  try {
    if (!token || !token.includes(".")) return false;
    const [payload, signature] = token.split(".");
    const expected = crypto.createHmac("sha256", SESSION_SECRET).update(payload).digest("base64url");
    if (signature.length !== expected.length) return false;
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return false;
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return data.user === ADMIN_USER && data.exp > Date.now();
  } catch {
    return false;
  }
}

function requireAdmin(req, res, next) {
  const token = parseCookies(req).admin_session;
  if (!verifyAdminToken(token)) {
    return res.status(401).json({ ok: false, message: "Admin login required." });
  }
  next();
}

function verifyCustomerToken(token) {
  try {
    if (!token || !token.includes(".")) return false;
    const [payload, signature] = token.split(".");
    const expected = crypto.createHmac("sha256", SESSION_SECRET).update(payload).digest("base64url");
    if (signature.length !== expected.length) return false;
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return false;
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return data.exp > Date.now() ? data : false;
  } catch {
    return false;
  }
}

function requireCustomer(req, res, next) {
  const session = verifyCustomerToken(parseCookies(req).customer_session);
  if (!session) return res.status(401).json({ ok: false, message: "Customer login required." });
  req.customerSession = session;
  next();
}

async function initDb() {
  pool = new Pool({ connectionString: DATABASE_URL });
  await pool.query(`
    CREATE TABLE IF NOT EXISTS customers (
      id SERIAL PRIMARY KEY,
      full_name TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS orders (
      id SERIAL PRIMARY KEY,
      customer_id INTEGER REFERENCES customers(id),
      status TEXT NOT NULL DEFAULT 'New',
      total NUMERIC(10,2) NOT NULL,
      address TEXT,
      latitude NUMERIC(11,8),
      longitude NUMERIC(11,8),
      notes TEXT,
      payment_status TEXT NOT NULL DEFAULT 'Pending',
      payment_date TIMESTAMPTZ,
      payment_reference TEXT,
      payment_method TEXT,
      receipt_path TEXT,
      payer_name TEXT,
      transaction_id TEXT,
      delivered_at TIMESTAMPTZ,
      delivered_by TEXT,
      delivery_location TEXT,
      delivery_notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id SERIAL PRIMARY KEY,
      order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      product_id TEXT NOT NULL,
      product_name TEXT NOT NULL,
      unit_price NUMERIC(10,2) NOT NULL,
      quantity INTEGER NOT NULL,
      line_total NUMERIC(10,2) NOT NULL
    );
  `);
  await pool.query(`
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'Pending';
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_date TIMESTAMPTZ;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_reference TEXT;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method TEXT;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS receipt_path TEXT;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS payer_name TEXT;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS transaction_id TEXT;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivered_by TEXT;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_location TEXT;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_notes TEXT;
  `);
  await seedPaymentOrder();
  dbReady = true;
}

async function seedPaymentOrder() {
  const seededPaymentOrder = getSeedPaymentOrder();
  if (!seededPaymentOrder || !seededPaymentOrder.total) return;
  const exists = await pool.query("SELECT id FROM orders WHERE transaction_id = $1 LIMIT 1", [seededPaymentOrder.transactionId]);
  if (exists.rowCount) return;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const customerResult = await client.query(
      `INSERT INTO customers (full_name, phone, email)
       VALUES ($1, $2, $3)
      ON CONFLICT (email) DO UPDATE SET full_name = EXCLUDED.full_name, phone = EXCLUDED.phone
       RETURNING id`,
      [seededPaymentOrder.payerName, "Not provided", `payment-${seededPaymentOrder.transactionId}@importadora.local`]
    );
    const customerId = customerResult.rows[0].id;
    const orderResult = await client.query(
      `INSERT INTO orders (
        customer_id, status, total, address, notes, payment_status, payment_date,
        payment_reference, payment_method, payer_name, transaction_id, delivered_at,
        delivered_by, delivery_location, delivery_notes, created_at
       )
       VALUES ($1, 'Paid', $2, $3, $4, 'Pending', $5, $6, 'Bank transfer', $7, $8, NULL, NULL, NULL, NULL, $5)
       RETURNING id`,
      [
        customerId,
        seededPaymentOrder.total,
        "Bolivia - department not specified",
        "Imported from payment screenshot. Delivery details pending confirmation.",
        seededPaymentOrder.paymentDate,
        seededPaymentOrder.paymentReference,
        seededPaymentOrder.payerName,
        seededPaymentOrder.transactionId,
      ]
    );
    await client.query(
      `INSERT INTO order_items (order_id, product_id, product_name, unit_price, quantity, line_total)
       VALUES ($1, $2, $3, $4, 1, $4)`,
      [orderResult.rows[0].id, "payment-transfer-1500", seededPaymentOrder.itemName, seededPaymentOrder.total]
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function createOrder(payload, receiptFile) {
  const selectedItems = normalizeItems(payload.items);
  if (!selectedItems.length) {
    const error = new Error("Select at least one product.");
    error.status = 400;
    throw error;
  }

  const fullName = String(payload.fullName || "").trim();
  const phone = String(payload.phone || "").trim();
  const email = String(payload.email || "").trim().toLowerCase();
  if (!fullName || !phone || !email) {
    const error = new Error("Name, phone and email are required.");
    error.status = 400;
    throw error;
  }

  const total = selectedItems.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const orderData = {
    fullName,
    phone,
    email,
    password: String(payload.password || "").trim(),
    address: String(payload.address || "").trim(),
    latitude: payload.latitude ? Number(payload.latitude) : null,
    longitude: payload.longitude ? Number(payload.longitude) : null,
    notes: String(payload.notes || "").trim(),
    paymentMethod: String(payload.paymentMethod || "Bank transfer").trim(),
    receiptPath: receiptFile ? `/uploads/${receiptFile.filename}` : null,
    total,
    items: selectedItems,
  };

  if (!dbReady) return createMemoryOrder(orderData);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const customerResult = await client.query(
      `INSERT INTO customers (full_name, phone, email, password_hash)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (email) DO UPDATE SET full_name = EXCLUDED.full_name, phone = EXCLUDED.phone
       RETURNING id, full_name, phone, email, created_at`,
      [orderData.fullName, orderData.phone, orderData.email, hashPassword(orderData.password)]
    );
    const customer = customerResult.rows[0];
    const orderResult = await client.query(
      `INSERT INTO orders (customer_id, total, address, latitude, longitude, notes)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, status, total, address, latitude, longitude, notes, created_at`,
      [customer.id, orderData.total, orderData.address, orderData.latitude, orderData.longitude, orderData.notes]
    );
    const order = orderResult.rows[0];
    await client.query("UPDATE orders SET payment_method = $2, receipt_path = $3 WHERE id = $1", [
      order.id,
      orderData.paymentMethod,
      orderData.receiptPath,
    ]);

    for (const item of orderData.items) {
      await client.query(
        `INSERT INTO order_items (order_id, product_id, product_name, unit_price, quantity, line_total)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          order.id,
          item.product.id,
          item.product.name,
          item.product.price,
          item.quantity,
          item.product.price * item.quantity,
        ]
      );
    }

    await client.query("COMMIT");
    return { ...order, customer, items: orderData.items };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

function createMemoryOrder(orderData) {
  let customer = memory.customers.find((item) => item.email === orderData.email);
  if (!customer) {
    customer = {
      id: memory.nextCustomerId++,
      full_name: orderData.fullName,
      phone: orderData.phone,
      email: orderData.email,
      password_hash: hashPassword(orderData.password),
      created_at: new Date().toISOString(),
    };
    memory.customers.push(customer);
  } else {
    customer.full_name = orderData.fullName;
    customer.phone = orderData.phone;
  }

  const order = {
    id: memory.nextOrderId++,
    customer_id: customer.id,
    status: "New",
    total: orderData.total,
    address: orderData.address,
    latitude: orderData.latitude,
    longitude: orderData.longitude,
    notes: orderData.notes,
    payment_status: "Pending",
    payment_date: null,
    payment_reference: null,
    payment_method: orderData.paymentMethod,
    receipt_path: orderData.receiptPath,
    payer_name: null,
    transaction_id: null,
    delivered_at: null,
    delivered_by: null,
    delivery_location: null,
    delivery_notes: null,
    created_at: new Date().toISOString(),
  };
  memory.orders.push(order);
  orderData.items.forEach((item) => {
    memory.items.push({
      order_id: order.id,
      product_id: item.product.id,
      product_name: item.product.name,
      unit_price: item.product.price,
      quantity: item.quantity,
      line_total: item.product.price * item.quantity,
    });
  });
  return { ...order, customer, items: orderData.items };
}

async function listOrders() {
  if (!dbReady) {
    return memory.orders
      .slice()
      .reverse()
      .map((order) => ({
        ...order,
        customer: memory.customers.find((customer) => customer.id === order.customer_id),
        items: memory.items.filter((item) => item.order_id === order.id),
      }));
  }

  const result = await pool.query(`
    SELECT
      o.*,
      c.full_name,
      c.phone,
      c.email,
      COALESCE(
        json_agg(
          json_build_object(
            'product_id', oi.product_id,
            'product_name', oi.product_name,
            'unit_price', oi.unit_price,
            'quantity', oi.quantity,
            'line_total', oi.line_total
          )
        ) FILTER (WHERE oi.id IS NOT NULL),
        '[]'
      ) AS items
    FROM orders o
    LEFT JOIN customers c ON c.id = o.customer_id
    LEFT JOIN order_items oi ON oi.order_id = o.id
    GROUP BY o.id, c.id
    ORDER BY o.created_at DESC
  `);

  return result.rows.map((row) => ({
    id: row.id,
    status: row.status,
    total: Number(row.total),
    address: row.address,
    latitude: row.latitude,
    longitude: row.longitude,
    notes: row.notes,
    payment_status: row.payment_status,
    payment_date: row.payment_date,
    payment_reference: row.payment_reference,
    payment_method: row.payment_method,
    receipt_path: row.receipt_path,
    payer_name: row.payer_name,
    transaction_id: row.transaction_id,
    delivered_at: row.delivered_at,
    delivered_by: row.delivered_by,
    delivery_location: row.delivery_location,
    delivery_notes: row.delivery_notes,
    created_at: row.created_at,
    customer: {
      full_name: row.full_name,
      phone: row.phone,
      email: row.email,
    },
    items: row.items,
  }));
}

function seedMemoryPaymentOrder() {
  const seededPaymentOrder = getSeedPaymentOrder();
  if (!seededPaymentOrder || !seededPaymentOrder.total) return;
  if (memory.orders.some((order) => order.transaction_id === seededPaymentOrder.transactionId)) return;
  const customer = {
    id: memory.nextCustomerId++,
    full_name: seededPaymentOrder.payerName,
    phone: "Not provided",
    email: `payment-${seededPaymentOrder.transactionId}@importadora.local`,
    created_at: seededPaymentOrder.paymentDate,
  };
  const order = {
    id: memory.nextOrderId++,
    customer_id: customer.id,
    status: "Paid",
    total: seededPaymentOrder.total,
    address: "Bolivia - department not specified",
    latitude: null,
    longitude: null,
    notes: "Imported from payment screenshot. Delivery details pending confirmation.",
    payment_status: "Pending",
    payment_date: seededPaymentOrder.paymentDate,
    payment_reference: seededPaymentOrder.paymentReference,
    payment_method: "Bank transfer",
    receipt_path: null,
    payer_name: seededPaymentOrder.payerName,
    transaction_id: seededPaymentOrder.transactionId,
    delivered_at: null,
    delivered_by: null,
    delivery_location: null,
    delivery_notes: null,
    created_at: seededPaymentOrder.paymentDate,
  };
  memory.customers.push(customer);
  memory.orders.push(order);
  memory.items.push({
    order_id: order.id,
    product_id: "payment-transfer-1500",
    product_name: seededPaymentOrder.itemName,
    unit_price: seededPaymentOrder.total,
    quantity: 1,
    line_total: seededPaymentOrder.total,
  });
}

async function updateDelivery(orderId, delivered, deliveredAt, deliveredBy, deliveryLocation, deliveryNotes) {
  const deliveryDate = delivered ? deliveredAt || new Date().toISOString() : null;
  if (!dbReady) {
    const order = memory.orders.find((item) => item.id === Number(orderId));
    if (!order) return null;
    order.status = delivered ? "Delivered" : "Paid";
    order.delivered_at = deliveryDate;
    order.delivered_by = delivered ? deliveredBy || null : null;
    order.delivery_location = delivered ? deliveryLocation || null : null;
    order.delivery_notes = delivered ? deliveryNotes || null : null;
    return order;
  }

  const result = await pool.query(
    `UPDATE orders
     SET status = $2,
         delivered_at = $3,
         delivered_by = $4,
         delivery_location = $5,
         delivery_notes = $6
     WHERE id = $1
     RETURNING id, status, delivered_at, delivered_by, delivery_location, delivery_notes`,
    [
      orderId,
      delivered ? "Delivered" : "Paid",
      deliveryDate,
      delivered ? deliveredBy || null : null,
      delivered ? deliveryLocation || null : null,
      delivered ? deliveryNotes || null : null,
    ]
  );
  return result.rows[0] || null;
}

app.get("/api/products", (req, res) => {
  res.json(products);
});

app.get("/api/products/:id", (req, res) => {
  const product = getProduct(req.params.id);
  if (!product) return res.status(404).json({ ok: false, message: "Product not found." });
  res.json(product);
});

app.get("/api/health", (req, res) => {
  res.json({ ok: true, database: dbReady ? "postgres" : "memory-demo" });
});

app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin-login.html"));
});

app.get("/checkout", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "checkout.html"));
});

app.get("/account", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "account.html"));
});

app.get("/product/:id", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "product.html"));
});

app.get("/admin/dashboard", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin.html"));
});

app.post("/api/admin/login", (req, res) => {
  const username = String(req.body.username || "");
  const password = String(req.body.password || "");
  if (username !== ADMIN_USER || password !== ADMIN_PASSWORD) {
    return res.status(401).json({ ok: false, message: "Invalid username or password." });
  }
  res.setHeader("Set-Cookie", `admin_session=${encodeURIComponent(createAdminToken())}; HttpOnly; SameSite=Lax; Path=/; Max-Age=43200`);
  res.json({ ok: true });
});

app.post("/api/admin/logout", (req, res) => {
  res.setHeader("Set-Cookie", "admin_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0");
  res.json({ ok: true });
});

app.get("/api/admin/me", requireAdmin, (req, res) => {
  res.json({ ok: true, user: ADMIN_USER });
});

app.post("/api/account/login", async (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");
  const customer = dbReady
    ? (await pool.query("SELECT id, full_name, phone, email, password_hash FROM customers WHERE email = $1", [email])).rows[0]
    : memory.customers.find((item) => item.email === email);
  if (!customer || !verifyPassword(password, customer.password_hash)) {
    return res.status(401).json({ ok: false, message: "Invalid email or password." });
  }
  res.setHeader("Set-Cookie", `customer_session=${encodeURIComponent(createCustomerToken(customer))}; HttpOnly; SameSite=Lax; Path=/; Max-Age=2592000`);
  res.json({ ok: true, customer: { fullName: customer.full_name, email: customer.email } });
});

app.post("/api/account/logout", (req, res) => {
  res.setHeader("Set-Cookie", "customer_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0");
  res.json({ ok: true });
});

app.get("/api/account/orders", requireCustomer, async (req, res) => {
  const orders = await listOrders();
  const userOrders = orders.filter((order) => order.customer?.email === req.customerSession.email);
  res.json({ ok: true, orders: userOrders });
});

app.post("/api/orders", upload.single("receipt"), async (req, res) => {
  try {
    const payload = req.file ? { ...req.body, items: JSON.parse(req.body.items || "[]") } : req.body;
    const order = await createOrder(payload, req.file);
    res.status(201).json({ ok: true, orderId: order.id, total: Number(order.total) });
  } catch (error) {
    res.status(error.status || 500).json({ ok: false, message: error.message || "Order could not be created." });
  }
});

app.get("/api/admin/orders", requireAdmin, async (req, res) => {
  const orders = await listOrders();
  res.json({ ok: true, database: dbReady ? "postgres" : "memory-demo", orders });
});

app.patch("/api/admin/orders/:id/delivery", requireAdmin, async (req, res) => {
  const delivered = Boolean(req.body.delivered);
  const updated = await updateDelivery(
    req.params.id,
    delivered,
    req.body.deliveredAt,
    req.body.deliveredBy,
    req.body.deliveryLocation,
    req.body.deliveryNotes
  );
  if (!updated) return res.status(404).json({ ok: false, message: "Order not found." });
  res.json({ ok: true, order: updated });
});

initDb()
  .catch((error) => {
    console.warn("PostgreSQL is not available. The app will start in memory demo mode.");
    console.warn(error.message);
  })
  .finally(() => {
    if (!dbReady) seedMemoryPaymentOrder();
    app.listen(PORT, () => {
      console.log(`Store ready at http://localhost:${PORT}`);
      console.log(`Admin login at http://localhost:${PORT}/admin`);
      console.log(`Database: ${dbReady ? "PostgreSQL" : "memory demo mode"}`);
    });
  });
