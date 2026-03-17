import { S3Client } from "@aws-sdk/client-s3";

const region = process.env.S3_REGION;
if (!region) {
  throw new Error("S3_REGION missing");
}

const bucket = process.env.S3_BUCKET;
if (!bucket) {
  throw new Error("S3_BUCKET missing");
}
export const s3Bucket: string = bucket;

export const s3Client = new S3Client({ region });
