import {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
  CopyObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  ListPartsCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
  UploadPartCopyCommand,
  ListMultipartUploadsCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { Env } from "../config/env.js";
import { createReadStream } from "node:fs";
import { transferTimeoutMs } from "../modules/uploads/processing-limits.js";

export function createObjectStorage(env: Env) {
  const client = new S3Client({
    endpoint: env.STORAGE_ENDPOINT,
    region: env.STORAGE_REGION,
    forcePathStyle: env.STORAGE_FORCE_PATH_STYLE,
    credentials: {
      accessKeyId: env.STORAGE_ACCESS_KEY_ID!,
      secretAccessKey: env.STORAGE_SECRET_ACCESS_KEY!,
    },
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
    maxAttempts: 2,
  });
  const Bucket = env.STORAGE_BUCKET!;
  return {
    async putFile(
      key: string,
      path: string,
      size: number,
      contentType: string,
    ) {
      if (size <= 256 * 1024 ** 2)
        return client.send(
          new PutObjectCommand({
            Bucket,
            Key: key,
            Body: createReadStream(path),
            ContentLength: size,
            ContentType: contentType,
          }),
          { abortSignal: AbortSignal.timeout(transferTimeoutMs(size)) },
        );
      const upload = await client.send(
        new CreateMultipartUploadCommand({
          Bucket,
          Key: key,
          ContentType: contentType,
        }),
      );
      if (!upload.UploadId) throw new Error("Multipart upload was not created");
      const partSize = Math.max(
        64 * 1024 ** 2,
        Math.ceil(size / 9999 / 1024 ** 2) * 1024 ** 2,
      );
      const parts: { PartNumber: number; ETag: string }[] = [];
      try {
        for (let start = 0; start < size; start += partSize) {
          const end = Math.min(size, start + partSize) - 1;
          const part = await client.send(
            new UploadPartCommand({
              Bucket,
              Key: key,
              UploadId: upload.UploadId,
              PartNumber: parts.length + 1,
              Body: createReadStream(path, { start, end }),
              ContentLength: end - start + 1,
            }),
            {
              abortSignal: AbortSignal.timeout(
                transferTimeoutMs(end - start + 1),
              ),
            },
          );
          if (!part.ETag) throw new Error("Missing part checksum");
          parts.push({ PartNumber: parts.length + 1, ETag: part.ETag });
        }
        return await client.send(
          new CompleteMultipartUploadCommand({
            Bucket,
            Key: key,
            UploadId: upload.UploadId,
            MultipartUpload: { Parts: parts },
          }),
        );
      } catch (error) {
        await client
          .send(
            new AbortMultipartUploadCommand({
              Bucket,
              Key: key,
              UploadId: upload.UploadId,
            }),
          )
          .catch(() => undefined);
        throw error;
      }
    },
    async createMultipart(key: string, contentType: string) {
      const upload = await client.send(
        new CreateMultipartUploadCommand({
          Bucket,
          Key: key,
          ContentType: contentType,
        }),
      );
      if (!upload.UploadId) throw new Error("Missing upload identifier");
      return upload.UploadId;
    },
    signPart: (key: string, uploadId: string, part: number, size: number) =>
      getSignedUrl(
        client,
        new UploadPartCommand({
          Bucket,
          Key: key,
          UploadId: uploadId,
          PartNumber: part,
          ContentLength: size,
        }),
        { expiresIn: 600, signableHeaders: new Set(["content-length"]) },
      ),
    async completeMultipart(
      key: string,
      uploadId: string,
      size: number,
      partSize: number,
    ) {
      const parts: { PartNumber: number; ETag: string }[] = [];
      let marker: string | undefined;
      do {
        const page = await client.send(
          new ListPartsCommand({
            Bucket,
            Key: key,
            UploadId: uploadId,
            PartNumberMarker: marker,
          }),
        );
        for (const part of page.Parts ?? []) {
          const number = parts.length + 1;
          const expected = Math.min(partSize, size - (number - 1) * partSize);
          if (
            part.PartNumber !== number ||
            !part.ETag ||
            expected <= 0 ||
            part.Size !== expected
          )
            throw new Error("Upload parts do not match the selected file");
          parts.push({ PartNumber: number, ETag: part.ETag });
        }
        marker = page.IsTruncated ? page.NextPartNumberMarker : undefined;
      } while (marker);
      if (parts.length !== Math.ceil(size / partSize))
        throw new Error("Some upload parts are missing");
      await client.send(
        new CompleteMultipartUploadCommand({
          Bucket,
          Key: key,
          UploadId: uploadId,
          MultipartUpload: { Parts: parts },
        }),
      );
    },
    abortMultipart: (key: string, uploadId: string) =>
      client.send(
        new AbortMultipartUploadCommand({
          Bucket,
          Key: key,
          UploadId: uploadId,
        }),
      ),
    signDownload: (key: string, inline = false) =>
      getSignedUrl(
        client,
        new GetObjectCommand({
          Bucket,
          Key: key,
          ResponseContentDisposition: inline
            ? "inline"
            : 'attachment; filename="clip.mp4"',
        }),
        { expiresIn: 60 },
      ),
    signPreview: (key: string) =>
      getSignedUrl(
        client,
        new GetObjectCommand({
          Bucket,
          Key: key,
          ResponseContentDisposition: "inline",
        }),
        { expiresIn: 900 },
      ),
    async removePrefix(prefix: string) {
      // Also reclaim abandoned multipart parts, including an init interrupted
      // between storage creation and saving its identifier in MongoDB.
      for (;;) {
        const unfinished = await client
          .send(
            new ListMultipartUploadsCommand({
              Bucket,
              Prefix: prefix,
              MaxUploads: 1000,
            }),
            { abortSignal: AbortSignal.timeout(15000) },
          )
          .catch((error) => {
            const localEmulator =
              env.NODE_ENV !== "production" &&
              ["127.0.0.1", "localhost", "[::1]"].includes(
                new URL(env.STORAGE_ENDPOINT!).hostname,
              );
            if (
              localEmulator &&
              error instanceof Error &&
              error.name === "NotImplemented"
            )
              return { Uploads: [], IsTruncated: false };
            throw error;
          });
        if (!unfinished.Uploads?.length) break;
        for (const item of unfinished.Uploads)
          if (item.Key && item.UploadId)
            await client.send(
              new AbortMultipartUploadCommand({
                Bucket,
                Key: item.Key,
                UploadId: item.UploadId,
              }),
              { abortSignal: AbortSignal.timeout(15000) },
            );
        if (!unfinished.IsTruncated) break;
      }
      let continuation: string | undefined;
      do {
        const page = await client.send(
          new ListObjectsV2Command({
            Bucket,
            Prefix: prefix,
            ContinuationToken: continuation,
            MaxKeys: 1000,
          }),
          { abortSignal: AbortSignal.timeout(15000) },
        );
        for (const item of page.Contents ?? [])
          if (item.Key)
            await client.send(
              new DeleteObjectCommand({ Bucket, Key: item.Key }),
              { abortSignal: AbortSignal.timeout(15000) },
            );
        continuation = page.IsTruncated
          ? page.NextContinuationToken
          : undefined;
      } while (continuation);
    },
    async signUpload(
      key: string,
      size: number,
      contentType: string,
      expiresIn: number,
    ) {
      return getSignedUrl(
        client,
        new PutObjectCommand({
          Bucket,
          Key: key,
          ContentLength: size,
          ContentType: contentType,
        }),
        {
          expiresIn,
          signableHeaders: new Set(["content-type", "content-length"]),
        },
      );
    },
    head: (key: string) =>
      client.send(new HeadObjectCommand({ Bucket, Key: key }), {
        abortSignal: AbortSignal.timeout(15000),
      }),
    async copy(from: string, to: string, etag: string) {
      const original = await client.send(
        new HeadObjectCommand({ Bucket, Key: from, IfMatch: etag }),
      );
      const size = original.ContentLength ?? 0;
      if (size <= 5 * 1024 ** 3)
        return client.send(
          new CopyObjectCommand({
            Bucket,
            Key: to,
            CopySource: `${Bucket}/${from.split("/").map(encodeURIComponent).join("/")}`,
            CopySourceIfMatch: etag,
          }),
          { abortSignal: AbortSignal.timeout(30000) },
        );
      const upload = await client.send(
        new CreateMultipartUploadCommand({
          Bucket,
          Key: to,
          ContentType: original.ContentType,
        }),
      );
      if (!upload.UploadId) throw new Error("Missing copy identifier");
      const parts: { PartNumber: number; ETag: string }[] = [];
      const partSize = Math.max(
        256 * 1024 ** 2,
        Math.ceil(size / 9999 / 1024 ** 2) * 1024 ** 2,
      );
      try {
        for (let start = 0; start < size; start += partSize) {
          const part = await client.send(
            new UploadPartCopyCommand({
              Bucket,
              Key: to,
              UploadId: upload.UploadId,
              PartNumber: parts.length + 1,
              CopySource: `${Bucket}/${from.split("/").map(encodeURIComponent).join("/")}`,
              CopySourceIfMatch: etag,
              CopySourceRange: `bytes=${start}-${Math.min(size, start + partSize) - 1}`,
            }),
            { abortSignal: AbortSignal.timeout(transferTimeoutMs(partSize)) },
          );
          if (!part.CopyPartResult?.ETag)
            throw new Error("Missing copied part checksum");
          parts.push({
            PartNumber: parts.length + 1,
            ETag: part.CopyPartResult.ETag,
          });
        }
        return await client.send(
          new CompleteMultipartUploadCommand({
            Bucket,
            Key: to,
            UploadId: upload.UploadId,
            MultipartUpload: { Parts: parts },
          }),
        );
      } catch (error) {
        await client
          .send(
            new AbortMultipartUploadCommand({
              Bucket,
              Key: to,
              UploadId: upload.UploadId,
            }),
          )
          .catch(() => undefined);
        throw error;
      }
    },
    get: (key: string, etag: string, timeout = 120000) =>
      client.send(new GetObjectCommand({ Bucket, Key: key, IfMatch: etag }), {
        abortSignal: AbortSignal.timeout(timeout),
      }),
    remove: (key: string) =>
      client.send(new DeleteObjectCommand({ Bucket, Key: key }), {
        abortSignal: AbortSignal.timeout(15000),
      }),
    close: () => client.destroy(),
  };
}
export type ObjectStorage = ReturnType<typeof createObjectStorage>;
