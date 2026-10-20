# PILL

[![PILL CI](https://github.com/kimyoungsu61/PILL/actions/workflows/ci.yml/badge.svg)](https://github.com/kimyoungsu61/PILL/actions/workflows/ci.yml)

영양제 라벨 분석과 복용 루틴을 관리하는 앱입니다. Expo 웹 앱과 Spring Boot API를 하나의 Docker 이미지로 배포합니다.

- 라벨 이미지 분석, 회사·제품·성분 정보 확인 및 수정
- 영양제 등록·삭제, 1분 단위 복용 시간 설정
- 복용 완료·취소와 복용 기록 관리
- 홈 화면에 설치하는 웹 앱과 복용 알림
- Gemini 기반 제품 정보와 복용 안내
- 검색으로 확인한 제품 대표사진을 오늘의 복용·영양제 목록에 표시

## 구성

| 경로 | 내용 |
| --- | --- |
| `app/` | Expo · React Native · TypeScript 앱, PWA 파일, 계약 테스트 |
| `server/` | Java 21 · Spring Boot API, MySQL 스키마, 서버 테스트 |
| `Dockerfile` | 웹 빌드 → 서버 패키징 → 실행 이미지 |
| `compose.local.yaml` | PC에서 앱과 개발용 MySQL 실행 |
| `.github/workflows/ci.yml` | 앱·서버 검사 후 배포용 Docker 이미지 빌드 |

## PC에서 Docker로 실행

Node.js 24와 실행 중인 Docker Desktop이 필요합니다.

```sh
node scripts/setup-local.mjs
docker compose -f compose.local.yaml up --build --detach --wait
```

브라우저에서 http://localhost:18082 를 열고 개발용 계정을 만듭니다. 로컬 설정은 `.local/docker/`에 생성됩니다. 스크립트를 다시 실행해도 기존 비밀번호를 덮어쓰지 않습니다.

Gemini 이미지 분석을 사용하려면 최초 설정 전에 `GEMINI_API_KEY` 환경 변수를 지정하거나, 생성된 `.local/docker/GEMINI_API_KEY` 파일에 본인의 키를 저장합니다. 키를 설정하지 않아도 수동 등록과 복용 기록 기능을 사용할 수 있습니다.

```sh
docker compose -f compose.local.yaml logs --tail=100 app
docker compose -f compose.local.yaml down
```

중지해도 MySQL 볼륨에 저장한 기록은 유지됩니다. 로컬 환경에서는 웹 푸시를 끕니다.

## 로그인 유지

아이폰 홈 화면 웹 앱은 HttpOnly·Secure·SameSite 쿠키로 로그인한 날부터 최대 180일 동안 로그인을 유지합니다. 로그인 비밀 값은 웹의 localStorage에 저장하지 않습니다. 네이티브 빌드는 기기 보안 저장소를 사용합니다.

기존의 유효한 웹 로그인은 앱을 다시 열 때 같은 서버 세션으로 이전하므로 연결된 복용 알림을 유지합니다. 앱을 열 때마다 만료일을 연장하지 않으며, 로그아웃하면 서버 세션을 무효화하고 쿠키를 지웁니다. 일시적인 네트워크 오류는 저장된 로그인을 지우지 않습니다. 오프라인에서 로그아웃한 경우에는 기기에 로그아웃 상태를 남겨 자동 로그인 복원을 막고, 다음 실행에서 서버 무효화를 다시 시도합니다.

쿠키를 사용하는 변경 요청은 앱 전용 헤더와 동일 출처 검증을 거칩니다. 로그인 유효기간은 `pill.auth.session-ttl`로 설정합니다.

## 제품 대표사진

대표사진은 등록된 제품의 브랜드·제품명·라벨을 기준으로 찾습니다. 기존에 확인한 검색 출처를 우선 재사용하고, 필요하면 Gemini Google Search로 제품 페이지를 조회합니다. 모델이 작성한 이미지 URL은 사용하지 않으며, 제품명이 일치하는 제조사·판매처 페이지의 Product JSON-LD 또는 Open Graph 사진만 저장합니다. 촬영한 사진과 기기 내부 파일 경로는 목록의 대표사진으로 사용하지 않습니다.

기존 영양제에도 화면을 열 때 비동기로 적용되며 복용 체크를 기다리게 하지 않습니다. 같은 제품의 중복 시간은 검색을 공유하고 동시에 두 제품까지만 조회합니다. 성공한 사진과 출처는 서버에 보관하고, 미확인은 5분, 일시적 조회 실패는 1분 동안 재검색하지 않습니다. 조회 방식이 바뀌면 이전 방식의 실패 결과는 재사용하지 않습니다. 제조사의 짧은 제품 제목과 제품 URL에 명시된 제형·함량·포장 수량을 함께 비교하고, 검색 출처는 최대 8개 확인합니다. 확인되지 않은 제품이나 이미지 로딩 실패는 기존 이니셜로 표시합니다. 공개 페이지 조회는 `ProductImagePageClient`의 제조사·판매처 허용 목록과 HTTPS 리다이렉트 제한을 적용합니다. 원본 라벨·함량·복용 시간·알림은 변경하지 않습니다.

## 자동 검사

`main`으로 push하거나 `main` 대상 pull request를 만들면 GitHub Actions가 실행됩니다.

1. 앱 의존성 설치, 테스트, TypeScript 검사, 웹 export
2. 서버 테스트와 JAR 패키징
3. 두 검사 통과 후 실제 배포용 Docker 이미지 빌드

검사에는 운영 DB, Gemini API 키, 복용 기록이 필요하지 않습니다. Actions에 운영 비밀 값을 저장하지 않습니다. Actions 버전은 커밋 SHA로 고정하고 Dependabot이 월 단위 업데이트를 제안합니다.

수동 검사:

```sh
cd app
npm ci
npm test
```

```sh
cd server
mvn --batch-mode --no-transfer-progress verify
```

## Railway 배포

기존 PILL 서버는 이 저장소의 `main`에 연결되어 있으며 **Wait for CI**가 켜져 있습니다. main 커밋의 GitHub Actions 검사가 통과하면 Railway가 자동 배포합니다. Dockerfile과 `railway.toml`은 저장소 루트에 있습니다.

DB 연결, Gemini 키, 웹 푸시 VAPID 키는 Railway 서비스 환경 변수로 관리합니다. MySQL은 별도 서비스와 영구 볼륨을 사용합니다. 웹 푸시는 HTTPS 환경과 사용자 알림 허용이 필요하며, 아이폰에서는 홈 화면에 설치한 웹 앱에서 사용합니다.

운영 데이터와 계정, 이미지 원본, 실패한 분석 기록, 개인 PC 설정 및 키 파일은 이 소스 저장소에 포함하지 않습니다.
