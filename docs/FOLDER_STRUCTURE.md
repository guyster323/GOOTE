# GOOTE - Project Folder Structure

> 프로젝트 디렉토리 구조
> 버전: 1.0.0

---

## 프로젝트 구조

```
goote/
├── docs/                          # 문서
│   ├── PRD.md                     # 기능 명세서
│   ├── ARCHITECTURE.md            # 시스템 아키텍처
│   ├── FOLDER_STRUCTURE.md        # 폴더 구조 (현재 파일)
│   ├── ROADMAP.md                 # 개발 로드맵
│   └── WIREFRAMES.md              # UI/UX 와이어프레임
│
├── src/                           # 소스 코드
│   ├── app/                       # Next.js App Router
│   │   ├── (auth)/                # 인증 관련 라우트 그룹
│   │   │   ├── login/
│   │   │   │   └── page.tsx
│   │   │   └── layout.tsx
│   │   │
│   │   ├── (dashboard)/           # 대시보드 라우트 그룹
│   │   │   ├── layout.tsx         # 대시보드 공통 레이아웃
│   │   │   ├── page.tsx           # 홈 (/)
│   │   │   ├── my-apps/           # 내 개발앱
│   │   │   │   ├── page.tsx
│   │   │   │   ├── new/
│   │   │   │   │   └── page.tsx   # 앱 등록
│   │   │   │   └── [appId]/
│   │   │   │       ├── page.tsx   # 앱 상세
│   │   │   │       └── edit/
│   │   │   │           └── page.tsx
│   │   │   │
│   │   │   ├── my-tests/          # 참여 테스트
│   │   │   │   └── page.tsx
│   │   │   │
│   │   │   ├── explore/           # 앱 탐색
│   │   │   │   ├── page.tsx
│   │   │   │   └── [appId]/
│   │   │   │       └── page.tsx   # 앱 상세 (참여용)
│   │   │   │
│   │   │   ├── notifications/     # 알림
│   │   │   │   └── page.tsx
│   │   │   │
│   │   │   ├── statistics/        # 통계
│   │   │   │   └── page.tsx
│   │   │   │
│   │   │   ├── rankings/          # 랭킹
│   │   │   │   └── page.tsx
│   │   │   │
│   │   │   ├── settings/          # 설정
│   │   │   │   └── page.tsx
│   │   │   │
│   │   │   └── guide/             # 가이드
│   │   │       └── page.tsx
│   │   │
│   │   ├── admin/                 # 관리자
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx           # 관리자 대시보드
│   │   │   ├── users/
│   │   │   │   └── page.tsx
│   │   │   ├── apps/
│   │   │   │   └── page.tsx
│   │   │   ├── reports/
│   │   │   │   └── page.tsx
│   │   │   └── announcements/
│   │   │       └── page.tsx
│   │   │
│   │   ├── api/                   # API Routes (필요시)
│   │   │   └── ...
│   │   │
│   │   ├── layout.tsx             # 루트 레이아웃
│   │   ├── loading.tsx            # 전역 로딩
│   │   ├── error.tsx              # 전역 에러
│   │   ├── not-found.tsx          # 404
│   │   └── globals.css            # 전역 스타일
│   │
│   ├── components/                # 컴포넌트
│   │   ├── ui/                    # shadcn/ui 컴포넌트
│   │   │   ├── button.tsx
│   │   │   ├── card.tsx
│   │   │   ├── dialog.tsx
│   │   │   ├── dropdown-menu.tsx
│   │   │   ├── input.tsx
│   │   │   ├── label.tsx
│   │   │   ├── select.tsx
│   │   │   ├── table.tsx
│   │   │   ├── tabs.tsx
│   │   │   ├── toast.tsx
│   │   │   └── ...
│   │   │
│   │   ├── layout/                # 레이아웃 컴포넌트
│   │   │   ├── header.tsx
│   │   │   ├── sidebar.tsx
│   │   │   ├── mobile-nav.tsx
│   │   │   └── footer.tsx
│   │   │
│   │   ├── auth/                  # 인증 관련
│   │   │   ├── login-button.tsx
│   │   │   ├── user-menu.tsx
│   │   │   └── protected-route.tsx
│   │   │
│   │   ├── app/                   # 앱 관련
│   │   │   ├── app-card.tsx
│   │   │   ├── app-list.tsx
│   │   │   ├── app-form.tsx
│   │   │   ├── app-detail.tsx
│   │   │   ├── app-stats.tsx
│   │   │   └── participation-list.tsx
│   │   │
│   │   ├── test/                  # 테스트 참여 관련
│   │   │   ├── test-card.tsx
│   │   │   ├── daily-check.tsx
│   │   │   ├── progress-tracker.tsx
│   │   │   └── participation-status.tsx
│   │   │
│   │   ├── like/                  # 좋아요/리뷰 관련
│   │   │   ├── like-button.tsx
│   │   │   ├── like-count.tsx
│   │   │   └── review-form.tsx
│   │   │
│   │   ├── ranking/               # 랭킹 관련
│   │   │   ├── ranking-card.tsx
│   │   │   ├── ranking-list.tsx
│   │   │   └── my-rank.tsx
│   │   │
│   │   ├── notification/          # 알림 관련
│   │   │   ├── notification-bell.tsx
│   │   │   ├── notification-list.tsx
│   │   │   └── notification-item.tsx
│   │   │
│   │   ├── statistics/            # 통계 관련
│   │   │   ├── stat-card.tsx
│   │   │   ├── activity-chart.tsx
│   │   │   └── progress-chart.tsx
│   │   │
│   │   └── common/                # 공통 컴포넌트
│   │       ├── loading-spinner.tsx
│   │       ├── empty-state.tsx
│   │       ├── error-boundary.tsx
│   │       ├── confirm-dialog.tsx
│   │       ├── avatar.tsx
│   │       └── page-header.tsx
│   │
│   ├── lib/                       # 유틸리티/설정
│   │   ├── firebase/              # Firebase 설정
│   │   │   ├── config.ts          # Firebase 초기화
│   │   │   ├── auth.ts            # Auth 헬퍼
│   │   │   ├── firestore.ts       # Firestore 헬퍼
│   │   │   └── storage.ts         # Storage 헬퍼
│   │   │
│   │   ├── utils/                 # 유틸리티 함수
│   │   │   ├── cn.ts              # className 유틸
│   │   │   ├── date.ts            # 날짜 유틸
│   │   │   ├── validation.ts      # 검증 유틸
│   │   │   └── format.ts          # 포맷 유틸
│   │   │
│   │   └── constants/             # 상수
│   │       ├── routes.ts          # 라우트 상수
│   │       ├── config.ts          # 앱 설정
│   │       └── messages.ts        # 메시지 상수
│   │
│   ├── hooks/                     # 커스텀 훅
│   │   ├── use-auth.ts            # 인증 훅
│   │   ├── use-user.ts            # 사용자 훅
│   │   ├── use-apps.ts            # 앱 데이터 훅
│   │   ├── use-participations.ts  # 참여 데이터 훅
│   │   ├── use-notifications.ts   # 알림 훅
│   │   ├── use-rankings.ts        # 랭킹 훅
│   │   └── use-toast.ts           # 토스트 훅
│   │
│   ├── stores/                    # Zustand 스토어
│   │   ├── auth-store.ts          # 인증 상태
│   │   ├── ui-store.ts            # UI 상태
│   │   └── notification-store.ts  # 알림 상태
│   │
│   ├── types/                     # TypeScript 타입
│   │   ├── user.ts
│   │   ├── app.ts
│   │   ├── participation.ts
│   │   ├── like.ts
│   │   ├── notification.ts
│   │   ├── ranking.ts
│   │   └── index.ts               # 타입 export
│   │
│   └── services/                  # API 서비스
│       ├── user-service.ts
│       ├── app-service.ts
│       ├── participation-service.ts
│       ├── like-service.ts
│       ├── notification-service.ts
│       ├── ranking-service.ts
│       └── mail-service.ts
│
├── functions/                     # Firebase Functions
│   ├── src/
│   │   ├── index.ts               # 함수 엔트리포인트
│   │   ├── triggers/              # Firestore 트리거
│   │   │   ├── on-user-create.ts
│   │   │   ├── on-user-delete.ts
│   │   │   ├── on-participation-create.ts
│   │   │   └── on-app-update.ts
│   │   │
│   │   ├── scheduled/             # 스케줄 함수
│   │   │   ├── send-daily-mails.ts
│   │   │   └── update-rankings.ts
│   │   │
│   │   ├── http/                  # HTTP 함수
│   │   │   └── admin.ts
│   │   │
│   │   ├── services/              # 서비스 로직
│   │   │   ├── mail-service.ts
│   │   │   └── ranking-service.ts
│   │   │
│   │   └── utils/                 # 유틸리티
│   │       ├── gmail.ts
│   │       └── encryption.ts
│   │
│   ├── package.json
│   └── tsconfig.json
│
├── public/                        # 정적 파일
│   ├── images/
│   │   ├── logo.svg
│   │   └── default-avatar.png
│   ├── favicon.ico
│   └── manifest.json
│
├── .github/                       # GitHub 설정
│   └── workflows/
│       └── deploy.yml
│
├── .env.example                   # 환경변수 예시
├── .env.local                     # 로컬 환경변수 (git ignore)
├── .gitignore
├── .eslintrc.json
├── .prettierrc
├── components.json                # shadcn/ui 설정
├── firebase.json                  # Firebase 설정
├── firestore.rules                # Firestore 보안 규칙
├── firestore.indexes.json         # Firestore 인덱스
├── storage.rules                  # Storage 보안 규칙
├── next.config.js
├── tailwind.config.ts
├── tsconfig.json
├── package.json
└── README.md
```

---

## 주요 디렉토리 설명

### `/src/app`
Next.js 14 App Router 기반 라우팅. 라우트 그룹을 사용하여 인증(`(auth)`)과 대시보드(`(dashboard)`)를 구분.

### `/src/components`
- **ui/**: shadcn/ui 기본 컴포넌트
- **layout/**: 레이아웃 관련 (헤더, 사이드바)
- **도메인별 폴더**: app, test, like, ranking 등 기능별 분리

### `/src/lib`
- **firebase/**: Firebase SDK 초기화 및 헬퍼 함수
- **utils/**: 공통 유틸리티 함수
- **constants/**: 상수 값

### `/src/hooks`
React Query와 Firebase 연동을 위한 커스텀 훅

### `/src/stores`
Zustand 기반 클라이언트 상태 관리

### `/src/services`
Firestore CRUD 로직 캡슐화

### `/functions`
Firebase Cloud Functions (서버리스 백엔드)

---

## 네이밍 컨벤션

| 대상 | 컨벤션 | 예시 |
|------|--------|------|
| 폴더/파일 | kebab-case | `my-apps`, `app-card.tsx` |
| 컴포넌트 | PascalCase | `AppCard`, `DailyCheck` |
| 함수/변수 | camelCase | `getApps`, `isLoading` |
| 상수 | SCREAMING_SNAKE_CASE | `MAX_TESTERS`, `API_URL` |
| 타입/인터페이스 | PascalCase | `User`, `AppData` |

---

## 파일 생성 가이드

### 새 페이지 추가
```bash
src/app/(dashboard)/new-page/page.tsx
```

### 새 컴포넌트 추가
```bash
# 도메인 컴포넌트
src/components/domain-name/component-name.tsx

# 공통 컴포넌트
src/components/common/component-name.tsx
```

### 새 Firebase Function 추가
```bash
functions/src/triggers/on-event-name.ts
# 또는
functions/src/scheduled/task-name.ts
```
