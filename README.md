# EduCore: Enterprise Learning Management System

> **Track:** Fullstack | **Project type:** Individual capstone (Prodesk, Sprint 13 to 17)
> **Status:** Sprint 14, Walking Skeleton (authentication and routing) built and deployed

---

## 1. Project Overview

EduCore is a scalable Learning Management System in the style of Udemy and Coursera. Students often struggle to find structured courses, keep their place across lessons, and see how far they have come. Instructors, meanwhile, lack a simple way to publish video lessons and supporting material without wrestling with hosting. EduCore gives students a searchable course catalogue, a distraction-free video player, and a dashboard that shows per-course progress. It gives instructors a portal to build courses and upload video and asset files, with role-based access keeping the two experiences separate and secure.

---

## 2. Designated Track

**Fullstack**: Next.js client + Express/MongoDB API, built and deployed by one developer.

---

## 3. Tech Stack

| Layer | Technology | Why | Status |
|---|---|---|---|
| Framework | **Next.js (App Router)** | File-based routing, server and client components, and straightforward Vercel deployment. | In use |
| Styling | **Tailwind CSS** | Utility classes let one developer build responsive layouts quickly without maintaining custom CSS. | In use |
| Backend | **Express.js** | Minimal, well-known framework for building a REST API with clear routing and middleware. | In use |
| Database | **MongoDB Atlas + Mongoose** | Flexible documents suit nested course/lesson data, and Mongoose adds schemas and validation. | In use |
| Auth | **JWT (jsonwebtoken) + bcryptjs** | Stateless authentication that works cleanly between a separate client and API, with role claims for RBAC. | In use |
| Client token handling | **jwt-decode + localStorage** | Lets the client read the token's expiry and guard routes before making requests. | In use |
| State | **Redux Toolkit** | Predictable global state for catalogue, enrollments, and progress, with slices and async thunks. | Planned (Sprint 15) |
| File handling | **multer** | Standard Express middleware for parsing multipart uploads before they are sent to cloud storage. | Planned |
| Asset storage | **Cloudinary** | Hosts and streams video and files via CDN, so the server never stores or serves large media itself. | Planned |

**Deployment:** Next.js on Vercel, Express API on Render, database on MongoDB Atlas. CI via GitHub Actions is planned for Sprint 17.

---

## 4. User Roles and Permissions

Two roles are in scope. An **Admin** role is deliberately excluded to keep RBAC small and testable for one developer (see Out of Scope).

| Capability | Guest | Student | Instructor |
|---|:---:|:---:|:---:|
| Browse and search the course catalog | Yes | Yes | Yes |
| View course detail page | Yes | Yes | Yes |
| Register / log in | Yes | n/a | n/a |
| Enroll in a course | No | **Yes** | No |
| Watch lessons of an enrolled course | No | **Yes** | Own courses (preview) |
| Mark lessons complete / view own progress | No | **Yes** | No |
| View student dashboard | No | **Yes** | No |
| Create, edit, delete own courses | No | **No** | **Yes** |
| Upload video and assets to own courses | No | **No** | **Yes** |
| Modify another instructor's course | No | No | **No** |
| View or modify other users' data | No | No | **No** |

**Role rules enforced on the API, not only in the UI:** every protected route verifies the JWT, then checks the role. Instructor actions also check course ownership (`course.instructorId === req.user.id`).

---

## 5. Core Features (Prioritized)

**Priority key:** **P0** = MVP. **P1** = full CRUD and feature completion. **P2** = AI integration and UX polish.

Each requirement is written to be testable: it has a clear actor, action, and observable result.

### 5.1 Authentication and Roles (Sprint 14)

| ID | Priority | Requirement | Status |
|---|---|---|---|
| AUTH-01 | **P0** | A visitor must be able to register with name, email, password, and a role (Student or Instructor). Duplicate emails must be rejected with a clear error. | Done |
| AUTH-02 | **P0** | A registered user must be able to log in and receive a JWT; invalid credentials must return a 401 and show an error message. | Done |
| AUTH-03 | **P0** | Protected API routes must return 401 without a valid token and 403 when the user's role is not permitted. | Partial: 401 done, role-based 403 planned with the first role-restricted routes |
| AUTH-04 | **P0** | Passwords must be stored hashed (bcrypt); no plain-text password may appear in the database or in API responses. | Done |
| AUTH-05 | **P1** | A logged-in user must be able to edit their name and password from a profile page. | Planned |

### 5.2 Course Catalog (Search and Filter)

| ID | Priority | Requirement |
|---|---|---|
| CAT-01 | **P0** | A user must see a paginated list of **published** courses showing thumbnail, title, instructor name, and lesson count. |
| CAT-02 | **P0** | A user must be able to open a course detail page showing description, instructor, and the ordered lesson list. |
| CAT-03 | **P0** | A user must be able to search courses by title; results must update to show only matching courses, with an empty state when none match. |
| CAT-04 | **P0** | A student must be able to enroll in a course with one click; enrolling twice in the same course must not create a duplicate enrollment. |
| CAT-05 | **P1** | A user must be able to filter courses by category and level, combined with the title search. |
| CAT-06 | **P1** | A student must be able to unenroll from a course; the course must disappear from their dashboard. |

### 5.3 Student Dashboard

| ID | Priority | Requirement |
|---|---|---|
| DASH-01 | **P0** | A student must see a "My Courses" grid of all enrolled courses after login. |
| DASH-02 | **P0** | Each enrolled course card must show a progress percentage and a "Continue Learning" link to the next incomplete lesson. |
| DASH-03 | **P0** | A student with no enrollments must see an empty state with a link to the catalog. |
| DASH-04 | **P1** | The dashboard must show a summary (courses enrolled, courses completed, lessons completed). |

> The Sprint 14 dashboard is a protected placeholder that shows "Welcome, [name]". The requirements above describe the full student dashboard.

### 5.4 Media Player UI

| ID | Priority | Requirement |
|---|---|---|
| PLAY-01 | **P0** | An enrolled student must be able to play a lesson's video in an in-page player with play/pause, seek, and fullscreen. |
| PLAY-02 | **P0** | The lesson page must show a sidebar listing all lessons in order, highlighting the current lesson and showing a tick on completed ones. |
| PLAY-03 | **P0** | A student must be able to move between lessons using Next and Previous buttons or by clicking the sidebar. |
| PLAY-04 | **P0** | A user who is not enrolled must be blocked from accessing lesson content (API returns 403; UI redirects to the course page). |
| PLAY-05 | **P1** | The player must resume from the last watched position when a student returns to a lesson. |
| PLAY-06 | **P1** | A lesson must show its downloadable attachments (e.g. PDF) when the instructor has added any. |

### 5.5 Instructor Portal (Video and Asset Upload)

| ID | Priority | Requirement |
|---|---|---|
| INST-01 | **P0** | An instructor must be able to create a course with title, description, and thumbnail image. |
| INST-02 | **P0** | An instructor must be able to upload a video lesson to their own course via multer, with the file stored on Cloudinary and its URL saved on the lesson. |
| INST-03 | **P0** | An instructor must see an upload progress indicator and a clear error message if the upload fails or the file type or size is invalid. |
| INST-04 | **P0** | An instructor must see a list of their own courses and lessons, and must not see or modify other instructors' courses. |
| INST-05 | **P1** | An instructor must be able to edit and delete (soft delete) their courses and lessons. |
| INST-06 | **P1** | An instructor must be able to reorder lessons within a course; the new order must be reflected to students. |
| INST-07 | **P1** | An instructor must be able to toggle a course between Draft and Published; Draft courses must not appear in the public catalog. |
| INST-08 | **P1** | An instructor must be able to attach files (PDF, etc.) to a lesson. |
| INST-09 | **P1** | An instructor dashboard must show the enrollment count for each of their courses. |

### 5.6 Progress Tracking

| ID | Priority | Requirement |
|---|---|---|
| PROG-01 | **P0** | A student must be able to mark a lesson as complete; the state must persist after page refresh and re-login. |
| PROG-02 | **P0** | A student must see a progress percentage per enrolled course, calculated as `completed lessons / total lessons × 100`. |
| PROG-03 | **P0** | Progress must be stored per student per course on the server and mirrored in the Redux store for instant UI updates. |
| PROG-04 | **P1** | A student must be able to un-mark a completed lesson; the percentage must update accordingly. |
| PROG-05 | **P1** | A course must display a "Completed" badge when progress reaches 100%. |

### 5.7 Polish and AI

| ID | Priority | Requirement |
|---|---|---|
| UX-01 | **P2** | Every data-driven screen must have loading, empty, and error states. |
| UX-02 | **P2** | All screens must be usable at mobile (375px), tablet, and desktop widths. |
| AI-01 | **P2** | One AI-assisted feature (to be selected in Sprint 16, e.g. lesson summaries) must work end to end without adding new database collections or changing P0/P1 behavior. |

---

## 6. Out of Scope

These are excluded to prevent scope creep. A new feature may enter scope only by replacing something of equal size.

- **Payments** (Stripe/Razorpay): all courses are free to enroll
- **Live classes** and video conferencing
- **Certificates** of completion
- **Discussion forums**, comments, and Q&A
- **Quizzes, assignments, and grading**
- **Ratings and reviews**
- **Admin panel** and super-admin role
- **Email and push notifications**
- **Video transcoding, DRM, and adaptive streaming** beyond what Cloudinary provides
- **Social login, multi-tenancy, internationalization, gamification**
- **Native mobile apps** (responsive web only)

---

## 7. Data Model

Four collections (full ERD in section 11). Progress is embedded in Enrollments as `completedLessons`, so there is no separate Progress collection.

| Collection | Key fields | Status |
|---|---|---|
| **Users** | name, email (unique, lowercase), password (bcrypt hash, hidden from queries), role (`student` \| `instructor`) | Implemented |
| **Courses** | title, description, category, level, thumbnailUrl, instructorId → Users, isPublished, lessonCount, isDeleted | Planned |
| **Lessons** | courseId → Courses, title, order, videoUrl, videoPublicId, duration, attachments[], isDeleted | Planned |
| **Enrollments** | userId → Users, courseId → Courses, completedLessons[] → Lessons, lastLessonId, lastAccessedAt, enrolledAt (unique on userId + courseId) | Planned |

Course progress is derived, not stored: `completedLessons.length / lessonCount × 100`.

---

## 8. Authentication (Sprint 14)

**Register and login**
1. The client sends `POST /api/auth/register` or `POST /api/auth/login` as JSON to the URL in `NEXT_PUBLIC_API_URL`.
2. On registration the `User` model's pre-save hook generates a salt (`bcrypt.genSalt(10)`) and hashes the password with bcryptjs. It re-hashes only when the password field changes, so no route can store a plain-text password.
3. The server signs a JWT (`{ id, role }`, HS256, 7 day expiry by default) and returns `{ token, user: { id, name, email, role } }`. The password hash is never included in any response.
4. The client stores the token and user in `localStorage` and redirects to `/dashboard`.

**Protected requests**
- The `protect` middleware reads `Authorization: Bearer <token>`, verifies it with `jwt.verify` and `JWT_SECRET`, loads the user (without the password) onto `req.user`, and returns a 401 with a clear message and code for each failure: `NO_TOKEN`, `MALFORMED_HEADER`, `MALFORMED_TOKEN`, `INVALID_TOKEN`, `TOKEN_EXPIRED`, `USER_NOT_FOUND`.
- `GET /api/auth/me` is protected and returns the current user's profile.

**Client route guard**
- The `useRequireAuth` hook runs on `/dashboard`. It decodes the stored token with `jwt-decode` and, if the token is missing, malformed, or expired, clears storage and redirects to `/login`.
- If the token looks valid it calls `GET /api/auth/me`. A 401 clears the session and redirects; a network error shows a retry option without logging the user out.
- No dashboard content renders until the server has confirmed the token, so typing `/dashboard` while logged out redirects to `/login` with no flash of protected content.

**Security notes**
- Login returns the same generic `401 Invalid credentials` for an unknown email and a wrong password, and runs a dummy bcrypt comparison for unknown emails so response time does not reveal which emails exist.
- Duplicate emails are rejected with a 409 using the unique index, which also covers simultaneous requests.
- CORS allows only the origins listed in `CLIENT_URL` (comma-separated).
- The token is stored in `localStorage` as the sprint requires. This is readable by any script on the page, so an httpOnly cookie would be the more secure production choice.

---

## 9. API Endpoints

### Implemented

| Method | Path | Purpose | Access |
|---|---|---|---|
| GET | `/api/health` | Server status and database connection state | Public |
| POST | `/api/auth/register` | Create account (name, email, password, optional role); returns `{ token, user }` | Public |
| POST | `/api/auth/login` | Log in; returns `{ token, user }` | Public |
| GET | `/api/auth/me` | Current user's profile | Any logged-in user |

### Planned

| Method | Path | Purpose | Role | Priority |
|---|---|---|---|---|
| GET | `/api/courses` | Paginated published catalog (search, filters) | Public | P0 (filters P1) |
| GET | `/api/courses/:id` | Course detail | Public | P0 |
| GET | `/api/courses/:id/lessons` | Lesson list without video URLs | Public | P0 |
| GET | `/api/instructor/courses` | Instructor's own courses | Instructor | P0 |
| POST | `/api/courses` | Create course | Instructor | P0 |
| POST | `/api/lessons/upload` | Upload a video lesson to Cloudinary | Instructor (owner) | P0 |
| GET | `/api/lessons/:id` | Full lesson with video URL | Enrolled student or owner | P0 |
| POST | `/api/enrollments` | Enroll in a course (409 if already enrolled) | Student | P0 |
| GET | `/api/enrollments/me` | My enrollments with progress | Student | P0 |
| PATCH | `/api/enrollments/:id/progress` | Mark or unmark a lesson complete | Student (owner) | P0 |
| PATCH / DELETE | `/api/courses/:id`, `/api/lessons/:id` | Edit and soft-delete | Instructor (owner) | P1 |
| PATCH | `/api/courses/:id/publish` | Toggle Draft / Published | Instructor (owner) | P1 |
| PATCH | `/api/courses/:id/lessons/reorder` | Reorder lessons | Instructor (owner) | P1 |
| PATCH | `/api/enrollments/:id/position` | Save playback position | Student (owner) | P1 |
| DELETE | `/api/enrollments/:id` | Unenroll | Student (owner) | P1 |

---

## 10. UI/UX Wireframes (Figma)

> **Figma file:** `TODO: paste public Figma link here`

Planned viewports (mobile responsive for each):

1. Auth screen (Login / Register)
2. Course catalog
3. Student dashboard
4. Course player (lesson page)
5. Instructor upload portal

---

## 11. System Architecture

### Entity Relationship Diagram

![EduCore ERD](docs/diagrams/erd.png)

### Redux State Tree

![EduCore Redux state tree](docs/diagrams/state-tree.png)

Editable sources: [`erd.dbml`](docs/diagrams/erd.dbml) and [`state-tree.mmd`](docs/diagrams/state-tree.mmd).

---

## 12. Getting Started

**Prerequisites:** Node.js 18 or higher and a MongoDB Atlas cluster (free M0 tier is enough).

### Backend (`server/`)

```bash
cd server
npm install
cp .env.example .env      # PowerShell: Copy-Item .env.example .env
npm run dev               # http://localhost:5000
```

| Variable | Purpose |
|---|---|
| `PORT` | Server port (defaults to 5000; Render sets it automatically) |
| `CLIENT_URL` | Allowed frontend origin(s) for CORS, comma-separated, no trailing slash |
| `MONGO_URI` | Atlas connection string, including the database name (`.../educore?...`) |
| `JWT_SECRET` | Long random string used to sign tokens |
| `JWT_EXPIRES_IN` | Optional token lifetime (default `7d`) |

To check password hashing, run `node scripts/testUser.js` from `server/`. It creates a test user, prints the stored document, and verifies the hash, hidden field, and `comparePassword` behavior (`--cleanup` deletes the test user afterwards).

### Frontend (`client/`)

```bash
cd client
npm install
cp .env.example .env.local   # PowerShell: Copy-Item .env.example .env.local
npm run dev                  # http://localhost:3000
```

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_API_URL` | Backend base URL, no trailing slash (for example `http://localhost:5000`) |

### Deployment

- **Atlas:** Network Access allows `0.0.0.0/0`, because Render's free tier has no fixed outbound IP.
- **Render (API):** root directory `server`, build command `npm install`, start command `npm start`, with `MONGO_URI`, `JWT_SECRET`, `CLIENT_URL`, and `NODE_ENV=production` set as environment variables.
- **Vercel (client):** root directory `client`, with `NEXT_PUBLIC_API_URL` set to the Render URL. Redeploy after changing it.
- **CORS:** `CLIENT_URL` on Render must include the exact Vercel production domain.

---

## 13. Repository Structure

```
prodesk-capstone-EduCore/
├── client/                      # Next.js (App Router) frontend
│   ├── src/
│   │   ├── app/                 # pages: /, /login, /register, /dashboard
│   │   ├── hooks/               # useRequireAuth (route guard)
│   │   └── lib/                 # api.js (fetch helpers), auth.js (token storage)
│   └── .env.example
├── server/                      # Express API
│   ├── src/
│   │   ├── config/              # Atlas connection
│   │   ├── controllers/         # register, login, getMe
│   │   ├── middleware/          # protect (JWT verification)
│   │   ├── models/              # User
│   │   ├── routes/              # /api/auth
│   │   ├── app.js               # Express app, CORS, routes
│   │   └── index.js             # entry point
│   ├── scripts/                 # testUser.js
│   └── .env.example
├── docs/
│   ├── wireframes/              # exported Figma frames
│   └── diagrams/                # ERD and state tree (PNG + sources)
├── Prompts.md                   # AI prompt log
└── README.md                    # This PRD
```

---

## 14. Execution Roadmap

| Sprint | Focus | Deliverable | Status |
|---|---|---|---|
| **13** | Planning | PRD, Figma wireframes, ERD | Done |
| **14** | Walking Skeleton | Registration, bcrypt hashing, JWT login, protected routes (server and client), live deployment | Done |
| **15** | Core features and CRUD | Remaining P0 features (catalog, enrollment, player, instructor upload, progress), then P1 edit/delete flows | Planned |
| **16** | AI and UX polish | P2 requirements | Planned |
| **17** | CI/CD | Pipeline, final deployment, go-live | Planned |

---

## 16. Author

**Akarsh Kumar** Full-stack Engineer, Prodesk Capstone
