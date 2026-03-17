## Storage services overview

This folder contains the core service functions for object storage (S3) integration. Each service is designed to be called from tRPC procedures and is responsible for a single, well-defined step in the upload / download lifecycle.

### `getUploadUrl`

- **Purpose**: Generate a pre-signed S3 URL that a client can use to upload a new file associated with a specific snapshot.
- **DB usage**: **None**. This function only computes an object key and signs an S3 `PutObject` request; the file record is created later by `completeUpload`.
- **Inputs (`GetUploadUrlInput`)**:
  - `orgId`: ID of the organization that owns the upload.
  - `snapshotId`: Snapshot the uploaded file will be attached to.
  - `fileName`: Original filename from the client (used to build the key).
  - `contentType`: MIME type the client will upload with.
  - `sizeBytes`: Expected size of the uploaded file in bytes.
- **Outputs (`GetUploadUrlResult`)**:
  - `bucket`: S3 bucket name the client should upload into.
  - `objectKey`: Fully qualified S3 object key for this upload.
  - `uploadUrl`: Pre-signed URL for `PUT` to S3.
  - `expiresAt`: JS `Date` when the pre-signed URL expires.
- **Behavior**:
  - Builds a unique and sanitized object key under `orgs/{orgId}/snapshots/{snapshotId}/raw/...`.
  - Uses `PutObjectCommand` and `getSignedUrl` to generate a short-lived upload URL (currently 15 minutes).

### `completeUpload`

- **Purpose**: Validate a completed S3 upload and create or update the corresponding `fileObjects` row in the database.
- **DB usage**:
  - Inserts into `fileObjects` with metadata about the uploaded object.
  - Uses `ON CONFLICT` on `(bucket, objectKey)` to update an existing record if the object already exists.
- **Inputs (`CompleteUploadInput`)**:
  - `orgId`: Organization that owns the snapshot and file.
  - `userId`: ID of the user who initiated / completed the upload.
  - `snapshotId`: Snapshot to attach the file to.
  - `bucket`: S3 bucket where the client uploaded the file (must match configured `s3Bucket`).
  - `objectKey`: Key of the uploaded object in S3.
  - `fileName`: Display filename to store in the DB.
  - `contentType`: MIME type of the stored object.
  - `sizeBytes`: Expected size in bytes.
  - `sha256` (optional): Optional checksum to persist.
- **Outputs (`CompleteUploadResult`)**:
  - `fileObjectId`: ID of the `fileObjects` row representing this object.
  - `status`: Status of the file object (currently `"ready"` in the happy path, but typed to allow `"pending" | "ready" | "failed" | "deleted"`).
- **Behavior**:
  - Uses `assertSnapshotAccess` to verify that the caller has access to the given snapshot.
  - Ensures the provided `bucket` matches the configured `S3_BUCKET`; otherwise throws `TRPCError("BAD_REQUEST")`.
  - Issues an S3 `HeadObject` to verify the object exists and that its `ContentLength` matches `sizeBytes`; mismatches result in `TRPCError("BAD_REQUEST")`.
  - Inserts or updates a `fileObjects` row with metadata (including `clientId` from the snapshot, filename, type, size, checksum, and uploader).
  - Always returns the up-to-date `id` and `status` from the DB.

### `getDownloadUrl`

- **Purpose**: Generate a pre-signed S3 URL for downloading an existing file object.
- **DB usage**:
  - Reads a single row from `fileObjects` by `id` and `orgId`.
- **Inputs (`GetDownloadUrlInput`)**:
  - `orgId`: Organization that owns the file.
  - `fileObjectId`: ID of the file object to download.
- **Outputs (`GetDownloadUrlResult`)**:
  - `downloadUrl`: Pre-signed URL for `GET` from S3.
  - `expiresAt`: JS `Date` when the URL expires.
- **Behavior**:
  - Fetches the `fileObjects` row for the given `fileObjectId` and `orgId`.
  - Ensures the file exists and has `status === "ready"`; otherwise throws `TRPCError("NOT_FOUND")`.
  - Uses `GetObjectCommand` and `getSignedUrl` to generate a short-lived download URL (currently 10 minutes).

### `listBySnapshot`

- **Purpose**: List all ready file objects for a given snapshot within an organization.
- **DB usage**:
  - Selects from `fileObjects` filtered by `orgId`, `snapshotId`, and `status = "ready"`, ordered by `createdAt` ascending.
- **Inputs (`ListBySnapshotInput`)**:
  - `orgId`: Organization that owns the snapshot.
  - `snapshotId`: Snapshot ID whose files should be listed.
- **Outputs (`ListBySnapshotResult`)**:
  - Array of items with:
    - `id`: File object ID.
    - `fileName`: Stored filename.
    - `contentType`: MIME type.
    - `sizeBytes`: Size in bytes (as a number).
    - `createdAt`: Creation timestamp.
- **Behavior**:
  - Returns only `"ready"` file objects so callers don't need to filter out pending or failed uploads.

### `s3Client`

- **Purpose**: Centralize configuration of the AWS S3 client and bucket for storage services.
- **DB usage**: **None**.
- **Exports**:
  - `s3Bucket`: Bucket name read from `process.env.S3_BUCKET` (throws on missing env).
  - `s3Client`: Shared `S3Client` instance configured with `process.env.S3_REGION` (throws on missing env).
- **Behavior**:
  - Validates that required S3 environment variables are present at module load time.
  - Provides a single S3 client and bucket constant for all storage services to use.

