# EduCore: Enterprise Learning Management System

> **Track:** Fullstack | **Project type:** Individual capstone (Prodesk, Sprint 13 to 17)
> **Status:** Sprint 13, Architecture Blueprint (planning only)

---

## 1. Project Overview

EduCore is a scalable Learning Management System in the style of Udemy and Coursera. Students often struggle to find structured courses, keep their place across lessons, and see how far they have come. Instructors, meanwhile, lack a simple way to publish video lessons and supporting material without wrestling with hosting. EduCore gives students a searchable course catalog, a distraction-free video player, and a dashboard that shows per-course progress. It gives instructors a portal to build courses and upload video and asset files, with role-based access keeping the two experiences separate and secure.

---

## 2. Designated Track

**Fullstack**: Next.js client + Express/MongoDB API, built and deployed by one developer.

---

## 3. Tech Stack

| Layer | Technology | Why |
|---|---|---|
| Framework | **Next.js (App Router)** | File-based routing, server and client components, and straightforward Vercel deployment. |
| Styling | **Tailwind CSS** | Utility classes let one developer build responsive layouts quickly without maintaining custom CSS. |
| State | **Redux Toolkit** | Predictable global state for auth, enrolled courses, and progress, with slices and async thunks for API calls. |
| Backend | **Express.js** | Minimal, well-known framework for building a REST API with clear routing and middleware. |
| Database | **MongoDB + Mongoose** | Flexible documents suit nested course/lesson data, and Mongoose adds schemas and validation. |
| Auth | **JWT (jsonwebtoken + bcrypt)** | Stateless authentication that works cleanly between a separate client and API, with role claims for RBAC. |
| File handling | **multer** | Standard Express middleware for parsing multipart uploads before they are sent to cloud storage. |
| Asset storage | **Cloudinary** | Hosts and streams video and files via CDN, so the server never stores or serves large media itself. |

**Deployment (Sprint 17):** Next.js on Vercel, Express API on Render, database on MongoDB Atlas, CI via GitHub Actions.

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

**Role rules enforced on the API, not only in the UI:** every protected route verifies the JWT, then checks the role. Instructor actions also check course ownership (`course.instructor === req.user.id`).

---

## 5. Core Features (Prioritized)

**Priority key:** **P0** = MVP, must ship in Sprint 14. **P1** = Sprint 15, full CRUD and feature completion. **P2** = Sprint 16, AI integration and UX polish.

Each requirement is written to be testable: it has a clear actor, action, and observable result.

### 5.1 Authentication and Roles

| ID | Priority | Requirement |
|---|---|---|
| AUTH-01 | **P0** | A visitor must be able to register with name, email, password, and a role (Student or Instructor). Duplicate emails must be rejected with a clear error. |
| AUTH-02 | **P0** | A registered user must be able to log in and receive a JWT; invalid credentials must return a 401 and show an error message. |
| AUTH-03 | **P0** | Protected API routes must return 401 without a valid token and 403 when the user's role is not permitted. |
| AUTH-04 | **P0** | Passwords must be stored hashed (bcrypt); no plain-text password may appear in the database or in API responses. |
| AUTH-05 | **P1** | A logged-in user must be able to edit their name and password from a profile page. |

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

### 5.7 Polish and AI (Sprint 16)

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

## 7. Data Model (High Level)

Five collections (full ERD in section 9):

| Collection | Key fields |
|---|---|
| **Users** | name, email, passwordHash, role (`student` \| `instructor`) |
| **Courses** | title, description, thumbnailUrl, instructor → Users, status (`draft` \| `published`), isDeleted |
| **Lessons** | course → Courses, title, order, videoUrl, videoPublicId, attachments[], isDeleted |
| **Enrollments** | student → Users, course → Courses, enrolledAt (unique on student + course) |
| **Progress** | student → Users, course → Courses, completedLessons[] → Lessons, lastPosition per lesson |

---

## 8. UI/UX Wireframes (Figma)

> **Figma file:** `TODO: paste public Figma link here`

Planned viewports (mobile responsive for each):

1. Auth screen (Login / Register)
2. Course catalog
3. Student dashboard
4. Course player (lesson page)
5. Instructor upload portal

---

## 9. System Architecture

> **ERD (Entity Relationship Diagram):** `TODO: export from dbdiagram.io / Draw.io and save to docs/diagrams/erd.png`

```md
![EduCore ERD](docs/diagrams/erd.png)
```

> **Redux state tree and API overview:** `TODO: add docs/diagrams/state-tree.png (optional for Fullstack)`

---

## 10. Planned Repository Structure

```
prodesk-capstone-EduCore/
├── client/        # Next.js (App Router) frontend
├── server/        # Express API
├── docs/
│   ├── wireframes/
│   └── diagrams/
├── Prompts.md     # AI prompt log
└── README.md      # This PRD
```

---

## 11. Execution Roadmap

| Sprint | Focus | Deliverable |
|---|---|---|
| **13** | Planning | PRD, Figma wireframes, ERD (this document) |
| **14** | MVP | All P0 requirements working end to end |
| **15** | Full CRUD | All P1 requirements, edit/delete flows |
| **16** | AI + UX polish | P2 requirements |
| **17** | Deployment | CI/CD pipeline and live URLs |

---

## 12. AI Usage

AI-assisted planning queries are documented in [`Prompts.md`](./Prompts.md).

---

## 13. Author

**TODO: Your Name**: Fullstack Engineer, Prodesk Capstone
GitHub: `TODO` | Contact: `TODO`
