# GOOTE - System Architecture

> 시스템 아키텍처 문서
> 버전: 1.0.0

---

## 1. 시스템 개요

```
┌─────────────────────────────────────────────────────────────────────┐
│                            GOOTE System                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────────────┐ │
│  │   Browser    │────▶│  Firebase    │────▶│   External APIs      │ │
│  │  (Next.js)   │◀────│   Hosting    │◀────│   (Gmail, etc.)      │ │
│  └──────────────┘     └──────────────┘     └──────────────────────┘ │
│         │                    │                                       │
│         ▼                    ▼                                       │
│  ┌──────────────┐     ┌──────────────┐                              │
│  │   Firebase   │     │   Firebase   │                              │
│  │     Auth     │     │  Firestore   │                              │
│  └──────────────┘     └──────────────┘                              │
│                              │                                       │
│                              ▼                                       │
│                       ┌──────────────┐                              │
│                       │   Firebase   │                              │
│                       │  Functions   │                              │
│                       └──────────────┘                              │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. 기술 스택

### 2.1 Frontend

| 기술 | 버전 | 용도 |
|------|------|------|
| **Next.js** | 14.x | React 프레임워크 |
| **TypeScript** | 5.x | 타입 안정성 |
| **Tailwind CSS** | 3.x | 스타일링 |
| **shadcn/ui** | latest | UI 컴포넌트 |
| **Zustand** | 4.x | 상태 관리 |
| **React Query** | 5.x | 서버 상태 관리 |
| **React Hook Form** | 7.x | 폼 관리 |
| **Zod** | 3.x | 스키마 검증 |

### 2.2 Backend (Firebase)

| 서비스 | 용도 |
|--------|------|
| **Firebase Auth** | 사용자 인증 (Google OAuth) |
| **Cloud Firestore** | NoSQL 데이터베이스 |
| **Cloud Functions** | 서버리스 함수 (메일 발송, 스케줄러) |
| **Firebase Hosting** | 정적 파일 호스팅 |
| **Cloud Storage** | 이미지 저장 (앱 아이콘, 스크린샷) |

### 2.3 External APIs

| API | 용도 |
|-----|------|
| **Gmail API** | 이메일 발송 |
| **Google OAuth 2.0** | 사용자 인증 |

### 2.4 Design System

| 도구 | 용도 |
|------|------|
| **UI-UX-Pro-Max-Skill** | AI 기반 디자인 시스템 |
| **Lucide Icons** | 아이콘 |

---

## 3. 데이터 모델

### 3.1 ERD

```
┌─────────────┐       ┌─────────────┐       ┌─────────────┐
│    User     │       │     App     │       │Participation│
├─────────────┤       ├─────────────┤       ├─────────────┤
│ uid (PK)    │──┐    │ id (PK)     │──┐    │ id (PK)     │
│ email       │  │    │ developerId │◀─┼────│ appId       │
│ nickname    │  └───▶│ name        │  │    │ testerId    │◀─┐
│ profileImage│       │ link        │  │    │ dailyChecks │  │
│ role        │       │ status      │  │    │ status      │  │
│ stats       │       │ stats       │  │    └─────────────┘  │
└─────────────┘       └─────────────┘  │                      │
       │                    │          │    ┌─────────────┐   │
       │                    │          │    │    Like     │   │
       │                    │          │    ├─────────────┤   │
       │                    │          │    │ id (PK)     │   │
       │                    │          │    │ fromUserId  │◀──┤
       │                    └──────────┼───▶│ toType      │   │
       │                               │    │ toId        │   │
       └───────────────────────────────┴───▶│ review      │   │
                                            └─────────────┘   │
                                                              │
       ┌─────────────┐       ┌─────────────┐                  │
       │   MailLog   │       │Notification │                  │
       ├─────────────┤       ├─────────────┤                  │
       │ id (PK)     │       │ id (PK)     │                  │
       │ appId       │       │ userId      │◀─────────────────┘
       │ testerId    │       │ type        │
       │ type        │       │ content     │
       │ status      │       │ read        │
       └─────────────┘       └─────────────┘
```

### 3.2 Firestore Collections

```typescript
// users/{uid}
interface User {
  uid: string;
  email: string;
  nickname: string;
  profileImage: string;
  role: 'user' | 'admin';
  createdAt: Timestamp;
  updatedAt: Timestamp;
  stats: {
    appsRegistered: number;
    testsJoined: number;
    testsCompleted: number;
    totalLikes: number;
    totalConsecutiveDays: number;
  };
  settings: {
    emailNotifications: boolean;
  };
}

// apps/{appId}
interface App {
  id: string;
  developerId: string;
  developerNickname: string;
  name: string;
  participationLink: string;
  packageName?: string;
  description?: string;
  iconUrl?: string;
  screenshots?: string[];
  category?: 'game' | 'utility' | 'productivity' | 'other';
  testDuration: number; // 7-30, default 14
  minTesters: number; // default 20
  mailTime: string; // "09:30"
  mailTemplate?: string;
  mailSender: 'developer' | 'system';
  reward?: string;
  recruitmentType: 'manual' | 'auto' | 'deadline';
  recruitmentDeadline?: Timestamp;
  status: 'recruiting' | 'testing' | 'completed' | 'deleted';
  createdAt: Timestamp;
  updatedAt: Timestamp;
  stats: {
    likes: number;
    participants: number;
    completedTesters: number;
  };
}

// participations/{participationId}
interface Participation {
  id: string;
  appId: string;
  appName: string;
  testerId: string;
  testerNickname: string;
  testerEmail: string;
  startDate: Timestamp;
  targetDays: number;
  dailyChecks: {
    [date: string]: boolean; // "2024-02-08": true
  };
  consecutiveDays: number;
  status: 'active' | 'completed' | 'abandoned';
  emailOptOut: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  completedAt?: Timestamp;
}

// likes/{likeId}
interface Like {
  id: string;
  fromUserId: string;
  fromUserNickname: string;
  toType: 'app' | 'user';
  toId: string;
  toName: string;
  review?: string;
  createdAt: Timestamp;
}

// mailLogs/{logId}
interface MailLog {
  id: string;
  appId: string;
  testerId: string;
  testerEmail: string;
  type: 'daily' | 'encouragement' | 'completion';
  subject: string;
  status: 'sent' | 'failed';
  error?: string;
  sentAt: Timestamp;
}

// notifications/{notificationId}
interface Notification {
  id: string;
  userId: string;
  type: 'tester_joined' | 'tester_left' | 'test_completed' |
        'mail_failed' | 'like_received' | 'review_received' |
        'app_completed' | 'system';
  title: string;
  content: string;
  linkTo?: string;
  read: boolean;
  createdAt: Timestamp;
}

// rankings/{weekId}
interface WeeklyRanking {
  weekId: string; // "2024-W06"
  generatedAt: Timestamp;
  topApps: Array<{
    appId: string;
    name: string;
    developerNickname: string;
    likes: number;
  }>;
  topDevelopers: Array<{
    userId: string;
    nickname: string;
    appsCount: number;
    completedTests: number;
    score: number;
  }>;
  topTesters: Array<{
    userId: string;
    nickname: string;
    testsJoined: number;
    totalDays: number;
    score: number;
  }>;
}

// reports/{reportId}
interface Report {
  id: string;
  reporterId: string;
  targetType: 'app' | 'user';
  targetId: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: Timestamp;
  processedAt?: Timestamp;
  processedBy?: string;
}

// announcements/{announcementId}
interface Announcement {
  id: string;
  title: string;
  content: string;
  authorId: string;
  isActive: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

---

## 4. API 설계

### 4.1 Firebase Functions

```typescript
// 인증 관련
functions.auth.user().onCreate() // 사용자 생성 시 초기화
functions.auth.user().onDelete() // 사용자 삭제 시 정리

// 스케줄러
functions.pubsub.schedule('30 9 * * *') // 매일 09:30 메일 발송
functions.pubsub.schedule('0 0 * * 1')  // 매주 월요일 랭킹 갱신

// HTTP Functions
POST /api/apps                    // 앱 등록
PUT  /api/apps/:id                // 앱 수정
DELETE /api/apps/:id              // 앱 삭제
POST /api/apps/:id/complete       // 출시 완료

POST /api/participations          // 테스트 참여
POST /api/participations/:id/check // 일일 체크
POST /api/participations/:id/abandon // 참여 중단

POST /api/likes                   // 좋아요
DELETE /api/likes/:id             // 좋아요 취소

POST /api/mail/send               // 수동 메일 발송

// Admin Functions
GET  /api/admin/users             // 사용자 목록
POST /api/admin/users/:id/ban     // 사용자 차단
GET  /api/admin/reports           // 신고 목록
POST /api/admin/reports/:id       // 신고 처리
```

### 4.2 Gmail API Integration

```typescript
// OAuth 2.0 Flow
1. 사용자가 Gmail 발송 권한 동의
2. Access Token + Refresh Token 저장 (암호화)
3. 메일 발송 시 Token 사용
4. Token 만료 시 자동 갱신

// 메일 발송
POST https://gmail.googleapis.com/gmail/v1/users/me/messages/send
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "raw": base64EncodedEmail
}
```

---

## 5. 보안

### 5.1 Firestore Security Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // 인증 필수
    function isAuthenticated() {
      return request.auth != null;
    }

    // 본인 확인
    function isOwner(userId) {
      return request.auth.uid == userId;
    }

    // 관리자 확인
    function isAdmin() {
      return get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }

    // Users
    match /users/{userId} {
      allow read: if isAuthenticated();
      allow create: if isOwner(userId);
      allow update: if isOwner(userId) || isAdmin();
      allow delete: if isOwner(userId) || isAdmin();
    }

    // Apps
    match /apps/{appId} {
      allow read: if isAuthenticated();
      allow create: if isAuthenticated();
      allow update: if isAuthenticated() &&
        (resource.data.developerId == request.auth.uid || isAdmin());
      allow delete: if isAuthenticated() &&
        (resource.data.developerId == request.auth.uid || isAdmin());
    }

    // Participations
    match /participations/{participationId} {
      allow read: if isAuthenticated() &&
        (resource.data.testerId == request.auth.uid ||
         get(/databases/$(database)/documents/apps/$(resource.data.appId)).data.developerId == request.auth.uid);
      allow create: if isAuthenticated();
      allow update: if isAuthenticated() && resource.data.testerId == request.auth.uid;
    }

    // Likes
    match /likes/{likeId} {
      allow read: if isAuthenticated();
      allow create: if isAuthenticated();
      allow delete: if isAuthenticated() && resource.data.fromUserId == request.auth.uid;
    }

    // Notifications
    match /notifications/{notificationId} {
      allow read: if isAuthenticated() && resource.data.userId == request.auth.uid;
      allow update: if isAuthenticated() && resource.data.userId == request.auth.uid;
    }

    // Rankings (read-only for users)
    match /rankings/{rankingId} {
      allow read: if isAuthenticated();
    }

    // Admin only
    match /reports/{reportId} {
      allow read: if isAdmin();
      allow create: if isAuthenticated();
      allow update: if isAdmin();
    }

    match /announcements/{announcementId} {
      allow read: if isAuthenticated();
      allow write: if isAdmin();
    }
  }
}
```

### 5.2 인증 토큰 관리

```typescript
// Gmail OAuth Token 암호화 저장
// Firebase Functions에서만 접근 가능
// users/{uid}/private/tokens (별도 subcollection)

interface UserTokens {
  gmail: {
    accessToken: string;  // AES-256 암호화
    refreshToken: string; // AES-256 암호화
    expiresAt: Timestamp;
  };
}
```

---

## 6. 인프라

### 6.1 Firebase 프로젝트 구성

```
goote-production (프로덕션)
├── Authentication
│   └── Google Provider
├── Firestore
│   └── (asia-northeast3) 서울 리전
├── Functions
│   └── (asia-northeast3) 서울 리전
├── Hosting
│   └── goote.web.app
└── Storage
    └── 이미지 저장
```

### 6.2 환경 변수

```bash
# .env.local
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

# Firebase Functions 환경변수
GMAIL_CLIENT_ID=
GMAIL_CLIENT_SECRET=
ENCRYPTION_KEY=
```

---

## 7. 성능 최적화

### 7.1 Firestore 인덱스

```yaml
# firestore.indexes.json
{
  "indexes": [
    {
      "collectionGroup": "apps",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "participations",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "testerId", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "notifications",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "userId", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    }
  ]
}
```

### 7.2 캐싱 전략

```typescript
// React Query 캐싱
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5분
      gcTime: 1000 * 60 * 30,   // 30분
    },
  },
});

// 실시간 업데이트가 필요한 데이터
// - 알림: onSnapshot 사용
// - 참여 현황: onSnapshot 사용

// 캐싱 가능한 데이터
// - 앱 목록: staleTime 5분
// - 랭킹: staleTime 1시간
// - 사용자 프로필: staleTime 10분
```

---

## 8. 모니터링

### 8.1 Firebase 내장 모니터링

- Performance Monitoring
- Crashlytics (Web)
- Analytics

### 8.2 로깅

```typescript
// Cloud Functions 로깅
import { logger } from 'firebase-functions';

logger.info('Mail sent', { appId, testerId });
logger.error('Mail failed', { error, appId, testerId });
```

---

## 9. 배포

### 9.1 배포 파이프라인

```yaml
# GitHub Actions
name: Deploy to Firebase

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run build
      - run: npm run test
      - uses: FirebaseExtended/action-hosting-deploy@v0
        with:
          repoToken: '${{ secrets.GITHUB_TOKEN }}'
          firebaseServiceAccount: '${{ secrets.FIREBASE_SERVICE_ACCOUNT }}'
          channelId: live
          projectId: goote-production
```

### 9.2 배포 명령어

```bash
# 전체 배포
firebase deploy

# Hosting만 배포
firebase deploy --only hosting

# Functions만 배포
firebase deploy --only functions

# Firestore Rules만 배포
firebase deploy --only firestore:rules
```
