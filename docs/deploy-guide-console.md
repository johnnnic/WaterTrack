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
10. [GitHub Actions — Konfigurasi Secrets Repository](#10-github-actions--konfigurasi-secrets-repository)
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
ARN ECS Execution Role:      arn:aws:iam::ACCOUNT:role/watertrack-ecs-execution-role
ARN ECS Task Role:           arn:aws:iam::ACCOUNT:role/watertrack-ecs-task-role
ARN GitHub Actions Role:     arn:aws:iam::ACCOUNT:role/watertrack-github-actions-role
IAM User Dev 2 (temp):       ____________________________
IAM User Dev 3 (temp):       ____________________________
IAM User Dev 4 (temp):       ____________________________
IAM User Dev 5 (temp):       ____________________________

--- [DEV 2] VPC & NETWORK ---
VPC ID:                      vpc-____________________
Public Subnet AZ-a ID:       subnet-_________________ (10.0.1.0/24)
Public Subnet AZ-b ID:       subnet-_________________ (10.0.2.0/24)
Private Subnet AZ-a ID:      subnet-_________________ (10.0.11.0/24)
Private Subnet AZ-b ID:      subnet-_________________ (10.0.12.0/24)
SG ALB ID:                   sg-_____________________ (alb-sg)
SG ECS ID:                   sg-_____________________ (ecs-sg)
SG RDS ID:                   sg-_____________________ (rds-sg)
SG Redis ID:                 sg-_____________________ (redis-sg)
ACM Certificate ARN (ap-southeast-3):  arn:aws:acm:ap-southeast-3:ACCOUNT:certificate/____
ACM Certificate ARN (us-east-1):       arn:aws:acm:us-east-1:ACCOUNT:certificate/____

--- [DEV 3] DATABASE & SECRETS ---
RDS Endpoint:                ______________________________.rds.amazonaws.com
ElastiCache Endpoint:        ______________________________.cache.amazonaws.com:6379
Secret ARN APP_KEY:          arn:aws:secretsmanager:ap-southeast-3:ACCOUNT:secret:watertrack/app-key-____
Secret ARN DB_PASSWORD:      arn:aws:secretsmanager:ap-southeast-3:ACCOUNT:secret:watertrack/db-password-____
Secret ARN DB_HOST:          arn:aws:secretsmanager:ap-southeast-3:ACCOUNT:secret:watertrack/db-host-____
Secret ARN REDIS_HOST:       arn:aws:secretsmanager:ap-southeast-3:ACCOUNT:secret:watertrack/redis-host-____

--- [DEV 4] FRONTEND & CDN ---
S3 Bucket Frontend:          watertrack-frontend-prod
S3 Bucket Uploads:           watertrack-uploads-prod
CloudFront Distribution ID:  E____________________
CloudFront Domain:           ______________________.cloudfront.net
WAF Web ACL ARN:             arn:aws:wafv2:us-east-1:ACCOUNT:global/webacl/watertrack-waf/____

--- [DEV 5] PLATFORM ---
ECR Repository URI:          ACCOUNT.dkr.ecr.ap-southeast-3.amazonaws.com/watertrack-backend
ECS Cluster ARN:             arn:aws:ecs:ap-southeast-3:ACCOUNT:cluster/watertrack-cluster
ECS Service ARN:             arn:aws:ecs:ap-southeast-3:ACCOUNT:service/watertrack-cluster/watertrack-backend
ALB DNS Name:                watertrack-alb-____.ap-southeast-3.elb.amazonaws.com
ALB ARN:                     arn:aws:elasticloadbalancing:ap-southeast-3:ACCOUNT:loadbalancer/app/watertrack-alb/____
Target Group ARN:            arn:aws:elasticloadbalancing:ap-southeast-3:ACCOUNT:targetgroup/watertrack-tg/____
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

1. Buka **AWS Console → IAM → Users → Create user**
2. Buat 4 user dengan nama: `dev2-network`, `dev3-database`, `dev4-frontend`, `dev5-platform`
3. Untuk setiap user:
   - **User name:** (sesuai di atas)
   - **Provide user access to the AWS Management Console:** centang
   - **Console password:** Auto-generated (catat dan kirim ke developer secara aman)
   - **Users must create a new password at next sign-in:** centang
   - **Permissions:** Attach policies directly → pilih `AdministratorAccess` (sementara, untuk setup awal)

   > **Catatan Keamanan:** Setelah seluruh infrastruktur selesai, hapus `AdministratorAccess` dan ganti dengan policy yang lebih terbatas.

4. Kirim ke masing-masing developer:
   - URL Sign-in: `https://ACCOUNT_ID.signin.aws.amazon.com/console`
   - Username dan password sementara

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
6. **Master username:** `watertrack_admin`
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
4. Tambah lifecycle rule untuk hapus versi lama:
   - **Bucket → Management → Create lifecycle rule**
   - **Rule name:** `delete-old-versions`
   - **Actions:** Permanently delete noncurrent versions
   - **Days after noncurrent:** 90

### 8.3 Buat CloudFront Distribution

1. **CloudFront → Distributions → Create distribution**
2. **Origin:**
   - **Origin domain:** pilih `watertrack-frontend-prod.s3.ap-southeast-3.amazonaws.com`
   - **Origin access:** Origin access control settings (recommended)
   - Klik **Create new OAC**:
     - **Name:** `watertrack-frontend-oac`
     - **Signing behavior:** Sign requests (recommended)
     - **Create**
   - Pilih OAC yang baru dibuat
3. **Default cache behavior:**
   - **Viewer protocol policy:** Redirect HTTP to HTTPS
   - **Allowed HTTP methods:** GET, HEAD
   - **Compress objects automatically:** Yes
   - **Cache policy:** CachingOptimized
4. **Settings:**
   - **Alternate domain names (CNAME):** `yourdomain.com`
   - **Custom SSL certificate:** pilih certificate **us-east-1** dari langkah 6.5
   - **Security policy:** TLSv1.2_2021
   - **Default root object:** `index.html`
5. **Create distribution**

#### 8.3.1 Tambahkan Custom Error Pages (SPA Routing)

Setelah distribution dibuat, klik distribution → tab **Error pages**:
1. **Create custom error response:**
   - HTTP error code: `403` | Response page: `/index.html` | HTTP Response code: `200`
2. **Create custom error response:**
   - HTTP error code: `404` | Response page: `/index.html` | HTTP Response code: `200`

> Ini memastikan React Router bekerja — semua route non-root diarahkan ke index.html.

#### 8.3.2 Update S3 Bucket Policy

Setelah distribution dibuat, CloudFront menampilkan banner **"Copy policy"**:
1. Klik **Copy policy**
2. **S3 → watertrack-frontend-prod → Permissions → Bucket policy → Edit**
3. Paste policy → **Save changes**

Catat **Distribution ID** dan **Domain name** (format: `xxxx.cloudfront.net`) di Shared Info Sheet.

### 8.4 Buat WAF Web ACL

> WAF untuk CloudFront harus dibuat di **us-east-1**. Ganti region.

1. **Ganti region ke us-east-1**
2. **WAF & Shield → Web ACLs → Create web ACL**
3. Konfigurasi:
   - **Resource type:** Amazon CloudFront distributions
   - **Name:** `watertrack-waf`
4. **Add rules → Add managed rule groups:**
   - `AWSManagedRulesCommonRuleSet`
   - `AWSManagedRulesKnownBadInputsRuleSet`
   - `AWSManagedRulesAmazonIpReputationList`
5. **Add rules → Add my own rules:**
   - **Rule name:** `LoginRateLimit`
   - **Rule type:** Rate-based rule
   - **Rate limit:** 100 requests per 5 minutes
   - **Request aggregation:** Source IP address
   - **Scope-down statement:** URI path → `/api/login` (exactly matches)
   - **Action:** Block
6. **Default action:** Allow
7. **Create web ACL**
8. **Associate** ke CloudFront:
   - Pilih Web ACL → **Associated AWS resources → Add AWS resources**
   - Pilih CloudFront distribution `watertrack-frontend-prod`
9. Catat **Web ACL ARN** di Shared Info Sheet
10. **Kembalikan region ke ap-southeast-3**

---

## 9. Dev 5 — ECR + ECS + ALB + Route 53

> **Dikerjakan oleh:** Dev 5
> **Input yang dibutuhkan:** Semua baris di Shared Info Sheet (Gate 1 harus selesai)
> **Output:** ECR URI, ECS Cluster, ECS Service running, ALB DNS, Route 53 records

### 9.1 Buat ECR Repository

1. **ECR → Repositories → Create repository**
2. Konfigurasi:
   - **Visibility:** Private
   - **Repository name:** `watertrack-backend`
   - **Scan on push:** Enable
   - **Encryption:** AES-256
3. **Create repository**
4. Catat **Repository URI** di Shared Info Sheet

### 9.2 Push Docker Image Pertama Kali

Jalankan di terminal lokal dengan Docker dan AWS CLI:

```bash
# Login ke ECR
aws ecr get-login-password --region ap-southeast-3 | \
  docker login --username AWS --password-stdin \
  ACCOUNT_ID.dkr.ecr.ap-southeast-3.amazonaws.com

# Build dari backend/
cd backend/
docker build -t watertrack-backend .

# Tag dan push
docker tag watertrack-backend:latest \
  ACCOUNT_ID.dkr.ecr.ap-southeast-3.amazonaws.com/watertrack-backend:latest

docker push ACCOUNT_ID.dkr.ecr.ap-southeast-3.amazonaws.com/watertrack-backend:latest
```

### 9.3 Buat CloudWatch Log Group

1. **CloudWatch → Log groups → Create log group**
2. **Log group name:** `/ecs/watertrack-backend`
3. **Retention setting:** 30 days
4. **Create**

### 9.4 Buat ECS Cluster

1. **ECS → Clusters → Create cluster**
2. **Cluster name:** `watertrack-cluster`
3. **Infrastructure:** AWS Fargate (serverless)
4. **Monitoring:** Use Container Insights
5. **Create cluster**

### 9.5 Buat Target Group

1. **EC2 → Target groups → Create target group**
2. **Target type:** IP addresses
3. **Target group name:** `watertrack-tg`
4. **Protocol:** HTTP | **Port:** 80
5. **VPC:** pilih VPC watertrack
6. **Health check settings:**
   - **Protocol:** HTTP
   - **Path:** `/health`
   - **Healthy threshold:** 2
   - **Unhealthy threshold:** 3
   - **Timeout:** 5 seconds
   - **Interval:** 30 seconds
   - **Success codes:** 200
7. **Next → Create target group**
8. Catat **Target Group ARN** di Shared Info Sheet

### 9.6 Buat Application Load Balancer (ALB)

1. **EC2 → Load Balancers → Create load balancer → Application Load Balancer**
2. **Basic:**
   - **Name:** `watertrack-alb`
   - **Scheme:** Internet-facing
   - **IP address type:** IPv4
3. **Network mapping:**
   - **VPC:** pilih VPC watertrack
   - Centang kedua AZ, masing-masing pilih **public subnet**
4. **Security groups:** hapus default, pilih `alb-sg`
5. **Listeners:**
   - **Port 443 (HTTPS):** Forward to `watertrack-tg`, certificate dari ACM ap-southeast-3
6. **Create load balancer**
7. Catat **DNS name** dan **ARN** di Shared Info Sheet

#### 9.6.1 Tambah HTTP → HTTPS Redirect

1. **EC2 → Load Balancers → watertrack-alb → Listeners → Add listener**
2. **Protocol:** HTTP | **Port:** 80
3. **Default actions:** Redirect to HTTPS, port 443, status 301
4. **Add**

### 9.7 Buat ECS Task Definition

1. **ECS → Task definitions → Create new task definition**
2. **Task definition family:** `watertrack-backend`
3. **Launch type:** AWS Fargate
4. **OS/Architecture:** Linux/X86_64
5. **Task size:** CPU 0.5 vCPU | Memory 1 GB
6. **Task role:** `watertrack-ecs-task-role`
7. **Task execution role:** `watertrack-ecs-execution-role`
8. **Container:**
   - **Name:** `watertrack-app`
   - **Image URI:** URI dari ECR (Shared Info Sheet)
   - **Port mappings:** Container port 80, Protocol HTTP

   **Environment variables** (pilih type **Value**):
   | Key | Value |
   |-----|-------|
   | APP_ENV | production |
   | APP_DEBUG | false |
   | APP_URL | https://api.yourdomain.com |
   | FRONTEND_URL | https://yourdomain.com |
   | LOG_CHANNEL | stderr |
   | LOG_LEVEL | error |
   | DB_CONNECTION | mysql |
   | DB_PORT | 3306 |
   | DB_DATABASE | water_billing |
   | DB_USERNAME | watertrack_admin |
   | SESSION_DRIVER | redis |
   | SESSION_ENCRYPT | true |
   | CACHE_STORE | redis |
   | QUEUE_CONNECTION | redis |
   | FILESYSTEM_DISK | s3 |
   | AWS_BUCKET | watertrack-uploads-prod |
   | AWS_DEFAULT_REGION | ap-southeast-3 |

   **Environment variables** (pilih type **ValueFrom** — isi dengan ARN dari Shared Info Sheet):
   | Key | ValueFrom |
   |-----|-----------|
   | APP_KEY | ARN Secret `watertrack/app-key` |
   | DB_PASSWORD | ARN Secret `watertrack/db-password` |
   | DB_HOST | ARN Secret `watertrack/db-host` |
   | REDIS_HOST | ARN Secret `watertrack/redis-host` |

   > ARN harus lengkap termasuk suffix (mis. `-AbCdEf`). Copy persis dari Shared Info Sheet.

   **Logging:**
   - Use log collection: awslogs
   - Log group: `/ecs/watertrack-backend`
   - Region: ap-southeast-3
   - Stream prefix: ecs

9. **Create**

### 9.8 Buat ECS Service

1. **ECS → Clusters → watertrack-cluster → Services → Create**
2. **Launch type:** FARGATE
3. **Task definition:** `watertrack-backend` (revision terbaru)
4. **Service name:** `watertrack-backend`
5. **Desired tasks:** 2
6. **Networking:**
   - **VPC:** watertrack VPC
   - **Subnets:** kedua **private** subnet
   - **Security groups:** `ecs-sg`
   - **Public IP:** Turned off
7. **Load balancing:**
   - **Load balancer:** `watertrack-alb`
   - **Container:** `watertrack-app:80:80`
   - **Listener:** port 443 (existing)
   - **Target group:** `watertrack-tg` (existing)
   - **Health check grace period:** 120 seconds
8. **Service auto scaling:**
   - Minimum tasks: 2 | Maximum tasks: 6
   - **Add scaling policy:**
     - Type: Target tracking
     - Metric: ECSServiceAverageCPUUtilization
     - Target value: 70
9. **Create service**

Tunggu hingga 2/2 tasks berstatus **Running**.

### 9.9 Konfigurasi Route 53

1. **Route 53 → Hosted zones → pilih zona domain**
   - Jika belum ada: **Create hosted zone**, masukkan domain, pilih Public. Salin nameserver ke registrar domain.

2. **Record API (backend):**
   - **Create record** | Name: `api` | Type: A | Alias: on
   - Route traffic to: ALB di ap-southeast-3 → pilih `watertrack-alb`

3. **Record Frontend (CloudFront):**
   - **Create record** | Name: (kosong) | Type: A | Alias: on
   - Route traffic to: CloudFront distribution → pilih `watertrack-frontend-prod`

4. **Record WWW (opsional):**
   - **Create record** | Name: `www` | Type: CNAME | Value: `yourdomain.com`

### 9.10 Verifikasi Health Check

Setelah DNS propagasi (5–30 menit):

```bash
curl https://api.yourdomain.com/health
# Expected: {"status":"ok"}
```

Jika sukses, beritahu tim: **"Gate 2 done."**

---

## 10. GitHub Actions — Konfigurasi Secrets Repository

> **Dikerjakan oleh:** Dev 1 (setelah Gate 2)

1. **GitHub → Repository → Settings → Secrets and variables → Actions**
2. **New repository secret** untuk setiap item:

| Secret Name | Value |
|-------------|-------|
| `AWS_ROLE_ARN` | ARN `watertrack-github-actions-role` dari Shared Info Sheet |
| `VITE_API_BASE_URL` | `https://api.yourdomain.com/api` |
| `S3_FRONTEND_BUCKET` | `watertrack-frontend-prod` |
| `CLOUDFRONT_DISTRIBUTION_ID` | Distribution ID dari Shared Info Sheet |

3. Pastikan `.github/workflows/deploy.yml` sudah ada di repository.
4. Test deploy: push perubahan kecil ke branch `main` → monitor **Actions tab** di GitHub.

---

## 11. Migrasi Database Pertama Kali

> **Dikerjakan oleh:** Dev 3 (setelah Gate 2)

1. **ECS → Clusters → watertrack-cluster → Tasks tab → Run new task**
2. Konfigurasi:
   - **Launch type:** Fargate
   - **Task definition:** `watertrack-backend` (revision terbaru)
3. **Networking:**
   - **VPC:** watertrack VPC
   - **Subnets:** private subnet
   - **Security groups:** `ecs-sg`
   - **Public IP:** Turned off
4. **Container overrides → watertrack-app → Command override:**
   ```
   php,artisan,migrate:fresh,--seed,--force
   ```
   > **Peringatan:** `migrate:fresh` hapus semua data. Gunakan hanya untuk deploy pertama. Deploy berikutnya: `php,artisan,migrate,--force`
5. **Create** dan tunggu task berstatus `STOPPED`
6. Cek log di **CloudWatch → /ecs/watertrack-backend** — pastikan tidak ada error

---

## 12. CloudWatch Alarms + Budget Alert

> **Dikerjakan oleh:** Dev 1 atau Dev 5 (setelah Gate 2)

### 12.1 ECS CPU Alarm

1. **CloudWatch → Alarms → Create alarm → Select metric**
2. **ECS → ClusterName, ServiceName → CPUUtilization**
3. Pilih `watertrack-cluster / watertrack-backend` → Select metric
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
- [ ] `https://yourdomain.com` terbuka (React SPA)
- [ ] `https://api.yourdomain.com/health` → `{"status":"ok"}`
- [ ] Login `admin@example.com / password` berhasil
- [ ] Login `operator@example.com / password` berhasil
- [ ] Login `kasir@example.com / password` berhasil
- [ ] Export Excel di halaman Transaksi mengunduh file .xlsx
- [ ] Upload template pelanggan berjalan

### Security Checks
- [ ] `http://yourdomain.com` redirect ke HTTPS (301)
- [ ] S3 bucket langsung: akses tanpa CloudFront → 403
- [ ] GitHub Actions deploy sukses tanpa AWS credentials di repo
- [ ] `GET /api/admin/customers` tanpa Bearer token → 401

### Infrastructure Checks
- [ ] ECS service: 2/2 tasks Running
- [ ] ALB target group: 2/2 Healthy
- [ ] CloudWatch log group menerima log
- [ ] RDS Multi-AZ: aktif
- [ ] Redis replica: aktif
- [ ] CloudFront status: Enabled
- [ ] WAF terhubung ke CloudFront

### Cleanup Setelah Semua Selesai
- [ ] Hapus `AdministratorAccess` dari IAM user dev2–dev5
- [ ] Verifikasi tidak ada SG yang buka port ke `0.0.0.0/0` selain alb-sg (80/443)
- [ ] Aktifkan AWS CloudTrail untuk audit logging

---

## Referensi Cepat

| Resource | Console URL |
|---------|-------------|
| ECS Cluster | `console.aws.amazon.com/ecs/v2/clusters/watertrack-cluster` |
| ECR Repository | `console.aws.amazon.com/ecr/repositories/watertrack-backend` |
| RDS Instances | `console.aws.amazon.com/rds/home#databases:` |
| ElastiCache | `console.aws.amazon.com/elasticache/home#/redis` |
| CloudFront | `console.aws.amazon.com/cloudfront/v4/home` |
| Secrets Manager | `console.aws.amazon.com/secretsmanager/listsecrets` |
| CloudWatch Logs | `console.aws.amazon.com/cloudwatch/home#logsV2:log-groups` |
| WAF (us-east-1) | `us-east-1.console.aws.amazon.com/wafv2/homev2/web-acls` |
| GitHub Actions | `github.com/YOUR_ORG/WaterTrack/actions` |

---

*Lihat juga [`docs/deploy-guide.md`](deploy-guide.md) untuk versi CLI (AWS CLI + JSON). Panduan ini menggunakan AWS Console UI untuk kemudahan onboarding.*
