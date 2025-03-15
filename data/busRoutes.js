// 模拟公交路线数据（GeoJSON格式）
export const busRoutes = {
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": {
        "id": "route1",
        "name": "1路公交",
        "color": "#FF5733"
      },
      "geometry": {
        "type": "LineString",
        "coordinates": [
          [114.35, 30.52],
          [114.355, 30.525],
          [114.36, 30.53],
          [114.365, 30.535],
          [114.37, 30.54],
          [114.375, 30.545],
          [114.38, 30.55]
        ]
      }
    },
    {
      "type": "Feature",
      "properties": {
        "id": "route2",
        "name": "2路公交",
        "color": "#33A1FF"
      },
      "geometry": {
        "type": "LineString",
        "coordinates": [
          [114.38, 30.51],
          [114.385, 30.515],
          [114.39, 30.52],
          [114.395, 30.525],
          [114.4, 30.53],
          [114.405, 30.535],
          [114.41, 30.54]
        ]
      }
    },
    {
      "type": "Feature",
      "properties": {
        "id": "route3",
        "name": "3路公交",
        "color": "#33FF57"
      },
      "geometry": {
        "type": "LineString",
        "coordinates": [
          [114.36, 30.51],
          [114.365, 30.505],
          [114.37, 30.5],
          [114.375, 30.495],
          [114.38, 30.49],
          [114.385, 30.485],
          [114.39, 30.48]
        ]
      }
    }
  ]
}; 