---
url: "https://www.mantratec.com/Careers"
title: "Careers at Mantra Softech | Join Our Biometric Innovation Team"
---

# Careers

## Opportunities

### Open Positions

### AI System Architect

End-to-End & Scalability

6+ YOE

#### Primary Goal

To design a robust, high-availability system that handles 100+ concurrent VLM requests with low latency. This person is the "bridge" between the model and the production environment.

#### Key Responsibilities

- **System Blueprint:** Design the end-to-end architecture, including load balancing, asynchronous task queues (Celery/RabbitMQ), and GPU memory management.
- **Inference Orchestration:** Implement high-throughput serving engines like vLLM, Triton, or TensorRT-LLM to handle parallel request batching.
- **Data Flow & Storage:** Architect the pipeline for multi-modal data (images/videos) ensuring fast retrieval and optimized storage (S3/Vector DBs).
- **Cost & Performance:** Monitor GPU utilization and implement autoscaling to ensure you aren't paying for idle "H100/A100" time.

#### Must-Have Skillset

- **System Design:** Deep knowledge of Microservices, API Gateways, and Caching strategies (Redis).
- **Compute:** Expert in Kubernetes (K8s), Docker, and NVIDIA Container Toolkit.
- **Backend:** Advanced Python/FastAPI or Go for high-concurrency systems.
- **Tools:** Terraform (IaC), Prometheus/Grafana for observability.

### Lead Data Scientist

VLM Research & Fine-tuning

5+ YoE

#### Primary Goal

To improve the "intelligence" and domain-specificity of your model. This person focuses on model weights, the data it consumes, and keeping you ahead of the research curve.

#### Key Responsibilities

- **Model Up-training:** Lead the fine-tuning of open-source VLMs (like Llama-3-Vision, Qwen-VL, or PaliGemma) using PEFT (LoRA/QLoRA) or full-parameter tuning.
- **Architecture Research:** Evaluate new architectures (e.g., Mixture-of-Experts for VLMs) to find the best balance between accuracy and parameter count.
- **Data Engineering:** Curate and clean high-quality multi-modal datasets. Implement synthetic data generation for niche use cases.
- **Evaluation Frameworks:** Build custom "Eval-Harnesses" to test for hallucinations, visual grounding, and OCR accuracy specific to your business.

#### Must-Have Skillset

- **Deep Learning:** Expert in PyTorch, Hugging Face Transformers, and PEFT libraries.
- **VLM Specifics:** Experience with Vision Encoders (CLIP, SigLIP) and bridge layers (Projectors/Cross-Attention).
- **Training Ops:** Experience with distributed training frameworks like DeepSpeed or FSDP.
- **Academic Depth:** Ability to read and implement latest papers from CVPR, NeurIPS, and ICLR.

### Senior Data Scientist

VLM Research & Fine-tuning

3+ YoE

#### Primary Goal

To improve the "intelligence" and domain-specificity of your model. This person focuses on model weights, the data it consumes, and keeping you ahead of the research curve.

#### Key Responsibilities

- **Model Up-training:** Lead the fine-tuning of open-source VLMs (like Llama-3-Vision, Qwen-VL, or PaliGemma) using PEFT (LoRA/QLoRA) or full-parameter tuning.
- **Architecture Research:** Evaluate new architectures (e.g., Mixture-of-Experts for VLMs) to find the best balance between accuracy and parameter count.
- **Data Engineering:** Curate and clean high-quality multi-modal datasets. Implement synthetic data generation for niche use cases.
- **Evaluation Frameworks:** Build custom "Eval-Harnesses" to test for hallucinations, visual grounding, and OCR accuracy specific to your business.

#### Must-Have Skillset

- **Deep Learning:** Expert in PyTorch, Hugging Face Transformers, and PEFT libraries.
- **VLM Specifics:** Experience with Vision Encoders (CLIP, SigLIP) and bridge layers (Projectors/Cross-Attention).
- **Training Ops:** Experience with distributed training frameworks like DeepSpeed or FSDP.
- **Academic Depth:** Ability to read and implement latest papers from CVPR, NeurIPS, and ICLR.

### Senior ML Engineer

Inference Optimization

3+ YoE

#### Primary Goal

Reduce the cost and latency of model outputs. This person ensures the model doesn't just work, but runs fast enough for 100 people to chat simultaneously without lag.

#### Key Responsibilities

- **Inference Acceleration:** Implement and tune high-performance backends like vLLM (PagedAttention) or NVIDIA TensorRT-LLM.
- **Model Optimization:** Apply quantization (AWQ, GPTQ, or FP8) to fit larger VLMs into smaller GPU footprints without significant accuracy loss.
- **VLM Specifcs:** Optimize the "Vision Encoder" (e.g., CLIP or SigLIP) to handle high-resolution images efficiently.
- **Benchmarking:** Build automated pipelines to measure Tokens Per Second (TPS) and Time to First Token (TTFT).

#### Must-Have Skillset

- **Frameworks:** PyTorch, DeepSpeed, vLLM, or Triton Inference Server.
- **Techniques:** Quantization, Speculative Decoding, Continuous Batching.
- **Vision Expertise:** Experience with ViT (Vision Transformers) and multimodal fusion layers.
- **Coding:** Highly proficient in Python and CUDA (C++ is a plus).

### Senior MLOps Engineer

Infrastructure & Scaling

3+ YOE

#### Primary Goal

Manage the "GPU Fleet." This role ensures that the website operations are stable and that the infrastructure scales up when traffic hits and scales down to save money.

#### Key Responsibilities

- **GPU Orchestration:** Manage multi-GPU clusters using Kubernetes (K8s) and KubeRay or NVIDIA's GPU Operator.
- **Autoscaling:** Design custom metrics (e.g., "GPU Queue Depth") to trigger the spinning up of new cloud instances (AWS P4/P5, GCP A3, etc.).
- **Observability:** Set up Prometheus/Grafana dashboards to monitor VRAM usage, power consumption, and hardware health.
- **Model Versioning:** Implement a registry (MLflow or Weights & Biases) to roll back models instantly if a new version fails in production.

#### Must-Have Skillset

- **Infrastructure:** Kubernetes, Terraform (IaC), Docker.
- **Cloud:** AWS (Sagemaker/EKS), GCP (Vertex/GKE), or Azure AI.
- **Monitoring:** Grafana, Prometheus, ELK Stack.
- **Networking:** Knowledge of RDMA/InfiniBand for distributed multi-node inference.

### Senior Frontend Engineer

AI/UX Specialist

3+ YoE

#### Primary Goal

To build a high-performance, responsive interface that masks the latency of VLM inference and provides a seamless "pro-grade" chat experience.

#### Key Responsibilities

- **Real-time Streaming:** Implement robust Server-Sent Events (SSE) or WebSockets to handle "streaming tokens," ensuring the text appears naturally as the model generates it.
- **Optimistic UI & Loading States:** Design sophisticated "Skeleton" loaders and progress indicators for image uploads so the app feels fast even when the GPU is busy.
- **Multi-modal State Management:** Manage complex chat histories that include large images, bounding box overlays (if the VLM does object detection), and markdown-heavy text.
- **Image Processing (Client-side):** Implement client-side image compression and resizing (using Canvas/WebWorkers) to reduce the payload size before it hits your server, saving bandwidth and improving upload speed.
- **Responsive AI Design:** Ensure the "Vision" aspect of the chat works perfectly on mobile—handling camera inputs and touch-based image interactions.

#### Must-Have Skillset

- **Frameworks:** Next.js or React.js (Expert level) with a focus on performance optimization.
- **State Management:** Experience with Zustand, TanStack Query (React Query), or Redux Toolkit for caching and syncing server state.
- **Communication:** Deep understanding of HTTP streaming, Buffer handling, and async patterns.
- **Visuals:** Tailwind CSS for rapid UI development and Framer Motion for smooth, non-distracting animations.
- **Asset Handling:** Experience with cloud storage SDKs (S3/Vercel Blob) for direct-to-cloud image uploads.

### Senior Full-Stack AI Engineer

Real-time UX

3+ YoE

#### Primary Goal

Ensure a "ChatGPT-like" smooth experience. This person bridges the gap between the heavy backend model and the user's browser, handling large image uploads and streaming text.

#### Key Responsibilities

- **Streaming Architecture:** Implement Server-Sent Events (SSE) or WebSockets to handle the asynchronous nature of VLM token generation.
- **Task Queuing:** Build a robust message broker system (Redis/RabbitMQ) to prevent the web server from hanging while the GPU processes a 4K image.
- **Image Pipeline:** Optimize frontend image compression and backend preprocessing (resizing/padding) before the image hits the VLM.
- **State Management:** Manage complex multi-modal chat histories so users can refer back to previous images in a conversation.

#### Must-Have Skillset

- **Frontend:** React.js or Next.js with advanced state management (Zustand/Redux).
- **Backend:** FastAPI or Node.js (specifically for their asynchronous/non-blocking I/O).
- **Real-time:** SSE (Server-Sent Events), WebSockets, and Redis Caching.
- **Database:** PostgreSQL (Vector extension like pgvector) for storing chat history and image embeddings.

Join Our Team

## At Mantra, we understand each employee has a unique role and responsibility. Come explore the new opportunities across different locations.

At Mantra Softech, we work hand in hand towards one goal to Make customers happy with the best service. Our objectives are clear and we give our team the best tools to help them achieve that goal. Whatever role they play, we motivate employees to make a difference for our customers, our team, and ourselves.

### Application Process

1.  **Application Submission**

    Browse our open positions and submit your CV through our online portal. Ensure your profile highlights your technical expertise and passion for innovation.

2.  **Profile Shortlisting**

    Our talent acquisition team carefully reviews every application to match your skills and aspirations with our evolving business needs.

3.  **Technical Evaluation**

    Engage in deep technical discussions with our experts and leaders to showcase your problem-solving abilities and domain knowledge.

4.  **Joining the Tribe**

    Upon successful evaluation, receive an offer and embark on your journey to secure the digital identity of millions together with us.