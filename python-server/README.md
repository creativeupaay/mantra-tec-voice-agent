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

```python
# In bot.py or webhook handler:
from pipeline.post_call import run_post_call_pipeline

# After call completion:
recording_bytes = get_recording_from_plivo(call_id)
await run_post_call_pipeline(
    state=call_state,
    duration_seconds=call_duration,
    recording_content=recording_bytes  # Optional - will be uploaded to configured storage
)
```

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
