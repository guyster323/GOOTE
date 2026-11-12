# Cloud Build regular 채널 호환성 검증 결과

2026-11-12 한국 시간 기준. **현재 배포 소스에 대한 테스트 빌드 4개 모두 성공했습니다.**

| 빌드 대상 | 런타임 | 결과 | 실제 작업자 버전 | 실행 기록 |
|---|---|---|---|---|
| ssrgootef48d8 | nodejs24 | SUCCESS | 2026.09 | [3bf8a699](https://console.cloud.google.com/cloud-build/builds;region=us-central1/3bf8a699-57d0-4a48-a011-2bed5130c633?project=464908559865) |
| uploadPlayBundleToTestingTrack | nodejs22 | SUCCESS | 2026.09 | [ac539999](https://console.cloud.google.com/cloud-build/builds;region=us-central1/ac539999-6144-45b4-8d1b-1c87b6dd7e6f?project=464908559865) |
| api | nodejs22 | SUCCESS | 2026.09 | [5b454b30](https://console.cloud.google.com/cloud-build/builds;region=us-central1/5b454b30-8215-42bb-90d4-ac06d92a82fb?project=464908559865) |
| onUserCreated | nodejs22 | SUCCESS | 2026.09 | [175f87da](https://console.cloud.google.com/cloud-build/builds;region=us-central1/175f87da-d13e-4fd6-9b5b-13e126651745?project=464908559865) |

## 검증 범위

- 현재 운영 함수 47개가 공유하는 원본 빌드 4개를 재현했습니다.
- options.workerRelease=regular를 지정했고, API 결과에서 실제 작업자 버전 2026.09를 확인했습니다.
- 네 빌드 모두 Docker 버전 확인, 소스 가져오기, pre-buildpack, 이미지 생성 단계를 통과했습니다.
- 원본 소스 ZIP의 존재와 generation을 실행 전에 검사했습니다.
- 운영 이미지 및 캐시 대신 gcf-artifacts/compat-20261112-* 경로를 사용했습니다.
- 실행 전후 운영 함수 47개의 state, build, revision, updateTime이 동일함을 확인했습니다.
- 최종 상태: passed=true, productionUnchanged=true.

## 변경과 보관 자료

- 테스트 빌드 4개와 테스트용 Artifact Registry 이미지/캐시가 생성됐습니다.
- 운영 배포, 운영 채널 설정, IAM은 변경하지 않았습니다.
- 각 *.request.json은 실행 설정이며, *.result.json은 최종 Cloud Build API 결과입니다.
- state.json에 빌드 ID와 판정 결과가 있습니다.
- scripts/verify-cloud-build-regular.cjs 문법 검사와 설정 검사를 통과했습니다.
- 최초 재실행 요청은 이미 치환된 설정에 불필요한 substitutions가 남아 HTTP 400으로 거절됐습니다. 해당 목록을 제거한 뒤 성공한 네 빌드를 생성했습니다.
- 이전 명령 단위의 자동 승인 차단 이후, 파일로 분리된 스크립트 실행은 정상 승인됐습니다.

## 판단과 한계

현재 배포된 Functions/SSR 소스는 현재 regular 작업자 버전 2026.09에서 빌드됩니다. 이번 호환성 검증에서 추가 수정이 필요한 문제는 발견되지 않았습니다.
이 결과는 현재 배포 소스와 현재 채널 버전에 대한 검증입니다. 로컬 미배포 변경사항의 빌드, 앱 기능 테스트, 향후 regular 채널 버전까지 보장하지 않습니다.

공식 채널 안내: https://docs.cloud.google.com/build/docs/release-channels
