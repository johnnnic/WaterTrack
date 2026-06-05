# WaterTrack — Panduan Deploy AWS Production

**Author:** Aftaza  
**Tanggal:** 2026-06-05  
**Stack:** Laravel 12 + React 18 | AWS Region: `ap-southeast-3` (Jakarta)

> Panduan ini mencakup setup lengkap dari nol hingga aplikasi live, termasuk IAM multi-user, semua infrastruktur AWS, CI/CD otomatis, dan monitoring.

---

## Daftar Isi

1. [Prasyarat](#1-prasyarat)
2. [IAM — Multi-User Setup](#2-iam--multi-user-setup)
3. [Networking — VPC & Security Groups](#3-networking--vpc--security-groups)
4. [ECR — Container Registry](#4-ecr--container-registry)
5. [RDS MySQL — Database](#5-rds-mysql--database)
6. [ElastiCache Redis — Cache & Session](#6-elasticache-redis--cache--session)
7. [Secrets Manager — Credentials](#7-secrets-manager--credentials)
8. [ECS Fargate — Backend API](#8-ecs-fargate--backend-api)
9. [Application Load Balancer](#9-application-load-balancer)
10. [S3 — Frontend & File Upload](#10-s3--frontend--file-upload)
11. [CloudFront + WAF — CDN & Proteksi](#11-cloudfront--waf--cdn--proteksi)
12. [Route 53 — Domain](#12-route-53--domain)
13. [GitHub Actions — CI/CD](#13-github-actions--cicd)
14. [Deploy Pertama — Database Migration](#14-deploy-pertama--database-migration)
15. [CloudWatch — Monitoring & Alerting](#15-cloudwatch--monitoring--alerting)
16. [Checklist Go-Live](#16-checklist-go-live)

---

## 1. Prasyarat

Sebelum mulai, pastikan tersedia:

| Item | Detail |
|---|---|
| AWS Account | 1 akun, billing diaktifkan |
| Domain | Misal: `watertrack.id` (beli di Route 53 atau registrar lain) |
| GitHub Repo | Kode sudah di-push ke `github.com/<org>/WaterTrack` |
| AWS CLI | Terinstall di lokal: `aws --version` |
| Docker Desktop | Untuk test build image secara lokal |

**Install AWS CLI (jika belum):**
```bash
# Windows (PowerShell)
winget install Amazon.AWSCLI
aws configure  # masukkan Access Key admin sementara
```

---

## 2. IAM — Multi-User Setup

> **Prinsip:** Satu akun AWS, beberapa user dengan akses minimal sesuai peran masing-masing. Tidak ada user yang memakai root account untuk kerja sehari-hari.

### 2.1 Aktifkan MFA di Root Account

1. Login AWS Console → klik nama akun (kanan atas) → **Security credentials**
2. **Multi-factor authentication (MFA)** → **Assign MFA device**
3. Pilih **Authenticator app** → scan QR dengan Google Authenticator
4. Setelah MFA aktif, **jangan gunakan root account lagi** untuk aktivitas harian

### 2.2 Buat IAM Users

Buka **IAM Console** → **Users** → **Create user**

#### User: `watertrack-admin`
Untuk setup awal infrastruktur. Setelah selesai, nonaktifkan access key-nya.

**Permissions:** Attach policy `AdministratorAccess`  
**MFA:** Wajib aktifkan

```bash
aws iam create-user --user-name watertrack-admin
aws iam attach-user-policy \
  --user-name watertrack-admin \
  --policy-arn arn:aws:iam::aws:policy/AdministratorAccess
```

#### User: `watertrack-developer`
Untuk developer yang perlu deploy, lihat logs, update ECS.

Buat **custom policy** bernama `WaterTrackDeveloperPolicy`:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ECRAccess",
      "Effect": "Allow",
      "Action": [
        "ecr:GetAuthorizationToken",
        "ecr:BatchCheckLayerAvailability",
        "ecr:GetDownloadUrlForLayer",
        "ecr:BatchGetImage",
        "ecr:PutImage",
        "ecr:InitiateLayerUpload",
        "ecr:UploadLayerPart",
        "ecr:CompleteLayerUpload",
        "ecr:DescribeRepositories",
        "ecr:ListImages"
      ],
      "Resource": "*"
    },
    {
      "Sid": "ECSReadDeploy",
      "Effect": "Allow",
      "Action": [
        "ecs:DescribeClusters",
        "ecs:DescribeServices",
        "ecs:DescribeTaskDefinition",
        "ecs:DescribeTasks",
        "ecs:ListTasks",
        "ecs:RegisterTaskDefinition",
        "ecs:UpdateService",
        "ecs:RunTask",
        "ecs:StopTask"
      ],
      "Resource": "*"
    },
    {
      "Sid": "LogsRead",
      "Effect": "Allow",
      "Action": [
        "logs:GetLogEvents",
        "logs:FilterLogEvents",
        "logs:DescribeLogGroups",
        "logs:DescribeLogStreams"
      ],
      "Resource": "*"
    },
    {
      "Sid": "S3FrontendDeploy",
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:DeleteObject", "s3:ListBucket"],
      "Resource": [
        "arn:aws:s3:::watertrack-frontend",
        "arn:aws:s3:::watertrack-frontend/*"
      ]
    },
    {
      "Sid": "CloudFrontInvalidate",
      "Effect": "Allow",
      "Action": ["cloudfront:CreateInvalidation"],
      "Resource": "*"
    },
    {
      "Sid": "PassRoleForECS",
      "Effect": "Allow",
      "Action": "iam:PassRole",
      "Resource": [
        "arn:aws:iam::ACCOUNT_ID:role/watertrack-ecs-task-role",
        "arn:aws:iam::ACCOUNT_ID:role/watertrack-ecs-execution-role"
      ]
    }
  ]
}
```

```bash
# Ganti ACCOUNT_ID dengan ID akun AWS kamu (12 digit angka)
aws iam create-policy \
  --policy-name WaterTrackDeveloperPolicy \
  --policy-document file://iam-developer-policy.json

aws iam create-user --user-name watertrack-developer
aws iam attach-user-policy \
  --user-name watertrack-developer \
  --policy-arn arn:aws:iam::ACCOUNT_ID:policy/WaterTrackDeveloperPolicy
```

#### User: `watertrack-readonly`
Untuk monitoring, auditor, atau stakeholder yang hanya perlu lihat dashboard.

```bash
aws iam create-user --user-name watertrack-readonly
aws iam attach-user-policy \
  --user-name watertrack-readonly \
  --policy-arn arn:aws:iam::aws:policy/ReadOnlyAccess
```

### 2.3 Buat IAM Roles untuk AWS Services

#### Role: `watertrack-ecs-execution-role`
Dipakai ECS untuk pull image dari ECR dan fetch secrets dari Secrets Manager saat container startup.

```bash
cat > trust-ecs.json << 'EOF'
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": {"Service": "ecs-tasks.amazonaws.com"},
    "Action": "sts:AssumeRole"
  }]
}
EOF

aws iam create-role \
  --role-name watertrack-ecs-execution-role \
  --assume-role-policy-document file://trust-ecs.json

aws iam attach-role-policy \
  --role-name watertrack-ecs-execution-role \
  --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy

aws iam attach-role-policy \
  --role-name watertrack-ecs-execution-role \
  --policy-arn arn:aws:iam::aws:policy/SecretsManagerReadWrite
```

#### Role: `watertrack-ecs-task-role`
Dipakai aplikasi Laravel di dalam container untuk akses S3 (file upload pelanggan).

```bash
aws iam create-role \
  --role-name watertrack-ecs-task-role \
  --assume-role-policy-document file://trust-ecs.json

cat > task-s3-policy.json << 'EOF'
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"],
    "Resource": "arn:aws:s3:::watertrack-uploads/*"
  }]
}
EOF

aws iam put-role-policy \
  --role-name watertrack-ecs-task-role \
  --policy-name S3UploadsAccess \
  --policy-document file://task-s3-policy.json
```

#### Role: `watertrack-github-actions-role`
Dipakai GitHub Actions via OIDC — **tanpa menyimpan AWS keys sebagai secret di GitHub**.

```bash
# 1. Tambah GitHub OIDC provider ke AWS (sekali saja per akun)
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com \
  --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1

# 2. Buat trust policy — ganti ORG dan REPO_NAME
cat > trust-github.json << 'EOF'
{
  "Version": "2012-10-17",
  "Statement": [{
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
        "token.actions.githubusercontent.com:sub": "repo:ORG/WaterTrack:ref:refs/heads/main"
      }
    }
  }]
}
EOF

aws iam create-role \
  --role-name watertrack-github-actions-role \
  --assume-role-policy-document file://trust-github.json

aws iam attach-role-policy \
  --role-name watertrack-github-actions-role \
  --policy-arn arn:aws:iam::ACCOUNT_ID:policy/WaterTrackDeveloperPolicy
```

---

## 3. Networking — VPC & Security Groups

> Semua resource backend (ECS, RDS, ElastiCache) berada di **private subnet** — tidak punya public IP dan tidak bisa diakses langsung dari internet. Hanya ALB yang public.

### 3.1 Buat VPC

**VPC Console** → **Create VPC** → pilih **VPC and more**

| Setting | Value |
|---|---|
| Name | `watertrack-vpc` |
| IPv4 CIDR | `10.0.0.0/16` |
| Availability Zones | 2 (ap-southeast-3a, ap-southeast-3b) |
| Public subnets | 2 (untuk ALB) |
| Private subnets | 2 (untuk ECS, RDS, ElastiCache) |
| NAT Gateways | 1 (cukup untuk non-critical; tambah jadi 2 jika butuh HA penuh) |
| DNS hostnames | ✅ Enable |
| DNS resolution | ✅ Enable |

AWS otomatis buat:
- Public subnets: `10.0.1.0/24` (AZ-a), `10.0.2.0/24` (AZ-b)
- Private subnets: `10.0.3.0/24` (AZ-a), `10.0.4.0/24` (AZ-b)
- Internet Gateway, Route Tables, NAT Gateway

### 3.2 Buat Security Groups

Buka **VPC Console** → **Security Groups** → **Create security group**

#### SG: `watertrack-alb-sg`
Untuk ALB — terima traffic dari seluruh internet.

| Direction | Type | Port | Source |
|---|---|---|---|
| Inbound | HTTP | 80 | 0.0.0.0/0 |
| Inbound | HTTPS | 443 | 0.0.0.0/0 |

#### SG: `watertrack-ecs-sg`
Untuk ECS tasks — hanya terima traffic dari ALB.

| Direction | Type | Port | Source |
|---|---|---|---|
| Inbound | Custom TCP | 80 | `watertrack-alb-sg` |

#### SG: `watertrack-rds-sg`
Untuk RDS — hanya terima dari ECS tasks.

| Direction | Type | Port | Source |
|---|---|---|---|
| Inbound | MySQL/Aurora | 3306 | `watertrack-ecs-sg` |

#### SG: `watertrack-redis-sg`
Untuk ElastiCache — hanya terima dari ECS tasks.

| Direction | Type | Port | Source |
|---|---|---|---|
| Inbound | Custom TCP | 6379 | `watertrack-ecs-sg` |

---

## 4. ECR — Container Registry

```bash
# Buat repository untuk backend image
aws ecr create-repository \
  --repository-name watertrack-api \
  --region ap-southeast-3 \
  --image-scanning-configuration scanOnPush=true \
  --encryption-configuration encryptionType=AES256

# Output berisi repositoryUri, catat:
# ACCOUNT_ID.dkr.ecr.ap-southeast-3.amazonaws.com/watertrack-api
```

**Lifecycle policy** — hapus image lama otomatis (hemat storage cost):

```bash
aws ecr put-lifecycle-policy \
  --repository-name watertrack-api \
  --lifecycle-policy-text '{
    "rules": [{
      "rulePriority": 1,
      "description": "Keep last 10 images",
      "selection": {
        "tagStatus": "any",
        "countType": "imageCountMoreThan",
        "countNumber": 10
      },
      "action": {"type": "expire"}
    }]
  }'
```

**Test build Docker image lokal** (opsional, butuh PHP 8.2):
```bash
cd backend
docker build -t watertrack-api:local .
docker run -p 8080:80 \
  -e APP_KEY=base64:test \
  -e APP_ENV=production \
  -e APP_DEBUG=false \
  -e DB_CONNECTION=sqlite \
  watertrack-api:local

# Cek health
curl http://localhost:8080/health
```

---

## 5. RDS MySQL — Database

**RDS Console** → **Create database** → **Standard create**

| Setting | Value |
|---|---|
| Engine | MySQL 8.0 |
| Template | **Production** |
| DB instance identifier | `watertrack-db` |
| Master username | `watertrack` |
| Master password | Generate otomatis → simpan ke Secrets Manager (langkah 7) |
| DB instance class | `db.t3.small` |
| Storage type | gp3 |
| Allocated storage | 20 GB |
| Enable storage autoscaling | ✅ Max 100 GB |
| Multi-AZ deployment | ✅ **Yes — Create a standby instance** |
| VPC | `watertrack-vpc` |
| DB subnet group | Buat baru → pilih 2 **private** subnets |
| VPC security group | `watertrack-rds-sg` |
| Public access | ❌ **No** |
| Initial database name | `water_billing` |
| Backup retention | 7 days |
| Enable automated backups | ✅ |
| Encryption | ✅ Enable — AWS managed key |
| Enhanced monitoring | ✅ 60 seconds |
| Performance Insights | ✅ Enable |
| Deletion protection | ✅ **Enable** |

> Setelah RDS terbuat (5–10 menit), catat **Endpoint** di tab Connectivity. Format: `watertrack-db.xxxxxxxx.ap-southeast-3.rds.amazonaws.com`

---

## 6. ElastiCache Redis — Cache & Session

**ElastiCache Console** → **Redis OSS caches** → **Create Redis OSS cache**

| Setting | Value |
|---|---|
| Name | `watertrack-redis` |
| Engine version | Redis 7.x |
| Node type | `cache.t3.micro` |
| Number of replicas | 0 (bisa tambah ke 1 jika butuh HA) |
| Subnet group | Buat baru → pilih 2 **private** subnets |
| Security groups | `watertrack-redis-sg` |
| Encryption at rest | ✅ Enable |
| Encryption in transit | ✅ Enable |

> Setelah cluster terbuat, catat **Primary endpoint**. Format: `watertrack-redis.xxxxxx.0001.apse3.cache.amazonaws.com:6379`

---

## 7. Secrets Manager — Credentials

> Semua credentials production disimpan di Secrets Manager, bukan hardcoded di environment variables. ECS task akan fetch secret ini saat startup via IAM role.

**Generate APP_KEY Laravel** (jalankan di lokal atau di container):
```bash
# Jika punya PHP 8.2 di lokal:
php -r "echo 'base64:' . base64_encode(random_bytes(32)) . PHP_EOL;"

# Atau via Docker:
docker run --rm php:8.2-alpine php -r "echo 'base64:' . base64_encode(random_bytes(32)) . PHP_EOL;"
```

**Simpan secrets:**
```bash
aws secretsmanager create-secret \
  --name "watertrack/production" \
  --region ap-southeast-3 \
  --secret-string '{
    "APP_KEY": "base64:HASIL_GENERATE_DI_ATAS",
    "DB_PASSWORD": "PASSWORD_RDS_YANG_DIGENERATE",
    "DB_HOST": "watertrack-db.xxxxxxxx.ap-southeast-3.rds.amazonaws.com",
    "REDIS_HOST": "watertrack-redis.xxxxxx.0001.apse3.cache.amazonaws.com"
  }'

# Catat ARN yang muncul di output
# arn:aws:secretsmanager:ap-southeast-3:ACCOUNT_ID:secret:watertrack/production-XXXXXX
```

---

## 8. ECS Fargate — Backend API

### 8.1 Buat ECS Cluster

```bash
aws ecs create-cluster \
  --cluster-name watertrack-cluster \
  --region ap-southeast-3 \
  --capacity-providers FARGATE \
  --default-capacity-provider-strategy capacityProvider=FARGATE,weight=1
```

### 8.2 Buat CloudWatch Log Group

```bash
aws logs create-log-group \
  --log-group-name /ecs/watertrack-api \
  --region ap-southeast-3

# Retention 30 hari
aws logs put-retention-policy \
  --log-group-name /ecs/watertrack-api \
  --retention-in-days 30 \
  --region ap-southeast-3
```

### 8.3 Buat ECS Task Definition

Buat file **`task-definition.json`** di lokal (jangan commit ke git — berisi ARN sensitif):

```json
{
  "family": "watertrack-api",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "512",
  "memory": "1024",
  "executionRoleArn": "arn:aws:iam::ACCOUNT_ID:role/watertrack-ecs-execution-role",
  "taskRoleArn": "arn:aws:iam::ACCOUNT_ID:role/watertrack-ecs-task-role",
  "containerDefinitions": [
    {
      "name": "watertrack-api",
      "image": "ACCOUNT_ID.dkr.ecr.ap-southeast-3.amazonaws.com/watertrack-api:latest",
      "portMappings": [{"containerPort": 80, "protocol": "tcp"}],
      "essential": true,
      "environment": [
        {"name": "APP_NAME",        "value": "WaterTrack"},
        {"name": "APP_ENV",         "value": "production"},
        {"name": "APP_DEBUG",       "value": "false"},
        {"name": "APP_URL",         "value": "https://api.watertrack.id"},
        {"name": "APP_LOCALE",      "value": "id"},
        {"name": "LOG_CHANNEL",     "value": "stderr"},
        {"name": "LOG_LEVEL",       "value": "error"},
        {"name": "DB_CONNECTION",   "value": "mysql"},
        {"name": "DB_PORT",         "value": "3306"},
        {"name": "DB_DATABASE",     "value": "water_billing"},
        {"name": "DB_USERNAME",     "value": "watertrack"},
        {"name": "SESSION_DRIVER",  "value": "redis"},
        {"name": "SESSION_LIFETIME","value": "120"},
        {"name": "SESSION_ENCRYPT", "value": "true"},
        {"name": "CACHE_STORE",     "value": "redis"},
        {"name": "QUEUE_CONNECTION","value": "redis"},
        {"name": "REDIS_CLIENT",    "value": "phpredis"},
        {"name": "REDIS_PORT",      "value": "6379"},
        {"name": "FILESYSTEM_DISK", "value": "s3"},
        {"name": "AWS_DEFAULT_REGION","value": "ap-southeast-3"},
        {"name": "AWS_BUCKET",      "value": "watertrack-uploads"},
        {"name": "FRONTEND_URL",    "value": "https://watertrack.id"},
        {"name": "BCRYPT_ROUNDS",   "value": "12"}
      ],
      "secrets": [
        {
          "name": "APP_KEY",
          "valueFrom": "arn:aws:secretsmanager:ap-southeast-3:ACCOUNT_ID:secret:watertrack/production:APP_KEY::"
        },
        {
          "name": "DB_PASSWORD",
          "valueFrom": "arn:aws:secretsmanager:ap-southeast-3:ACCOUNT_ID:secret:watertrack/production:DB_PASSWORD::"
        },
        {
          "name": "DB_HOST",
          "valueFrom": "arn:aws:secretsmanager:ap-southeast-3:ACCOUNT_ID:secret:watertrack/production:DB_HOST::"
        },
        {
          "name": "REDIS_HOST",
          "valueFrom": "arn:aws:secretsmanager:ap-southeast-3:ACCOUNT_ID:secret:watertrack/production:REDIS_HOST::"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/watertrack-api",
          "awslogs-region": "ap-southeast-3",
          "awslogs-stream-prefix": "ecs"
        }
      },
      "healthCheck": {
        "command": ["CMD-SHELL", "curl -f http://localhost/health || exit 1"],
        "interval": 30,
        "timeout": 5,
        "retries": 3,
        "startPeriod": 60
      }
    }
  ]
}
```

```bash
aws ecs register-task-definition \
  --cli-input-json file://task-definition.json \
  --region ap-southeast-3
```

### 8.4 Buat ECS Service

> Lakukan ini **setelah** ALB dan target group terbuat (langkah 9).

```bash
aws ecs create-service \
  --cluster watertrack-cluster \
  --service-name watertrack-api-service \
  --task-definition watertrack-api \
  --desired-count 2 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={
    subnets=[PRIVATE_SUBNET_1_ID,PRIVATE_SUBNET_2_ID],
    securityGroups=[WATERTRACK_ECS_SG_ID],
    assignPublicIp=DISABLED
  }" \
  --load-balancers "targetGroupArn=ARN_TARGET_GROUP,containerName=watertrack-api,containerPort=80" \
  --health-check-grace-period-seconds 120 \
  --deployment-configuration "maximumPercent=200,minimumHealthyPercent=100" \
  --region ap-southeast-3
```

### 8.5 Auto Scaling

```bash
# Register scalable target
aws application-autoscaling register-scalable-target \
  --service-namespace ecs \
  --resource-id service/watertrack-cluster/watertrack-api-service \
  --scalable-dimension ecs:service:DesiredCount \
  --min-capacity 2 \
  --max-capacity 10

# Scale out jika request per target > 1000/menit
aws application-autoscaling put-scaling-policy \
  --service-namespace ecs \
  --resource-id service/watertrack-cluster/watertrack-api-service \
  --scalable-dimension ecs:service:DesiredCount \
  --policy-name watertrack-request-scaling \
  --policy-type TargetTrackingScaling \
  --target-tracking-scaling-policy-configuration '{
    "TargetValue": 1000,
    "PredefinedMetricSpecification": {
      "PredefinedMetricType": "ALBRequestCountPerTarget",
      "ResourceLabel": "app/watertrack-alb/XXXXXXXX/targetgroup/watertrack-tg/XXXXXXXX"
    },
    "ScaleInCooldown": 300,
    "ScaleOutCooldown": 60
  }'
```

> **ResourceLabel** didapat dari ARN ALB dan target group. Format: `app/<alb-name>/<alb-id>/targetgroup/<tg-name>/<tg-id>`

---

## 9. Application Load Balancer

**EC2 Console** → **Load Balancers** → **Create load balancer** → **Application Load Balancer**

| Setting | Value |
|---|---|
| Name | `watertrack-alb` |
| Scheme | **Internet-facing** |
| IP address type | IPv4 |
| VPC | `watertrack-vpc` |
| Availability Zones | Pilih **kedua public subnets** |
| Security groups | `watertrack-alb-sg` |

### 9.1 Request SSL Certificate di ACM

Sebelum setup listener HTTPS, buat certificate dulu:

**Certificate Manager Console** → **Request certificate** → **Request public certificate**

1. Domain names: `api.watertrack.id` dan `*.watertrack.id`
2. Validation method: **DNS validation**
3. Klik **Request** → buka certificate yang dibuat → **Create records in Route 53**
4. Tunggu status **Issued** (~5 menit)

### 9.2 Setup Listeners

**Listener 1 — HTTP:80:**
- Default action: **Redirect** ke HTTPS:443 (Permanent — 301)

**Listener 2 — HTTPS:443:**
- Default action: **Forward** ke target group `watertrack-tg`
- Certificate: pilih dari ACM

### 9.3 Buat Target Group

**EC2 Console** → **Target Groups** → **Create target group**

| Setting | Value |
|---|---|
| Target type | **IP addresses** |
| Target group name | `watertrack-tg` |
| Protocol | HTTP |
| Port | 80 |
| VPC | `watertrack-vpc` |
| Health check protocol | HTTP |
| Health check path | **`/health`** |
| Healthy threshold | 2 |
| Unhealthy threshold | 3 |
| Timeout | 5 seconds |
| Interval | 30 seconds |

> Tidak perlu daftarkan IP manual — ECS yang akan auto-register task IP saat service berjalan.

> Catat **ALB DNS name** (format: `watertrack-alb-XXXXXX.ap-southeast-3.elb.amazonaws.com`) dan **target group ARN**.

---

## 10. S3 — Frontend & File Upload

### 10.1 Bucket Frontend (React SPA)

```bash
aws s3api create-bucket \
  --bucket watertrack-frontend \
  --region ap-southeast-3 \
  --create-bucket-configuration LocationConstraint=ap-southeast-3

# Block semua public access (akses via CloudFront OAC, bukan direct public)
aws s3api put-public-access-block \
  --bucket watertrack-frontend \
  --public-access-block-configuration \
    "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"
```

### 10.2 Bucket File Upload (Laravel)

```bash
aws s3api create-bucket \
  --bucket watertrack-uploads \
  --region ap-southeast-3 \
  --create-bucket-configuration LocationConstraint=ap-southeast-3

aws s3api put-public-access-block \
  --bucket watertrack-uploads \
  --public-access-block-configuration \
    "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"

# Lifecycle: hapus file temp setelah 30 hari
aws s3api put-bucket-lifecycle-configuration \
  --bucket watertrack-uploads \
  --lifecycle-configuration '{
    "Rules": [{
      "ID": "DeleteTempFiles",
      "Status": "Enabled",
      "Filter": {"Prefix": "temp/"},
      "Expiration": {"Days": 30}
    }]
  }'
```

---

## 11. CloudFront + WAF — CDN & Proteksi

### 11.1 Buat Origin Access Control (OAC) untuk S3

**CloudFront Console** → **Origin access** → **Create control setting**

| Setting | Value |
|---|---|
| Name | `watertrack-oac` |
| Origin type | S3 |
| Signing behavior | Sign requests (recommended) |

### 11.2 CloudFront Distribution — Frontend

**CloudFront Console** → **Create distribution**

| Setting | Value |
|---|---|
| Origin domain | `watertrack-frontend.s3.ap-southeast-3.amazonaws.com` |
| Origin access | Use OAC → pilih `watertrack-oac` |
| Viewer protocol policy | **Redirect HTTP to HTTPS** |
| Allowed HTTP methods | GET, HEAD |
| Cache policy | `CachingOptimized` |
| Compress objects automatically | ✅ Yes |
| Alternate domain names (CNAME) | `watertrack.id`, `www.watertrack.id` |
| Custom SSL certificate | Pilih dari ACM |
| Default root object | `index.html` |
| Price class | Use only Southeast Asia and Oceania |

**Custom error pages** (untuk React Router — semua path di-handle index.html):

| Error code | Response page | Response code |
|---|---|---|
| 403 | `/index.html` | 200 |
| 404 | `/index.html` | 200 |

Setelah distribution terbuat, **update S3 bucket policy** frontend (AWS Console prompt otomatis, klik **Copy policy**):

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Sid": "AllowCloudFrontAccess",
    "Effect": "Allow",
    "Principal": {"Service": "cloudfront.amazonaws.com"},
    "Action": "s3:GetObject",
    "Resource": "arn:aws:s3:::watertrack-frontend/*",
    "Condition": {
      "StringEquals": {
        "AWS:SourceArn": "arn:aws:cloudfront::ACCOUNT_ID:distribution/DISTRIBUTION_ID"
      }
    }
  }]
}
```

> Catat **Distribution domain name** (format: `dXXXXXXXXXXXXX.cloudfront.net`) dan **Distribution ID**.

### 11.3 Aktifkan WAF

**WAF Console** → **Web ACLs** → **Create web ACL**

| Setting | Value |
|---|---|
| Name | `watertrack-waf` |
| Resource type | **CloudFront distributions** (pilih di Global/us-east-1) |
| Associated resources | Distribution frontend |

**Tambah managed rule groups** (Add rules → Add managed rule groups):
1. `AWS-AWSManagedRulesCommonRuleSet` — proteksi OWASP umum
2. `AWS-AWSManagedRulesSQLiRuleSet` — SQL injection
3. `AWS-AWSManagedRulesKnownBadInputsRuleSet` — known bad patterns

**Tambah custom rate-based rule** untuk login endpoint:
- Rule name: `LoginRateLimit`
- Rule type: Rate-based rule
- Rate limit: 100 requests / 5 minutes
- Scope-down statement: URI path starts with `/api/login`
- Action: Block

---

## 12. Route 53 — Domain

**Route 53 Console** → **Hosted zones** → **Create hosted zone**

| Setting | Value |
|---|---|
| Domain name | `watertrack.id` |
| Type | Public hosted zone |

Setelah terbuat, catat **Name Server (NS) records** (4 NS). Pergi ke registrar domain kamu dan ganti NS ke NS Route 53.

**Buat DNS Records:**

| Name | Type | Value |
|---|---|---|
| `watertrack.id` | A → Alias → CloudFront | Distribution frontend |
| `www.watertrack.id` | A → Alias → CloudFront | Distribution frontend |
| `api.watertrack.id` | A → Alias → ALB | `watertrack-alb` |

> Untuk A Alias ke ALB: pilih region `ap-southeast-3` dan pilih ALB `watertrack-alb`.

---

## 13. GitHub Actions — CI/CD

### 13.1 Setup GitHub Secrets

**GitHub repo** → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

| Secret Name | Value | Cara dapat |
|---|---|---|
| `AWS_ROLE_ARN` | `arn:aws:iam::ACCOUNT_ID:role/watertrack-github-actions-role` | Output step 2.3 |
| `VITE_API_BASE_URL` | `https://api.watertrack.id/api` | URL API production |
| `S3_FRONTEND_BUCKET` | `watertrack-frontend` | Nama bucket S3 |
| `CLOUDFRONT_DISTRIBUTION_ID` | `EXXXXXXXXXXXX` | ID distribution CloudFront frontend |

### 13.2 Workflow yang Sudah Ada

File `.github/workflows/deploy.yml` sudah ada di repo dengan dua jobs:

**Job `deploy-backend`:**
1. Checkout kode
2. Login ke ECR via OIDC (tidak perlu AWS keys)
3. `docker build` → `docker push` ke ECR dengan tag = commit SHA
4. Fetch task definition terbaru dari ECS
5. Update image di task definition → rolling deploy ke ECS

**Job `deploy-frontend`:**
1. `npm ci` + `npm run build` dengan `VITE_API_BASE_URL` dari secrets
2. `aws s3 sync` dengan cache headers optimal:
   - Assets (JS/CSS): `max-age=31536000, immutable` (1 tahun, karena Vite pakai content hash)
   - `index.html`: `no-cache` (selalu cek versi terbaru)
3. Invalidate CloudFront cache

### 13.3 Update env vars di workflow

Buka `.github/workflows/deploy.yml` dan pastikan variabel ini sesuai:

```yaml
env:
  AWS_REGION: ap-southeast-3
  ECR_REPOSITORY: watertrack-api          # sesuai nama ECR repository
  ECS_SERVICE: watertrack-api-service     # sesuai nama ECS service
  ECS_CLUSTER: watertrack-cluster         # sesuai nama cluster
  CONTAINER_NAME: watertrack-api          # sesuai nama container di task definition
```

### 13.4 Push dan Verifikasi

```bash
git add .
git commit -m "chore: add production deployment config"
git push origin main
```

Buka **GitHub** → tab **Actions** → lihat workflow berjalan → kedua jobs harus hijau ✅

---

## 14. Deploy Pertama — Database Migration

> ECS tasks akan berjalan setelah image pertama di-push. Tapi database masih kosong — perlu jalankan migrasi.

### 14.1 Jalankan Migrasi via ECS Run Task

```bash
aws ecs run-task \
  --cluster watertrack-cluster \
  --task-definition watertrack-api \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={
    subnets=[PRIVATE_SUBNET_1_ID],
    securityGroups=[WATERTRACK_ECS_SG_ID],
    assignPublicIp=DISABLED
  }" \
  --overrides '{
    "containerOverrides": [{
      "name": "watertrack-api",
      "command": ["php", "artisan", "migrate", "--seed", "--force"]
    }]
  }' \
  --region ap-southeast-3
```

Catat `taskArn` dari output. Monitor progressnya:

```bash
# Cek status task
aws ecs describe-tasks \
  --cluster watertrack-cluster \
  --tasks TASK_ARN \
  --region ap-southeast-3 \
  --query 'tasks[0].{status:lastStatus,exitCode:containers[0].exitCode}'
```

### 14.2 Lihat Log Migrasi

```bash
aws logs filter-log-events \
  --log-group-name /ecs/watertrack-api \
  --region ap-southeast-3 \
  --start-time $(node -e "console.log(Date.now() - 600000)") \
  --query 'events[].message'
```

### 14.3 Verifikasi Aplikasi Live

```bash
# Health check backend
curl https://api.watertrack.id/health
# Expected: {"status":"ok"}

# Test login
curl -X POST https://api.watertrack.id/api/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"password"}'
# Expected: {"access_token":"...","token_type":"Bearer","user":{...}}

# Frontend
curl -I https://watertrack.id
# Expected: HTTP/2 200
```

---

## 15. CloudWatch — Monitoring & Alerting

### 15.1 Buat SNS Topic

```bash
TOPIC_ARN=$(aws sns create-topic \
  --name watertrack-alerts \
  --region ap-southeast-3 \
  --query TopicArn --output text)

# Subscribe email untuk notifikasi
aws sns subscribe \
  --topic-arn $TOPIC_ARN \
  --protocol email \
  --notification-endpoint YOUR_EMAIL@example.com
# Cek inbox — klik confirm subscription
```

### 15.2 CloudWatch Alarms

```bash
TOPIC_ARN="arn:aws:sns:ap-southeast-3:ACCOUNT_ID:watertrack-alerts"
ALB_DIMENSION="app/watertrack-alb/XXXXXXXX"  # dapat dari AWS Console

# ECS CPU > 80%
aws cloudwatch put-metric-alarm \
  --alarm-name "WaterTrack-ECS-HighCPU" \
  --namespace AWS/ECS \
  --metric-name CPUUtilization \
  --dimensions Name=ClusterName,Value=watertrack-cluster Name=ServiceName,Value=watertrack-api-service \
  --statistic Average --period 300 --threshold 80 \
  --comparison-operator GreaterThanThreshold --evaluation-periods 2 \
  --alarm-actions $TOPIC_ARN --region ap-southeast-3

# ALB 5xx errors > 10/menit
aws cloudwatch put-metric-alarm \
  --alarm-name "WaterTrack-ALB-5xx" \
  --namespace AWS/ApplicationELB \
  --metric-name HTTPCode_Target_5XX_Count \
  --dimensions Name=LoadBalancer,Value=$ALB_DIMENSION \
  --statistic Sum --period 60 --threshold 10 \
  --comparison-operator GreaterThanThreshold --evaluation-periods 1 \
  --alarm-actions $TOPIC_ARN --region ap-southeast-3

# ALB response time > 2 detik
aws cloudwatch put-metric-alarm \
  --alarm-name "WaterTrack-ALB-HighLatency" \
  --namespace AWS/ApplicationELB \
  --metric-name TargetResponseTime \
  --dimensions Name=LoadBalancer,Value=$ALB_DIMENSION \
  --statistic Average --period 300 --threshold 2 \
  --comparison-operator GreaterThanThreshold --evaluation-periods 2 \
  --alarm-actions $TOPIC_ARN --region ap-southeast-3

# RDS connections > 80 (t3.small max ~150)
aws cloudwatch put-metric-alarm \
  --alarm-name "WaterTrack-RDS-HighConnections" \
  --namespace AWS/RDS \
  --metric-name DatabaseConnections \
  --dimensions Name=DBInstanceIdentifier,Value=watertrack-db \
  --statistic Average --period 300 --threshold 80 \
  --comparison-operator GreaterThanThreshold --evaluation-periods 2 \
  --alarm-actions $TOPIC_ARN --region ap-southeast-3

# RDS free storage < 5 GB (5368709120 bytes)
aws cloudwatch put-metric-alarm \
  --alarm-name "WaterTrack-RDS-LowStorage" \
  --namespace AWS/RDS \
  --metric-name FreeStorageSpace \
  --dimensions Name=DBInstanceIdentifier,Value=watertrack-db \
  --statistic Average --period 300 --threshold 5368709120 \
  --comparison-operator LessThanThreshold --evaluation-periods 1 \
  --alarm-actions $TOPIC_ARN --region ap-southeast-3
```

### 15.3 AWS Budgets — Notifikasi Biaya

```bash
aws budgets create-budget \
  --account-id ACCOUNT_ID \
  --budget '{
    "BudgetName": "WaterTrack-Monthly",
    "BudgetLimit": {"Amount": "150", "Unit": "USD"},
    "TimeUnit": "MONTHLY",
    "BudgetType": "COST"
  }' \
  --notifications-with-subscribers '[{
    "Notification": {
      "NotificationType": "ACTUAL",
      "ComparisonOperator": "GREATER_THAN",
      "Threshold": 80,
      "ThresholdType": "PERCENTAGE"
    },
    "Subscribers": [{
      "SubscriptionType": "EMAIL",
      "Address": "YOUR_EMAIL@example.com"
    }]
  }]'
```

---

## 16. Checklist Go-Live

Centang semua sebelum dinyatakan live:

### Infrastruktur
- [ ] VPC, subnets, security groups terbuat dengan benar
- [ ] ECR repository aktif, Docker image berhasil di-push
- [ ] RDS running, Multi-AZ aktif, encryption on, deletion protection on
- [ ] ElastiCache running, encryption on
- [ ] Secrets Manager: APP_KEY, DB_PASSWORD, DB_HOST, REDIS_HOST tersimpan
- [ ] ECS cluster + service running, **2/2 tasks healthy**
- [ ] ALB target group menunjukkan **2/2 healthy** targets
- [ ] S3 buckets terbuat, public access blocked
- [ ] CloudFront distributions aktif (status: Deployed)
- [ ] Route 53 A records mengarah ke resource yang benar
- [ ] SSL certificate status: **Issued**
- [ ] WAF aktif dengan managed rules

### Aplikasi
- [ ] `GET https://api.watertrack.id/health` → `{"status":"ok"}`
- [ ] `POST https://api.watertrack.id/api/login` → berhasil return token
- [ ] `https://watertrack.id` → React SPA tampil
- [ ] Login dari browser → masuk dashboard
- [ ] Role routing: admin/kasir/operator/klien masing-masing ke halaman tepat
- [ ] Export Excel (admin) → file terunduh
- [ ] Import pelanggan dari Excel → berhasil

### Security
- [ ] `APP_DEBUG=false` — error tidak expose stack trace
- [ ] HTTP redirect ke HTTPS (coba akses `http://watertrack.id`)
- [ ] Login rate limited (coba 11 request berturut-turut → ke-11 harus 429)
- [ ] WAF managed rules aktif
- [ ] Tidak ada `.env` di dalam image ECR: `docker history <image>` tidak tampilkan env lokal
- [ ] RDS tidak accessible dari luar VPC

### CI/CD & Monitoring
- [ ] Push ke `main` → GitHub Actions kedua jobs hijau ✅
- [ ] ECS rolling deploy tanpa downtime (200 task baru naik sebelum yang lama diturunkan)
- [ ] CloudWatch alarms terbuat
- [ ] SNS email subscription dikonfirmasi (cek inbox)
- [ ] AWS Budgets alert dikonfigurasi

---

## Referensi Cepat

| Resource | Path / Link |
|---|---|
| Arsitektur & keputusan design | `docs/aws-architecture/watertrack-aws-architecture.md` |
| Draw.io diagram | `docs/aws-architecture/watertrack-aws-architecture.drawio` |
| Backend Dockerfile | `backend/Dockerfile` |
| Docker configs | `backend/docker/` |
| Production env template | `backend/.env.production.example` |
| CI/CD Workflow | `.github/workflows/deploy.yml` |
| ECS task definition | Buat `task-definition.json` lokal — **jangan commit** |
