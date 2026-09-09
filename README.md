# Neuro Atlas

첨부한 FlyWire CSV 6개를 실제로 읽어 만든 **React + Three.js 신경 연결 탐색기**입니다. 뉴런 검색, 입출력 연결 탐색, 방향성 경로 찾기, 필터, 저장, JSON 내보내기를 제공합니다.

> **이 데이터는 학습된 AI 추론 모델이나 신경 활동 시뮬레이터가 아닙니다.** 첨부 파일에는 해부학적 3D 좌표, 뉴런 골격, 메시가 없습니다. 화면의 좌표는 분류·유형·좌우 정보로 만든 합성 좌표입니다. 연결 관계와 시냅스 수는 원본에서 읽은 값입니다.

## 실행 미리보기

실제 앱에서 3D 회전 → 뉴런 검색 → 주변 연결 → 경로 탐색 → 데이터 확인을 녹화했습니다.

![Neuro Atlas 실행 화면: 3D 회전, 뉴런 검색, 주변 연결 및 경로 탐색](docs/assets/neuro-atlas-demo.gif)

[실행 GIF 다운로드](docs/assets/neuro-atlas-demo.gif) · 28.5초 · 약 30MB

## 바로 실행

전체 ZIP을 해제하고 `neuro-atlas` 디렉터리에서 실행합니다.

```bash
python3 scripts/serve.py
```

브라우저에서 `http://127.0.0.1:4173`을 엽니다. Python 3.10 이상이면 별도 Python 패키지 설치 없이 실행할 수 있습니다. Linux/macOS에서는 `./start.sh`도 가능합니다. Windows에서는 `py scripts/serve.py`를 사용할 수 있습니다.

**간편 실행판은 Three.js만 고정 버전 CDN에서 가져옵니다.** React, UI 코드, 데이터는 로컬 파일입니다. CDN에 접근할 수 없으면 3D 영역에 오류와 안내가 표시되고 데이터 검색·연결·경로 탐색은 계속 사용할 수 있도록 구성했습니다. 인터넷 없는 운영 환경은 아래의 npm 빌드 방식을 사용하세요.

파일을 더블 클릭해서 `file://`로 열지 마세요. Worker, 모듈, 데이터 로딩은 HTTP 서버가 필요합니다. 서버는 기본적으로 로컬 기기에서만 접근 가능한 `127.0.0.1`에 바인딩합니다.

## 일반 React 개발과 배포

Node.js 20.19 이상 및 npm이 필요합니다.

```bash
npm install
npm run dev
```

Vite가 출력하는 로컬 주소를 엽니다. 기본 개발 포트는 5173입니다. 처음 패키지를 설치할 때 npm 레지스트리 연결이 필요합니다.

```bash
npm run build
python3 scripts/serve.py --directory dist
```

이 방식은 React와 Three.js를 빌드 결과에 포함하므로 **런타임 CDN 의존성이 없습니다.** `dist/` 전체를 정적 서버로 배포할 수도 있습니다. HTTPS 또는 localhost를 사용하고 `data/`를 빼놓지 마세요.

현재 실행 환경에서 npm 네트워크 접근이 막혀 `npm install`과 Vite 프로덕션 빌드는 수행하지 못했습니다. 포함된 `portable/`은 JSX를 ESM으로 변환한 별도 간편 실행판이며, Vite 프로덕션 빌드 검증을 대신하지 않습니다. `package-lock.json`도 생성되지 않았습니다. 운영에서는 설치·빌드 검증 후 생성된 잠금 파일을 커밋하세요.

## 포함된 실제 데이터

| 항목 | 확인된 값 |
|---|---:|
| 뉴런 | 139,255 |
| 영역별 연결 행 | 5,342,446 |
| 고유 방향성 뉴런 쌍 | 3,732,460 |
| 시냅스 합계 | 50,666,648 |
| 연결 영역 | 79 |
| 원본에 없는 연결 끝점 | 0 |
| 중복 뉴런 ID | 0 |

데이터 버전 `93f11973e92ae8cf`는 이 앱에서 원본 해시로 생성한 식별자입니다. 원본 CSV만으로 확인할 수 없는 FlyWire 릴리스 번호를 붙이지 않았습니다.

전체 ZIP에는 원본 `.csv.gz` 6개, 변환된 전체 인덱스, 프론트엔드 소스, 간편 실행 코드, 테스트가 들어 있습니다. `public/data/` 약 65 MB를 기본 데이터 저장소로 사용합니다. ZIP에서는 중복 용량을 줄이기 위해 `portable/data/`를 따로 넣지 않았으며, 포함된 `scripts/serve.py`가 `/data/` 요청을 `public/data/`로 연결합니다. 간편 실행판을 다른 정적 서버에 독립 배포하려면 `npm run build:portable`로 데이터까지 포함한 폴더를 다시 생성하거나 `public/data/`를 `portable/data/`로 복사하세요.

## 화면과 조작

| 구역 | 구현한 조작 |
|---|---|
| 3D 화면 | 드래그 회전, 스크롤 확대, Shift + 드래그 이동, 정면·윗면, 전체 맞춤, 자동 회전 |
| 뉴런 탐색 | ID·이름·세포 유형 검색, 목록 페이지 이동, 전달물질·좌우·상위 분류·영역·Rich club 필터 |
| 뉴런 상세 | 원본 문자열 ID, 분류, 태그, 전달물질 예측 점수, 전체 입력·출력 합계 및 고유 이웃 수 |
| 선택 주변 | 실제 1홉 이웃 연결, 입력만·출력만·양방향, 연결 수 제한, 이웃 선택으로 이동 |
| 경로 | 시작·도착 ID, 서로 바꾸기, 최소 홉 방향성 탐색, 중단, 홉·탐색 예산 한도 표시 |
| 표시 설정 | NT·분류·좌우 색상, 점 크기·선 투명도, 표시 밀도, 방향 입자 |
| 저장·내보내기 | 브라우저 뉴런 북마크, 현재 그래프 JSON, 매니페스트 JSON, PNG 캡처 |
| 작은 화면 | 접을 수 있는 탐색·상세 패널, 전체 너비 3D 영역 |

`/` 키로 검색창을 열고 포커스를 이동합니다. 캔버스에 포커스가 있는 상태에서 `0`을 누르면 전체 맞춤입니다. `Esc`는 팝오버와 모바일 패널을 닫습니다.

**방향 입자는 신호가 실제로 발화한다는 뜻이 아닙니다.** 연결 방향을 읽기 위한 애니메이션입니다. 전달물질 예측값만으로 흥분성·억제성 기능을 확정하지 않습니다.

## 전체 데이터와 화면에 보이는 데이터의 차이

전체 연결을 삭제하거나 무작위로 대체하지 않습니다. 모든 원본 연결 행은 양방향 조회 인덱스에 보존합니다. 단, 수백만 개 선을 한 프레임에 모두 그리지 않습니다.

개요는 강한 연결 **26,000쌍**을 후보로 사용하고 기본 18,000개 점·최대 2,200개 선을 표시합니다. 따라서 약한 연결이나 특정 영역의 희소한 연결이 개요에서 보이지 않을 수 있습니다. 개요를 전체 그래프의 무편향 표본으로 사용하면 안 됩니다. 왼쪽 검색은 전체 139,255개 뉴런을 대상으로 하며, 뉴런을 선택하면 전체 인접 데이터에서 필요한 연결을 조회합니다. 상세 패널의 합계와 JSON의 `truncated`는 화면 일부와 전체를 구분합니다.

같은 A→B 연결이 여러 영역에 걸친 경우 **영역 필터 → 방향별 뉴런 쌍 합산 → 최소 시냅스 기준** 순서로 처리합니다. A→B와 B→A는 별개입니다. 전달물질·분류·좌우·태그 필터는 뉴런에 적용되고, 최소 시냅스는 연결 쌍에 적용됩니다. 최소 시냅스 값을 바꿔도 전체 검색 목록의 뉴런 수가 줄지 않을 수 있습니다.

경로 탐색은 원본 인접 인덱스에서 실행하며 개요의 26,000쌍 제한을 사용하지 않습니다. **영역·최소 시냅스** 조건을 따르며, 뉴런 목록의 NT·분류·좌우·태그·저장 필터는 경로를 제한하지 않습니다. UI에도 이 차이를 표시합니다. 최적화 목표는 최소 홉 수이지, 최대 시냅스 합계나 생리학적 전달 시간은 아닙니다.

최대 8홉·12,000개 뉴런의 탐색 예산이 있습니다. 예산이나 홉 한도에 걸린 경우에는 “연결이 없다”고 단정하지 않습니다. 시작과 도착이 같으면 유효한 0홉 경로입니다.

## 데이터 재생성

평소 실행에는 필요하지 않습니다. 원본 변경 시에만 수행합니다.

```bash
python3 -m venv .venv
# Linux/macOS
source .venv/bin/activate
# Windows PowerShell: .venv\Scripts\Activate.ps1
pip install -r requirements-data.txt
python3 scripts/prepare_data.py --input source-data --output public/data
python3 scripts/verify_data.py --data public/data
```

원본 이름은 다음과 같아야 합니다.

```text
source-data/
  neurons.csv.gz
  names.csv.gz
  classification.csv.gz
  connectivity_tags.csv.gz
  consolidated_cell_types.csv.gz
  connections_princeton.csv.gz
```

재생성은 pandas/NumPy로 전체 그래프를 메모리에서 인덱싱합니다. 브라우저 실행보다 메모리 사용량이 크므로 충분한 메모리를 가진 개발 환경에서 수행하세요. 생성 중에는 별도 디렉터리를 쓰고, 끝난 후 매니페스트와 데이터를 교체합니다. 실패하면 기존 데이터가 유지되도록 작성했습니다. 실행 중인 브라우저가 이전 데이터를 읽고 있다면 재생성 후 새로고침하세요. 운영 배포에서는 데이터와 코드 전체를 버전 단위로 교체하는 방식이 안전합니다.

## 구조

```text
src/
  App.jsx                       React 화면·선택·요청 결과 조정
  components/NetworkScene.jsx    Three.js 렌더러·카메라·선택·GPU 리소스 정리
  components/SceneLoader.jsx     3D 라이브러리 로드·오류 격리
  components/ExplorerSidebar.jsx
  components/Inspector.jsx
  components/PathPanel.jsx
  components/DataPanel.jsx
  workers/data.worker.js        gzip 로드·해시 검증·검색·연결·경로
  lib/graph.js                  필터·합산·LOD·BFS·이진 인덱스·JSON 계약
  lib/client.js                 Worker RPC·저장·내보내기
  styles.css
scripts/                        재생성·검증·간편 서버·ESM 변환
public/data/                    전체 버전 데이터셋
portable/                       제공되는 간편 실행 프론트엔드
source-data/                    첨부된 원본 6개
vendor/                         간편 실행용 React 18.2 + MIT 고지
```

대용량 읽기와 계산은 Web Worker에서 처리합니다. 메인 스레드는 UI와 GPU 렌더링을 담당합니다. 512개 뉴런 단위 샤드를 필요할 때만 읽고 LRU 캐시로 재사용합니다. 빠르게 검색·선택을 바꿨을 때 이전 결과가 현재 화면을 덮어쓰지 않도록 처리했습니다. 실패한 연결 요청, 워커 오류, WebGL 초기화 실패, GPU 컨텍스트 손실은 별도로 표시합니다.

## 검증 결과와 남은 확인

- **완료:** Node 테스트 32개. 21개 단위 테스트 + 11개 실제 데이터 Worker 통합 테스트.
- **완료:** 압축 데이터 549개 SHA-256·크기 검증. 입력·출력 인덱스의 모든 뉴런 합계, 5,342,446행, 50,666,648시냅스 보존 검증.
- **완료:** 로컬 HTTP 서버 테스트 4개. 데이터 폴더 공유, 압축 바이트 보존, 경로 이탈 차단 확인.
- **완료:** JSX/JS 13개 모듈의 portable ESM 변환과 구문 진단.
- **미검증:** npm 설치, Vite 프로덕션 빌드, 브라우저 상호작용 전체 흐름, 실제 Three.js/WebGL 렌더링, 장치별 FPS.

외부 패키지 다운로드가 차단되어 Three.js를 설치할 수 없었고, 제공된 Chromium의 관리자 URL 차단 정책 때문에 localhost 페이지 탐색도 실행되지 않았습니다. 이 환경 제약을 통과한 것처럼 처리하지 않았습니다. UI 및 WebGL에 대한 실제 브라우저 검증은 제공된 테스트로 대상 환경에서 수행해야 합니다.

```bash
npm test
python3 -m unittest discover -s tests -p 'test_server.py' -v
python3 scripts/verify_data.py --data public/data
# 별도 터미널에서 서버를 먼저 실행한 후
pip install playwright
python3 -m playwright install chromium
python3 tests/browser_checks.py
```

기존 Chromium 경로를 쓰려면 `CHROMIUM_EXECUTABLE=/path/to/chromium`을 설정할 수 있습니다. 테스트 주소는 `NEURO_TEST_URL`로 변경합니다. 브라우저 테스트 파일은 이 환경에서 **통과하지 않은 테스트**입니다. 마지막 성공 보고서가 있다면 실행 날짜와 결과를 확인하세요.

세부 결과는 `docs/verification-summary.json`, `docs/data-verification.json`, `docs/node-test-results.txt`를 참조하세요.

## 운영 시 주의

표준 `DecompressionStream`, Web Workers, WebGL2를 지원하는 현대 브라우저를 대상으로 합니다. 저사양 기기에서는 8,000개 점·800개 선으로 낮추세요. 특정 장치의 FPS를 보장하지 않습니다.

`.gz` 자산은 두 전달 방식을 모두 지원합니다. 서버가 원본 gzip 바이트를 보내면 압축 파일 SHA-256을 검증한 뒤 브라우저에서 풉니다. Vite·프록시·CDN이 `Content-Encoding: gzip`으로 처리해 Fetch가 이미 풀린 payload를 전달하면 별도로 고정된 payload SHA-256을 검증합니다. 어느 경우에도 체크섬 검증을 생략하지 않습니다. 포함된 Python 서버는 원본 gzip 바이트를 그대로 전송합니다.

북마크는 현재 브라우저 localStorage에 저장되며 계정 동기화 기능이 아닙니다. JSON 내보내기는 현재 화면의 부분 그래프이며 전체 534만 행 덤프가 아닙니다. PNG는 현재 캔버스만 내보냅니다.

## 라이선스와 참고

새로 작성한 앱 코드는 `LICENSE`를 따릅니다. React 등의 라이브러리는 각 라이선스가 적용됩니다. 첨부 원본 데이터에 새 라이선스를 부여하지 않았습니다. 공개 재배포 전에는 원 출처의 데이터 사용·표시 조건을 확인해야 합니다.

- React: https://react.dev/reference/react-dom/client/createRoot
- Three.js: https://threejs.org/docs/pages/BufferGeometry.html
- OrbitControls: https://threejs.org/docs/pages/OrbitControls.html
- FlyWire: https://flywire.ai/
- Codex: https://codex.flywire.ai/
