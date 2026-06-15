import { S3Client, PutObjectCommand, GetObjectCommand, NoSuchKey } from "@aws-sdk/client-s3";
import type { ArtifactStore } from "./artifact-store";

export type OssConfig = {
  endpoint: string;     // e.g. https://oss-ap-southeast-1.aliyuncs.com
  region: string;       // e.g. oss-ap-southeast-1
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
};

/** Works against Alibaba OSS and Cloudflare R2 — both speak the S3 API. */
export class OssArtifactStore implements ArtifactStore {
  private readonly client: S3Client;
  constructor(private readonly cfg: OssConfig) {
    this.client = new S3Client({
      endpoint: cfg.endpoint,
      region: cfg.region,
      forcePathStyle: true,
      credentials: { accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey },
    });
  }
  async put(key: string, body: string): Promise<void> {
    await this.client.send(new PutObjectCommand({ Bucket: this.cfg.bucket, Key: key, Body: body }));
  }
  async get(key: string): Promise<string | null> {
    try {
      const res = await this.client.send(new GetObjectCommand({ Bucket: this.cfg.bucket, Key: key }));
      return (await res.Body?.transformToString()) ?? null;
    } catch (e) {
      if (e instanceof NoSuchKey) return null;
      throw e;
    }
  }
}
