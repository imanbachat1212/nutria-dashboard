import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema(
  {
    invoice: { type: mongoose.Schema.Types.ObjectId, ref: "Invoice", required: true },
    client: { type: mongoose.Schema.Types.ObjectId, ref: "Client", required: true },
    amount: { type: Number, required: true },
    method: { type: String },
    paidAt: { type: Date, default: Date.now },
    reference: { type: String },
  },
  { timestamps: true }
);

export default mongoose.model("Payment", paymentSchema);
