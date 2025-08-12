/* =========================
 * 레이어/소스
 * ========================= */
var raster = new ol.layer.Tile({
    source: new ol.source.OSM({crossOrigin: 'anonymous'})
});

var source = new ol.source.Vector({wrapX: false});

var vector = new ol.layer.Vector({
    source: source
});

var overviewLayer = new ol.layer.Tile({
    source: new ol.source.OSM({crossOrigin: 'anonymous'})
});

/* =========================
 * 지도/컨트롤
 * ========================= */
var map = new ol.Map({
    target: 'map',
    layers: [raster, vector],
    view: new ol.View({
        center: [14133319.4, 4517014.6],
        zoom: 12
    }),
    controls: ol.control.defaults().extend([
        new ol.control.ScaleLine(),
        new ol.control.OverviewMap({
            collapsed: false,
            layers: [overviewLayer],
            className: 'ol-overviewmap ol-custom-overviewmap'
        })
    ])
});

/* =========================
 * 헬퍼: 스타 지오메트리
 * ========================= */
function createStarGeometryFn() {
    return function (coordinates, geometry) {
        var center = coordinates[0];
        var last = coordinates[coordinates.length - 1];

        var dx = center[0] - last[0];
        var dy = center[1] - last[1];
        var radius = Math.sqrt(dx * dx + dy * dy);
        var rotation = Math.atan2(dy, dx);

        var ring = [];
        var num = 12;
        for (var i = 0; i < num; i++) {
            var angle = rotation + (i * 2 * Math.PI) / num;
            var frac = (i % 2 === 0) ? 1 : 0.5;
            ring.push([
                center[0] + radius * frac * Math.cos(angle),
                center[1] + radius * frac * Math.sin(angle)
            ]);
        }
        ring.push(ring[0].slice());

        if (!geometry) geometry = new ol.geom.Polygon([ring]);
        else geometry.setCoordinates([ring]);

        return geometry;
    };
}


/* =========================
 * 그리기 인터랙션
 * ========================= */
var typeSelect = document.getElementById('type');
var draw = null;

function addInteraction() {
    var value = typeSelect.value;
    if (value === 'None') return;

    var geomFn = undefined;
    if (value === 'Square') {
        value = 'Circle';
        geomFn = ol.interaction.Draw.createRegularPolygon(4);
    } else if (value === 'Box') {
        value = 'Circle';
        geomFn = ol.interaction.Draw.createBox();
    } else if (value === 'Star') {
        value = 'Circle';
        geomFn = createStarGeometryFn();
    }

    draw = new ol.interaction.Draw({
        source: source,
        type: /** @type {ol.geom.GeometryType} */ (value),
        geometryFunction: geomFn
    });
    map.addInteraction(draw);
}

function removeDraw() {
    if (!draw) return;
    map.removeInteraction(draw);
    draw = null;
}

typeSelect.onchange = function () {
    removeDraw();
    addInteraction();
};

document.getElementById('undo').addEventListener('click', function () {
    if (draw) draw.removeLastPoint();
});

addInteraction();

/* =========================
 * 선택/수정/스냅
 * ========================= */
var select = new ol.interaction.Select();
map.addInteraction(select);

var modify = new ol.interaction.Modify({
    features: select.getFeatures()
});
map.addInteraction(modify);
modify.setActive(false);

var snap = new ol.interaction.Snap({source: source});
map.addInteraction(snap);

/* =========================
 * 버튼 동작
 * ========================= */
var btnModify = document.getElementById('btnModify');
btnModify.addEventListener('click', function () {
    var next = !modify.getActive();
    modify.setActive(next);
    btnModify.textContent = '수정: ' + (next ? 'ON' : 'OFF');
});

function removeSelected() {
    var features = select.getFeatures();
    features.forEach(function (f) {
        source.removeFeature(f);
    });
    features.clear();
}

document.getElementById('btnDelete').addEventListener('click', removeSelected);

window.addEventListener('keydown', function (e) {
    if (e.key === 'Delete' || e.key === 'Backspace') removeSelected();
});

document.getElementById('btnClear').addEventListener('click', function () {
    source.clear();
    select.getFeatures().clear();
});

/* =========================
 * PNG 저장
 * ========================= */
function exportPNG() {
    map.once('postcompose', function () {
        var size = map.getSize();
        var out = document.createElement('canvas');
        out.width = size[0];
        out.height = size[1];

        var ctx = out.getContext('2d');
        var canvases = map.getViewport().querySelectorAll('.ol-layer canvas');

        Array.prototype.forEach.call(canvases, function (c) {
            if (c.width <= 0) return;

            var opacity = c.parentNode.style.opacity;
            ctx.globalAlpha = opacity === '' ? 1 : Number(opacity);

            var t = c.style.transform;
            var m = [1, 0, 0, 1, 0, 0];
            if (t && t.indexOf('matrix') === 0) {
                m = t.match(/^matrix\(([^\(]*)\)$/)[1].split(',').map(Number);
            }
            ctx.setTransform(m[0], m[1], m[2], m[3], m[4], m[5]);

            var bg = c.style.backgroundColor;
            if (bg) {
                ctx.fillStyle = bg;
                ctx.fillRect(0, 0, c.width, c.height);
            }
            ctx.drawImage(c, 0, 0);
        });

        ctx.setTransform(1, 0, 0, 1, 0, 0);

        var a = document.createElement('a');
        a.href = out.toDataURL('image/png');
        a.download = 'map.png';
        a.click();
    });

    map.renderSync();
}

/* =========================
 * WFS(BBOX) - GET + GeoJSON
 * ========================= */
var WFS_URL = 'https://ahocevar.com/geoserver/wfs'; // 실제 서비스로 교체 가능
var TYPE_NAME = 'osm:water_areas';                   // 실제 레이어로 교체

var wfsSource = new ol.source.Vector({
    format: new ol.format.GeoJSON(),
    url: function (extent) {
        return (
            WFS_URL +
            '?service=WFS&version=1.1.0&request=GetFeature' +
            '&typename=' + encodeURIComponent(TYPE_NAME) +
            '&outputFormat=application/json' +
            '&srsname=EPSG:3857' +
            '&bbox=' + extent.join(',') + ',EPSG:3857'
        );
    },
    strategy: ol.loadingstrategy.bbox
});

var wfsLayer = new ol.layer.Vector({
    source: wfsSource,
    style: new ol.style.Style({
        stroke: new ol.style.Stroke({
            color: 'rgba(33, 150, 243, 1)', // 파란색 계열
            width: 2
        }),
        fill: new ol.style.Fill({
            color: 'rgba(33, 150, 243, 0.15)' // 투명도 있는 파란색
        }),
        image: new ol.style.Circle({
            radius: 5,
            fill: new ol.style.Fill({
                color: 'rgba(255, 193, 7, 1)' // 노란색 포인트
            }),
            stroke: new ol.style.Stroke({
                color: 'rgba(33, 150, 243, 1)',
                width: 1
            })
        })
    })
});

map.addLayer(wfsLayer);

// 로드 로그(디버깅)
wfsSource.on('featuresloadstart', function () {
    console.log('WFS load start');
});
wfsSource.on('featuresloadend', function (e) {
    console.log('WFS load end, count=', (e.features || []).length);
});
wfsSource.on('featuresloaderror', function (e) {
    console.error('WFS load error', e);
});

// 수동 새로고침(옵션)
function reloadWFS() {
    wfsSource.clear(true);
    wfsSource.refresh();
}


/* =========================
 * WFS(POST) - Filter 예시
 * ========================= */
function loadWFSWithFilter() {
    // 예시: name LIKE 'Mississippi%' AND waterway = 'riverbank'
    var fLike = ol.format.filter.like('name', 'Mississippi*');
    var fEq = ol.format.filter.equalTo('waterway', 'riverbank');
    var fAnd = ol.format.filter.and(fLike, fEq);

    var wfsFormat = new ol.format.WFS();
    var featureRequest = wfsFormat.writeGetFeature({
        srsName: 'EPSG:3857',
        featureNS: 'http://www.openstreetmap.org', // 네임스페이스 정확히
        featurePrefix: 'osm',
        featureTypes: ['water_areas'],
        outputFormat: 'application/json',
        filter: fAnd
    });

    fetch(WFS_URL, {
        method: 'POST',
        headers: {'Content-Type': 'text/xml'},
        body: new XMLSerializer().serializeToString(featureRequest)
    })
        .then(function (resp) {
            return resp.json();
        })
        .then(function (json) {
            // 투영 지정(중요): dataProjection=EPSG:3857, featureProjection=지도뷰(EPSG:3857)
            var feats = new ol.format.GeoJSON().readFeatures(json, {
                dataProjection: 'EPSG:3857',
                featureProjection: map.getView().getProjection()
            });
            wfsSource.clear();
            wfsSource.addFeatures(feats);
            if (feats.length) map.getView().fit(wfsSource.getExtent(), {size: map.getSize(), maxZoom: 16});
        })
        .catch(function (err) {
            console.error('WFS POST error', err);
        });
}


document.getElementById('btnSavePNG').addEventListener('click', exportPNG);
document.getElementById('btnReloadWFS')?.addEventListener('click', reloadWFS);
