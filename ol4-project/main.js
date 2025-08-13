// -------- 초기 뷰 --------
var initialCenter = ol.proj.fromLonLat([-98.5, 39.5]); // 미국 본토 중심
var initialZoom = 4;
var view = new ol.View({
    projection: 'EPSG:3857',
    center: initialCenter,
    zoom: initialZoom
});

// -------- 레이어들 --------
var base = new ol.layer.Tile({ source: new ol.source.OSM(), zIndex: -1 });

var wmsSource = new ol.source.TileWMS({
    url: 'https://ahocevar.com/geoserver/wms',
    params: { 'LAYERS': 'topp:states', 'TILED': true },
    serverType: 'geoserver',
    crossOrigin: 'anonymous'
});
var wmsLayer = new ol.layer.Tile({ source: wmsSource, zIndex: 0, opacity: 1 });

var wfsSource = new ol.source.Vector({ format: new ol.format.GeoJSON() });
var wfsLayer = new ol.layer.Vector({
    source: wfsSource,
    style: new ol.style.Style({
        stroke: new ol.style.Stroke({ color: '#333', width: 1 }),
        fill: new ol.style.Fill({ color: 'rgba(255,165,0,0.15)' })
    }),
    zIndex: 1
});

// -------- 지도 --------
var map = new ol.Map({
    target: 'map',
    layers: [base, wmsLayer, wfsLayer],
    view: view,
    controls: ol.control.defaults({ attribution: true })
});

// 스케일바(우하단)
var scaleLine = new ol.control.ScaleLine();
map.addControl(scaleLine);
// 기본 위치를 우하단으로 옮기기 위해 컨테이너 갈아끼움
document.getElementById('scaleWrap').appendChild(scaleLine.element);

// -------- WFS 로드 --------
(function loadWFS() {
    var url =
        'https://ahocevar.com/geoserver/wfs?' +
        'service=WFS&version=1.1.0&request=GetFeature&' +
        'typeName=topp:states&outputFormat=application/json&' +
        'srsName=EPSG:3857';

    fetch(url)
        .then(function (res) { return res.json(); })
        .then(function (geojson) {
            var features = wfsSource.getFormat().readFeatures(geojson, {
                dataProjection: 'EPSG:4326',
                featureProjection: 'EPSG:3857'
            });
            wfsSource.addFeatures(features);
        })
        .catch(function (err) { console.error('WFS load failed:', err); });
})();

// -------- GetFeatureInfo --------
var infoPanel = document.getElementById('infoPanel');
var infoBody  = document.getElementById('infoBody');

map.on('singleclick', function (evt) {
    var res = view.getResolution();
    var url = wmsSource.getGetFeatureInfoUrl(evt.coordinate, res, 'EPSG:3857', {
        'INFO_FORMAT': 'application/json'
    });
    if (!url) {
        infoBody.innerHTML = 'GetFeatureInfo URL 생성 실패';
        return;
    }
    fetch(url)
        .then(function (r) { return r.json(); })
        .then(function (json) {
            var out;
            if (json && json.features && json.features.length) {
                var p = json.features[0].properties || {};
                out = {
                    STATE_NAME: p.STATE_NAME,
                    SUB_REGION: p.SUB_REGION,
                    STATE_ABBR: p.STATE_ABBR,
                    PERSONS: p.PERSONS
                };
            } else {
                out = '피처 없음';
            }
            infoBody.innerHTML = '<pre>' + JSON.stringify(out, null, 2) + '</pre>';
            infoPanel.classList.remove('hidden');
        })
        .catch(function (e) {
            console.error('GetFeatureInfo error', e);
            infoBody.innerHTML = 'GetFeatureInfo 오류';
        });
});

// -------- 마우스 좌표 표시 --------
var mousePosEl = document.getElementById('mousePos');
map.on('pointermove', function (evt) {
    if (evt.dragging) return;
    var lonlat = ol.proj.toLonLat(evt.coordinate);
    mousePosEl.textContent = 'Lon,Lat: ' + lonlat[0].toFixed(5) + ', ' + lonlat[1].toFixed(5);
});

// -------- 커서 힌트(타일/피처 위) --------
map.on('pointermove', function (evt) {
    if (evt.dragging) return;
    var pixel = map.getEventPixel(evt.originalEvent);
    var hit = map.hasFeatureAtPixel(pixel) || map.forEachLayerAtPixel(pixel, function () { return true; });
    map.getTargetElement().style.cursor = hit ? 'pointer' : '';
});

// -------- 툴바 핸들러 --------
document.getElementById('zoomIn').onclick  = function () { view.setZoom(view.getZoom() + 1); };
document.getElementById('zoomOut').onclick = function () { view.setZoom(view.getZoom() - 1); };
document.getElementById('reset').onclick   = function () {
    view.animate({ center: initialCenter, zoom: initialZoom, duration: 250 });
};

var toggleWMS = document.getElementById('toggleWMS');
var toggleWFS = document.getElementById('toggleWFS');
var opacity   = document.getElementById('opacity');

toggleWMS.onchange = function () { wmsLayer.setVisible(this.checked); };
toggleWFS.onchange = function () { wfsLayer.setVisible(this.checked); };
opacity.oninput    = function () { wmsLayer.setOpacity(parseFloat(this.value)); };

// 정보 패널 접기/펼치기
document.getElementById('collapse').onclick = function () {
    var body = document.getElementById('infoBody');
    var hidden = body.classList.toggle('hidden');
    this.textContent = hidden ? '펼치기' : '접기';
};