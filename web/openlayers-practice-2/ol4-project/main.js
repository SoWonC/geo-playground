// ===== 초기 뷰 =====
var initialCenter = ol.proj.fromLonLat([-98.5, 39.5]); // 필요시 [127, 37.5] 로 변경
var initialZoom = 4;
var view = new ol.View({
    projection: 'EPSG:3857',
    center: initialCenter,
    zoom: initialZoom
});

// ===== 레이어 =====
var base = new ol.layer.Tile({source: new ol.source.OSM(), zIndex: -1});

// === 사용자 도형 전용 소스/레이어 (WFS랑 분리)
var drawSource = new ol.source.Vector();
var drawLayer = new ol.layer.Vector({
    source: drawSource,
    style: new ol.style.Style({
        fill:   new ol.style.Fill({ color: 'rgba(0, 153, 255, 0.15)' }),
        stroke: new ol.style.Stroke({ color: '#0099ff', width: 2 }),
        image:  new ol.style.Circle({ radius: 5, fill: new ol.style.Fill({color: '#0099ff'}) })
    }),
    zIndex: 5
});

// WMS
var wmsSource = new ol.source.TileWMS({
    url: 'https://ahocevar.com/geoserver/wms',
    params: {'LAYERS': 'topp:states', 'TILED': true},
    serverType: 'geoserver',
    crossOrigin: 'anonymous'
});
var wmsLayer = new ol.layer.Tile({source: wmsSource, zIndex: 0, opacity: 1});

// WFS (빈 소스 → fetch로 채움)
var wfsSource = new ol.source.Vector({format: new ol.format.GeoJSON()});
var wfsLayer = new ol.layer.Vector({
    source: wfsSource,
    style: new ol.style.Style({
        stroke: new ol.style.Stroke({color: '#333', width: 1}),
        fill: new ol.style.Fill({color: 'rgba(255,165,0,0.15)'})
    }),
    zIndex: 1
});

var wfsUrl =
    'https://ahocevar.com/geoserver/wfs?' +
    'service=WFS&version=1.1.0&request=GetFeature&' +
    'typeName=topp:states&outputFormat=application/json&' +
    'srsName=EPSG:3857';

fetch(wfsUrl)
    .then(function (res) {
        return res.json();
    })
    .then(function (geojson) {
        var features = wfsSource.getFormat().readFeatures(geojson, {
            dataProjection: 'EPSG:3857',
            featureProjection: 'EPSG:3857'
        });
        wfsSource.addFeatures(features);  // ← 여기서 실제 데이터 주입
    })
    .catch(function (err) {
        console.error('WFS load failed:', err);
    });

// ===== 지도 =====
var map = new ol.Map({
    target: 'map',
    layers: [base, wmsLayer, wfsLayer,drawLayer],
    view: view,
    controls: ol.control.defaults({attribution: true})
});

// 스케일바(우하단 HUD 내부로 이동)
var scaleLine = new ol.control.ScaleLine();
map.addControl(scaleLine);
document.getElementById('scaleWrap').appendChild(scaleLine.element);

// 인덱스맵(좌하단, 지도 내부)
var overview = new ol.control.OverviewMap({
    collapsed: false,
    layers: [new ol.layer.Tile({source: new ol.source.OSM()})]
});
map.addControl(overview);

// ===== WFS 로드 =====
(function loadWFS() {
    var url =
        'https://ahocevar.com/geoserver/wfs?' +
        'service=WFS&version=1.1.0&request=GetFeature&' +
        'typeName=topp:states&outputFormat=application/json&' +
        'srsName=EPSG:3857';

    fetch(url)
        .then(function (res) {
            return res.json();
        })
        .then(function (geojson) {
            var features = wfsSource.getFormat().readFeatures(geojson, {
                dataProjection: 'EPSG:4326',
                featureProjection: 'EPSG:3857'
            });
            wfsSource.addFeatures(features);
        })
        .catch(function (err) {
            console.error('WFS load failed:', err);
        });
})();

// ===== 정보 패널 =====
var infoPanel = document.getElementById('infoPanel');
var infoBody = document.getElementById('infoBody');

// ===== 클릭: WFS 우선 선택 → 없으면 WMS GetFeatureInfo =====
map.on('singleclick', function (evt) {
    // 1) 로컬 WFS 피처 우선
    var hitFeature = map.forEachFeatureAtPixel(evt.pixel, function (f) {
        return f;
    });
    if (hitFeature) {
        var props = hitFeature.getProperties();
        // geometry 제외
        var out = {};
        Object.keys(props).forEach(function (k) {
            if (k !== 'geometry') out[k] = props[k];
        });
        infoBody.innerHTML = '<pre>' + JSON.stringify({source: 'WFS (local)', ...out}, null, 2) + '</pre>';
        return;
    }

    // 2) 없으면 WMS GetFeatureInfo
    var res = view.getResolution();
    var url = wmsSource.getGetFeatureInfoUrl(evt.coordinate, res, 'EPSG:3857', {
        'INFO_FORMAT': 'application/json'
    });
    if (!url) {
        infoBody.innerHTML = '<span class="muted">GetFeatureInfo URL 생성 실패</span>';
        return;
    }
    fetch(url)
        .then(function (r) {
            return r.json();
        })
        .then(function (json) {
            var out;
            if (json && json.features && json.features.length) {
                var p = json.features[0].properties || {};
                out = {
                    source: 'WMS (server)',
                    STATE_NAME: p.STATE_NAME,
                    SUB_REGION: p.SUB_REGION,
                    STATE_ABBR: p.STATE_ABBR,
                    PERSONS: p.PERSONS
                };
            } else {
                out = {source: 'WMS (server)', message: '피처 없음'};
            }
            infoBody.innerHTML = '<pre>' + JSON.stringify(out, null, 2) + '</pre>';
        })
        .catch(function (e) {
            console.error('GetFeatureInfo error', e);
            infoBody.innerHTML = '<span class="muted">GetFeatureInfo 오류</span>';
        });
});

// ===== 마우스 좌표 표시 =====
var mousePosEl = document.getElementById('mousePos');
map.on('pointermove', function (evt) {
    if (evt.dragging) return;
    var lonlat = ol.proj.toLonLat(evt.coordinate);
    mousePosEl.textContent = 'Lon,Lat: ' + lonlat[0].toFixed(5) + ', ' + lonlat[1].toFixed(5);
});

// ===== 커서 힌트 =====
map.on('pointermove', function (evt) {
    if (evt.dragging) return;
    var pixel = map.getEventPixel(evt.originalEvent);
    var hit = map.hasFeatureAtPixel(pixel) || map.forEachLayerAtPixel(pixel, function () {
        return true;
    });
    map.getTargetElement().style.cursor = hit ? 'pointer' : '';
});

// ===== 사이드바 컨트롤 =====
document.getElementById('zoomIn').onclick = function () {
    view.setZoom(view.getZoom() + 1);
};
document.getElementById('zoomOut').onclick = function () {
    view.setZoom(view.getZoom() - 1);
};
document.getElementById('reset').onclick = function () {
    view.animate({center: initialCenter, zoom: initialZoom, duration: 250});
};

var toggleWMS = document.getElementById('toggleWMS');
var toggleWFS = document.getElementById('toggleWFS');
var opacity = document.getElementById('opacity');
toggleWMS.onchange = function () {
    wmsLayer.setVisible(this.checked);
};
toggleWFS.onchange = function () {
    wfsLayer.setVisible(this.checked);
};
opacity.oninput = function () {
    wmsLayer.setOpacity(parseFloat(this.value));
};

// 정보 패널 접기/펼치기
document.getElementById('collapse').onclick = function () {
    var body = document.getElementById('infoBody');
    var hidden = body.style.display === 'none';
    body.style.display = hidden ? '' : 'none';
    this.textContent = hidden ? '접기' : '펼치기';
};
// ===== 그리기/수정/지우기 =====
var drawInteraction = null;
var modifyInteraction = null;

function stopDrawing() {
    if (drawInteraction) {
        map.removeInteraction(drawInteraction);
        drawInteraction = null;
    }
    // 버튼 텍스트 원복
    document.getElementById('drawPoint').textContent = '점 그리기';
    document.getElementById('drawLine').textContent  = '선 그리기';
    document.getElementById('drawPoly').textContent  = '폴리곤 그리기';
}

// 공통: 타입별 그리기 시작/토글
function toggleDraw(type, btnEl) {
    // 이미 그리는 중이면 종료
    if (drawInteraction) {
        stopDrawing();
        return;
    }
    // 수정 모드가 켜져 있으면 잠시 꺼줌(겹침 방지)
    if (modifyInteraction) {
        map.removeInteraction(modifyInteraction);
        modifyInteraction = null;
        document.getElementById('toggleModify').textContent = '수정 모드 켜기';
    }

    drawInteraction = new ol.interaction.Draw({
        source: drawSource,  // 사용자 도형은 drawSource에만 넣음
        type: type           // 'Point' | 'LineString' | 'Polygon'
    });
    map.addInteraction(drawInteraction);

    // 완료 시 버튼 텍스트 원복
    drawInteraction.on('drawend', function() {
        stopDrawing();
    });

    // 현재 버튼만 “그리기 종료”로 표시
    btnEl.textContent = '그리기 종료';
}

// 버튼 이벤트
document.getElementById('drawPoint').onclick = function() {
    toggleDraw('Point', this);
};
document.getElementById('drawLine').onclick = function() {
    toggleDraw('LineString', this);
};
document.getElementById('drawPoly').onclick = function() {
    toggleDraw('Polygon', this);
};

// 수정 모드 토글 (Modify)
document.getElementById('toggleModify').onclick = function() {
    // 그리기 중이면 먼저 종료
    if (drawInteraction) stopDrawing();

    if (modifyInteraction) {
        map.removeInteraction(modifyInteraction);
        modifyInteraction = null;
        this.textContent = '수정 모드 켜기';
        return;
    }
    modifyInteraction = new ol.interaction.Modify({
        source: drawSource
        // 또는 features: new ol.Collection(drawSource.getFeatures())
    });
    map.addInteraction(modifyInteraction);
    this.textContent = '수정 모드 끄기';
};

// 전체 지우기 (사용자 도형만 삭제)
document.getElementById('clearAll').onclick = function() {
    // 그리기/수정 중지
    stopDrawing();
    if (modifyInteraction) {
        map.removeInteraction(modifyInteraction);
        modifyInteraction = null;
        document.getElementById('toggleModify').textContent = '수정 모드 켜기';
    }
    drawSource.clear(); // 사용자 도형만 싹 지움
};

document.getElementById('saveImage')?.addEventListener('click', function () {
    map.once('postcompose', function(event) {
        var canvas = event.context.canvas;
        var a = document.createElement('a');
        a.href = canvas.toDataURL('image/png');
        a.download = 'map.png';
        a.click();
    });
    map.renderSync();
});