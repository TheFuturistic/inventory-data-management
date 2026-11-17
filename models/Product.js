const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Product name is required"],
      trim: true,
      minlength: [2, "Product name must contain at least 2 characters"],
      maxlength: [100, "Product name cannot exceed 100 characters"]
    },
    sku: {
      type: String,
      required: [true, "SKU is required"],
      unique: true,
      uppercase: true,
      trim: true,
      match: [/^[A-Z0-9-]{3,30}$/, "SKU must be 3-30 characters using letters, numbers or hyphens"]
    },
    category: {
      type: String,
      required: [true, "Category is required"],
      trim: true,
      maxlength: 60
    },
    price: {
      type: Number,
      required: [true, "Price is required"],
      min: [0, "Price cannot be negative"]
    },
    quantity: {
      type: Number,
      required: [true, "Quantity is required"],
      min: [0, "Quantity cannot be negative"],
      validate: {
        validator: Number.isInteger,
        message: "Quantity must be a whole number"
      },
      default: 0
    },
    reorderLevel: {
      type: Number,
      required: [true, "Reorder level is required"],
      min: [0, "Reorder level cannot be negative"],
      validate: {
        validator: Number.isInteger,
        message: "Reorder level must be a whole number"
      },
      default: 10
    },
    supplier: {
      type: String,
      trim: true,
      maxlength: 100,
      default: "Not specified"
    }
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

productSchema.virtual("stockValue").get(function () {
  return this.price * this.quantity;
});

module.exports = mongoose.model("Product", productSchema);