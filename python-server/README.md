# Mantra Tech Voice Agent - Python Server

Voice agent backend with call recording storage and analytics.

## Storage Providers

Supports multiple storage backends for call recordings:

| Provider             | Environment Variable     | Description           |
| -------------------- | ------------------------ | --------------------- |
| AWS S3               | `STORAGE_PROVIDER=s3`    | Production S3 storage |
| Google Cloud Storage | `STORAGE_PROVIDER=gcs`   | GCS buckets           |
| Local Filesystem     | `STORAGE_PROVIDER=local` | Development/testing   |

## Call Recording Flow

Recording is captured **in-process** via Pipecat's ``AudioBufferProcessor``
(not Plivo cloud recording). On disconnect, PCM is wrapped as WAV and uploaded
to the configured storage provider as ``recordings/{plivo_call_id}.wav``.

```python
# Handled automatically in pipeline/bot.py on_client_disconnected:
await run_post_call_pipeline(
    state=call_state,
    duration_seconds=call_duration,
    recording_content=recording_bytes,  # WAV bytes from AudioBuffer
    recording_content_type="audio/wav",
)
```

## Plivo endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET/POST | `/plivo/answer` | Answer URL — returns bidirectional Stream XML |
| POST | `/plivo/call` | Initiate outbound agent call |
| GET/POST | `/plivo/hangup` | Optional hangup callback (logging) |
| WS | `/ws/plivo` | Bidirectional media stream |

Set Plivo Application Answer URL to ``https://<host>/plivo/answer`` and
``PUBLIC_BASE_URL`` to the same public host.

## Models

- **Call** - Call records with recordings, transcripts, summaries
- **CallRecording** - Recording data model for upload
- **CallCreate/CallUpdate** - Pydantic models for CRUD operations

## Project Structure

```
modules/calls/
├── model.py       # Call, CallCreate, CallUpdate, CallRecording models
├── repository.py  # Database operations with storage integration
└── service.py     # Business logic for call lifecycle

services/storage/
├── base.py        # Abstract StorageProvider and StorageFactory
├── s3.py          # AWS S3 implementation
├── gcs.py         # Google Cloud Storage implementation
└── local.py       # Local filesystem implementation

pipeline/
└── post_call.py   # Post-call analytics and storage pipeline
```
