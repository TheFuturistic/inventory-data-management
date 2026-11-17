const mongoose = require("mongoose");
const Product = require("../models/Product");
const asyncHandler = require("../utils/asyncHandler");

const allowedFields = ["name", "sku", "category", "price", "quantity", "reorderLevel", "supplier"];

function pickProductFields(body) {
  return Object.fromEntries(
    Object.entries(body).filter(([key]) => allowedFields.includes(key))
  );
}

// POST /api/products - Create a product
const createProduct = asyncHandler(async (req, res) => {
  const product = await Product.create(pickProductFields(req.body));
  res.status(201).json({ success: true, product });
});

// GET /api/products - Filtering, sorting and pagination
const getProducts = asyncHandler(async (req, res) => {
  const {
    category, search, minPrice, maxPrice, minQuantity, maxQuantity,
    sort = "-createdAt", page = 1, limit = 10
  } = req.query;

  const filter = {};
  if (category) filter.category = new RegExp(`^${escapeRegex(category)}$`, "i");
  if (search) {
    const safeSearch = escapeRegex(search);
    filter.$or = [
      { name: new RegExp(safeSearch, "i") },
      { sku: new RegExp(safeSearch, "i") },
      { supplier: new RegExp(safeSearch, "i") }
    ];
  }
  if (minPrice !== undefined || maxPrice !== undefined) {
    filter.price = {};
    if (minPrice !== undefined) filter.price.$gte = Number(minPrice);
    if (maxPrice !== undefined) filter.price.$lte = Number(maxPrice);
  }
  if (minQuantity !== undefined || maxQuantity !== undefined) {
    filter.quantity = {};
    if (minQuantity !== undefined) filter.quantity.$gte = Number(minQuantity);
    if (maxQuantity !== undefined) filter.quantity.$lte = Number(maxQuantity);
  }

  const pageNumber = Math.max(parseInt(page, 10) || 1, 1);
  const pageSize = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 100);
  const sortFields = {};
  String(sort).split(",").forEach((field) => {
    const key = field.trim();
    if (!/^-?(name|price|quantity|category|createdAt|updatedAt)$/.test(key)) {
      throw Object.assign(new Error(`Unsupported sort field: ${key}`), { statusCode: 400 });
    }
    sortFields[key.replace("-", "")] = key.startsWith("-") ? -1 : 1;
  });

  const [products, total] = await Promise.all([
    Product.find(filter).sort(sortFields).skip((pageNumber - 1) * pageSize).limit(pageSize),
    Product.countDocuments(filter)
  ]);

  res.json({
    success: true,
    total,
    page: pageNumber,
    totalPages: Math.ceil(total / pageSize),
    count: products.length,
    products
  });
});

// GET /api/products/:id - Get one product
const getProductById = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    res.status(400);
    throw new Error("Invalid product ID");
  }
  const product = await Product.findById(req.params.id);
  if (!product) {
    res.status(404);
    throw new Error("Product not found");
  }
  res.json({ success: true, product });
});

// PUT /api/products/:id - Update product details
const updateProduct = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    res.status(400);
    throw new Error("Invalid product ID");
  }
  const updates = pickProductFields(req.body);
  if (!Object.keys(updates).length) {
    res.status(400);
    throw new Error("Provide at least one valid product field to update");
  }
  const product = await Product.findByIdAndUpdate(req.params.id, updates, {
    new: true, runValidators: true
  });
  if (!product) {
    res.status(404);
    throw new Error("Product not found");
  }
  res.json({ success: true, product });
});

// PATCH /api/products/:id/stock - Safe stock increment/decrement
const adjustStock = asyncHandler(async (req, res) => {
  const change = Number(req.body.change);
  if (!Number.isInteger(change) || change === 0) {
    res.status(400);
    throw new Error("change must be a non-zero integer (positive to restock, negative for a sale)");
  }
  const condition = { _id: req.params.id };
  if (change < 0) condition.quantity = { $gte: Math.abs(change) };

  const product = await Product.findOneAndUpdate(
    condition,
    { $inc: { quantity: change } },
    { new: true, runValidators: true }
  );
  if (!product) {
    const exists = await Product.exists({ _id: req.params.id });
    res.status(exists ? 409 : 404);
    throw new Error(exists ? "Insufficient stock for this sale" : "Product not found");
  }
  res.json({ success: true, message: "Stock updated", product });
});

// DELETE /api/products/:id - Delete a product
const deleteProduct = asyncHandler(async (req, res) => {
  const product = await Product.findByIdAndDelete(req.params.id);
  if (!product) {
    res.status(404);
    throw new Error("Product not found");
  }
  res.json({ success: true, message: "Product deleted", id: product._id });
});

// GET /api/products/low-stock - Low-stock alert report
const getLowStockProducts = asyncHandler(async (req, res) => {
  const lowStockItems = await Product.find({
    $expr: { $lte: ["$quantity", "$reorderLevel"] }
  }).sort({ quantity: 1 });
  res.json({ success: true, count: lowStockItems.length, lowStockItems });
});

// GET /api/products/summary - Category-wise aggregation
const getCategorySummary = asyncHandler(async (req, res) => {
  const summary = await Product.aggregate([
    {
      $group: {
        _id: "$category",
        totalItems: { $sum: 1 },
        totalQuantity: { $sum: "$quantity" },
        totalStockValue: { $sum: { $multiply: ["$price", "$quantity"] } },
        avgPrice: { $avg: "$price" }
      }
    },
    { $sort: { _id: 1 } },
    {
      $project: {
        _id: 0,
        category: "$_id",
        totalItems: 1,
        totalQuantity: 1,
        totalStockValue: { $round: ["$totalStockValue", 2] },
        avgPrice: { $round: ["$avgPrice", 2] }
      }
    }
  ]);
  res.json({ success: true, categories: summary.length, summary });
});

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

module.exports = {
  createProduct, getProducts, getProductById, updateProduct,
  adjustStock, deleteProduct, getLowStockProducts, getCategorySummary
};