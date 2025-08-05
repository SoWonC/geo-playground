# 🗺️ postgis-data-exporter

Spring Boot 기반으로 PostGIS 공간 테이블의 데이터를 조회하고,  
WKT 및 공간 연산 결과(ST_Area 등)를 `.txt` 또는 Excel 파일로 내보내는 실습형 프로젝트입니다.

---

## 🔧 기술 스택

- **Java 17**
- **Spring Boot 3.5.4**
- **PostgreSQL + PostGIS**
- **JDBC**
- **Apache POI** (엑셀 내보내기)

---

## 📌 주요 기능

| 기능 | 설명 |
|------|------|
| ✅ 공간 테이블 조회 | PostGIS의 `GEOMETRY` 컬럼을 조회 |
| ✅ WKT 추출 | `ST_AsText()`를 통해 WKT 포맷 변환 |
| ✅ 면적 계산 | `ST_Area(geom::geography)` 사용 |
| ✅ 텍스트 저장 | `.txt` 파일로 결과 저장 가능 |
| ✅ 엑셀 저장 | Apache POI로 `.xlsx` 파일 생성 가능 (추후 구현) |
