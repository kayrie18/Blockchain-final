# Backend (Auth + Document Upload)

Node.js (Express) backend module for **Blockchain-Based Document Integrity Verification System**.

## Setup

1. Create an environment file:

   - Copy `.env.example` to `.env`
   - Set `MONGODB_URI` and `JWT_SECRET`

2. Install dependencies:

   - `npm install`

3. Configure email delivery (optional but recommended):

   - Set SMTP variables in `.env` using `.env.example`
   - `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, and `EMAIL_FROM`

4. Run:

   - `npm run dev` (nodemon)
   - `npm start`

## API

Base paths:

- `POST /api/auth/register`  
  Body: `{ "name": "...", "email": "...", "password": "...", "role": "Admin|Issuer|Verifier|User" }`

- `POST /api/auth/login`  
  Body: `{ "email": "...", "password": "..." }`

- `GET /api/users/me`  
  Header: `Authorization: Bearer <token>`

- `GET /api/auth/verify-role?allowed=Admin,Issuer`
  Header: `Authorization: Bearer <token>`

- `GET /api/auth/verify-email/:token`
  Public endpoint for email verification.

- `POST /api/auth/request-password-reset`
  Body: `{ "email": "..." }`

- `POST /api/auth/reset-password`
  Body: `{ "token": "...", "password": "..." }`

- `POST /api/documents/upload`  
  Header: `Authorization: Bearer <token>`  
  Content-Type: `multipart/form-data`  
  File field: `document`  
  Form fields: `title`, `ownerName`, `issuingOrganization`, `documentType`, optional `uploadDate`

- `GET /api/documents/:id/hash`  
  Header: `Authorization: Bearer <token>`

- `GET /api/documents/:id/verify-hash?hash=<sha256hex>`  
  Header: `Authorization: Bearer <token>`

- `POST /api/blockchain/store-hash`  
  Header: `Authorization: Bearer <token>`  
  Body: `{ "documentId": "...", "sha256HashHex": "<64 hex chars>", "timestamp": 1711920000 }`  
  Roles: `Admin`, `Issuer`

- `GET /api/blockchain/hashes/:documentId`  
  Header: `Authorization: Bearer <token>`

- `POST /api/verification/documents/:documentId`  
  Header: `Authorization: Bearer <token>`  
  Content-Type: `multipart/form-data`  
  File field: `document`  
  Response includes verification verdict (`Authentic Document` or `Document Tampered`)

- `GET /api/metadata?skip=0&limit=20`  
  Header: `Authorization: Bearer <token>`

- `GET /api/metadata/:id`  
  Header: `Authorization: Bearer <token>`

- `PATCH /api/metadata/:id`  
  Header: `Authorization: Bearer <token>`  
  Body (any): `{ "title": "...", "ownerName": "...", "issuingOrganization": "...", "documentType": "...", "uploadDate": "..." }`

- `DELETE /api/metadata/:id`  
  Header: `Authorization: Bearer <token>`  
  Roles: `Admin`

- `GET /api/search/documents`  
  Header: `Authorization: Bearer <token>`  
  Query params (all optional): `q`, `title`, `ownerName`, `issuingOrganization`, `documentType`, `uploadDateFrom`, `uploadDateTo`, `sha256Hash`, `blockchainTx`, `page`, `limit`, `sortBy`, `sortDir`

- `GET /api/qr/documents/:documentId`  
  Header: `Authorization: Bearer <token>`  
  Returns dynamic QR code data URL + verification URL for the document

- `GET /api/qr/verify?documentId=<id>`  
  Public endpoint for QR scans to resolve document verification result

- `POST /api/qr/verify`  
  Public endpoint accepting `{ "scanData": "<qr-url-or-doc-id>" }` or `{ "documentId": "..." }`

## Notes

- Passwords are stored as `passwordHash` (bcrypt).
- JWT payload includes `sub` (user id) and `role`.
- Uploaded documents are currently persisted to local storage with Multer.
- SHA-256 hash is generated from uploaded file bytes and saved in MongoDB metadata.
- After upload, the SHA-256 hash is handed off to a blockchain adapter stub (`src/services/blockchainService.js`) ready to be replaced with your real blockchain storage module.
- Blockchain storage uses **Ethers.js** and a deployed Solidity contract ABI (`src/contracts/DocumentIntegrity.abi.json`). Configure the RPC URL, signer private key, and contract address in `.env`.
- Verification module computes a fresh SHA-256 for the uploaded file, retrieves the original hash from blockchain, compares using timing-safe equality, and returns a verdict.
- Storage mode can be set with `DOCUMENT_STORAGE_DRIVER` (`local`, `cloud`, `ipfs`); `cloud`/`ipfs` are extension points ready for adapter integration.
- Document metadata records are stored in MongoDB (`Document` model) and include document hash plus blockchain transaction reference (when available).
- Search uses MongoDB indexes (including a text index) and supports pagination for large datasets.
- QR module generates verification links/codes dynamically and validates document authenticity by comparing DB hash with on-chain hash during scan verification.

