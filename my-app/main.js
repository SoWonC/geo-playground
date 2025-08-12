import Map from 'ol/Map.js';
import View from 'ol/View.js';
import Polygon from 'ol/geom/Polygon.js';
import Draw, { createBox, createRegularPolygon } from 'ol/interaction/Draw.js';
import Select from 'ol/interaction/Select.js';
import Modify from 'ol/interaction/Modify.js';
import Snap from 'ol/interaction/Snap.js';

import TileLayer from 'ol/layer/Tile.js';
import VectorLayer from 'ol/layer/Vector.js';
import OSM from 'ol/source/OSM.js';
import VectorSource from 'ol/source/Vector.js';

import { defaults as defaultControls } from 'ol/control/defaults.js';
import ScaleLine from 'ol/control/ScaleLine.js';
import OverviewMap from 'ol/control/OverviewMap.js';

/* 타일 CORS 허용(내보내기용) */
const raster = new TileLayer({
  source: new OSM({ crossOrigin: 'anonymous' }),
});

const source = new VectorSource({ wrapX: false });

const vector = new VectorLayer({ source });

/* 인덱스맵용 레이어 */
const overviewLayer = new TileLayer({
  source: new OSM({ crossOrigin: 'anonymous' }),
});

/* 지도 */
const map = new Map({
  layers: [raster, vector],
  target: 'map',
  view: new View({
    center: [14133319.4, 4517014.6], // 서울시청 좌표 (Web Mercator)
    zoom: 12,
  }),

  controls: defaultControls().extend([
    new ScaleLine(),
    new OverviewMap({
      collapsed: false,
      layers: [overviewLayer],
      className: 'ol-overviewmap ol-custom-overviewmap'
    }),
  ]),
});

/* 그리기 */
const typeSelect = document.getElementById('type');
let draw;
function addInteraction() {
  let value = typeSelect.value;
  if (value !== 'None') {
    let geometryFunction;
    if (value === 'Square') {
      value = 'Circle';
      geometryFunction = createRegularPolygon(4);
    } else if (value === 'Box') {
      value = 'Circle';
      geometryFunction = createBox();
    } else if (value === 'Star') {
      value = 'Circle';
      geometryFunction = function (coordinates, geometry) {
        const center = coordinates[0];
        const last = coordinates[coordinates.length - 1];
        const dx = center[0] - last[0];
        const dy = center[1] - last[1];
        const radius = Math.sqrt(dx * dx + dy * dy);
        const rotation = Math.atan2(dy, dx);
        const newCoordinates = [];
        const numPoints = 12;
        for (let i = 0; i < numPoints; ++i) {
          const angle = rotation + (i * 2 * Math.PI) / numPoints;
          const fraction = i % 2 === 0 ? 1 : 0.5;
          const offsetX = radius * fraction * Math.cos(angle);
          const offsetY = radius * fraction * Math.sin(angle);
          newCoordinates.push([center[0] + offsetX, center[1] + offsetY]);
        }
        newCoordinates.push(newCoordinates[0].slice());
        if (!geometry) {
          geometry = new Polygon([newCoordinates]);
        } else {
          geometry.setCoordinates([newCoordinates]);
        }
        return geometry;
      };
    }
    draw = new Draw({ source, type: value, geometryFunction });
    map.addInteraction(draw);
  }
}
typeSelect.onchange = function () {
  if (draw) map.removeInteraction(draw);
  addInteraction();
};
document.getElementById('undo').addEventListener('click', () => {
  if (draw) draw.removeLastPoint();
});
addInteraction();

/* 선택/수정/스냅 */
const select = new Select();                  // 클릭으로 피처 선택
map.addInteraction(select);

const modify = new Modify({ features: select.getFeatures() });
map.addInteraction(modify);
modify.setActive(false);                      // 기본 OFF

const snap = new Snap({ source });
map.addInteraction(snap);

/* 수정 토글 */
const btnModify = document.getElementById('btnModify');
btnModify.addEventListener('click', () => {
  const next = !modify.getActive();
  modify.setActive(next);
  btnModify.textContent = `수정: ${next ? 'ON' : 'OFF'}`;
});

/* 선택 삭제 */
function removeSelected() {
  const features = select.getFeatures();
  features.forEach(f => source.removeFeature(f));
  features.clear();
}
document.getElementById('btnDelete').addEventListener('click', removeSelected);

/* 키보드(Delete/Backspace)로도 삭제 */
window.addEventListener('keydown', (e) => {
  if (e.key === 'Delete' || e.key === 'Backspace') removeSelected();
});

/* 전체 삭제 */
document.getElementById('btnClear').addEventListener('click', () => {
  source.clear();
  select.getFeatures().clear();
});

/* PNG 저장 */
function exportPNG() {
  map.once('rendercomplete', function () {
    const size = map.getSize();
    const mapCanvas = document.createElement('canvas');
    mapCanvas.width = size[0];
    mapCanvas.height = size[1];
    const mapContext = mapCanvas.getContext('2d');

    const canvases = map.getViewport().querySelectorAll('.ol-layer canvas, canvas.ol-fixedoverlay');
    Array.prototype.forEach.call(canvases, (canvas) => {
      if (canvas.width <= 0) return;
      const opacity = canvas.parentNode.style.opacity;
      mapContext.globalAlpha = opacity === '' ? 1 : Number(opacity);

      const transform = canvas.style.transform;
      let matrix = [1, 0, 0, 1, 0, 0];
      if (transform && transform.startsWith('matrix')) {
        matrix = transform
            .match(/^matrix\(([^\(]*)\)$/)[1]
            .split(',')
            .map(Number);
      }
      mapContext.setTransform(matrix[0], matrix[1], matrix[2], matrix[3], matrix[4], matrix[5]);

      const bg = canvas.style.backgroundColor;
      if (bg) {
        mapContext.fillStyle = bg;
        mapContext.fillRect(0, 0, canvas.width, canvas.height);
      }
      mapContext.drawImage(canvas, 0, 0);
    });

    mapContext.setTransform(1, 0, 0, 1, 0, 0);
    const link = document.createElement('a');
    link.href = mapCanvas.toDataURL('image/png');
    link.download = 'map.png';
    link.click();
  });
  map.renderSync();
}
document.getElementById('btnSavePNG').addEventListener('click', exportPNG);
