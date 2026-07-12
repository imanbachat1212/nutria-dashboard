import mongoose from "mongoose";

const invoiceSchema = new mongoose.Schema(
  {
    client: { type: mongoose.Schema.Types.ObjectId, ref: "Client", required: true },
    items: [
      {
        description: { type: String },
        amount: { type: Number },
        quantity: { type: Number, default: 1 },
      },
    ],
    total: { type: Number, required: true },
    status: { type: String, enum: ["draft", "sent", "paid", "overdue", "cancelled"], default: "draft" },
    dueDate: { type: Date },
    issuedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

export default mongoose.model("Invoice", invoiceSchema);
