import { S3Client } from "@aws-sdk/client-s3";

const region = process.env.S3_REGION;
if (!region) {
  throw new Error("S3_REGION missing");
}

export const s3Bucket = process.env.S3_BUCKET;
if (!s3Bucket) {
  throw new Error("S3_BUCKET missing");
}

export const s3Client = new S3Client({ region });
