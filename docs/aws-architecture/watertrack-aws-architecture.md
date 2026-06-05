# WaterTrack — AWS Production Architecture

**Author:** Aftaza  
**Date:** 2026-06-05  
**Region:** ap-southeast-3 (Jakarta)  
**Stack:** Laravel 12 + React 18 + MySQL

---

## Konteks & Tujuan

WaterTrack adalah sistem manajemen tagihan air (water billing) dengan empat peran: admin, operator, kasir, dan klien. Arsitektur ini dirancang untuk **simulasi real production** di AWS dengan prioritas:

- **Cost-efficient** — bayar apa yang dipakai, bukan kapasitas idle
- **Highly available** — tidak ada single point of failure
- **Scalable** — tahan lonjakan traffic (payday spike)
- **Security-grade** — VPC isolation, WAF, Secrets Manager, TLS end-to-end
- **Multi-region users** — CloudFront CDN untuk latensi rendah di seluruh Indonesia

---

## Keputusan Arsitektur

### Mengapa ECS Fargate, bukan Kubernetes (EKS)?

EKS menambah biaya ~$70/bulan hanya untuk control plane, belum termasuk kompleksitas operasional (Helm, kubectl, node groups). ECS Fargate adalah sweet spot: tulis Dockerfile, AWS yang urus server-nya, auto-scaling built-in di level task, bayar per CPU/RAM aktif.

### Mengapa bukan EC2 langsung?

EC2 lebih murah di biaya tetap tapi membawa overhead: patch OS, tidak ada native auto-scaling, restart manual saat crash. Untuk tim kecil, waktu ops > penghematan biaya.

### Mengapa GitHub Actions, bukan AWS CodePipeline?

GitHub Actions lebih familiar, gratis 2.000 menit/bulan, dan integrasi ke AWS via OIDC tanpa menyimpan AWS keys sebagai secret.

---

## Arsitektur Overview

```
                         CI/CD
  [GitHub] ──→ [GitHub Actions] ──Push image──→ [ECR]
                      │                              │
                      └──Deploy SPA──→ [S3 React]   │ Deploy
                                           │         ↓
[Users] → [Route 53] → [CloudFront] ──→ [ALB] ──→ [ECS Fargate (Laravel)]
                            ↑                           │          │
                         CDN/WAF                  [ElastiCache] [RDS MySQL]
                          /ACM                    Redis cache   Multi-AZ
                                                       │
                                               [Secrets Manager]
                                               [S3 CSV/Uploads]

  Monitoring:
  [CloudWatch Logs+Metrics] ──Alerts──→ [SNS]
  [CloudWatch] ↔ [X-Ray Tracing]
  [CloudTrail Audit Log]
```

---

## Services & Alasan Pemilihan

### Networking & Delivery

| Service | Alasan |
|---|---|
| **Route 53** | DNS dengan health check dan latency-based routing. Fondasi untuk domain custom dan failover. |
| **CloudFront** | CDN global 400+ edge location. User di Bali, Surabaya, atau yang bayar tagihan apartemen dari kota lain tetap dapat latensi rendah untuk static assets (React SPA). |
| **Application Load Balancer** | Distribusi traffic ke multiple ECS tasks. Health check per-task — kalau satu task crash, ALB berhenti kirim traffic ke sana. SSL termination di sini. |

### Security

| Service | Alasan |
|---|---|
| **AWS WAF** | Dipasang di depan CloudFront. Block SQL injection, XSS, rate limiting per IP. Penting karena `/api/login` dan endpoint pembayaran terbuka ke internet. |
| **ACM** | SSL certificate gratis, auto-renew. Dipasang di ALB dan CloudFront untuk HTTPS end-to-end. |
| **VPC + Private Subnet** | RDS dan ECS tasks tidak punya public IP. Tidak bisa diakses langsung dari internet — hanya dari dalam VPC. |
| **Security Groups** | Firewall per-resource: ECS hanya terima traffic dari ALB; RDS hanya dari ECS tasks. Prinsip least-privilege di network layer. |
| **Secrets Manager** | `APP_KEY`, `DB_PASSWORD`, Sanctum config disimpan di sini, bukan di `.env` file. ECS task pull secret saat startup via IAM role. Zero hardcoded credentials. |
| **NAT Gateway** | ECS di private subnet butuh akses internet untuk pull ECR images. NAT Gateway adalah satu-satunya jalan keluar tanpa expose ECS ke internet. |

### Compute

| Service | Alasan |
|---|---|
| **ECS Fargate** | Container PHP (nginx + php-fpm) di-manage AWS. Scale out otomatis saat payday spike — tambah tasks dalam hitungan detik berdasarkan request count atau CPU. |
| **ECR** | Docker image registry terintegrasi dengan ECS. Image disimpan per commit SHA untuk rollback mudah. |
| **ECS Auto Scaling** | Policy: jika `ALBRequestCountPerTarget > 1000 req/menit`, tambah 1 task. Minimum 2 tasks untuk High Availability. Scale in otomatis saat traffic turun. |

### Database

| Service | Alasan |
|---|---|
| **RDS MySQL Multi-AZ** | Primary di AZ-1, standby di AZ-2. Jika AZ-1 down, failover otomatis dalam 60–120 detik tanpa intervensi manual. Data billing tidak boleh hilang. |
| **ElastiCache Redis** | Cache hasil query tagihan yang sering dibaca (read-heavy saat payday), session storage Sanctum, dan rate limiting. Mengurangi beban RDS 60–80% di peak. |

### Storage

| Service | Alasan |
|---|---|
| **S3 (React SPA)** | Hosting static files hasil `npm run build`. Tidak butuh server. Di-update GitHub Actions setiap deploy, CloudFront cache di edge. |
| **S3 (CSV/Uploads)** | Import data pelanggan via CSV dan file upload operator. Diakses ECS via IAM role tanpa credential hardcode. |

---

## CI/CD Pipeline

| Step | Tool | Aksi |
|---|---|---|
| 1 | GitHub | Push ke branch `main` |
| 2 | GitHub Actions | Run tests → build Docker image |
| 3 | GitHub Actions | Push image ke ECR (tag: commit SHA) |
| 4 | GitHub Actions | Update ECS task definition → rolling deploy |
| 5 | GitHub Actions | `npm run build` → sync ke S3 → invalidate CloudFront cache |

**Auth ke AWS:** GitHub Actions menggunakan OIDC — tidak ada AWS Access Key/Secret Key yang disimpan sebagai GitHub secret.

---

## Handling Payday Spike

Skenario: tanggal 25, ratusan pelanggan akses sekaligus untuk cek tagihan dan bayar.

1. **CloudFront** cache response API read-only (cek tagihan), mengurangi beban ke backend
2. **ElastiCache** cache query tagihan per `customer_id` — RDS tidak di-hit setiap request
3. **ECS Auto Scaling** deteksi kenaikan `RequestCountPerTarget` di ALB, scale out 2 → N tasks otomatis
4. **RDS Multi-AZ** tetap tersedia bahkan saat satu AZ down
5. Setelah peak selesai, Auto Scaling scale in — biaya turun otomatis

---

## Monitoring & Logging

### Log Groups (CloudWatch Logs)

```
/ecs/watertrack-api/   ← Laravel stderr logs (JSON structured)
/aws/rds/watertrack/   ← MySQL slow query + error log
/aws/alb/watertrack/   ← ALB access log (→ S3)
/aws/cloudfront/       ← CloudFront access log (→ S3)
```

**Catatan implementasi:** Konfigurasi Laravel untuk output log ke `stderr` (bukan file), agar ECS otomatis forward ke CloudWatch. Format JSON agar bisa di-query di CloudWatch Logs Insights.

### Metric Alarms (CloudWatch → SNS → Email/Slack)

| Alarm | Threshold | Tindakan |
|---|---|---|
| ECS CPU | > 80% | Notif + trigger Auto Scaling |
| ALB 5xx errors | > 10/menit | Notif segera |
| ALB response time | > 2 detik | Investigasi |
| RDS connections | > 80% max | Notif |
| RDS free storage | < 20% | Tambah storage |
| ElastiCache hit rate | < 60% | Review cache config |

### Tracing & Audit

- **X-Ray**: Distributed tracing per request ALB → ECS → RDS. Berguna untuk debug kenapa request lambat di peak hour — apakah query N+1, Redis miss, atau external call.
- **CloudTrail**: Rekam semua AWS API call (siapa ubah security group? kapan RDS di-restart?). Penting untuk forensik security incident dan compliance.

---

## Estimasi Biaya

| Service | Spesifikasi | Estimasi/Bulan |
|---|---|---|
| ECS Fargate | 2 tasks × 0.5 vCPU / 1 GB RAM | ~$30 |
| RDS MySQL Multi-AZ | t3.small | ~$50 |
| ElastiCache Redis | t3.micro | ~$15 |
| ALB | ~1M request/bulan | ~$18 |
| NAT Gateway | ~10 GB data | ~$10 |
| CloudFront + S3 | ~50 GB transfer | ~$5 |
| CloudWatch + X-Ray | Logs + metrics | ~$10 |
| **Total** | | **~$138/bulan** |

> Untuk staging: matikan Multi-AZ, scale ke 1 task → ~$70/bulan.

---

## Security Checklist Sebelum Go-Live

- [ ] **Fix `AuthController::login`** — saat ini tidak verifikasi password (dev shortcut, HARUS difix sebelum production)
- [ ] Aktifkan WAF Managed Rule Groups (AWS Core Rule Set + SQLi + XSS rules)
- [ ] Enable RDS encryption at rest (KMS)
- [ ] Enable VPC Flow Logs untuk audit network traffic
- [ ] Setup CloudTrail dengan S3 bucket object lock
- [ ] Review Security Group rules (tighten inbound)
- [ ] Setup AWS Budgets alert untuk anomali biaya
- [ ] Rotasi Secrets Manager secara periodik

---

## File Terkait

- `docs/aws-architecture/watertrack-aws-architecture.drawio` — diagram arsitektur (buka dengan draw.io desktop)
- `docs/superpowers/specs/2026-06-04-watertrack-redesign-design.md` — desain frontend/backend sebelumnya
