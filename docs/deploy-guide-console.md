# WaterTrack — Panduan Deploy AWS (AWS Console UI)

> **Versi:** Console UI · **Region:** ap-southeast-3 (Jakarta) · **Target:** 5 Developer Paralel
>
> Panduan ini menggunakan AWS Management Console (bukan CLI). Setiap bagian diberi label **siapa yang mengerjakannya** dan **input apa yang dibutuhkan dari developer lain**.

---

## Daftar Isi

1. [Pra-Syarat](#1-pra-syarat)
2. [Lembar Informasi Bersama (Shared Info Sheet)](#2-lembar-informasi-bersama)
3. [Struktur 5 Workstream](#3-struktur-5-workstream)
4. [Gate Sinkronisasi](#4-gate-sinkronisasi)
5. [Dev 1 — IAM + GitHub OIDC](#5-dev-1--iam--github-oidc)
6. [Dev 2 — VPC + Security Groups + ACM](#6-dev-2--vpc--security-groups--acm)
7. [Dev 3 — RDS + ElastiCache + Secrets Manager](#7-dev-3--rds--elasticache--secrets-manager)
8. [Dev 4 — S3 + CloudFront + WAF](#8-dev-4--s3--cloudfront--waf)
9. [Dev 5 — ECR + ECS + ALB + Route 53](#9-dev-5--ecr--ecs--alb--route-53)
10. [GitHub Actions — CI/CD Pipeline ke ECR & ECS](#10-github-actions--cicd-pipeline-ke-ecr--ecs)
11. [Migrasi Database Pertama Kali](#11-migrasi-database-pertama-kali)
12. [CloudWatch Alarms + Budget Alert](#12-cloudwatch-alarms--budget-alert)
13. [Checklist Pasca-Deploy](#13-checklist-pasca-deploy)

---

## 1. Pra-Syarat

Sebelum memulai, pastikan semua developer memiliki:

| Item | Keterangan |
|------|-----------|
| Akun AWS | 1 akun AWS, dikelola oleh **Dev 1 (Koordinator)** |
| Domain | Daftarkan di Route 53 atau transfer ke sana (mis. `watertrack.id`) |
| GitHub Repo | Repository sudah ada di GitHub, branch `main` untuk production |
| Docker local | Untuk build image pertama kali (Dev 5) |
| Browser | Chrome/Firefox — akses AWS Console di `console.aws.amazon.com` |

**Pengaturan awal sebelum developer lain mulai:**
1. Login ke AWS Console dengan akun root.
2. Di kanan atas, ganti region ke **Asia Pacific (Jakarta) ap-southeast-3**.
3. Aktifkan MFA untuk akun root di **IAM → Security credentials → Multi-factor authentication**.
4. Buat IAM user pertama untuk Dev 1 (lihat [Bagian 5](#5-dev-1--iam--github-oidc)).

---

## 2. Lembar Informasi Bersama

> **Wajib diisi** saat setiap resource dibuat. Gunakan Google Sheets, Notion, atau tabel di channel Slack tim.
> Format: salin tabel di bawah ke dokumen bersama.

### Template Shared Info Sheet

```
=== WATERTRACK AWS DEPLOYMENT INFO SHEET ===
Tanggal mulai: _______________
Region: ap-southeast-3

--- [DEV 1] IAM ---
AWS Account ID:              ____________________________
ARN ECS Execution Role:      arn:aws:iam::775755739096:role/watertrack-ecs-execution-role
ARN ECS Task Role:           arn:aws:iam::775755739096:role/watertrack-ecs-task-role
ARN GitHub Actions Role:     arn:aws:iam::775755739096:role/watertrack-github-actions-role
IAM User Dev 2 (temp):       ____________________________
IAM User Dev 3 (temp):       ____________________________
IAM User Dev 4 (temp):       ____________________________
IAM User Dev 5 (temp):       ____________________________

--- [DEV 2] VPC & NETWORK ---
VPC ID:                      vpc-06717718b29f964c3
Public Subnet AZ-a ID:       subnet-0e6e9a0dc3899d07c (10.0.16.0/20)
Public Subnet AZ-b ID:       subnet-0b3fafa6d3535e223 (10.0.2.0/24)
Private Subnet AZ-a ID:      subnet-07ea5795e74af67c8 (10.0.128.0/20)
Private Subnet AZ-b ID:      subnet-004e9a679b0d2deb5 (10.0.144.0/20)
SG ALB ID:                   sg-0717a87255858c55e     (alb-sg)
SG ECS ID:                   sg-0b1fea5f39a256919     (ecs-sg)
SG RDS ID:                   sg-07a0dce9ebea074a0     (rds-sg)
SG Redis ID:                 sg-0df045422dc4ad20d     (redis-sg)
ACM Certificate ARN (ap-southeast-3):  arn:aws:acm:ap-southeast-3:775755739096:certificate/7c115b03-02e3-4388-960a-98baa73c2dc6
ACM Certificate ARN (us-east-1):       arn:aws:acm:us-east-1:775755739096:certificate/f6c80578-ebe8-408e-bd13-b8634f24fda6

--- [DEV 3] DATABASE & SECRETS ---
RDS Endpoint:                watertrack-db-prod.c94gy0yacjro.ap-southeast-3.rds.amazonaws.com
ElastiCache Endpoint:        clustercfg.watertrack-redis-prod.hxtqnn.apse3.cache.amazonaws.com:6379
Secret ARN APP_KEY:          arn:aws:secretsmanager:ap-southeast-3:775755739096:secret:watertrack/app-key-mxSzGu
Secret ARN DB_PASSWORD:      arn:aws:secretsmanager:ap-southeast-3:775755739096:secret:watertrack/db-password-q8hwYQ
Secret ARN DB_HOST:          arn:aws:secretsmanager:ap-southeast-3:775755739096:secret:watertrack/db-host-4Fvid5
Secret ARN REDIS_HOST:       arn:aws:secretsmanager:ap-southeast-3:775755739096:secret:watertrack/redis-host-SGM4I3

--- [DEV 4] FRONTEND & CDN ---
S3 Bucket Frontend:          watertrack-frontend-prod
S3 Bucket Uploads:           watertrack-uploads-prod
CloudFront Distribution ID:  E1CZ9SHMZRJEXV
CloudFront Domain:           d2i4hufhzwjtvn.cloudfront.net
WAF Web ACL ARN:             arn:aws:wafv2:us-east-1:775755739096:global/webacl/watertrack-waf/63bb25a4-36f6-41c5-9a95-9418d9822858

--- [DEV 5] PLATFORM ---
ECR Repository URI:          ACCOUNT.dkr.ecr.ap-southeast-3.amazonaws.com/watertrack-api
ECS Cluster ARN:             arn:aws:ecs:ap-southeast-3:ACCOUNT:cluster/watertrack-cluster
ECS Service ARN:             arn:aws:ecs:ap-southeast-3:ACCOUNT:service/watertrack-cluster/watertrack-api-service
ALB DNS Name:                watertrack-alb-____.ap-southeast-3.elb.amazonaws.com
ALB ARN:                     arn:aws:elasticloadbalancing:ap-southeast-3:ACCOUNT:loadbalancer/app/watertrack-alb/____
Target Group ARN:            arn:aws:elasticloadbalancing:ap-southeast-3:775755739096:targetgroup/watertrack-tg/c8a2989c862f2eae
Route 53 Hosted Zone ID:     Z____________________
```

---

## 3. Struktur 5 Workstream

```
┌─────────────────────────────────────────────────────────────────────┐
│                        FASE 0 — GATE AWAL                           │
│         Dev 1 selesaikan IAM + bagikan credential ke tim            │
└─────────────────────┬───────────────────────────────────────────────┘
                      │
        ┌─────────────┼─────────────┬─────────────┐
        ▼             ▼             ▼              ▼
   [DEV 2]       [DEV 3]       [DEV 4]        [DEV 5]
   VPC/Net    DB/Cache/Sec     S3/CDN/WAF    ECR/Build
        │             │             │              │
        └─────────────┴─────────────┴──────────────┘
                      │
┌─────────────────────┴───────────────────────────────────────────────┐
│                     GATE 1 — SYNC CHECKPOINT                        │
│  Semua resource ID dikumpulkan di Shared Info Sheet sebelum lanjut  │
└─────────────────────┬───────────────────────────────────────────────┘
                      │
              [DEV 5] membuat ECS Task Definition + Service
              menggunakan semua ARN dari tim
                      │
┌─────────────────────┴───────────────────────────────────────────────┐
│                     GATE 2 — DEPLOY PERTAMA                         │
│         First container running, health check /health = OK          │
└─────────────────────┬───────────────────────────────────────────────┘
                      │
        ┌─────────────┼─────────────┐
        ▼             ▼             ▼
  [DEV 3]         [Dev 1]       [DEV 4]
  DB Migration  GitHub Secrets  CF + WAF final
        │             │             │
        └─────────────┴─────────────┘
                      │
┌─────────────────────┴───────────────────────────────────────────────┐
│                     GATE 3 — PRODUCTION LIVE                        │
│    DNS pointing ke CloudFront + ALB, semua smoke test pass          │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 4. Gate Sinkronisasi

### Gate 0 — IAM Selesai
**Kapan:** Sebelum siapapun mengerjakan workstream lainnya.
**Kondisi lulus:** Dev 1 sudah membuat 4 IAM user untuk Dev 2–5 dan membagikan temporary credentials. AWS Account ID sudah tercatat di Shared Info Sheet.

### Gate 1 — Semua Infrastruktur Dasar Selesai
**Kapan:** Dev 2, 3, 4, 5 selesai semua resource awal mereka.
**Kondisi lulus:** Semua baris di Shared Info Sheet sudah terisi (VPC ID, Subnet IDs, SG IDs, RDS Endpoint, Redis Endpoint, Secret ARNs, S3 Bucket, CloudFront ID, ECR URI).

### Gate 2 — Backend Container Berjalan
**Kapan:** Setelah Dev 5 selesai ECS Task Definition + Service.
**Kondisi lulus:** `curl https://api.yourdomain.com/health` mengembalikan `{"status":"ok"}`.

### Gate 3 — Production Live
**Kapan:** Setelah DNS, CloudWatch alarms, dan migrasi database selesai.
**Kondisi lulus:** Frontend dapat diakses via domain HTTPS, login berfungsi, semua role dapat masuk.

---

## 5. Dev 1 — IAM + GitHub OIDC

> **Dikerjakan oleh:** Dev 1 (Koordinator)
> **Input yang dibutuhkan:** AWS Account ID (dari console kanan atas)
> **Output:** IAM users untuk Dev 2–5, 3 IAM roles, GitHub OIDC provider

### 5.1 Buat IAM User untuk Tim

> **Prinsip least privilege:** Setiap user hanya diberi permission yang sesuai dengan workstream-nya (bukan `AdministratorAccess`) — agar blast radius tetap kecil bila kredensial bocor, dan agar setiap developer terbiasa dengan permission yang akan dipakai di production.

1. Buka **AWS Console → IAM → Users → Create user**
2. Buat 4 user dengan nama: `dev2-network`, `dev3-database`, `dev4-frontend`, `dev5-platform`
3. Untuk setiap user, isi bagian dasar yang sama:
   - **User name:** (sesuai di atas)
   - **Provide user access to the AWS Management Console:** centang
   - **Console password:** Auto-generated (catat dan kirim ke developer secara aman)
   - **Users must create a new password at next sign-in:** centang
4. Pada step **Permissions → Attach policies directly**, pilih AWS managed policy sesuai tabel berikut (bukan `AdministratorAccess`):

| User | AWS Managed Policy yang di-attach | Alasan |
|------|-----------------------------------|--------|
| `dev2-network` | `AmazonVPCFullAccess` | Membuat VPC, subnet, route table, security group ([Bagian 6](#6-dev-2--vpc--security-groups--acm)) |
| | `AWSCertificateManagerFullAccess` | Request & kelola sertifikat ACM (ap-southeast-3 dan us-east-1) |
| | `AmazonRoute53FullAccess` | Membuat DNS validation record (CNAME) untuk ACM via tombol "Create records in Route 53" |
| `dev3-database` | `AmazonRDSFullAccess` | Membuat & kelola RDS instance, subnet group ([Bagian 7](#7-dev-3--rds--elasticache--secrets-manager)) |
| | `AmazonElastiCacheFullAccess` | Membuat & kelola ElastiCache Redis cluster + subnet group |
| | `SecretsManagerReadWrite` | Membuat 4 secret (`app-key`, `db-password`, `db-host`, `redis-host`) |
| `dev4-frontend` | `AmazonS3FullAccess` | Membuat & kelola bucket frontend dan uploads ([Bagian 8](#8-dev-4--s3--cloudfront--waf)) |
| | `CloudFrontFullAccess` | Membuat distribution, OAC, custom error pages |
| | `AWSWAFFullAccess` | Membuat Web ACL dan asosiasikan ke CloudFront (region us-east-1) |
| `dev5-platform` | `AmazonEC2ContainerRegistryFullAccess` | Membuat ECR repository ([Bagian 9](#9-dev-5--ecr--ecs--alb--route-53)) |
| | `AmazonECS_FullAccess` | Membuat ECS cluster, task definition, service, auto scaling |
| | `ElasticLoadBalancingFullAccess` | Membuat Target Group, ALB, listener |
| | `AmazonRoute53FullAccess` | Membuat record `api`, root domain, dan `www` |
| | `CloudWatchLogsFullAccess` | Membuat log group `/ecs/watertrack-api` dan melihat log task |
| | `AmazonVPCReadOnlyAccess` | Memilih VPC/Subnet/Security Group yang sudah dibuat Dev 2 saat membuat ALB & ECS Service |
| | `AWSCertificateManagerReadOnly` | Memilih sertifikat ACM (dibuat Dev 2) saat membuat HTTPS listener di ALB ([Bagian 9.6](#96-buat-application-load-balancer-alb)) — tanpa ini, dropdown sertifikat di console gagal load dengan `AccessDeniedException: acm:ListCertificates` |

5. Selain managed policy di atas, **dev3-database** dan **dev5-platform** butuh izin tambahan yang tidak tercakup managed policy manapun — buat sebagai **inline policy** (tab JSON) langsung pada masing-masing user:

   **Inline policy untuk `dev3-database`** — dibutuhkan di [Bagian 7.5](#75-beri-permission-ke-ecs-execution-role) untuk menempelkan inline policy `WaterTrackSecretsAccess` pada role `watertrack-ecs-execution-role`:
   - **Policy name:** `WaterTrackDev3RoleEdit`
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Action": ["iam:GetRole", "iam:GetRolePolicy", "iam:PutRolePolicy"],
         "Resource": "arn:aws:iam::ACCOUNT_ID:role/watertrack-ecs-execution-role"
       }
     ]
   }
   ```
   > Ganti `ACCOUNT_ID` dengan AWS Account ID dari Shared Info Sheet.

   **Inline policy untuk `dev5-platform`** — dibutuhkan di [Bagian 9.7](#97-buat-ecs-task-definition) (`iam:PassRole` adalah syarat wajib ECS Console saat memilih Task Role / Task Execution Role):
   - **Policy name:** `WaterTrackDev5PassRole`
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Action": "iam:PassRole",
         "Resource": [
           "arn:aws:iam::ACCOUNT_ID:role/watertrack-ecs-execution-role",
           "arn:aws:iam::ACCOUNT_ID:role/watertrack-ecs-task-role"
         ]
       }
     ]
   }
   ```
   > Ganti `ACCOUNT_ID` dengan AWS Account ID dari Shared Info Sheet.

   > **Catatan Keamanan:** Inline policy di atas sengaja dibatasi (`Resource`) hanya ke ARN role spesifik milik proyek WaterTrack — bukan `Resource: "*"` — sehingga user tidak bisa pass-role atau mengubah role IAM lain di akun.

6. Kirim ke masing-masing developer:
   - URL Sign-in: `https://ACCOUNT_ID.signin.aws.amazon.com/console`
   - Username dan password sementara
   - Daftar permission yang melekat pada akunnya (agar tahu batasan dan tidak heran bila ada aksi yang ditolak `AccessDenied`)

### 5.2 Buat IAM Role: `watertrack-ecs-execution-role`

Role ini digunakan ECS untuk pull image dari ECR dan ambil secrets dari Secrets Manager.

1. **IAM → Roles → Create role**
2. **Trusted entity type:** AWS service
3. **Use case:** Elastic Container Service → **Elastic Container Service Task** → Next
4. **Permissions:**
   - `AmazonECSTaskExecutionRolePolicy` (search dan centang)
5. **Role name:** `watertrack-ecs-execution-role`
6. **Create role**
7. Catat ARN-nya di Shared Info Sheet.

### 5.3 Buat IAM Role: `watertrack-ecs-task-role`

Role ini untuk container yang sedang berjalan (akses S3 uploads).

1. **IAM → Roles → Create role**
2. **Trusted entity type:** AWS service
3. **Use case:** Elastic Container Service → **Elastic Container Service Task** → Next
4. **Permissions:** Klik **Create policy** (tab baru):
   - Pilih tab **JSON** dan paste:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Action": [
           "s3:PutObject",
           "s3:GetObject",
           "s3:DeleteObject"
         ],
         "Resource": "arn:aws:s3:::watertrack-uploads-prod/*"
       },
       {
         "Effect": "Allow",
         "Action": ["s3:ListBucket"],
         "Resource": "arn:aws:s3:::watertrack-uploads-prod"
       }
     ]
   }
   ```
   - **Policy name:** `WaterTrackECSTaskPolicy`
   - Kembali ke tab role, refresh, attach `WaterTrackECSTaskPolicy`
5. **Role name:** `watertrack-ecs-task-role`
6. Catat ARN di Shared Info Sheet.

### 5.4 Buat GitHub OIDC Provider

1. **IAM → Identity providers → Add provider**
2. **Provider type:** OpenID Connect
3. **Provider URL:** `https://token.actions.githubusercontent.com`
4. Klik **Get thumbprint**
5. **Audience:** `sts.amazonaws.com`
6. **Add provider**

### 5.5 Buat IAM Role: `watertrack-github-actions-role`

1. **IAM → Roles → Create role**
2. **Trusted entity type:** Web identity
3. **Identity provider:** `token.actions.githubusercontent.com`
4. **Audience:** `sts.amazonaws.com`
5. **Permissions:** Klik **Create policy** (tab baru), tab JSON:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Action": [
           "ecr:GetAuthorizationToken",
           "ecr:BatchCheckLayerAvailability",
           "ecr:GetDownloadUrlForLayer",
           "ecr:BatchGetImage",
           "ecr:InitiateLayerUpload",
           "ecr:UploadLayerPart",
           "ecr:CompleteLayerUpload",
           "ecr:PutImage"
         ],
         "Resource": "*"
       },
       {
         "Effect": "Allow",
         "Action": [
           "ecs:RegisterTaskDefinition",
           "ecs:UpdateService",
           "ecs:DescribeServices",
           "ecs:DescribeTaskDefinition",
           "ecs:RunTask",
           "ecs:ListTasks",
           "ecs:DescribeTasks"
         ],
         "Resource": "*"
       },
       {
         "Effect": "Allow",
         "Action": ["iam:PassRole"],
         "Resource": [
           "arn:aws:iam::*:role/watertrack-ecs-execution-role",
           "arn:aws:iam::*:role/watertrack-ecs-task-role"
         ]
       },
       {
         "Effect": "Allow",
         "Action": [
           "s3:PutObject",
           "s3:GetObject",
           "s3:DeleteObject",
           "s3:ListBucket"
         ],
         "Resource": [
           "arn:aws:s3:::watertrack-frontend-prod",
           "arn:aws:s3:::watertrack-frontend-prod/*"
         ]
       },
       {
         "Effect": "Allow",
         "Action": ["cloudfront:CreateInvalidation"],
         "Resource": "*"
       },
       {
         "Effect": "Allow",
         "Action": [
           "logs:CreateLogGroup",
           "logs:CreateLogStream",
           "logs:PutLogEvents"
         ],
         "Resource": "*"
       }
     ]
   }
   ```
   - **Policy name:** `WaterTrackGitHubActionsPolicy`
6. Kembali ke tab role, refresh, attach `WaterTrackGitHubActionsPolicy`
7. **Role name:** `watertrack-github-actions-role`
8. Setelah dibuat, **edit Trust Policy**:
   - Klik role → **Trust relationships → Edit trust policy**
   - Ganti condition agar hanya branch `main` yang bisa assume role:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Principal": {
           "Federated": "arn:aws:iam::ACCOUNT_ID:oidc-provider/token.actions.githubusercontent.com"
         },
         "Action": "sts:AssumeRoleWithWebIdentity",
         "Condition": {
           "StringEquals": {
             "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
           },
           "StringLike": {
             "token.actions.githubusercontent.com:sub": "repo:YOUR_GITHUB_ORG/WaterTrack:ref:refs/heads/main"
           }
         }
       }
     ]
   }
   ```
   - Ganti `YOUR_GITHUB_ORG/WaterTrack` dengan org/username dan nama repo GitHub yang sebenarnya.
9. Catat ARN role di Shared Info Sheet.

### 5.6 Notifikasi Gate 0

Isi Shared Info Sheet baris **AWS Account ID** dan **ARN ketiga role**, lalu beritahu tim: **"Gate 0 done — Dev 2, 3, 4, 5 bisa mulai."**

---

## 6. Dev 2 — VPC + Security Groups + ACM

> **Dikerjakan oleh:** Dev 2
> **Input yang dibutuhkan:** AWS Account ID dari Shared Info Sheet (Gate 0 harus selesai)
> **Output:** VPC ID, 4 Subnet IDs, 4 Security Group IDs, 2 ACM Certificate ARNs

### 6.1 Buat VPC

1. **VPC → Your VPCs → Create VPC**
2. Pilih **VPC and more** (wizard yang buat subnet otomatis)
3. Konfigurasi:
   - **Name tag auto-generation:** `watertrack`
   - **IPv4 CIDR block:** `10.0.0.0/16`
   - **IPv6 CIDR block:** No IPv6
   - **Number of Availability Zones:** 2
   - **Number of public subnets:** 2
   - **Number of private subnets:** 2
   - **NAT gateways:** In 1 AZ (untuk private subnet akses internet)
   - **VPC endpoints:** S3 Gateway (gratis, rekomendasi)
   - **DNS hostnames:** Enable
   - **DNS resolution:** Enable
4. Klik **Create VPC**
5. Di **VPC → Subnets**, catat ID keempat subnet (2 public, 2 private) ke Shared Info Sheet

### 6.2 Verifikasi Route Tables

1. **VPC → Route tables**
2. Pastikan **public route table** punya route `0.0.0.0/0 → igw-xxxxx` (Internet Gateway)
3. Pastikan **private route table** punya route `0.0.0.0/0 → nat-xxxxx` (NAT Gateway)

### 6.3 Buat Security Groups

Buat 4 security group secara berurutan di **VPC → Security groups → Create security group**.

#### SG 1: `alb-sg` (Load Balancer)

| Field | Nilai |
|-------|-------|
| Name | `alb-sg` |
| Description | WaterTrack ALB Security Group |
| VPC | pilih VPC yang baru dibuat |

**Inbound rules:**
| Type | Port | Source |
|------|------|--------|
| HTTP | 80 | 0.0.0.0/0, ::/0 |
| HTTPS | 443 | 0.0.0.0/0, ::/0 |

Catat SG ID sebagai `SG ALB ID`.

#### SG 2: `ecs-sg` (ECS Container)

| Field | Nilai |
|-------|-------|
| Name | `ecs-sg` |
| VPC | pilih VPC yang sama |

**Inbound rules:**
| Type | Port | Source |
|------|------|--------|
| Custom TCP | 80 | Custom: pilih `alb-sg` |

Catat SG ID sebagai `SG ECS ID`.

#### SG 3: `rds-sg` (RDS MySQL)

| Field | Nilai |
|-------|-------|
| Name | `rds-sg` |
| VPC | pilih VPC yang sama |

**Inbound rules:**
| Type | Port | Source |
|------|------|--------|
| MySQL/Aurora | 3306 | Custom: pilih `ecs-sg` |

Catat SG ID sebagai `SG RDS ID`.

#### SG 4: `redis-sg` (ElastiCache Redis)

| Field | Nilai |
|-------|-------|
| Name | `redis-sg` |
| VPC | pilih VPC yang sama |

**Inbound rules:**
| Type | Port | Source |
|------|------|--------|
| Custom TCP | 6379 | Custom: pilih `ecs-sg` |

Catat SG ID sebagai `SG Redis ID`.

### 6.4 Request ACM Certificate — ap-southeast-3

1. **Certificate Manager → Request certificate**
2. **Certificate type:** Public certificate → Next
3. **Fully qualified domain names:** `yourdomain.com` dan `*.yourdomain.com`
4. **Validation method:** DNS validation
5. Klik **Request**
6. Di halaman certificate, klik **Create records in Route 53** (auto buat CNAME)
7. Tunggu status `Issued` (5–30 menit)
8. Catat **Certificate ARN** sebagai `ACM Certificate ARN (ap-southeast-3)`

### 6.5 Request ACM Certificate — us-east-1

> CloudFront hanya dapat menggunakan certificate dari us-east-1.

1. **Ganti region ke us-east-1 (N. Virginia)**
2. Ulangi langkah 6.4 di region ini
3. Catat ARN kedua sebagai `ACM Certificate ARN (us-east-1)`
4. **Kembalikan region ke ap-southeast-3**

### 6.6 Notifikasi Tim

Isi semua baris **[DEV 2] VPC & NETWORK** di Shared Info Sheet.

---

## 7. Dev 3 — RDS + ElastiCache + Secrets Manager

> **Dikerjakan oleh:** Dev 3
> **Input yang dibutuhkan:** VPC ID, Private Subnet IDs, SG RDS ID, SG Redis ID
> **Output:** RDS Endpoint, Redis Endpoint, 4 Secret ARNs

### 7.1 Buat RDS Subnet Group

1. **RDS → Subnet groups → Create DB subnet group**
2. Konfigurasi:
   - **Name:** `watertrack-rds-subnet-group`
   - **VPC:** pilih VPC watertrack
   - **Availability Zones:** pilih kedua AZ
   - **Subnets:** pilih kedua **private** subnet
3. **Create**

### 7.2 Buat RDS MySQL Instance

1. **RDS → Databases → Create database**
2. **Engine options:** MySQL, versi 8.0.x terbaru
3. **Templates:** Production
4. **Availability:** Multi-AZ DB instance
5. **DB instance identifier:** `watertrack-db-prod`
6. **Master username:** `watertrack`
7. **Master password:** buat password kuat (simpan sementara)
8. **DB instance class:** db.t3.small
9. **Storage:** gp3, 20 GB, autoscaling max 100 GB
10. **Connectivity:**
    - **VPC:** pilih VPC watertrack
    - **DB subnet group:** `watertrack-rds-subnet-group`
    - **Public access:** No
    - **Security groups:** hapus default, pilih `rds-sg`
11. **Additional configuration:**
    - **Initial database name:** `water_billing`
    - **Backup retention:** 7 days
    - **Deletion protection:** centang
12. **Create database** (5–10 menit)
13. Catat **Endpoint** di Shared Info Sheet

### 7.3 Buat ElastiCache Redis

1. **ElastiCache → Redis caches → Create Redis cache**
2. **Cluster mode:** Disabled
3. **Name:** `watertrack-redis-prod`
4. **Node type:** cache.t3.micro
5. **Number of replicas:** 1
6. **Subnet group:** Create new
   - **Name:** `watertrack-redis-subnet-group`
   - **VPC:** pilih VPC watertrack
   - **Subnets:** pilih kedua **private** subnet
7. **Security groups:** pilih `redis-sg`
8. **Encryption in-transit:** Enable
9. **Encryption at-rest:** Enable
10. **Create**
11. Catat **Primary Endpoint** di Shared Info Sheet (format: `xxxx.cache.amazonaws.com:6379`)

### 7.4 Simpan Secrets ke Secrets Manager

Buat 4 secret. Untuk masing-masing: **Secrets Manager → Secrets → Store a new secret**

| Secret Name | Key | Value |
|-------------|-----|-------|
| `watertrack/app-key` | `value` | `base64:` + 32-byte base64 random string |
| `watertrack/db-password` | `value` | password RDS dari langkah 7.2 |
| `watertrack/db-host` | `value` | RDS endpoint dari langkah 7.2 |
| `watertrack/redis-host` | `value` | Redis hostname dari langkah 7.3 (tanpa `:6379`) |

Untuk setiap secret:
1. **Secret type:** Other type of secret
2. Isi key/value sesuai tabel
3. **Secret name:** sesuai kolom Secret Name
4. **Automatic rotation:** Disable
5. Catat **Secret ARN** di Shared Info Sheet

> **Cara generate APP_KEY tanpa PHP lokal:**
> ```
> python3 -c "import base64, os; print('base64:' + base64.b64encode(os.urandom(32)).decode())"
> ```

### 7.5 Beri Permission ke ECS Execution Role

1. **IAM → Roles → watertrack-ecs-execution-role**
2. **Add permissions → Create inline policy**
3. Tab JSON:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Action": "secretsmanager:GetSecretValue",
         "Resource": [
           "ARN_SECRET_APP_KEY",
           "ARN_SECRET_DB_PASSWORD",
           "ARN_SECRET_DB_HOST",
           "ARN_SECRET_REDIS_HOST"
         ]
       }
     ]
   }
   ```
   - Ganti keempat `ARN_SECRET_*` dengan ARN dari Shared Info Sheet
4. **Policy name:** `WaterTrackSecretsAccess`
5. **Create policy**

### 7.6 Notifikasi Tim

Isi semua baris **[DEV 3] DATABASE & SECRETS** di Shared Info Sheet.

---

## 8. Dev 4 — S3 + CloudFront + WAF

> **Dikerjakan oleh:** Dev 4
> **Input yang dibutuhkan:** ACM Certificate ARN (us-east-1) dari Dev 2
> **Output:** S3 buckets, CloudFront Distribution ID, WAF ACL ARN

### 8.1 Buat S3 Bucket Frontend

1. **S3 → Create bucket**
2. Konfigurasi:
   - **Bucket name:** `watertrack-frontend-prod`
   - **AWS Region:** ap-southeast-3
   - **Block all public access:** centang semua (CloudFront akses via OAC — JANGAN buat public)
   - **Versioning:** Disable
   - **Encryption:** SSE-S3
3. **Create bucket**

### 8.2 Buat S3 Bucket Uploads

1. **S3 → Create bucket**
2. Konfigurasi:
   - **Bucket name:** `watertrack-uploads-prod`
   - **AWS Region:** ap-southeast-3
   - **Block all public access:** centang semua
   - **Versioning:** Enable
3. **Create bucket**
4. Tambah lifecycle rule untuk hapus versi lama — buka **Bucket → Management → Lifecycle rules → Create lifecycle rule**:

   **Step 1 — Lifecycle rule configuration:**

   | Field | Nilai |
   |-------|-------|
   | **Lifecycle rule name** | `delete-old-versions` |
   | **Rule scope** | Pilih radio button **"Apply to all objects in the bucket"** |

   > **Kenapa "Apply to all objects"?** Bucket ini hanya berisi file upload pelanggan — tidak ada sub-folder yang perlu dikecualikan. Pilihan ini menghindari keharusan mengisi Prefix atau Tag (seperti error di screenshot). Setelah dipilih, AWS menampilkan peringatan kuning: *"This rule will apply to all objects in the bucket."* — centang checkbox acknowledgment yang muncul untuk melanjutkan.

   > **Jangan pilih "Limit the scope using filters"** kecuali kamu hanya ingin rule ini berlaku untuk folder/prefix tertentu (mis. hanya `uploads/avatar/`). Jika dipilih tapi Prefix dan Tag dibiarkan kosong, AWS akan menampilkan error validasi seperti pada screenshot: *"You must specify a prefix or another filter."*

   **Step 2 — Lifecycle rule actions:**

   Centang **hanya** satu action berikut:

   | Checkbox | Status | Keterangan |
   |----------|--------|-----------|
   | Move current versions between storage classes | ☐ Kosong | Tidak diperlukan. |
   | Move noncurrent versions between storage classes | ☐ Kosong | Tidak diperlukan. |
   | **Expire current versions of objects** | ☐ Kosong | Jangan centang — ini akan menghapus file aktif yang masih dipakai user. |
   | **Permanently delete noncurrent versions of objects** | ☑ **Centang** | Hapus versi lama yang sudah tidak aktif. |
   | Delete expired object delete markers or incomplete multipart uploads | ☐ Kosong | Opsional — bisa dicentang juga untuk membersihkan delete markers. |

   **Step 3 — Permanently delete noncurrent versions of objects:**

   Setelah mencentang action di atas, bagian konfigurasinya muncul di bawah:

   | Field | Nilai | Keterangan |
   |-------|-------|-----------|
   | **Days after objects become noncurrent** | `90` | Versi lama dihapus 90 hari setelah diganti versi baru. |
   | **Number of newer noncurrent versions to retain** | (kosong / 0) | Kosongkan = hapus semua versi lama setelah 90 hari. Isi `1` jika ingin selalu menyimpan minimal 1 versi sebelumnya sebagai fallback. |

   Klik **"Create rule"** untuk menyimpan.

   > **Verifikasi:** Setelah dibuat, rule muncul di tab **Management → Lifecycle rules** dengan status **Enabled** dan scope **Bucket**. AWS menjalankan evaluasi lifecycle setiap hari — versi yang sudah lebih dari 90 hari otomatis dihapus tanpa aksi manual.

### 8.3 Buat CloudFront Distribution

> **Catatan UI:** AWS telah memperbarui tampilan console CloudFront dengan alur yang jauh lebih sederhana. Form kini menggunakan pendekatan "recommended settings" — bukan lagi konfigurasi manual OAC, cache behavior, dll. Panduan ini mengikuti UI terbaru tersebut.

Buka **CloudFront → Distributions → Create distribution**. Isi form dari atas ke bawah:

---

#### Bagian 1 — Origin

**Field Origin domain:**

Klik kotak input atau tombol **Browse S3** di sebelah kanan, lalu pilih:
```
watertrack-frontend-prod.s3.ap-southeast-3.amazonaws.com
```
Pastikan yang terpilih adalah endpoint REST (format `.s3.<region>.amazonaws.com`) — bukan endpoint website hosting.

**Field Origin path — optional:**

| Field | Nilai | Keterangan |
|-------|-------|-----------|
| **Origin path** | (kosong) | Hanya diisi jika build frontend disimpan di sub-folder bucket (mis. `/dist`). CI/CD di `deploy.yml` sync langsung ke root bucket, jadi kosongkan. |

---

#### Bagian 2 — Settings (Muncul Tepat di Bawah Origin Path)

AWS otomatis menampilkan section **"Settings"** setelah origin domain dipilih. Section ini berisi tiga keputusan utama:

**A. Allow private S3 bucket access to CloudFront**

| Field | Nilai |
|-------|-------|
| Checkbox **"Allow private S3 bucket access to CloudFront — Recommended"** | ☑ **Centang (sudah aktif by default)** |

> Dengan mencentang ini, AWS secara otomatis: (1) membuat Origin Access Control (OAC), dan (2) memperbarui S3 bucket policy agar hanya distribution ini yang bisa akses bucket. **Tidak perlu lagi membuat OAC manual atau copy-paste bucket policy** seperti di UI lama.

> Jika tidak dicentang, bucket harus dibuat public — ini adalah risiko keamanan besar. Pastikan checkbox ini selalu tercentang.

**B. Origin settings**

Pilih radio button:

| Pilihan | Status | Keterangan |
|---------|--------|-----------|
| ● **Use recommended origin settings** | ✅ **Pilih ini** | AWS otomatis mengatur connection timeout, keep-alive, retry, dan Origin Shield sesuai best practice untuk S3 origin. |
| ○ Customize origin settings | ❌ Tidak perlu | Hanya diperlukan jika ada kebutuhan khusus seperti custom timeout atau mengaktifkan Origin Shield secara manual. |

**C. Cache settings**

Pilih radio button:

| Pilihan | Status | Keterangan |
|---------|--------|-----------|
| ● **Use recommended cache settings tailored to serving S3 content** | ✅ **Pilih ini** | AWS otomatis mengatur: redirect HTTP→HTTPS, metode GET/HEAD saja, policy CachingOptimized, dan kompresi gzip/Brotli. Semua setting optimal untuk static SPA dari S3. |
| ○ Customize cache settings | ❌ Tidak perlu | Hanya jika perlu konfigurasi cache header atau behavior kustom. |

---

#### Bagian 3 — Web Application Firewall (WAF)

Section ini muncul di bawah Cache settings, sebelum pengaturan distribusi:

| Opsi | Pilih? | Keterangan |
|------|--------|-----------|
| ● **Do not enable security protections** | ✅ **Pilih ini** | WAF dibuat dan diasosiasikan **secara manual di Bagian 8.4** agar kita bisa tambah rule kustom (rate limiting `/api/login`). |
| ○ Enable security protections | ❌ Jangan | Membuat WAF ACL baru otomatis tanpa rule kustom — akan duplikat dengan yang dibuat di Bagian 8.4. |

---

#### Bagian 4 — Pengaturan Distribusi (Settings)

Scroll ke bawah. Isi field-field berikut:

| Field | Nilai | Keterangan |
|-------|-------|-----------|
| **Price class** | **Use all edge locations (best performance)** | Mencakup semua POP CloudFront termasuk Asia Tenggara. Latensi terbaik untuk pengguna Indonesia. |
| **AWS WAF web ACL** | (kosong / None) | Biarkan kosong — WAF diasosiasikan di langkah 8.4 setelah Web ACL dibuat. |
| **Alternate domain names (CNAME)** | Klik **"Add item"** → isi `aftaza.dev` | Domain publik. Tambah baris kedua `www.aftaza.dev` jika diperlukan. Wajib diisi jika ingin pakai domain sendiri. |
| **Custom SSL certificate** | Pilih sertifikat **us-east-1** dari langkah 6.5 | ARN: `arn:aws:acm:us-east-1:775755739096:certificate/f6c80578-ebe8-408e-bd13-b8634f24fda6`. Wajib dari **us-east-1** — CloudFront hanya membaca ACM dari region ini. |
| **Security policy** | **TLSv1.2_2021 (recommended)** | Minimum TLS 1.2. Menonaktifkan TLS 1.0/1.1 yang sudah deprecated. |
| **Supported HTTP versions** | ☑ **HTTP/2** dan ☑ **HTTP/3** | Aktifkan keduanya. HTTP/3 (QUIC) memberikan koneksi lebih cepat di jaringan mobile. |
| **Default root object** | `index.html` | **Wajib diisi.** Tanpa ini, request ke `https://aftaza.dev` mengembalikan 403 dari S3 alih-alih halaman React. |
| **Standard logging** | Off (default) | Biarkan off. Aktifkan jika perlu audit akses — butuh bucket S3 terpisah untuk log delivery. |
| **IPv6** | **On** (default) | Biarkan aktif. |
| **Description** | `WaterTrack frontend SPA - production` | Label opsional untuk identifikasi di daftar distributions. |

Klik **"Create distribution"**. Status berubah dari `In Progress` → `Enabled` dalam **5–10 menit**.

Catat **Distribution ID** (`E1C3FJ11UUAQM4`) dan **Domain name** (`d56pe38f7mqzq.cloudfront.net`) di Shared Info Sheet.

> **Verifikasi bucket policy otomatis:** Setelah distribution dibuat, buka **S3 → watertrack-frontend-prod → Permissions → Bucket policy** — AWS sudah otomatis menambahkan policy berikut (tidak perlu copy-paste manual seperti UI lama):
> ```json
> {
>     "Version": "2012-10-17",
>     "Statement": [{
>         "Sid": "AllowCloudFrontServicePrincipal",
>         "Effect": "Allow",
>         "Principal": { "Service": "cloudfront.amazonaws.com" },
>         "Action": "s3:GetObject",
>         "Resource": "arn:aws:s3:::watertrack-frontend-prod/*",
>         "Condition": {
>             "StringEquals": {
>                 "AWS:SourceArn": "arn:aws:cloudfront::775755739096:distribution/E1C3FJ11UUAQM4"
>             }
>         }
>     }]
> }
> ```
> Kondisi `AWS:SourceArn` memastikan **hanya distribution ini** yang bisa akses bucket. Pastikan juga **Block Public Access** di bucket tetap aktif penuh (semua 4 checkbox).

---

#### 8.3.1 Tambahkan Custom Error Pages (SPA Routing)

React Router menangani routing di sisi client. Saat user refresh di `/dashboard` atau `/kasir`, browser meminta path tersebut ke CloudFront — S3 mengembalikan **403** karena file itu tidak ada secara fisik. Tanpa konfigurasi ini, user mendapat halaman error, bukan React app.

Setelah distribution aktif (status **Enabled**), buka distribution → tab **Error pages → Create custom error response**. Buat **dua** entri:

**Entri 1 — Handle 403:**

| Field | Nilai |
|-------|-------|
| HTTP error code | **403: Forbidden** |
| Customize error response | **Yes** |
| Response page path | `/index.html` |
| HTTP Response code | **200: OK** |

**Entri 2 — Handle 404:**

| Field | Nilai |
|-------|-------|
| HTTP error code | **404: Not Found** |
| Customize error response | **Yes** |
| Response page path | `/index.html` |
| HTTP Response code | **200: OK** |

> **Kenapa return 200, bukan 404?** Browser menerima 200, lalu React Router membaca URL (`/dashboard`) dan menampilkan komponen yang sesuai. Jika dikembalikan 404, browser dan search crawler memperlakukan halaman sebagai not found — padahal route valid di aplikasi.

> **Kenapa perlu handle 403 juga?** S3 dengan Block Public Access aktif mengembalikan **403** (bukan 404) untuk file yang tidak ada — karena S3 tidak mengonfirmasi keberadaan object pada bucket private. Konfigurasi keduanya agar semua skenario refresh/deep-link tertangani.

### 8.4 Buat WAF Web ACL

> **Catatan UI (2026):** AWS telah memperbarui console WAF. Navigation pane sekarang menggunakan **"Resources & protection packs (web ACLs)"** dan tombol buat adalah **"Add protection pack (web ACL)"** — bukan lagi "Web ACLs → Create web ACL". Panduan ini mengikuti UI terbaru tersebut.

> WAF untuk CloudFront harus dibuat di **us-east-1 (N. Virginia)**. Ganti region sebelum mulai.

---

#### Langkah 1 — Ganti Region ke us-east-1

Di kanan atas console, ganti region ke **US East (N. Virginia) us-east-1**.

> WAF untuk CloudFront selalu di-deploy di us-east-1 (scope Global), bukan ap-southeast-3. Jika region salah, distribusi CloudFront tidak akan muncul di daftar resource yang bisa diasosiasikan.

---

#### Langkah 2 — Buka WAF Console dan Mulai Membuat

1. Buka **WAF & Shield** dari search bar AWS Console.
2. Di navigation pane kiri, pilih **Resources & protection packs (web ACLs)**.
3. Klik tombol **"Add protection pack (web ACL)"**.

---

#### Langkah 3 — Tell us about your app

Bagian ini menentukan rekomendasi rule groups yang akan ditawarkan AWS:

| Field | Nilai | Keterangan |
|-------|-------|-----------|
| **App category** | `Content & publishing systems` | Pilih dari dropdown. Ini pilihan paling mendekati untuk aplikasi billing berbasis web. Jika tersedia pilih juga `Financial services`. |
| **App focus / Traffic source** | ● **Both API and web** | WaterTrack memiliki React SPA (web) dan Laravel REST API (API) — keduanya perlu dilindungi. |

---

#### Langkah 4 — Select resources to protect

1. Klik tombol **"Add resources"** — dropdown muncul dengan dua grup:
   - **Regional:** Add regional resources
   - **Global:** Add CloudFront or Amplify resources ← **Pilih ini**
2. Di dialog yang muncul, cari dan pilih distribution:
   ```
   E1C3FJ11UUAQM4  (watertrack-frontend-prod)
   ```
3. Klik **Add**.

> Resource langsung diasosiasikan saat pembuatan — tidak perlu langkah asosiasi terpisah setelah WAF dibuat seperti di UI lama.

---

#### Langkah 5 — Choose initial protections

Pilih protection level dari tiga opsi:

| Opsi | Deskripsi | Pilih? |
|------|-----------|--------|
| Recommended | AWS otomatis memilih rule berdasarkan app category & focus — kurang transparan | ❌ |
| Essentials | Set rule minimal | ❌ |
| ● **You build it** | Kontrol penuh — pilih sendiri managed rules dan custom rules | ✅ **Pilih ini** |

Setelah memilih **"You build it"**, dua sub-langkah berikut muncul:

---

**5a — Tambahkan Managed Rule Groups**

Klik **"AWS-managed rule group"** → **Next**. Aktifkan (toggle **Add to protection pack**) untuk tiga rule group berikut:

| Rule Group | Keterangan |
|------------|-----------|
| `AWSManagedRulesCommonRuleSet` | Proteksi dasar: XSS, SQL injection, path traversal. |
| `AWSManagedRulesKnownBadInputsRuleSet` | Blokir payload berbahaya yang sudah dikenal (Log4j, dll). |
| `AWSManagedRulesAmazonIpReputationList` | Blokir IP reputasi buruk: scanner, bot, TOR exit nodes. |

Klik **Next** setelah selesai.

---

**5b — Tambahkan Custom Rule: LoginRateLimit**

Klik **"Custom rule"** → **Next**. Isi form rule builder:

| Field | Nilai | Keterangan |
|-------|-------|-----------|
| **Rule type** | **Rate-based rule** | Menghitung request per IP dalam window 5 menit. |
| **Name** | `LoginRateLimit` | Jangan pakai prefix `AWS`, `Shield`, `PreFM`, atau `PostFM` — dicadangkan AWS. |
| **Rate limit** | `100` | Maks. 100 request dari satu IP per 5 menit ke endpoint login. |
| **Request aggregation** | **Source IP address** | Rate dihitung per IP pengirim. |
| **Add scope-down statement** | ☑ **Centang** | Batasi rule ini hanya ke endpoint login — bukan semua traffic. |
| Scope-down: **Request component** | **URI path** | |
| Scope-down: **Match type** | **Exactly matches string** | |
| Scope-down: **String to match** | `/api/login` | |
| **Action** | **Block** | IP yang melewati batas langsung diblokir (tanpa CAPTCHA). |

Klik **"Create rule"** untuk menyimpan.

---

#### Langkah 6 — Name and description

| Field | Nilai | Keterangan |
|-------|-------|-----------|
| **Name** | `watertrack-waf` | **Tidak bisa diubah setelah dibuat.** |
| **Description** | `WaterTrack WAF - CloudFront global protection` | Opsional, untuk identifikasi di daftar Web ACLs. |

---

#### Langkah 7 — Customize protection pack (opsional)

Di bagian **Default rule actions**:

| Setting | Nilai |
|---------|-------|
| **Default action** | **Allow** | Request yang tidak cocok dengan rule apapun akan diizinkan lewat. |

Bagian **Rule configuration** (default rate limits, IP addresses, country blocking) dan **Logging destination** bisa dikosongkan untuk deployment awal.

---

#### Langkah 8 — Review dan Buat

Review semua pengaturan, lalu klik **"Add protection pack (web ACL)"**.

Setelah selesai, catat **Web ACL ARN** di Shared Info Sheet (format):
```
WAF Web ACL ARN: arn:aws:wafv2:us-east-1:775755739096:global/webacl/watertrack-waf/____
```

> ARN bisa dilihat di halaman detail Web ACL setelah dibuat — klik nama `watertrack-waf` di daftar.

---

#### Langkah 9 — Kembalikan Region

Ganti region kembali ke **ap-southeast-3 (Jakarta)** untuk lanjut ke workstream berikutnya.

---

## 9. Dev 5 — ECR + ECS + ALB + Route 53

> **Dikerjakan oleh:** Dev 5
> **Input yang dibutuhkan:** Semua baris di Shared Info Sheet (Gate 1 harus selesai — VPC ID, Subnet IDs, SG IDs, Secret ARNs, ACM ARN sudah terisi semua)
> **Output:** ECR URI, ECS Cluster, ECS Service running, ALB DNS, Route 53 records
> **Urutan pengerjaan:** 9.1 → 9.2 → 9.3 → 9.4 → 9.5 → 9.6 → 9.7 → 9.8 → 9.9 → 9.10. Jangan lewati urutan — Task Definition (9.7) membutuhkan ECR image (9.2) dan Log Group (9.3) sudah ada.

---

### 9.1 Buat ECR Repository

ECR (Elastic Container Registry) adalah registry Docker private milik AWS tempat image backend WaterTrack disimpan. ECS nantinya akan pull image dari sini setiap kali menjalankan container.

1. **ECR → Repositories → Create repository**
2. Konfigurasi:
   - **Visibility:** Private
   - **Repository name:** `watertrack-api`
   - **Tag immutability:** Disabled (agar tag dapat di-overwrite; CI/CD menggunakan tag commit SHA, bukan `latest`)
   - **Scan on push:** Enable (AWS Inspector otomatis scan vulnerability tiap push)
   - **Encryption:** AES-256
3. **Create repository**
4. Setelah dibuat, klik nama repository → salin **URI** lengkapnya (format: `ACCOUNT_ID.dkr.ecr.ap-southeast-3.amazonaws.com/watertrack-api`) ke Shared Info Sheet.

> **Nama ini sudah sinkron dengan `deploy.yml`:** `ECR_REPOSITORY: watertrack-api` di `.github/workflows/deploy.yml` sudah sesuai. Jangan ubah nama ini tanpa mengubah `ECR_REPOSITORY` di workflow secara bersamaan.

### 9.2 Push Docker Image Pertama Kali

Ini adalah langkah paling kritis di workstream Dev 5: membangun image Docker dari kode backend dan mengunggahnya ke ECR agar ECS bisa menjalankannya. Langkah ini dikerjakan di **terminal lokal**, bukan di AWS Console.

#### 9.2.1 Prasyarat Lokal

Pastikan ketiga tool berikut sudah terinstall di mesin Dev 5 sebelum melanjutkan:

| Tool | Cek versi | Catatan |
|------|-----------|---------|
| Docker Desktop | `docker --version` | Pastikan **sedang berjalan** (ikon Docker aktif di system tray) |
| AWS CLI v2 | `aws --version` | Harus v2, bukan v1 — cek dengan `aws --version` pastikan output `aws-cli/2.x.x` |
| Git (repo sudah ter-clone) | `git --version` | Repo harus ada di lokal karena build butuh akses ke `backend/` |

#### 9.2.2 Buat AWS Access Key untuk CLI

Akun `dev5-platform` dibuat dengan Console access (Bagian 5.1), tetapi AWS CLI membutuhkan **Access Key** (programmatic access) yang berbeda dari password Console. Langkah ini perlu dilakukan Dev 1 atau Dev 5 sendiri setelah login Console:

1. **IAM → Users → dev5-platform → tab Security credentials**
2. Scroll ke bagian **Access keys → Create access key**
3. **Use case:** Command Line Interface (CLI) → Next
4. Centang konfirmasi → **Create access key**
5. **Salin atau unduh** Access Key ID dan Secret Access Key sekarang — ini **satu-satunya kesempatan** melihat Secret Key, setelah halaman ini ditutup tidak bisa dilihat lagi.

Kemudian konfigurasi CLI di terminal lokal Dev 5:

```bash
aws configure
# AWS Access Key ID [None]: masukkan Access Key ID
# AWS Secret Access Key [None]: masukkan Secret Access Key
# Default region name [None]: ap-southeast-3
# Default output format [None]: json
```

Verifikasi berhasil:

```bash
aws sts get-caller-identity
# Expected:
# {
#   "UserId": "AIDAXXXXXXXXXXXXXXXXX",
#   "Account": "775755739096",
#   "Arn": "arn:aws:iam::775755739096:user/dev5-platform"
# }
```

Jika Account ID sesuai dengan Shared Info Sheet, CLI sudah terhubung ke akun AWS yang benar.

#### 9.2.3 Memahami Struktur Dockerfile

Sebelum build, penting memahami apa yang dilakukan `backend/Dockerfile` agar lebih mudah debug bila ada error:

```
Tahap 1 — Base image
  └─ php:8.2-fpm-alpine        ← Alpine Linux ringan (~10MB), PHP-FPM sudah termasuk

Tahap 2 — Install sistem & ekstensi PHP
  └─ nginx, supervisor, curl   ← Nginx sebagai web server, Supervisor mengelola proses
  └─ pdo_mysql, gd, zip, dll.  ← Ekstensi PHP yang dibutuhkan Laravel

Tahap 3 — Install dependensi PHP (layer terpisah untuk cache efisien)
  └─ COPY composer.json/lock   ← Disalin dulu SEBELUM kode aplikasi
  └─ composer install --no-dev ← Tanpa --dev: phpunit & tools dev tidak masuk image production

Tahap 4 — Copy kode aplikasi
  └─ COPY . .                  ← Semua file backend ke /var/www/html
  └─ dump-autoload --optimize  ← Buat classmap production (lebih cepat dari PSR-4 autoload biasa)

Tahap 5 — Konfigurasi runtime
  └─ nginx.conf, supervisord.conf, php.ini   ← Config yang sudah disiapkan di backend/docker/
  └─ chown www-data storage/                 ← Laravel butuh write permission ke storage/

ENTRYPOINT: docker/entrypoint.sh (dijalankan SETIAP container start)
  ├─ php artisan config:cache   ← Cache config SETELAH container start
  ├─ php artisan route:cache    ← Cache routing
  ├─ php artisan view:cache     ← Cache blade templates
  └─ supervisord                ← Jalankan nginx + php-fpm secara paralel
```

> **Mengapa `config:cache` ada di entrypoint, bukan saat `docker build`?**
> Karena `APP_KEY`, `DB_HOST`, `DB_PASSWORD`, dan variabel lainnya baru tersedia saat container ECS berjalan — diinjeksikan oleh Secrets Manager. Jika dijalankan saat build, perintah ini akan gagal karena `APP_KEY` kosong dan Laravel akan throw exception.

#### 9.2.4 Login ke ECR

AWS ECR menggunakan token autentikasi sementara yang berlaku **12 jam**. Perintah berikut mengambil token tersebut dan langsung menggunakannya untuk login Docker:

```bash
aws ecr get-login-password --region ap-southeast-3 | \
  docker login --username AWS --password-stdin \
  ACCOUNT_ID.dkr.ecr.ap-southeast-3.amazonaws.com
```

Ganti `ACCOUNT_ID` dengan AWS Account ID dari Shared Info Sheet. Output yang diharapkan: `Login Succeeded`

Jika muncul error `Cannot perform an interactive login from a non TTY device`, jalankan dua baris terpisah:
```bash
TOKEN=$(aws ecr get-login-password --region ap-southeast-3)
docker login --username AWS --password "$TOKEN" \
  ACCOUNT_ID.dkr.ecr.ap-southeast-3.amazonaws.com
```

#### 9.2.5 Build Docker Image

Jalankan dari **root repository** (`WaterTrack/`), bukan dari dalam folder `backend/`:

```bash
docker build \
  --platform linux/amd64 \
  -t watertrack-api \
  backend/
```

Penjelasan flag:
- `--platform linux/amd64` — **wajib** jika mesin Dev 5 adalah Mac dengan chip Apple Silicon (M1/M2/M3) atau CPU ARM lainnya. ECS Fargate berjalan di `linux/amd64`. Tanpa flag ini, image ARM akan diupload ke ECR tapi container akan langsung crash saat ECS mencoba menjalankannya dengan error `exec format error`.
- `-t watertrack-api` — nama lokal sementara untuk image (sesuai nama ECR repository).
- `backend/` — path ke folder berisi Dockerfile, relatif terhadap working directory saat ini.

Build pertama kali membutuhkan **5–15 menit** karena composer install mendownload semua dependensi. Build berikutnya jauh lebih cepat karena Docker cache layer `composer install`.

Verifikasi image berhasil dibuat:
```bash
docker images | grep watertrack-api
# REPOSITORY        TAG       IMAGE ID       CREATED         SIZE
# watertrack-api    latest    abc123def456   1 minute ago    ~180MB
```

#### 9.2.6 Tag dan Push ke ECR

Docker membutuhkan image di-tag dengan URI ECR lengkap sebelum bisa di-push:

```bash
# Simpan URI ke variabel untuk kemudahan — ganti ACCOUNT_ID dengan Account ID sebenarnya
ECR_URI="ACCOUNT_ID.dkr.ecr.ap-southeast-3.amazonaws.com/watertrack-api"

# Tag image lokal dengan URI ECR
docker tag watertrack-api:latest $ECR_URI:latest

# Push ke ECR
docker push $ECR_URI:latest
```

Proses push pertama kali membutuhkan **5–15 menit** tergantung kecepatan internet (image ~180MB). Progress ditampilkan layer per layer di terminal.

Output yang diharapkan di akhir:
```
latest: digest: sha256:xxxxxxxxxxxx size: 1234
```

#### 9.2.7 Verifikasi di ECR Console

1. **ECR → Repositories → watertrack-api → Images**
2. Pastikan muncul baris dengan tag `latest`, kolom **Pushed at** menunjukkan waktu tadi
3. Kolom **Scan status** menunjukkan `Complete` atau `In progress` (bukan `Failed`)
4. Salin **Image URI** lengkap termasuk `:latest` di akhir — akan dibutuhkan di step 9.7

#### 9.2.8 Troubleshooting Build & Push

| Error | Penyebab | Solusi |
|-------|----------|--------|
| `Cannot connect to the Docker daemon` | Docker Desktop belum berjalan | Buka Docker Desktop, tunggu ikon berubah hijau di system tray |
| `exec format error` saat ECS menjalankan container | Image dibangun untuk ARM tanpa `--platform` | Rebuild dengan `--platform linux/amd64` dan push ulang |
| `no space left on device` saat build | Disk Docker penuh | `docker system prune -a` untuk bersihkan image lama, lalu build ulang |
| `denied: Your authorization token has expired` | Token ECR berlaku 12 jam | Ulangi langkah login di 9.2.4 |
| `denied: User is not authorized to perform ecr:InitiateLayerUpload` | `dev5-platform` tidak punya izin ECR push | Cek `AmazonEC2ContainerRegistryFullAccess` sudah ter-attach (Bagian 5.1) |
| `COPY failed: no such file or directory` saat build | Dijalankan dari dalam folder `backend/` | Pindah ke root repo lalu jalankan `docker build ... backend/` |
| Composer install gagal: SSL certificate error | Proxy/VPN blokir koneksi ke packagist.org | Matikan VPN, coba lagi |

### 9.3 Buat CloudWatch Log Group

Log group ini **harus dibuat sebelum Task Definition** (langkah 9.7). Jika belum ada saat ECS mencoba menulis log pertama kali, task akan gagal start dengan error `ResourceNotFoundException`.

1. **CloudWatch → Log groups → Create log group**
2. **Log group name:** `/ecs/watertrack-api` — nama ini harus persis sama dengan `awslogs-group` di Task Definition nanti
3. **Retention setting:** 30 days — log lebih dari 30 hari otomatis terhapus (hemat biaya)
4. **Create**

Semua output container (stdout/stderr) akan muncul di sini: log Laravel (format `stderr` karena `LOG_CHANNEL=stderr`), output `php artisan config:cache` / `route:cache` / `view:cache` dari entrypoint.sh saat container start, dan error nginx/php-fpm dari supervisord.

---

### 9.4 Buat ECS Cluster

ECS Cluster adalah kumpulan kapasitas komputasi. Dengan Fargate, AWS yang mengelola server — tidak perlu EC2.

1. **ECS → Clusters → Create cluster**
2. **Cluster name:** `watertrack-cluster`
3. **Infrastructure:** AWS Fargate (serverless) — **jangan pilih EC2**
4. **Monitoring:** Use Container Insights — aktifkan agar metrik CPU/memory per-task muncul di CloudWatch (dipakai Alarm di Bagian 12)
5. **Create cluster**

> Container Insights menambah biaya CloudWatch kecil (~$0.35/GB log). Sangat direkomendasikan untuk visibility saat troubleshoot.

---

### 9.5 Buat Target Group

Target Group adalah daftar "tujuan" yang menerima traffic dari ALB. Untuk Fargate, tipenya wajib **IP addresses** karena setiap Fargate task mendapat IP sendiri yang berubah setiap restart.

1. **EC2 → Target groups → Create target group**
2. **Target type:** IP addresses — **wajib pilih ini, bukan Instances**
3. **Target group name:** `watertrack-tg`
4. **Protocol:** HTTP | **Port:** 80 — komunikasi ALB→Container via HTTP (enkripsi TLS sudah diakhiri di ALB)
5. **VPC:** pilih VPC watertrack (hasil Dev 2)
6. **Health check settings:**
   - **Protocol:** HTTP
   - **Path:** `/health` — endpoint ini ada di `routes/web.php`, mengembalikan `{"status":"ok"}` tanpa autentikasi. ALB memanggil endpoint ini secara berkala untuk memastikan container masih hidup.
   - **Healthy threshold:** 2 — butuh 2× respons 200 berturut-turut sebelum dianggap Healthy
   - **Unhealthy threshold:** 3 — butuh 3× gagal berturut-turut sebelum dianggap Unhealthy dan task di-replace
   - **Timeout:** 5 seconds
   - **Interval:** 30 seconds
   - **Success codes:** 200
7. **Next → Create target group**

> Jangan daftarkan IP secara manual — ECS otomatis mendaftarkan IP Fargate task saat service dibuat (langkah 9.8).

8. Catat **Target Group ARN** di Shared Info Sheet

---

### 9.6 Buat Application Load Balancer (ALB)

ALB menerima traffic dari internet (port 80/443), mengakhiri TLS, lalu meneruskan ke container di private subnet via HTTP internal.

1. **EC2 → Load Balancers → Create load balancer → Application Load Balancer**
2. **Basic:**
   - **Name:** `watertrack-alb`
   - **Scheme:** Internet-facing — ALB harus bisa diakses dari internet
   - **IP address type:** IPv4
3. **Network mapping:**
   - **VPC:** pilih VPC watertrack
   - Centang **kedua AZ**, masing-masing pilih **public subnet** — ALB harus di public subnet agar mendapat IP publik. Private subnet tidak akan berhasil.
4. **Security groups:** hapus `default`, pilih `alb-sg` (dari Shared Info Sheet Dev 2)
5. **Listeners:**
   - Tambah listener **Port 443, Protocol HTTPS** → Forward to `watertrack-tg` → pilih ACM certificate **ap-southeast-3** dari Shared Info Sheet Dev 2
6. **Create load balancer**
7. Catat **DNS name** (format: `watertrack-alb-xxxx.ap-southeast-3.elb.amazonaws.com`) dan **ARN** di Shared Info Sheet

#### 9.6.1 Tambah HTTP → HTTPS Redirect

Setelah ALB terbuat, tambahkan listener port 80 yang otomatis redirect ke HTTPS:

1. **EC2 → Load Balancers → watertrack-alb → Listeners and rules → Add listener**
2. **Protocol:** HTTP | **Port:** 80
3. **Default actions:** Redirect → HTTPS | Port: 443 | Status code: **301 Moved Permanently**
4. **Add**

Dengan ini, akses `http://api.aftaza.dev` otomatis diarahkan ke `https://api.aftaza.dev`.

---

### 9.7 Buat ECS Task Definition

Task Definition adalah "blueprint" container: image apa yang dijalankan, berapa CPU/memory, environment variable apa saja, dan bagaimana logging-nya. Setiap deploy baru akan membuat **revision** baru dari Task Definition yang sama.

> **Siapkan dulu sebelum membuka form:** Kumpulkan ECR Image URI (dari 9.2.7) dan semua Secret ARN dari Shared Info Sheet [DEV 3] sebelum mulai mengisi — form tidak bisa disimpan setengah jalan.

1. **ECS → Task definitions → Create new task definition**
2. **Task definition family:** `watertrack-api`
3. **Launch type:** AWS Fargate
4. **OS/Architecture:** Linux/X86_64 — **wajib X86_64**, sesuai `--platform linux/amd64` saat build
5. **Task size:** CPU **0.5 vCPU** | Memory **1 GB**
6. **Task role:** `watertrack-ecs-task-role` — digunakan kode Laravel saat berjalan (akses S3 uploads)
7. **Task execution role:** `watertrack-ecs-execution-role` — digunakan ECS *sebelum* container start (pull image ECR, ambil secrets dari Secrets Manager)

8. **Container → Add container**

   Klik tombol **"Add container"** — panel konfigurasi muncul (drawer di sisi kanan atau inline tergantung lebar browser). Panel terdiri dari beberapa sub-section yang bisa di-collapse. Isi dari atas ke bawah:

   ---

   #### 8a. Container Basics

   | Field di Console | Nilai | Keterangan |
   |-----------------|-------|-----------|
   | **Name** | `watertrack-api` | Harus sama persis dengan `CONTAINER_NAME: watertrack-api` di `deploy.yml`. Perbedaan satu karakter pun menyebabkan CI/CD gagal di step "Update ECS task definition". |
   | **Image URI** | `775755739096.dkr.ecr.ap-southeast-3.amazonaws.com/watertrack-api:latest` | Salin dari Shared Info Sheet [DEV 5] + tambahkan `:latest`. Tag `latest` untuk deploy pertama; CI/CD berikutnya pakai tag SHA commit. |
   | **Essential container** | Toggle **On** (Yes) | Jika container ini berhenti (exit code apapun), seluruh task dianggap gagal dan ECS menjalankan task pengganti. Karena ini satu-satunya container, wajib On. |
   | **Private registry authentication** | (kosong / tidak dicentang) | Hanya untuk registry non-ECR yang butuh kredensial. ECR sudah ditangani oleh execution role. |

   ---

   #### 8b. Port Mappings

   Klik **"Add port mapping"**. Setiap baris punya empat field:

   | Field | Nilai | Keterangan |
   |-------|-------|-----------|
   | **Container port** | `80` | Nginx di dalam container mendengarkan port 80 (sesuai `backend/docker/nginx.conf`). |
   | **Protocol** | `TCP` | Default, tidak perlu diubah. |
   | **App protocol** | `HTTP` | Memberi tahu ALB bahwa container berkomunikasi via HTTP. ALB sudah mengakhiri TLS di sisinya, lalu meneruskan ke container via HTTP internal. Diperlukan agar ALB health check dan routing bekerja benar. |
   | **Port name** | (biarkan auto-generate) | Opsional, untuk Service Connect. Tidak diperlukan untuk setup ini. |

   > Fargate menggunakan network mode `awsvpc` — setiap task mendapat IP sendiri. Field **"Host port"** tidak muncul karena host port selalu sama dengan container port secara otomatis.

   ---

   #### 8c. Resource Allocation (Container-Level, Opsional)

   Sub-section ini ada setelah Port Mappings. Untuk setup ini, **biarkan semua field kosong** — batas resource sudah di-set di level task (langkah 5: 0.5 vCPU / 1 GB total). Tabel ini untuk referensi:

   | Field | Penjelasan |
   |-------|-----------|
   | **CPU** | Soft limit dalam CPU units (1 vCPU = 1024 units). Kosong = container bisa pakai semua CPU yang dialokasikan task. |
   | **Memory hard limit** | Dalam MiB. Container di-kill (OOM) jika melewati nilai ini. Kosong = tidak ada batas per-container selain batas task total. |
   | **Memory soft limit** | ECS mencoba menjaga penggunaan memory di bawah nilai ini, tapi mengizinkan burst. |

   ---

   #### 8d. Environment Variables — Type `Value` (Plaintext)

   Scroll ke sub-section **"Environment variables"**. Klik **"Add environment variable"** untuk setiap baris. Tiap baris punya tiga field:
   - **Key** — nama variabel
   - **Value type** — dropdown: pilih **`Value`** untuk plaintext
   - **Value** — isi nilai langsung

   Tambahkan semua baris berikut **satu per satu** (tidak ada bulk import di Console):

   | Key | Value | Penjelasan |
   |-----|-------|-----------|
   | `APP_ENV` | `production` | Mode Laravel: menonaktifkan fitur development. |
   | `APP_DEBUG` | `false` | **Wajib `false`.** Jika `true`, stack trace PHP dan isi `.env` bisa bocor ke response API ke pengguna. |
   | `APP_URL` | `https://api.aftaza.dev` | Base URL API. Dipakai Laravel untuk generate URL absolut — misal link PDF tagihan di response JSON, link reset password di email. |
   | `APP_LOCALE` | `id` | Locale untuk pesan validasi dan error Laravel (Bahasa Indonesia). |
   | `APP_FALLBACK_LOCALE` | `id` | Fallback jika terjemahan locale tertentu tidak tersedia. |
   | `FRONTEND_URL` | `https://aftaza.dev` | Dibaca `config/cors.php` sebagai `allowed_origins`. **Tanpa ini, semua request dari browser akan diblokir** oleh browser (CORS policy). |
   | `LOG_CHANNEL` | `stderr` | Laravel tulis log ke stderr container. Driver `awslogs` otomatis tangkap stderr dan kirim ke CloudWatch. Jangan pakai `stack` atau `single` — file log tidak persisten di Fargate task. |
   | `LOG_LEVEL` | `error` | Hanya log `error`, `critical`, `alert`, `emergency` yang masuk CloudWatch. Level `info`/`debug` tidak di-log — hemat biaya dan kurangi noise. |
   | `DB_CONNECTION` | `mysql` | Driver database Laravel. |
   | `DB_PORT` | `3306` | Port MySQL standar. |
   | `DB_DATABASE` | `water_billing` | Nama database yang dibuat saat setup RDS (Bagian 7.2 → "Initial database name"). |
   | `DB_USERNAME` | `watertrack` | Master username RDS (sesuai `MYSQL_USER` di `docker-compose.yml` dan `.env.production.example`). |
   | `SESSION_DRIVER` | `redis` | **Wajib Redis untuk multi-task.** Jika `file`, setiap Fargate task punya storage terpisah — user yang dirouting ke task A tidak bisa baca session dari task B, menyebabkan logout acak. |
   | `SESSION_LIFETIME` | `120` | Menit sebelum session expired (idle). |
   | `SESSION_ENCRYPT` | `true` | Payload session dienkripsi dengan `APP_KEY` sebelum disimpan ke Redis. |
   | `CACHE_STORE` | `redis` | Cache Laravel (query cache, config cache) disimpan di ElastiCache. |
   | `QUEUE_CONNECTION` | `redis` | Job queue pakai Redis (siap jika fitur queue diaktifkan di masa depan). |
   | `REDIS_CLIENT` | `phpredis` | Gunakan ekstensi C `phpredis` (sudah di-install di `backend/Dockerfile`). Lebih cepat dan memory-efficient dari `predis` (pure PHP). Tanpa setting eksplisit ini, Laravel bisa salah memilih client. |
   | `REDIS_PORT` | `6379` | Port ElastiCache Redis standar. |
   | `REDIS_PASSWORD` | `` | **Isi string kosong.** ElastiCache tanpa auth token — keamanan ditangani oleh Security Group VPC (`redis-sg` hanya izinkan koneksi dari `ecs-sg`). |
   | `FILESYSTEM_DISK` | `s3` | Laravel simpan file upload ke S3, bukan lokal. Storage lokal Fargate tidak persisten — hilang saat task restart atau scale. |
   | `AWS_BUCKET` | `watertrack-uploads-prod` | Nama bucket S3 untuk file upload pelanggan (dibuat di Bagian 8.2). |
   | `AWS_DEFAULT_REGION` | `ap-southeast-3` | Region untuk S3 bucket dan ElastiCache. |
   | `BCRYPT_ROUNDS` | `12` | Iterasi hash bcrypt untuk password. `12` ≈ 250ms per hash — aman dari brute force. Dev pakai `10` di `.env.docker` untuk kecepatan. |

   > **Tidak perlu `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`:** ECS Fargate menginjeksikan AWS credentials secara otomatis via IAM Task Role (`watertrack-ecs-task-role`) ke dalam container melalui endpoint metadata internal (`169.254.170.2`). AWS SDK Laravel otomatis membaca dari sana. Hardcode credentials adalah risiko keamanan serius — jangan lakukan.

   ---

   #### 8e. Environment Variables — Type `ValueFrom` (Secrets Manager)

   Masih di sub-section **"Environment variables"** yang sama. Untuk variabel sensitif, klik **"Add environment variable"** dan pada dropdown **"Value type"** pilih **`ValueFrom`**.

   Field **"Value"** berubah menjadi input ARN — isi dengan ARN penuh dari Shared Info Sheet [DEV 3]:

   | Key | Value type | Value (ARN) |
   |-----|-----------|------------|
   | `APP_KEY` | `ValueFrom` | `arn:aws:secretsmanager:ap-southeast-3:775755739096:secret:watertrack/app-key-mxSzGu` |
   | `DB_PASSWORD` | `ValueFrom` | `arn:aws:secretsmanager:ap-southeast-3:775755739096:secret:watertrack/db-password-q8hwYQ` |
   | `DB_HOST` | `ValueFrom` | `arn:aws:secretsmanager:ap-southeast-3:775755739096:secret:watertrack/db-host-4Fvid5` |
   | `REDIS_HOST` | `ValueFrom` | `arn:aws:secretsmanager:ap-southeast-3:775755739096:secret:watertrack/redis-host-SGM4I3` |

   **Cara kerjanya:** Sebelum container start, ECS execution role (`watertrack-ecs-execution-role`) memanggil Secrets Manager API untuk mengambil nilai tiap secret, lalu menginjeksikannya sebagai environment variable ke dalam container. Nilai **tidak pernah muncul** di Console ECS, di log CloudWatch, atau di response API describe-task.

   Di task definition JSON, variabel `Value` masuk array `"environment"`, sedangkan `ValueFrom` masuk array `"secrets"` — keduanya tampil sebagai env var biasa di dalam container.

   > **ARN suffix wajib disertakan:** Secrets Manager menambahkan 6 karakter acak di akhir setiap secret ARN (mis. `-mxSzGu`). Copy ARN persis dari Shared Info Sheet termasuk suffix. Jika suffix hilang atau salah, ECS gagal start dengan error: `ResourceNotFoundException: Secrets Manager can't find the specified secret`.

   > **`REDIS_HOST`** — secret berisi hostname ElastiCache **tanpa port** (mis. `clustercfg.watertrack-redis-prod.hxtqnn.apse3.cache.amazonaws.com`). Port sudah di-set terpisah via `REDIS_PORT=6379`. Jangan masukkan hostname dengan `:6379` — port akan di-append dua kali oleh Laravel dan koneksi gagal.

   > **`APP_KEY`** — nilai diawali `base64:` diikuti 44 karakter. Key ini dipakai Laravel untuk enkripsi session dan cookie. Jika key berubah setelah deploy, **semua session aktif user langsung invalid** (semua pengguna ter-logout otomatis).

   ---

   #### 8f. Health Check (Container-Level)

   Sub-section **"Health check"** biasanya **collapsed by default** — klik untuk expand. Health check ini berjalan di dalam container (berbeda dari ALB health check di Bagian 9.5, yang bekerja dari luar).

   | Field | Nilai | Keterangan |
   |-------|-------|-----------|
   | **Command** | `CMD-SHELL,curl -f http://localhost/health \|\| exit 1` | `curl -f` return exit code 1 jika HTTP response bukan 2xx. Route `/health` ada di `routes/web.php`, mengembalikan `{"status":"ok"}` tanpa autentikasi. |
   | **Interval** | `30` | Detik antar pemeriksaan. |
   | **Timeout** | `5` | Detik maksimal sebelum satu pemeriksaan dianggap gagal (timeout). |
   | **Start period** | `60` | Grace period: health check pertama tidak dihitung selama 60 detik pertama setelah container start. Memberi waktu `entrypoint.sh` menjalankan `config:cache`, `route:cache`, `view:cache` sebelum Nginx siap. |
   | **Retries** | `3` | Butuh 3 kali gagal berturut-turut agar container dinyatakan `UNHEALTHY`. |

   > **Perbedaan dua health check:** ALB health check (Bagian 9.5) menentukan apakah task ini menerima traffic dari load balancer. Container health check ini menentukan apakah ECS menandai container `UNHEALTHY` dan mengganti task. Keduanya independen — pastikan keduanya dikonfigurasi.

   ---

   #### 8g. Log Configuration

   Sub-section **"Log configuration"** juga **collapsed by default**. Expand, lalu:

   1. **Log driver** → pilih **`awslogs`** dari dropdown

   Setelah memilih `awslogs`, muncul tabel key/value untuk options. Tambahkan empat baris berikut (klik "Add" untuk tiap baris):

   | Option Key | Value | Keterangan |
   |-----------|-------|-----------|
   | `awslogs-group` | `/ecs/watertrack-api` | Harus **persis sama** dengan nama Log Group yang dibuat di langkah 9.3. Perbedaan satu karakter = container gagal start dengan `ResourceNotFoundException`. |
   | `awslogs-region` | `ap-southeast-3` | Region tempat Log Group berada — harus sama dengan region deployment. |
   | `awslogs-stream-prefix` | `ecs` | Prefix untuk nama log stream. Nama stream otomatis jadi `ecs/watertrack-api/TASK_ID` — memudahkan filter per-task saat debug. |
   | `awslogs-create-group` | `false` | Jangan buat log group otomatis. Log group sudah dibuat manual di langkah 9.3 dengan retention 30 hari. Jika `true` sementara log group sudah ada, tidak error — tapi retention tidak ter-set dan biaya log tidak terkontrol. |

   > **Kenapa `LOG_CHANNEL=stderr`?** Laravel dikonfigurasi menulis semua log ke stderr container. Driver `awslogs` otomatis mengambil seluruh output stdout/stderr dari container dan mengirimnya ke CloudWatch — tanpa perlu log agent tambahan atau konfigurasi tambahan. Ini pola standar untuk containerized apps.

9. **Create** — Task Definition revision 1 berhasil dibuat.

> **Verifikasi setelah create:** Buka Task Definition yang baru dibuat → tab **JSON** → pastikan `"image"` berisi URI ECR yang benar dan semua `"environment"` / `"secrets"` sudah terisi. Ini lebih cepat daripada membuka form lagi.

---

### 9.8 Buat ECS Service

ECS Service memastikan sejumlah task selalu berjalan. Jika satu task crash, Service otomatis menjalankan pengganti. Service juga yang menghubungkan task ke ALB Target Group.

1. **ECS → Clusters → watertrack-cluster → tab Services → Create**
2. **Launch type:** FARGATE
3. **Task definition:** `watertrack-api` — pilih revision terbaru (angka tertinggi)
4. **Service name:** `watertrack-api-service`
5. **Desired tasks:** 2 — minimal 2 untuk high availability (satu task per AZ)
6. **Networking:**
   - **VPC:** watertrack VPC
   - **Subnets:** centang kedua **private** subnet — container tidak boleh langsung dapat IP publik
   - **Security groups:** `ecs-sg` (dari Shared Info Sheet Dev 2)
   - **Public IP:** Turned off
7. **Load balancing:**
   - **Load balancer type:** Application Load Balancer
   - **Load balancer:** `watertrack-alb`
   - **Container to load balance:** `watertrack-api:80:80`
   - **Listener:** pilih `443:HTTPS` (existing)
   - **Target group:** pilih `watertrack-tg` (existing)
   - **Health check grace period:** `120` seconds — memberi waktu entrypoint.sh menjalankan `config:cache`, `route:cache`, `view:cache` sebelum ALB mulai health check. Jika terlalu kecil, task dianggap unhealthy sebelum sempat siap.
8. **Service auto scaling:**
   - Minimum tasks: `2` | Maximum tasks: `6`
   - **Add scaling policy:**
     - Type: Target tracking
     - Metric: `ECSServiceAverageCPUUtilization`
     - Target value: `70`
     - Scale-in cooldown: 300s | Scale-out cooldown: 60s
9. **Create service**

**Monitor proses startup:**
- **ECS → Clusters → watertrack-cluster → Services → watertrack-api-service → tab Tasks**
- Tunggu kolom **Last status**: `PROVISIONING` → `PENDING` → `RUNNING` (~2–4 menit per task)
- Setelah RUNNING, cek **tab Health** di Target Group: harus menunjukkan 2/2 **Healthy**

Jika task terus STOPPED atau stuck di PENDING lebih dari 5 menit:
- **CloudWatch → Log groups → /ecs/watertrack-api** → buka log stream terbaru
- Cari baris error — biasanya masalah DB, APP_KEY, atau pull image gagal

---

### 9.9 Konfigurasi Route 53

Route 53 mengarahkan domain publik ke ALB (API) dan ke CloudFront (frontend).

1. **Route 53 → Hosted zones → pilih zona `aftaza.dev`**
   - Hosted zone sudah ada. Jika belum ada: **Create hosted zone** → masukkan domain → Public → salin 4 nameserver ke registrar, tunggu propagasi NS (bisa 24–48 jam).

2. **Record API (backend):**
   - **Create record**
   - **Record name:** `api` → domain akhir: `api.aftaza.dev`
   - **Record type:** A | **Alias:** ON
   - **Route traffic to:** Alias to Application and Classic Load Balancer → ap-southeast-3 → pilih `watertrack-alb`
   - **Create records**

3. **Record Frontend (CloudFront):**
   - **Create record**
   - **Record name:** (kosong) → domain akhir: `aftaza.dev`
   - **Record type:** A | **Alias:** ON
   - **Route traffic to:** Alias to CloudFront distribution → pilih distribusi `watertrack-frontend-prod`
   - **Create records**

4. **Record WWW (opsional):**
   - **Create record** | Name: `www` | Type: `CNAME` | Value: `aftaza.dev` | TTL: 300

> Record alias AWS aktif dalam **1–5 menit**. Verifikasi dengan `nslookup api.aftaza.dev` — harus mengembalikan IP ALB.

---

### 9.10 Verifikasi Health Check

Lakukan verifikasi bertahap setelah DNS propagasi:

**Langkah 1 — Cek ALB langsung, bypass DNS:**
```bash
# Gunakan DNS name ALB dari Shared Info Sheet
curl -k https://watertrack-alb-xxxx.ap-southeast-3.elb.amazonaws.com/health \
  -H "Host: api.aftaza.dev"
# Expected: {"status":"ok"}
```

**Langkah 2 — Cek via domain:**
```bash
curl https://api.aftaza.dev/health
# Expected: {"status":"ok"}
```

**Langkah 3 — Cek redirect HTTP ke HTTPS:**
```bash
curl -I http://api.aftaza.dev/health
# Expected: HTTP/1.1 301 Moved Permanently
#           Location: https://api.aftaza.dev/health
```

**Langkah 4 — Cek CORS (simulasi request browser):**
```bash
curl -I https://api.aftaza.dev/health \
  -H "Origin: https://aftaza.dev"
# Expected di response header: Access-Control-Allow-Origin: https://aftaza.dev
```

Jika semua langkah berhasil, beritahu tim: **"Gate 2 done — backend running."**

#### Troubleshooting Umum Section 9

| Gejala | Kemungkinan Penyebab | Di mana Cek |
|--------|---------------------|-------------|
| Task terus STOPPED | APP_KEY tidak terbaca / ARN Secret salah | CloudWatch `/ecs/watertrack-api`: cari `RuntimeException: No application encryption key` |
| Task STOPPED dengan exit code 1 | `config:cache` gagal karena tidak bisa konek DB | CloudWatch `/ecs/watertrack-api`: cari `SQLSTATE[HY000]` atau `Connection refused` |
| Task STOPPED: `REDIS_HOST` error | Redis host tidak bisa dijangkau | Cek Security Group `redis-sg` izinkan port 6379 dari `ecs-sg`. Cek `REDIS_CLIENT=phpredis` sudah di-set |
| Task PENDING > 10 menit | ECS tidak bisa pull image ECR (NAT Gateway belum jalan atau permission kurang) | ECS Service → Events tab: cari `CannotPullContainerError` |
| Target group Unhealthy | Container belum siap dalam grace period 120 detik, atau `/health` mengembalikan non-200 | Naikkan grace period ke 180 detik di Service settings. Cek log entrypoint: `config:cache` selesai? |
| `502 Bad Gateway` dari ALB | Container berjalan tapi Nginx crash atau PHP-FPM tidak start | CloudWatch `/ecs/watertrack-api`: cari `[emerg]` nginx atau tidak ada baris `NOTICE: fpm is running` |
| `exec format error` di log | Image ARM dijalankan di X86_64 | Rebuild dengan `--platform linux/amd64` (lihat 9.2.5) |
| `AccessDeniedException` saat read secret | Execution role tidak punya permission Secrets Manager | Cek `WaterTrackSecretsAccess` sudah ter-attach ke `watertrack-ecs-execution-role` (Bagian 7.5) |
| Login berhasil tapi session langsung logout | `APP_KEY` berbeda dari session yang tersimpan, atau Redis tidak bisa konek | Cek `SESSION_DRIVER=redis` dan `REDIS_CLIENT=phpredis` sudah ter-set |

---

## 10. GitHub Actions — CI/CD Pipeline ke ECR & ECS

> **Dikerjakan oleh:** Dev 1 (setelah Gate 2 selesai)
> **Prasyarat:** ECR repository dibuat (Dev 5), ECS Cluster + Service running (Dev 5), CloudFront + S3 siap (Dev 4), IAM OIDC role dibuat (Dev 1 — Bagian 5.4–5.5)

### 10.0 Konsistensi Nama Resource

File workflow `.github/workflows/deploy.yml` sudah ada di repository. Pastikan nama resource AWS yang dibuat di Console **persis sama** dengan konstanta di bagian `env:` pada file tersebut.

| Konstanta di `deploy.yml` | Nilai | Resource AWS yang harus sesuai |
|---------------------------|-------|-------------------------------|
| `ECR_REPOSITORY` | `watertrack-api` | Nama ECR repository (Bagian 9.1) ✅ |
| `ECS_CLUSTER` | `watertrack-cluster` | Nama ECS Cluster (Bagian 9.4) ✅ |
| `ECS_SERVICE` | `watertrack-api-service` | Nama ECS Service (Bagian 9.8) ✅ |
| `CONTAINER_NAME` | `watertrack-api` | Nama container di Task Definition (Bagian 9.7) ✅ |
| `AWS_REGION` | `ap-southeast-3` | Region semua resource ✅ |

Panduan ini (Bagian 9) sudah diselaraskan dengan nilai di atas. Jika kamu perlu mengubah nama resource setelah deploy, ubah keduanya sekaligus: resource di Console **dan** konstanta di `deploy.yml`.

> **Jika deploy gagal di step "Download current ECS task definition":** Pastikan `--task-definition watertrack-api` di step itu sudah ada di ECS (Task Definition family bernama `watertrack-api` sudah pernah dideploy minimal satu kali secara manual sebelum CI/CD bisa mengambilnya).

### 10.1 Alur CI/CD

```
Push ke branch main
       │
       ▼
┌──────────────────────────────────────────────────────────┐
│                   GitHub Actions Trigger                  │
│         on: push: branches: [main]                       │
└─────────────────────┬────────────────────────────────────┘
                      │  (kedua job jalan paralel)
          ┌───────────┴───────────┐
          ▼                       ▼
┌─────────────────────┐ ┌────────────────────────┐
│  Job: deploy-backend│ │  Job: deploy-frontend  │
│                     │ │                        │
│ 1. OIDC → AWS       │ │ 1. OIDC → AWS          │
│ 2. ECR Login        │ │ 2. npm ci (Node 20)    │
│ 3. docker build     │ │ 3. npm run build       │
│    (backend/)       │ │    (VITE_API_BASE_URL) │
│ 4. docker push      │ │ 4. aws s3 sync → S3    │
│    tag: commit SHA  │ │ 5. CloudFront          │
│ 5. Ambil task def   │ │    invalidation /*     │
│    dari ECS         │ │                        │
│ 6. Update image URI │ │                        │
│ 7. Deploy ke ECS    │ │                        │
│    (rolling update) │ │                        │
└─────────────────────┘ └────────────────────────┘
```

### 10.2 Isi File `.github/workflows/deploy.yml`

File ini sudah ada di repository. Berikut isi lengkapnya beserta penjelasan tiap bagian:

```yaml
name: Deploy to AWS

on:
  push:
    branches: [main]   # Hanya trigger saat push/merge ke main

env:
  AWS_REGION: ap-southeast-3
  ECR_REPOSITORY: watertrack-api          # Harus sama dengan nama ECR repo di Console
  ECS_SERVICE: watertrack-api-service     # Harus sama dengan nama ECS Service
  ECS_CLUSTER: watertrack-cluster         # Harus sama dengan nama ECS Cluster
  CONTAINER_NAME: watertrack-api          # Harus sama dengan nama container di Task Definition

permissions:
  id-token: write   # WAJIB: izin GitHub minta OIDC token ke AWS
  contents: read    # Izin baca isi repository

jobs:
  deploy-backend:
    name: Deploy Backend (Laravel)
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Configure AWS credentials (OIDC)
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: ${{ secrets.AWS_ROLE_ARN }}   # ARN dari IAM role watertrack-github-actions-role
          aws-region: ${{ env.AWS_REGION }}

      - name: Login to Amazon ECR
        id: login-ecr
        uses: aws-actions/amazon-ecr-login@v2

      - name: Build, tag, and push Docker image to ECR
        id: build-image
        env:
          ECR_REGISTRY: ${{ steps.login-ecr.outputs.registry }}
          IMAGE_TAG: ${{ github.sha }}     # Tag = commit hash, bukan "latest" — mudah rollback
        run: |
          docker build -t $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG backend/
          docker push $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG
          echo "image=$ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG" >> $GITHUB_OUTPUT

      - name: Download current ECS task definition
        run: |
          aws ecs describe-task-definition \
            --task-definition watertrack-api \
            --query taskDefinition \
            > task-definition.json
          # "watertrack-api" = Task Definition family name yang dibuat di Bagian 9.7

      - name: Update ECS task definition with new image
        id: task-def
        uses: aws-actions/amazon-ecs-render-task-definition@v1
        with:
          task-definition: task-definition.json
          container-name: ${{ env.CONTAINER_NAME }}
          image: ${{ steps.build-image.outputs.image }}

      - name: Deploy to ECS
        uses: aws-actions/amazon-ecs-deploy-task-definition@v1
        with:
          task-definition: ${{ steps.task-def.outputs.task-definition }}
          service: ${{ env.ECS_SERVICE }}
          cluster: ${{ env.ECS_CLUSTER }}
          wait-for-service-stability: true   # Tunggu hingga rolling update selesai sebelum job dinyatakan sukses

  deploy-frontend:
    name: Deploy Frontend (React SPA)
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Configure AWS credentials (OIDC)
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: ${{ secrets.AWS_ROLE_ARN }}
          aws-region: ${{ env.AWS_REGION }}

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: frontend/package-lock.json

      - name: Install dependencies
        working-directory: frontend
        run: npm ci   # ci = install deterministik dari package-lock.json (lebih cepat dari npm install)

      - name: Build SPA
        working-directory: frontend
        env:
          VITE_API_BASE_URL: ${{ secrets.VITE_API_BASE_URL }}   # Inject saat build, bukan runtime
        run: npm run build

      - name: Sync to S3
        run: |
          # File JS/CSS: cache 1 tahun (Vite sudah tambah content hash di nama file)
          aws s3 sync frontend/dist/ s3://${{ secrets.S3_FRONTEND_BUCKET }}/ \
            --delete \
            --cache-control "public, max-age=31536000, immutable" \
            --exclude "index.html"
          # index.html: no-cache (agar browser selalu ambil versi terbaru)
          aws s3 cp frontend/dist/index.html s3://${{ secrets.S3_FRONTEND_BUCKET }}/index.html \
            --cache-control "no-cache, no-store, must-revalidate"

      - name: Invalidate CloudFront cache
        run: |
          aws cloudfront create-invalidation \
            --distribution-id ${{ secrets.CLOUDFRONT_DISTRIBUTION_ID }} \
            --paths "/*"
```

### 10.3 Konfigurasi GitHub Repository Secrets

1. Buka **GitHub → Repository → Settings → Secrets and variables → Actions**
2. Klik **New repository secret** untuk setiap baris berikut:

| Secret Name | Value | Dari mana |
|-------------|-------|-----------|
| `AWS_ROLE_ARN` | `arn:aws:iam::775755739096:role/watertrack-github-actions-role` | Shared Info Sheet → [DEV 1] |
| `VITE_API_BASE_URL` | `https://api.aftaza.dev/api` | Domain API + `/api` di akhir — dibaca `src/lib/api.ts` sebagai `baseURL` Axios |
| `S3_FRONTEND_BUCKET` | `watertrack-frontend-prod` | Shared Info Sheet → [DEV 4] |
| `CLOUDFRONT_DISTRIBUTION_ID` | `E1C3FJ11UUAQM4` | Shared Info Sheet → [DEV 4] |

> **Catatan `VITE_API_BASE_URL`:** Variabel ini di-inject oleh Vite **saat build** (bukan runtime) ke dalam bundle JS. Artinya nilai ini ter-bake ke dalam file `.js` di S3. Jika domain API berubah, harus rebuild dan redeploy frontend. Pastikan nilai diakhiri `/api` (tanpa trailing slash) karena `src/lib/api.ts` langsung append path seperti `/login`, `/admin/customers`, dst.

> **Verifikasi:** Setelah menambahkan, pastikan di halaman Secrets muncul 4 secret tanpa tanda error. Secret yang sudah disimpan tidak bisa dilihat lagi nilainya — jika salah input, delete dan buat ulang.

### 10.4 Verifikasi Koneksi OIDC ke AWS

Sebelum push ke `main` untuk pertama kali, pastikan:

**1. OIDC Provider terdaftar:**
- **IAM → Identity providers** — harus ada entry `token.actions.githubusercontent.com` dengan status **Active**

**2. Trust policy role sudah sesuai repo:**
- **IAM → Roles → watertrack-github-actions-role → Trust relationships**
- Pastikan bagian `Condition` berisi nama repo yang benar:
  ```json
  "StringLike": {
    "token.actions.githubusercontent.com:sub": "repo:YOUR_GITHUB_ORG/WaterTrack:ref:refs/heads/main"
  }
  ```
- Ganti `YOUR_GITHUB_ORG/WaterTrack` dengan owner dan nama repo GitHub yang sebenarnya (perhatikan huruf besar/kecil — harus persis sama)

**3. Permissions role mencakup ECR:**
- **IAM → Roles → watertrack-github-actions-role → Permissions → WaterTrackGitHubActionsPolicy**
- Pastikan ada action `ecr:GetAuthorizationToken` dan `ecr:PutImage` (sudah diset di Bagian 5.5)

### 10.5 Trigger dan Monitor Deploy

```bash
# Dari local repository — push ke main untuk trigger pipeline
git push origin main
```

Monitor di **GitHub → Repository → Actions**:

| Status | Arti | Tindakan |
|--------|------|---------|
| Kuning (running) | Pipeline sedang berjalan | Tunggu, klik untuk lihat live log |
| Hijau (success) | Semua job berhasil | Cek aplikasi di `https://yourdomain.com` |
| Merah (failure) | Ada step yang gagal | Klik job → expand step merah → baca error |

Durasi normal:
- `deploy-backend`: 4–8 menit (docker build + ECS rolling update)
- `deploy-frontend`: 2–4 menit (npm build + S3 sync)

### 10.6 Rollback

**Via ECS Console (rollback backend — paling cepat):**
1. **ECS → Task definitions → watertrack-api** — tampil daftar revision berurutan
2. Centang revision yang ingin di-rollback ke sana (mis. revision 5 sebelum revision 6 yang bermasalah)
3. Klik **Deploy → Update Service**
4. Pilih cluster `watertrack-cluster`, service `watertrack-api-service` → **Update**
5. Pantau di **Services → watertrack-api-service → tab Deployments** sampai status `PRIMARY`

**Via GitHub (re-deploy commit lama):**
```bash
git revert HEAD       # Buat commit revert
git push origin main  # Trigger GitHub Actions dengan kode sebelumnya
```

**Via S3 (rollback frontend):**
- Karena S3 sync menggunakan `--delete`, tidak ada versi lama di S3.
- Gunakan opsi revert di GitHub agar npm build ulang dan re-deploy.

### 10.7 Troubleshooting Umum

| Error | Penyebab | Solusi |
|-------|----------|--------|
| `Not authorized to perform sts:AssumeRoleWithWebIdentity` | OIDC provider belum terdaftar atau `sub` di Trust policy tidak sesuai nama repo | Cek **IAM → Identity providers** dan **Trust relationships** di role |
| `RepositoryNotFoundException: watertrack-api` | Nama ECR di `env.ECR_REPOSITORY` tidak cocok dengan yang dibuat di Console | Sesuaikan `ECR_REPOSITORY` di `deploy.yml` atau rename ECR repo |
| `Service not found: watertrack-api-service` | Nama ECS service tidak cocok | Sesuaikan `ECS_SERVICE` di `deploy.yml` |
| `container name ... not found in task definition` | `CONTAINER_NAME` di workflow ≠ nama container di Task Definition | Edit Task Definition di ECS atau ubah `CONTAINER_NAME` |
| `AccessDeniedException: ecr:GetAuthorizationToken` | Policy IAM role belum mencakup ECR | Tambah permission di `WaterTrackGitHubActionsPolicy` (Bagian 5.5) |
| Frontend deploy sukses tapi site tidak update | CloudFront masih cache konten lama | Tunggu 5–10 menit; atau buka **CloudFront → Invalidations** cek status |
| `npm ci` gagal karena `package-lock.json` tidak ada | `package-lock.json` belum di-commit | Jalankan `npm install` lokal lalu commit `package-lock.json` |

---

## 11. Migrasi Database Pertama Kali

> **Dikerjakan oleh:** Dev 3 (setelah Gate 2)

1. **ECS → Clusters → watertrack-cluster → Tasks tab → Run new task**
2. Konfigurasi:
   - **Launch type:** Fargate
   - **Task definition:** `watertrack-api` (revision terbaru)
3. **Networking:**
   - **VPC:** watertrack VPC
   - **Subnets:** private subnet
   - **Security groups:** `ecs-sg`
   - **Public IP:** Turned off
4. **Container overrides → watertrack-api → Command override:**
   ```
   php,artisan,migrate:fresh,--seed,--force
   ```
   > **Peringatan:** `migrate:fresh` menghapus semua tabel dan data lalu buat ulang dari awal. Gunakan **hanya untuk deploy pertama**. Deploy berikutnya gunakan: `php,artisan,migrate,--force`

   > **Seeder yang dijalankan:** `DatabaseSeeder` akan membuat user default — `admin@example.com`, `operator@example.com`, `kasir@example.com` (semua password `password`). Akun klien dibuat oleh admin/operator setelah login.
5. **Create** dan tunggu task berstatus `STOPPED`
6. Cek log di **CloudWatch → /ecs/watertrack-api** — pastikan tidak ada error migrasi

---

## 12. CloudWatch Alarms + Budget Alert

> **Dikerjakan oleh:** Dev 1 atau Dev 5 (setelah Gate 2)

### 12.1 ECS CPU Alarm

1. **CloudWatch → Alarms → Create alarm → Select metric**
2. **ECS → ClusterName, ServiceName → CPUUtilization**
3. Pilih `watertrack-cluster / watertrack-api-service` → Select metric
4. **Statistic:** Average | **Period:** 5 minutes | **Threshold:** Greater than 80
5. **Notification:** Create SNS topic `watertrack-alarms`, email tim
6. **Alarm name:** `WaterTrack-ECS-HighCPU`

### 12.2 ALB 5xx Error Rate Alarm

1. **Select metric → ApplicationELB → Per AppELB Metrics → HTTPCode_ELB_5XX_Count**
2. Pilih `watertrack-alb`
3. **Statistic:** Sum | **Period:** 1 minute | **Threshold:** Greater than 10
4. SNS topic: `watertrack-alarms`
5. **Alarm name:** `WaterTrack-ALB-High5xx`

### 12.3 RDS Storage Alarm

1. **Select metric → RDS → Per-Database Metrics → FreeStorageSpace**
2. Pilih `watertrack-db-prod`
3. **Statistic:** Average | **Period:** 5 minutes | **Threshold:** Less than `5368709120` (5 GB dalam bytes)
4. **Alarm name:** `WaterTrack-RDS-LowStorage`

### 12.4 Budget Alert

1. **AWS Billing → Budgets → Create budget**
2. **Type:** Cost budget | **Name:** `WaterTrack-Monthly`
3. **Amount:** $150 (sesuaikan kebutuhan)
4. **Alert:** 80% actual spend → kirim email penanggung jawab billing

---

## 13. Checklist Pasca-Deploy

### Smoke Tests

**Backend API:**
- [ ] `https://api.aftaza.dev/health` → `{"status":"ok"}` (route di `routes/web.php`, tanpa auth)
- [ ] `https://api.aftaza.dev/up` → HTTP 200 (Laravel built-in health, tanpa auth)
- [ ] `GET /api/user` tanpa token → `{"message":"Unauthenticated."}` HTTP 401

**Frontend:**
- [ ] `https://aftaza.dev` terbuka, tampil halaman login (React SPA via CloudFront)
- [ ] Refresh di `/dashboard` tidak 404 — CloudFront custom error pages (`403/404 → index.html 200`) bekerja

**Login per Role:**
- [ ] Login `admin@example.com / password` → redirect ke `/dashboard`, menu lengkap
- [ ] Login `operator@example.com / password` → akses ke Pelanggan & Tagihan
- [ ] Login `kasir@example.com / password` → akses ke Kasir (cek tagihan, bayar)
- [ ] Buat akun klien via admin → login sebagai klien → diarahkan ke halaman ganti password (forced change karena `password_changed_at = null`)
- [ ] Setelah ganti password, klien bisa akses `/klien/bills` dan `/klien/profile`

**Fungsionalitas Utama:**
- [ ] Admin: buat pelanggan baru (CRUD Customer) → pelanggan muncul di daftar
- [ ] Operator: generate tagihan periode ini → `php,artisan,bills,generate` atau via UI
- [ ] Operator: catat meteran → `pemakaian = meteran_akhir - meteran_awal` terhitung
- [ ] Kasir: cek tagihan via `id_klien` → tampil tagihan belum bayar
- [ ] Kasir: proses pembayaran → status tagihan berubah `belum_bayar` → `sudah_bayar`
- [ ] Export Excel di halaman Transaksi mengunduh file `.xlsx`
- [ ] Klien: upload template pelanggan berjalan (file tersimpan ke S3 `watertrack-uploads-prod`)

### Security Checks
- [ ] `http://aftaza.dev` redirect ke HTTPS (301 Moved Permanently)
- [ ] `http://api.aftaza.dev/health` redirect ke HTTPS (301)
- [ ] S3 bucket URL langsung (`watertrack-frontend-prod.s3.amazonaws.com`) → HTTP 403 (block public access aktif)
- [ ] GitHub Actions deploy sukses tanpa AWS credentials di repo (OIDC, bukan Access Key)
- [ ] `GET /api/admin/customers` tanpa Bearer token → `{"message":"Unauthenticated."}` HTTP 401
- [ ] `GET /api/admin/customers` dengan token kasir → HTTP 403 atau 401 (role check)

### Infrastructure Checks
- [ ] ECS service `watertrack-api-service`: 2/2 tasks Running
- [ ] ALB target group `watertrack-tg`: 2/2 Healthy
- [ ] CloudWatch log group `/ecs/watertrack-api` menerima log (buka stream terbaru)
- [ ] RDS `watertrack-db-prod`: status Available, Multi-AZ: Yes
- [ ] ElastiCache `watertrack-redis-prod`: status Available, replica aktif
- [ ] CloudFront `E1C3FJ11UUAQM4`: Deployed (bukan In Progress)
- [ ] WAF Web ACL terhubung ke CloudFront distribution
- [ ] Secrets Manager: 4 secret ada dan berstatus `Active`

### Cleanup Setelah Semua Selesai
- [ ] Review permission IAM user dev2–dev5 — lepas managed policy yang sudah tidak relevan pasca-setup awal (mis. `AmazonVPCFullAccess` di `dev2-network` setelah VPC tidak lagi sering diubah), sisakan hanya yang dibutuhkan untuk operasional rutin
- [ ] Verifikasi tidak ada SG yang buka port ke `0.0.0.0/0` selain alb-sg (80/443)
- [ ] Aktifkan AWS CloudTrail untuk audit logging

---

## Referensi Cepat

| Resource | Console URL (region ap-southeast-3 kecuali dinyatakan lain) |
|---------|-------------------------------------------------------------|
| ECS Cluster | `console.aws.amazon.com/ecs/v2/clusters/watertrack-cluster` |
| ECS Service | `console.aws.amazon.com/ecs/v2/clusters/watertrack-cluster/services/watertrack-api-service` |
| ECR Repository | `console.aws.amazon.com/ecr/repositories/private/775755739096/watertrack-api` |
| CloudWatch Logs | `console.aws.amazon.com/cloudwatch/home#logsV2:log-groups/log-group/$252Fecs$252Fwatertrack-api` |
| RDS Instances | `console.aws.amazon.com/rds/home#databases:` |
| ElastiCache | `console.aws.amazon.com/elasticache/home#/redis` |
| CloudFront | `console.aws.amazon.com/cloudfront/v4/home` |
| Secrets Manager | `console.aws.amazon.com/secretsmanager/listsecrets` |
| WAF (us-east-1) | `us-east-1.console.aws.amazon.com/wafv2/homev2/web-acls` |
| GitHub Actions | `github.com/johnnnic/WaterTrack/actions` |

---

*Lihat juga [`docs/deploy-guide.md`](deploy-guide.md) untuk versi CLI (AWS CLI + JSON). Panduan ini menggunakan AWS Console UI untuk kemudahan onboarding.*
