# PILL

영양제 라벨 분석과 복용 루틴을 관리하는 앱입니다. Expo 웹 앱과 Spring Boot API를 하나의 Docker 이미지로 배포합니다.

- 라벨 이미지 분석, 회사·제품·성분 정보 확인 및 수정
- 영양제 등록·삭제, 1분 단위 복용 시간 설정
- 복용 완료·취소와 복용 기록 관리
- 홈 화면에 설치하는 웹 앱과 복용 알림
- Gemini 기반 제품 정보와 복용 안내

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

기존 서버 서비스의 소스를 이 저장소의 `main`에 연결하고 **Wait for CI**를 켜면 검사 통과 후 자동 배포할 수 있습니다. Dockerfile과 `railway.toml`은 저장소 루트에 있습니다.

DB 연결, Gemini 키, 웹 푸시 VAPID 키는 Railway 서비스 환경 변수로 관리합니다. MySQL은 별도 서비스와 영구 볼륨을 사용합니다. 웹 푸시는 HTTPS 환경과 사용자 알림 허용이 필요하며, 아이폰에서는 홈 화면에 설치한 웹 앱에서 사용합니다.

운영 데이터와 계정, 이미지 원본, 실패한 분석 기록, 개인 PC 설정 및 키 파일은 이 소스 저장소에 포함하지 않습니다.
