# Water Billing Management System

A comprehensive water billing management system built with Laravel (backend) and React (frontend). This system manages customer billing, payment processing, and meter readings for water utility services.

## Project Overview

This full-stack application provides a complete solution for water billing management with role-based access control for administrators, operators, and cashiers.

### Key Features

- **Multi-role Authentication**: Admin, Operator, and Kasir (Cashier) roles
- **Customer Management**: Complete CRUD operations with Excel import/export
- **Bill Generation**: Automated billing based on meter readings
- **Payment Processing**: Real-time payment handling with multiple payment methods
- **Dashboard Analytics**: Real-time statistics and activity tracking
- **Meter Reading**: Digital meter recording system
- **Responsive Design**: Modern UI with Tailwind CSS and shadcn/ui

## Tech Stack

### Backend (Laravel)
- **Framework**: Laravel 12.x
- **Authentication**: Laravel Sanctum
- **Database**: MySQL
- **API**: RESTful API architecture
- **PHP Version**: 8.2+

### Frontend (React)
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **UI Library**: shadcn/ui + Tailwind CSS
- **State Management**: React Context + Hooks
- **HTTP Client**: Axios
- **Routing**: React Router v6
- **Data Processing**: XLSX for Excel operations

## System Architecture

```
├── backend/              # Laravel API Backend
│   ├── app/
│   │   ├── Http/Controllers/
│   │   │   ├── Api/
│   │   │   │   ├── Admin/        # Admin endpoints
│   │   │   │   ├── AuthController.php
│   │   │   │   └── KasirController.php
│   │   │   └── OperatorController.php
│   │   ├── Models/
│   │   │   ├── User.php
│   │   │   ├── Customer.php
│   │   │   ├── Bill.php
│   │   │   ├── Payment.php
│   │   │   └── Tariff.php
│   │   └── ...
│   ├── database/
│   │   ├── migrations/    # Database schema
│   │   └── seeders/       # Sample data
│   └── routes/api.php     # API routes
│
└── frontend/             # React Frontend
    ├── src/
    │   ├── components/    # Reusable components
    │   ├── pages/         # Page components
    │   │   ├── admin/     # Admin pages
    │   │   └── kasir/     # Cashier pages
    │   ├── contexts/      # React contexts
    │   ├── hooks/         # Custom hooks
    │   └── lib/           # Utilities
    └── public/            # Static assets
```

## Database Schema

### Core Tables

#### Users
- Multi-role authentication system
- Roles: admin, operator, kasir

#### Customers
- Customer information and status
- Meter readings and tariff rates
- Contact details and service status

#### Bills
- Monthly billing records
- Meter usage calculations
- Payment status tracking

#### Payments
- Payment transaction records
- Multiple payment methods
- Cashier processing logs

#### Tariffs
- Water rate configurations
- Category-based pricing

## API Endpoints

### Authentication
```
POST /api/login          # User login
POST /api/logout         # User logout
GET  /api/user           # Get current user
```

### Admin Routes (`/api/admin/*`)
```
# Dashboard
GET  /dashboard/stats     # Dashboard statistics
GET  /dashboard/activities # Recent activities

# Customer Management
GET    /customers         # List customers
POST   /customers         # Create customer
GET    /customers/{id}    # Get customer
PUT    /customers/{id}    # Update customer
DELETE /customers/{id}    # Delete customer
POST   /customers/import  # Import Excel data

# Bill Management
GET    /bills            # List bills
POST   /bills            # Create bill
PUT    /bills/{id}       # Update bill
DELETE /bills/{id}       # Delete bill
POST   /bills/generate   # Generate monthly bills

# Payment Management
GET    /payments         # List payments
POST   /payments         # Create payment
PUT    /payments/{id}    # Update payment
DELETE /payments/{id}    # Delete payment

# Tariff Management
GET    /tariffs          # List tariffs
POST   /tariffs          # Create tariff
PUT    /tariffs/{id}     # Update tariff
DELETE /tariffs/{id}     # Delete tariff
```

### Cashier Routes (`/api/kasir/*`)
```
POST /cek-tagihan        # Check customer bill
POST /bayar              # Process payment
```

### Operator Routes (`/api/operator/*`)
```
POST /catat-meteran      # Record meter reading
POST /customer-info      # Get customer info
```

## User Roles & Permissions

### Admin
- Full system access
- Customer management
- Bill generation and management
- Payment oversight
- System configuration
- User management
- Reports and analytics

### Operator
- Customer data management
- Meter reading input
- Customer information lookup
- Excel import/export for customers

### Kasir (Cashier)
- Bill checking and lookup
- Payment processing
- Receipt generation
- Payment method selection
- Transaction history

## Installation & Setup

### Prerequisites
- PHP 8.2+
- Composer
- Node.js 18+
- MySQL 8.0+
- Git

### Backend Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd WaterTrack/backend
   ```

2. **Install dependencies**
   ```bash
   composer install
   ```

3. **Environment configuration**
   ```bash
   cp .env.example .env
   php artisan key:generate
   ```

4. **Database configuration**
   Update `.env` file with your database credentials:
   ```env
   DB_CONNECTION=mysql
   DB_HOST=127.0.0.1
   DB_PORT=3306
   DB_DATABASE=water_billing
   DB_USERNAME=root
   DB_PASSWORD=
   ```

5. **Run migrations and seeders**
   ```bash
   php artisan migrate:fresh --seed
   ```

6. **Start the server**
   ```bash
   php artisan serve
   ```

### Frontend Setup

1. **Navigate to frontend directory**
   ```bash
   cd ../frontend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment configuration**
   Create `.env` file:
   ```env
   VITE_API_URL=http://localhost:8000/api
   ```

4. **Start development server**
   ```bash
   npm run dev
   ```

## Usage

### Default Accounts
After running seeders, these demo accounts are available:

- **Admin**: admin@example.com
- **Operator**: operator@example.com  
- **Kasir**: kasir@example.com

### Customer Management
1. Login as Admin or Operator
2. Navigate to "Kelola Pelanggan"
3. Add customers manually or import via Excel
4. Manage customer status and tariff rates

### Bill Processing
1. Generate monthly bills for all customers
2. Record meter readings (Operator)
3. System automatically calculates usage and billing

### Payment Processing
1. Login as Kasir
2. Use "Cek Tagihan" to lookup customer bills
3. Process payments with various methods
4. Generate payment receipts

## Features in Detail

### Excel Import/Export
- **Template Download**: Get standardized Excel template
- **Bulk Import**: Import customer data with validation
- **Error Handling**: Detailed error reporting for invalid data
- **Data Validation**: Comprehensive validation rules

### Real-time Dashboard
- **Statistics**: Live billing and payment statistics
- **Activities**: Recent system activities
- **Role-based Views**: Customized dashboard per user role
- **Quick Actions**: Frequently used features accessible

### Payment System
- **Multiple Methods**: Cash, transfer, card payments
- **Receipt Generation**: Automatic receipt creation
- **Transaction Logging**: Complete payment audit trail
- **Status Tracking**: Real-time payment status updates

### Responsive Design
- **Mobile Friendly**: Optimized for all device sizes
- **Modern UI**: Clean, professional interface
- **Accessibility**: WCAG compliant design
- **Dark/Light Mode**: Theme support (configurable)

## Development

### Code Structure

**Backend (Laravel)**
- Controllers follow REST conventions
- Models use Eloquent relationships
- Validation through Form Requests
- API responses are standardized
- Authentication via Sanctum tokens

**Frontend (React)**
- TypeScript for type safety
- Component-based architecture
- Custom hooks for state management
- Consistent error handling
- Responsive design patterns

### API Response Format
```json
{
  "data": {...},
  "message": "Success message",
  "status": "success"
}
```

### Error Handling
```json
{
  "message": "Error message",
  "errors": {...},
  "status": "error"
}
```

## Security Features

- **CORS Protection**: Configured for production
- **CSRF Protection**: Built-in Laravel protection
- **SQL Injection Prevention**: Eloquent ORM protection
- **XSS Protection**: Input sanitization
- **Authentication**: Sanctum token-based auth
- **Authorization**: Role-based access control

## Performance Optimizations

- **Database Indexing**: Optimized query performance
- **Eager Loading**: Reduced N+1 query problems
- **API Pagination**: Efficient data loading
- **Frontend Caching**: Component and data caching
- **Lazy Loading**: On-demand component loading

## Testing

### Backend Testing
```bash
cd backend
php artisan test
```

### Frontend Testing
```bash
cd frontend
npm run test
```

## Deployment

### Production Environment
1. Set `APP_ENV=production` in `.env`
2. Configure production database
3. Set up SSL certificates
4. Configure web server (Apache/Nginx)
5. Build frontend for production: `npm run build`

### AWS Deployment (ECS Fargate)
Step-by-step AWS Console guide (RDS, ElastiCache, ECS Fargate, ALB, CloudFront, GitHub Actions CI/CD): see [`docs/deploy-guide-console.md`](docs/deploy-guide-console.md).

> **Production requires Redis** (`SESSION_DRIVER=redis`, `CACHE_STORE=redis`, `QUEUE_CONNECTION=redis`) via the `phpredis` PECL extension — already configured in `backend/Dockerfile`.

### Docker Deployment
Docker configuration files are available for containerized deployment.

## Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support and questions:
- Create an issue in this repository
- Contact the development team
- Check the documentation wiki

## Changelog

### Version 1.0.0
- Initial release
- Multi-role authentication system
- Customer management with Excel import
- Bill generation and management
- Payment processing system
- Real-time dashboard
- Responsive design

---

**Built with ❤️ for efficient water billing management**
