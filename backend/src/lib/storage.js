import { randomUUID } from "crypto";
import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { imageSize } from "image-size";
import { env } from "../config/env.js";
import { ApiError } from "./ApiError.js";

const MIME_OVERRIDES = { jpg: "jpeg" };

function requireR2Config() {
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_PUBLIC_URL } = env;
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET_NAME || !R2_PUBLIC_URL) {
    throw new ApiError(
      503,
      "R2 storage is not configured — set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, and R2_PUBLIC_URL in the backend .env"
    );
  }
  return { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_PUBLIC_URL };
}

function getClient({ R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY }) {
  return new S3Client({
    region: "auto",
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
  });
}

export async function uploadImage(buffer, folder) {
  const config = requireR2Config();

  let width = null;
  let height = null;
  let type;
  try {
    ({ width, height, type } = imageSize(buffer));
  } catch {
    // buffer isn't a recognizable image format — upload anyway, without dimensions
  }

  const key = `${folder}/${randomUUID()}${type ? `.${type}` : ""}`;

  await getClient(config).send(
    new PutObjectCommand({
      Bucket: config.R2_BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: type ? `image/${MIME_OVERRIDES[type] || type}` : undefined,
    })
  );

  return {
    url: `${config.R2_PUBLIC_URL}/${key}`,
    key,
    width,
    height,
  };
}

export async function deleteImage(key) {
  if (!key) return;
  const config = requireR2Config();
  await getClient(config).send(
    new DeleteObjectCommand({ Bucket: config.R2_BUCKET_NAME, Key: key })
  );
}
