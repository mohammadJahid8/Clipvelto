import { RedisMemoryServer } from "redis-memory-server";
import S3rver from "s3rver";
import { createServer } from "node:http";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { timingSafeEqual } from "node:crypto";
import { SignatureV4 } from "@smithy/signature-v4";
import { HttpRequest } from "@smithy/protocol-http";
import { Sha256 } from "@aws-crypto/sha256-js";

// Development-only S3 emulator. Check signatures with the AWS SDK's signer;
// the emulator itself does not fully verify V4 signatures or deny unsigned access.
async function validSignature(
  req: import("node:http").IncomingMessage,
  endpoint: string,
) {
  const url = new URL(req.url!, endpoint);
  const presigned = url.searchParams.has("X-Amz-Signature");
  const authorization = req.headers.authorization;
  const headerMatch = authorization?.match(
    /^AWS4-HMAC-SHA256 Credential=([^,]+), SignedHeaders=([^,]+), Signature=([a-f0-9]+)$/i,
  );
  const credential = presigned
    ? url.searchParams.get("X-Amz-Credential")
    : headerMatch?.[1];
  const signed = presigned
    ? url.searchParams.get("X-Amz-SignedHeaders")
    : headerMatch?.[2];
  const signature = presigned
    ? url.searchParams.get("X-Amz-Signature")
    : headerMatch?.[3];
  const timestamp = presigned
    ? url.searchParams.get("X-Amz-Date")
    : req.headers["x-amz-date"];
  if (
    !credential ||
    !signed ||
    !signature ||
    typeof timestamp !== "string" ||
    !/^[a-f0-9]{64}$/i.test(signature)
  )
    return false;
  const [key, , region, service] = credential.split("/");
  if (key !== "S3RVER" || service !== "s3") return false;
  const date = new Date(
    timestamp.replace(
      /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/,
      "$1-$2-$3T$4:$5:$6Z",
    ),
  );
  const expires = presigned
    ? Number(url.searchParams.get("X-Amz-Expires"))
    : 900;
  if (
    !Number.isFinite(date.getTime()) ||
    !Number.isFinite(expires) ||
    expires < 0 ||
    expires > 3600 ||
    Date.now() > date.getTime() + expires * 1000 ||
    date.getTime() > Date.now() + 300000
  )
    return false;
  const headers = Object.fromEntries(
    signed.split(";").map((name) => [name, String(req.headers[name] ?? "")]),
  );
  if (presigned) headers["X-Amz-Content-Sha256"] = "UNSIGNED-PAYLOAD";
  const query = Object.fromEntries(
    [...url.searchParams.entries()].filter(
      ([name]) => name !== "X-Amz-Signature",
    ),
  );
  const request = new HttpRequest({
    protocol: "http:",
    hostname: url.hostname,
    port: Number(url.port),
    method: req.method,
    path: url.pathname,
    headers,
    query,
  });
  const signer = new SignatureV4({
    credentials: { accessKeyId: "S3RVER", secretAccessKey: "S3RVER" },
    region,
    service: "s3",
    sha256: Sha256,
    uriEscapePath: false,
  });
  const expected = presigned
    ? (
        await signer.presign(request, {
          signingDate: date,
          expiresIn: expires,
          signableHeaders: new Set(signed.split(";")),
        })
      ).query?.["X-Amz-Signature"]
    : (
        await signer.sign(request, { signingDate: date })
      ).headers.authorization?.split("Signature=")[1];
  return (
    typeof expected === "string" &&
    /^[a-f0-9]{64}$/i.test(expected) &&
    timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(expected, "hex"))
  );
}

export async function startLocalUploadServices(
  directory: string,
  { redisPort = 0, storagePort = 0, origin = "http://localhost:3000" } = {},
) {
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const redisDirectory = join(directory, "redis");
  await mkdir(redisDirectory, { recursive: true });
  const redis = await RedisMemoryServer.create({
    binary: { version: "8.2.3" },
    instance: {
      port: redisPort || undefined,
      ip: "127.0.0.1",
      args: [
        "--bind",
        "127.0.0.1",
        "--protected-mode",
        "yes",
        "--maxmemory-policy",
        "noeviction",
        "--appendonly",
        "yes",
        "--dir",
        redisDirectory,
      ],
    },
  });
  const s3Directory = join(directory, "objects");
  await mkdir(s3Directory, { recursive: true });
  const emulator = new S3rver({
    address: "127.0.0.1",
    directory: s3Directory,
    silent: true,
    resetOnClose: false,
    vhostBuckets: false,
    configureBuckets: [{ name: "clipvelto-local", configs: [] }],
  });
  await emulator.configureBuckets();
  const handler = emulator.callback();
  let endpoint = "";
  const server = createServer((req, res) => {
    if (
      !["PUT", "GET", "HEAD", "DELETE", "OPTIONS"].includes(req.method ?? "") ||
      (req.headers.origin && req.headers.origin !== origin)
    ) {
      res.writeHead(403);
      res.end("Access denied");
      return;
    }
    if (req.headers.origin === origin) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
      res.setHeader(
        "Access-Control-Allow-Methods",
        "PUT,GET,HEAD,DELETE,OPTIONS",
      );
      res.setHeader(
        "Access-Control-Allow-Headers",
        "content-type,content-length,x-amz-content-sha256,x-amz-checksum-crc32,x-amz-sdk-checksum-algorithm",
      );
      res.setHeader("Access-Control-Expose-Headers", "ETag");
    }
    if (req.method === "OPTIONS") {
      res.writeHead(req.headers.origin === origin ? 204 : 403);
      res.end();
      return;
    }
    void validSignature(req, endpoint)
      .then((valid) => {
        if (!valid) {
          res.writeHead(403);
          res.end("Access denied");
          return;
        }
        handler(req, res);
      })
      .catch(() => {
        res.writeHead(403);
        res.end("Access denied");
      });
  });
  await new Promise<void>((resolve) =>
    server.listen(storagePort, "127.0.0.1", resolve),
  );
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Local object storage could not start");
  endpoint = `http://127.0.0.1:${address.port}`;
  return {
    endpoint,
    redisUrl: `redis://127.0.0.1:${await redis.getPort()}`,
    bucket: "clipvelto-local",
    close: async () => {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await redis.stop();
    },
  };
}
