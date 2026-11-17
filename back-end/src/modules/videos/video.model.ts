import { Schema, type Connection, type InferSchemaType } from "mongoose";

const videoSchema = new Schema(
  {
    userId: { type: String, required: true, immutable: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    originalFilename: { type: String, required: true, maxlength: 255 },
    sourceProvider: {
      type: String,
      enum: ["device", "youtube"],
      default: "device",
    },
    youtubeId: String,
    captureSeconds: Number,
    processingStartedAt: Date,
    processingMaxSeconds: Number,
    creditMode: { type: String, enum: ["live", "test"], default: "live" },
    quotedCreditSeconds: Number,
    processedCreditSeconds: { type: Number, default: 0 },
    cancellationChargeSeconds: Number,
    deletionRequestedAt: Date,
    mediaExpiresAt: Date,
    renderOptions: {
      type: new Schema(
        {
          aspectRatio: {
            type: String,
            enum: ["9:16", "16:9", "1:1"],
            default: "9:16",
          },
          captions: { type: Boolean, default: true },
        },
        { _id: false },
      ),
    },
    trialId: String,
    trialExpiresAt: Date,
    trialPreviewKey: { type: String, select: false },
    trialPosterKeys: { type: [String], default: [], select: false },
    clipStage: {
      type: String,
      enum: ["source", "transcription", "selection", "rendering", "storage"],
    },
    artifactKeys: { type: [String], default: [] },
    clipStatus: {
      type: String,
      enum: ["queued", "processing", "completed", "failed"],
    },
    clipGeneration: { type: Number, default: 0 },
    clipFormatVersion: Number,
    clipRenderRevision: Number,
    clipRunId: String,
    clipHeartbeatAt: Date,
    clipMessage: String,
    clipTimingsMs: {
      type: new Schema(
        {
          source: Number,
          transcription: Number,
          selection: Number,
          rendering: Number,
          storage: Number,
          total: Number,
        },
        { _id: false },
      ),
    },
    clipFailureStage: {
      type: String,
      enum: ["source", "transcription", "selection", "rendering", "storage"],
    },
    clipPlan: {
      type: [
        new Schema(
          { title: String, start: Number, end: Number },
          { _id: false },
        ),
      ],
      default: [],
    },
    clips: {
      type: [
        new Schema(
          {
            key: String,
            title: String,
            start: Number,
            end: Number,
            sizeBytes: Number,
            width: Number,
            height: Number,
            focusX: Number,
            framingMethod: { type: String, enum: ["face", "center"] },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
    status: {
      type: String,
      enum: [
        "awaiting_upload",
        "uploaded",
        "queued",
        "validating",
        "processing",
        "ready",
        "completed",
        "failed",
        "cancelled",
        "deleting",
        "import_queued",
        "importing",
      ],
      required: true,
    },
    expectedSize: { type: Number, min: 1 },
    contentType: String,
    stagingKey: String,
    multipartUploadId: { type: String, select: false },
    multipartPartSize: Number,
    sourceKey: String,
    stagingEtag: String,
    stagingCleanedAt: Date,
    sourceEtag: String,
    uploadExpiresAt: Date,
    signedUrlExpiresAt: Date,
    durationSeconds: Number,
    width: Number,
    height: Number,
    container: String,
    sha256: String,
    statusMessage: String,
    failureKind: { type: String, enum: ["invalid", "temporary"] },
    validationGeneration: { type: Number, default: 0 },
    validationRunId: String,
    importFailureCode: String,
    importProcessReason: String,
    importExitCode: Number,
    importExitSignal: String,
    quotaReserved: { type: Boolean, default: false },
    transcriptionStatus: {
      type: String,
      enum: ["queued", "processing", "completed", "failed"],
    },
    transcriptionGeneration: { type: Number, default: 0 },
    transcriptionRunId: String,
    transcriptionHeartbeatAt: Date,
    transcriptionMessage: String,
    transcriptionFailureCode: String,
    transcriptionFailureChunk: Number,
    transcriptionCheckpoint: { type: Schema.Types.Mixed, select: false },
    transcriptKey: { type: String, select: false },
    checkpointKey: { type: String, select: false },
    transcript: {
      type: new Schema(
        {
          language: { type: String, required: true },
          model: { type: String, required: true },
          provider: {
            type: String,
            enum: ["local", "groq", "deepinfra", "mixed"],
          },
          emptyReason: { type: String, enum: ["no_audio", "no_speech"] },
          segments: {
            type: [
              new Schema(
                {
                  start: { type: Number, required: true },
                  end: { type: Number, required: true },
                  text: { type: String, required: true },
                  words: {
                    type: [
                      new Schema(
                        { start: Number, end: Number, word: String },
                        { _id: false },
                      ),
                    ],
                    default: [],
                  },
                },
                { _id: false },
              ),
            ],
            default: [],
          },
        },
        { _id: false },
      ),
      select: false,
    },
  },
  { timestamps: true, versionKey: false, strict: "throw" },
);

videoSchema.index({ userId: 1, _id: -1 });
videoSchema.index({ status: 1, uploadExpiresAt: 1 });
videoSchema.index({ transcriptionStatus: 1, transcriptionHeartbeatAt: 1 });
export type Video = InferSchemaType<typeof videoSchema>;
export function createVideoModel(connection: Connection) {
  return connection.model("Video", videoSchema);
}
