import { Schema, type Connection } from "mongoose";

export function createUploadQuotaModel(connection: Connection) {
  return connection.model(
    "UploadQuota",
    new Schema(
      {
        _id: { type: String, required: true },
        bytes: { type: Number, required: true, default: 0, min: 0 },
        videos: { type: Number, required: true, default: 0, min: 0 },
      },
      { versionKey: false, timestamps: true },
    ),
  );
}
