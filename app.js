import BusController from './BusController.js';
import { busRoutes } from './data/busRoutes.js';

// Mapbox访问令牌
mapboxgl.accessToken = '';

// 初始化地图
const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/streets-v12',
  projection: 'mercator',
  center: [114.38, 30.52], // 初始中心点（武汉市）
  zoom: 13,
  pitch: 45, // 倾斜角度
  bearing: 0, // 方位角
  antialias: true // 启用抗锯齿
});

// 公交车控制器数组
const busControllers = [];

// 上一帧时间戳
let lastFrameTime = 0;

// 动画循环
function animate(timestamp) {
  // 计算时间增量（毫秒）
  const deltaTime = lastFrameTime ? timestamp - lastFrameTime : 0;
  lastFrameTime = timestamp;
  
  // 更新所有公交车位置
  busControllers.forEach(controller => {
    controller.update(deltaTime);
  });
  
  // 请求下一帧动画
  requestAnimationFrame(animate);
}

// 地图加载完成后初始化
map.on('style.load', () => {
  console.log('地图加载完成');
  
  // 添加公交路线到地图
  busRoutes.features.forEach(route => {
    // 添加路线图层
    map.addSource(route.properties.id, {
      type: 'geojson',
      data: {
        type: 'Feature',
        properties: {},
        geometry: route.geometry
      }
    });
    
    // 添加路线线条
    map.addLayer({
      id: `route-${route.properties.id}`,
      type: 'line',
      source: route.properties.id,
      layout: {
        'line-join': 'round',
        'line-cap': 'round'
      },
      paint: {
        'line-color': route.properties.color,
        'line-width': 6,
        'line-opacity': 0.8
      }
    });
    
    // 创建公交车控制器
    const busController = new BusController(map, route, {
      modelPath: 'data/model/bus/bus.obj',
      materialPath: 'data/model/bus/bus.mtl',
      modelScale: { x: 2.5, y: 2.5, z: 2.5 }, // 单位是米,一般公交车长12米左右,根据模型大小调整比例
      modelHeight: 0, // 单位是米,设为0表示贴地
      speed: 0.00001 // 初始速度
    });
    
    // 设置初始速度为10km/h
    busController.setSpeedKmh(10);
    
    // 添加到控制器数组
    busControllers.push(busController);
  });
  
  // 启动动画循环
  requestAnimationFrame(animate);
  
  // 添加速度控制滑块事件监听
  const speedSlider = document.getElementById('speed');
  const speedValue = document.getElementById('speedValue');
  
  // 更新速度滑块的初始值显示
  if (busControllers.length > 0) {
    const initialSpeed = busControllers[0].getSpeedKmh();
    speedValue.textContent = initialSpeed.toFixed(1);
  }
  
  speedSlider.addEventListener('input', (e) => {
    // 将滑块值（1-10）转换为km/h（30-100km/h）
    const speedKmh = 30 + parseFloat(e.target.value) * 7;
    speedValue.textContent = speedKmh.toFixed(1);
    
    // 更新所有公交车速度
    busControllers.forEach(controller => {
      controller.setSpeedKmh(speedKmh);
    });
  });
  
  // 添加地图控件
  map.addControl(new mapboxgl.NavigationControl(), 'top-right');
  map.addControl(new mapboxgl.FullscreenControl(), 'top-right');
});

// 添加地图事件监听器
map.on('error', (e) => {
  console.error('地图错误:', e);
});

// 添加窗口大小变化监听器
window.addEventListener('resize', () => {
  map.resize();
});

// 添加键盘事件监听器，用于调试模型方向
window.addEventListener('keydown', (e) => {
  // 按R键旋转所有公交车模型180度
  if (e.key === 'r' || e.key === 'R') {
    console.log('旋转所有公交车模型180度');
    busControllers.forEach(controller => {
      controller.rotateModel(180);
    });
  }
  
  // 按F键翻转所有公交车模型的行驶方向
  if (e.key === 'f' || e.key === 'F') {
    console.log('翻转所有公交车模型的行驶方向');
    busControllers.forEach(controller => {
      controller.isForward = !controller.isForward;
      controller.rotateModel(180);
    });
  }
  
  // 按Z键重置所有公交车模型的旋转偏移量为180度（默认值）
  if (e.key === 'z' || e.key === 'Z') {
    console.log('重置所有公交车模型的旋转偏移量为180度');
    
    busControllers.forEach(controller => {
      // 计算需要旋转的角度，使偏移量回到180度
      const rotationNeeded = 180 - controller.rotationOffset;
      controller.rotateModel(rotationNeeded);
    });
  }
  
  // 按D键显示当前所有公交车的状态信息
  if (e.key === 'd' || e.key === 'D') {
    console.log('显示所有公交车状态信息');
    busControllers.forEach(controller => {
      console.log(`公交车 ${controller.modelId}:`);
      console.log(`  - 当前位置: ${controller.currentPosition}`);
      console.log(`  - 行驶方向: ${controller.isForward ? '正向' : '反向'}`);
      console.log(`  - 当前角度: ${controller.modelLoader.modelAngle}度`);
      console.log(`  - 旋转偏移量: ${controller.rotationOffset}度`);
      console.log(`  - 当前速度: ${controller.getSpeedKmh().toFixed(1)} km/h`);
    });
  }
}); 