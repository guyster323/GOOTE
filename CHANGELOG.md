# Changelog

## v0.7.0 - 2026-02-18

### Added
- 앱 상세 페이지에서 기존 참여 테스터가 Android/Web 참여 링크 클릭 시 오늘 참여 카운트가 반영되도록 track-daily 경유 로직 추가
- 참여 중인 테스트 목록의 오늘의 출석 체크 버튼이 Android 참여 링크를 열고 동일 카운트를 반영하도록 변경

### Changed
- track-daily API가 lastCheckIn뿐 아니라 dailyChecks.{yyyy-MM-dd}도 함께 기록하도록 개선
- 날짜 계산 기준을 KST(Asia/Seoul)로 통일해 일일 판정 일관성 확보
- 로그인 페이지 릴리즈 노트 및 UI 버전 표기를 v0.7로 업데이트
- 사이드바 버전 표기를 v0.7로 업데이트

### Fixed
- 일일 메일 스케줄러(09:30/17:30)에서 일부 발송 실패가 전체 배치를 중단시키지 않도록 Promise.allSettled 적용
- testerEmail 누락 데이터는 경고 로그 후 스킵하도록 가드 추가
