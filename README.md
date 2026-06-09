# Spotify Clone Backend API

Backend REST API for a Spotify-like music streaming platform.

## Features

- Authentication
- JWT access + refresh tokens
- Music upload
- Playlist management
- Queue system
- Likes system
- Albums
- User profile/avatar
- History tracking

---

## Tech Stack

- Node.js
- Express.js
- MongoDB
- Mongoose
- JWT
- ImageKit
- Multer
- Express Validator

---

## Installation

```bash
npm install
```

---

## Environment Variables

Create `.env`

```env
MONGO_URI=
JWT_ACCESS_SECRET=
JWT_REFRESH_SECRET=
IMAGE_KIT_PUBLIC_KEY=
IMAGE_KIT_PRIVATE_KEY=
IMAGE_KIT_URL_ENDPOINT=
```

---

## Run Server

```bash
npm run dev
```

---

## API Base URL

```bash
http://localhost:5000/api
```

---

# Endpoints

## Auth

| Method | Endpoint | Description |
|---|---|---|
| POST | /auth/register | Register |
| POST | /auth/login | Login |
| POST | /auth/refresh-token | Refresh access token |
| POST | /auth/logout | Logout |

## Music

| Method | Endpoint |
|---|---|
| POST | /music/upload-music |
| POST | /music/play/:songId |
| GET | /music/all-songs |

## Playlists

| Method | Endpoint |
|---|---|
| POST | /playlists |
| POST | /playlists/add-song |
| POST | /playlists/remove-song |

## Queue

| Method | Endpoint |
|---|---|
| POST | /queue/add |
| POST | /queue/next |
| POST | /queue/prev |

---

## Author

Saim Khan