# Northwide Traders Website

A full-stack website for **Northwide Traders**, including a
public-facing website, product pages, administration panel,
authentication, product uploads, and backend API routes.

## Project Overview

This project appears to use:

-   **Frontend:** HTML, CSS, and JavaScript
-   **Backend:** Node.js with Express
-   **Database:** Custom database files located in the `db/` directory
-   **Admin Panel:** Admin interface located in the `admin/` directory
-   **Authentication:** Middleware located in `middleware/`
-   **API Routes:** Public and admin routes located in `routes/`
-   **Product Images:** Stored in `uploads/products/`

> **Important:** Review the existing source code before deploying. The
> exact database engine, authentication method, API endpoints, and
> deployment requirements depend on the implementation in your files.

------------------------------------------------------------------------

## Project Structure

``` text
northwide-traders-website/
│
├── admin/
│   ├── admin.css
│   ├── admin.js
│   └── index.html
│
├── assets/
│   └── images/
│
├── css/
│   └── style.css
│
├── data/
│
├── db/
│   ├── database.js
│   ├── seed.js
│   └── setup-admin.js
│
├── js/
│   └── script.js
│
├── middleware/
│   └── auth.js
│
├── node_modules/
│
├── routes/
│   ├── admin.js
│   └── public.js
│
├── uploads/
│   └── products/
│
├── .env
├── .gitignore
├── index.html
├── package.json
├── package-lock.json
├── products.html
├── robots.txt
├── server.js
├── server.ps1
├── server1.ps1
└── start-server.bat
```

------------------------------------------------------------------------

## Requirements

Install the following software before running the project:

1.  [Node.js](https://nodejs.org/) - preferably an active LTS version
2.  npm - included with Node.js
3.  Git - required for GitHub deployment
4.  A database service, if required by the application

Verify your Node.js and npm installations:

``` bash
node --version
npm --version
```

------------------------------------------------------------------------

## Installation

### 1. Clone the repository

``` bash
git clone YOUR_GITHUB_REPOSITORY_URL
cd northwide-traders-website
```

If the project is already on your computer, open the project directory
in VS Code.

### 2. Install dependencies

``` bash
npm install
```

### 3. Configure environment variables

Create a `.env` file in the project root.

Example:

``` env
PORT=3000
DATABASE_URL=your_neon_connection_string
SESSION_SECRET=replace_with_a_strong_random_secret
NODE_ENV=development
BLOB_READ_WRITE_TOKEN=your_vercel_blob_token
```

`DATABASE_URL` is required in Vercel. The application uses local
`data/catalogue.db` only when running outside Vercel and no PostgreSQL URL is
configured. `BLOB_READ_WRITE_TOKEN` is required for production image uploads;
local uploads use the existing data-URI fallback.

### 4. Initialize the database

Check the following files and run the appropriate setup commands or
scripts:

-   `db/database.js`
-   `db/seed.js`
-   `db/setup-admin.js`

Do not run database initialization scripts in production until you
understand whether they create, overwrite, or delete records.

### PostgreSQL migration

Create a Neon PostgreSQL project and copy its pooled connection string into
`DATABASE_URL` locally. The migration is non-destructive: it imports the live
`data/catalogue.db` when present, otherwise it uses
`data/backup_catalogue.json`, and preserves existing IDs, products, categories,
and password hashes.

``` bash
node db/migrate-to-postgres.js
```

The command creates the schema inside a transaction and prints source and
destination counts. It aborts if any destination count is below the source
count. It does not drop or reset tables. Set `SOURCE_SQLITE_PATH` only when
the source database is stored somewhere else.

### Vercel configuration

Configure these variable names in both Preview and Production environments:

``` text
DATABASE_URL
SESSION_SECRET
BLOB_READ_WRITE_TOKEN
NODE_ENV=production
```

Use Vercel Storage to create a Blob store and copy its read/write token to
`BLOB_READ_WRITE_TOKEN`. Use a strong unique `SESSION_SECRET`; never commit
`.env` or print these values in logs. Deploy after the Neon migration, then
open `/api/categories`, `/api/products`, and `/secure-admin` to verify the
deployment.

------------------------------------------------------------------------

## Running the Website Locally

Start the server using the command defined in your `package.json`.

Common examples:

``` bash
npm start
```

or:

``` bash
node server.js
```

If your project uses a development script:

``` bash
npm run dev
```

Open the local URL shown in your terminal. A common local address is:

``` text
http://localhost:3000
```

The actual port depends on your server configuration.

------------------------------------------------------------------------

## Main Components

### Public Website

The public website may include:

-   Homepage
-   Product listings
-   Product details
-   Public API endpoints
-   Static assets
-   Product images

Relevant files and folders:

``` text
index.html
products.html
css/
js/
routes/public.js
assets/
```

### Admin Panel

The admin section is located in:

``` text
admin/
```

The admin panel may provide functionality such as:

-   Managing products
-   Managing product images
-   Accessing administrative routes
-   Performing authorized actions

Relevant files:

``` text
admin/index.html
admin/admin.js
admin/admin.css
routes/admin.js
middleware/auth.js
```

Make sure admin routes require proper authentication and authorization
before deploying publicly.

------------------------------------------------------------------------

## GitHub Setup

Before pushing the project to GitHub, ensure sensitive files are
excluded.

Recommended `.gitignore`:

``` gitignore
node_modules/
.env
.vercel/
npm-debug.log*
.DS_Store
```

Initialize Git if it has not already been initialized:

``` bash
git init
git add .
git commit -m "Initial project commit"
```

Connect the GitHub repository:

``` bash
git remote add origin YOUR_GITHUB_REPOSITORY_URL
git branch -M main
git push -u origin main
```

> Never commit passwords, API keys, database credentials, JWT secrets,
> or other private information.

------------------------------------------------------------------------

## Deployment to Vercel

### Can the frontend and backend be deployed together?

Yes, the frontend and backend can potentially be deployed in a single
Vercel project if the Express application is compatible with Vercel's
deployment model.

Your project currently includes:

``` text
server.js
routes/
middleware/
db/
index.html
products.html
package.json
```

The exact configuration must be checked before deployment.

### Basic Vercel Deployment Steps

1.  Push the project to GitHub.
2.  Open [Vercel](https://vercel.com/).
3.  Select **Add New Project**.
4.  Import the GitHub repository.
5.  Select the project root as the root directory.
6.  Configure the required environment variables.
7.  Deploy the project.
8.  Review the deployment logs and test all pages and API endpoints.

### Vercel Environment Variables

Add the required environment variables in:

``` text
Vercel Dashboard
→ Project
→ Settings
→ Environment Variables
```

Do not upload the local `.env` file to GitHub.

### Important Vercel Considerations

Before production deployment, review the following:

-   Express entry point and Vercel compatibility
-   Database connection and production database availability
-   File upload behavior
-   Persistent storage requirements
-   Authentication and session configuration
-   CORS settings, if frontend and backend use different domains
-   Production environment variables
-   API route paths
-   Error handling and logging

------------------------------------------------------------------------

## Database and File Upload Notes

### Database

If the application uses a local database file, it may not work reliably
as a permanent production database on a serverless platform.

Consider using a managed database service compatible with your
application.

Before deploying, confirm:

-   Which database engine is used
-   Where production data will be stored
-   How database connections are created
-   Whether migrations or seed scripts are required
-   Whether database credentials are stored securely

### Product Image Uploads

The project contains:

``` text
uploads/products/
```

Local files uploaded during runtime may not persist reliably in
serverless environments.

For production, consider using persistent object storage or a dedicated
file-storage service. Update the application to save and retrieve image
URLs from that storage service.

------------------------------------------------------------------------

## Connecting a GoDaddy Domain

After deploying to Vercel:

1.  Open your Vercel project.
2.  Go to **Settings → Domains**.
3.  Add your GoDaddy domain.
4.  Copy the DNS records provided by Vercel.
5.  Open GoDaddy DNS Management.
6.  Add or update the records exactly as instructed by Vercel.
7.  Wait for DNS propagation.
8.  Confirm that HTTPS is active and the domain loads correctly.

Do not guess DNS values. Use the exact records displayed in your Vercel
dashboard.

------------------------------------------------------------------------

## Production Checklist

Before launching the website, verify the following:

-   [ ] Website homepage loads correctly
-   [ ] CSS and JavaScript files load correctly
-   [ ] Product listing works
-   [ ] Product detail pages work
-   [ ] Product images load correctly
-   [ ] Admin login is protected
-   [ ] Admin routes require authorization
-   [ ] Database connection works in production
-   [ ] Environment variables are configured
-   [ ] `.env` is excluded from Git
-   [ ] Product uploads use persistent storage
-   [ ] API endpoints work correctly
-   [ ] Error messages do not expose sensitive information
-   [ ] GoDaddy domain is connected
-   [ ] HTTPS is enabled
-   [ ] Mobile layout is tested
-   [ ] Backup and recovery procedures are available

------------------------------------------------------------------------

## Troubleshooting

### The deployment fails

Check:

-   Vercel deployment logs
-   `package.json` scripts
-   Node.js compatibility
-   Missing environment variables
-   Incorrect application entry point

### The website loads but API requests fail

Check:

-   API route URLs
-   Express route configuration
-   Environment variables
-   CORS settings
-   Database connectivity
-   Vercel runtime compatibility

### Product images disappear

Check whether images are stored only on the local filesystem. Use
persistent storage for production uploads.

### Admin login does not work

Check:

-   Authentication middleware
-   Session or token configuration
-   Production environment variables
-   Secure cookie settings
-   Backend API URLs

------------------------------------------------------------------------

## Useful Links

-   [Vercel Documentation](https://vercel.com/docs)
-   [Vercel Express Deployment
    Guide](https://vercel.com/docs/frameworks/backend/express)
-   [GoDaddy](https://www.godaddy.com/)
-   [Node.js](https://nodejs.org/)
-   [GitHub](https://github.com/)

------------------------------------------------------------------------

## Disclaimer

This README is based on the visible project structure and provides a
deployment guide. The exact commands, environment variables, database
configuration, and Vercel setup should be confirmed by reviewing the
actual project source code.

