import ModelLoadHelper from './modelLoadHelper.js';

class BusController {
  constructor(map, route, options = {}) {
    this.map = map;
    this.route = route;
    this.coordinates = route.geometry.coordinates;
    this.routeProperties = route.properties;
    
    // 计算路径总长度（米）
    this.routeLengthMeters = this.calculateRouteLength();
    console.log(`路线 ${this.routeProperties.id} 总长度: ${this.routeLengthMeters.toFixed(2)} 米`);
    
    // 配置选项
    this.options = {
      modelPath: options.modelPath || 'data/model/bus/bus.obj',
      materialPath: options.materialPath || 'data/model/bus/bus.mtl',
      modelScale: options.modelScale || { x: 1, y: 1, z: 1 },
      modelHeight: options.modelHeight || 0,
      speed: options.speed || 0.0001, // 移动速度
      ...options
    };
    
    // 初始化状态
    this.currentPosition = 0; // 当前位置（路径上的百分比，0-1之间）
    this.isForward = true; // 是否正向行驶
    this.busModel = null; // 公交车模型引用
    this.modelId = `bus-${this.routeProperties.id}`; // 模型ID
    this.rotationOffset = 180; // 添加旋转偏移量，默认为180度（反转模型）
    
    // 初始化模型加载器
    this.initModelLoader();
  }
  
  // 计算路径总长度（米）
  calculateRouteLength() {
    let totalLength = 0;
    
    for (let i = 0; i < this.coordinates.length - 1; i++) {
      const p1 = this.coordinates[i];
      const p2 = this.coordinates[i + 1];
      
      // 使用Haversine公式计算两点之间的距离（米）
      totalLength += this.calculateDistance(p1, p2);
    }
    
    return totalLength;
  }
  
  // 计算两点之间的距离（米）- Haversine公式
  calculateDistance(point1, point2) {
    const R = 6371000; // 地球半径（米）
    const lat1 = point1[1] * Math.PI / 180;
    const lat2 = point2[1] * Math.PI / 180;
    const deltaLat = (point2[1] - point1[1]) * Math.PI / 180;
    const deltaLon = (point2[0] - point1[0]) * Math.PI / 180;
    
    const a = Math.sin(deltaLat/2) * Math.sin(deltaLat/2) +
              Math.cos(lat1) * Math.cos(lat2) *
              Math.sin(deltaLon/2) * Math.sin(deltaLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c;
    
    return distance;
  }
  
  // 设置公交车速度（km/h）
  setSpeedKmh(speedKmh) {
    // 将km/h转换为每毫秒移动的路径百分比
    // 1 km/h = 1000/3600 m/s = 1/3.6 m/s = 1/3600 m/ms
    const speedMeterPerMs = speedKmh / 3600;
    
    // 计算每毫秒移动的路径百分比
    const speedPercent = speedMeterPerMs / this.routeLengthMeters;
    
    this.options.speed = speedPercent;
    console.log(`设置公交车 ${this.modelId} 速度为 ${speedKmh} km/h (${this.options.speed.toExponential(5)} 路径百分比/ms)`);
  }
  
  // 获取当前速度（km/h）
  getSpeedKmh() {
    // 将每毫秒移动的路径百分比转换为km/h
    const speedMeterPerMs = this.options.speed * this.routeLengthMeters;
    const speedKmh = speedMeterPerMs * 3600;
    
    return speedKmh;
  }
  
  // 设置公交车速度（原始百分比）
  setSpeed(speed) {
    this.options.speed = speed;
  }
  
  // 初始化模型加载器
  initModelLoader() {
    // 获取路线起点坐标
    const startPoint = this.coordinates[0];
    
    // 创建模型加载器
    this.modelLoader = new ModelLoadHelper(this.map, {
      modelId: this.modelId,
      center: startPoint, // 初始位置为路线起点
      height: this.options.modelHeight,
      angle: 0, // 初始角度
      scale: this.options.modelScale,
      objUrl: this.options.modelPath,
      mtlUrl: this.options.materialPath,
      onModelLoaded: (model) => {
        this.busModel = model;
        console.log(`公交车模型 ${this.modelId} 加载完成`);
        
        // 模型加载完成后立即应用旋转偏移量
        this.updateModelOrientation(this.getDirectionAtPosition(this.currentPosition));
        console.log(`公交车模型 ${this.modelId} 已应用初始旋转偏移量: ${this.rotationOffset}度`);
      }
    });
    
    // 添加模型到地图
    this.modelLoader.addModel();
  }
  
  // 更新公交车位置
  update(deltaTime) {
    if (!this.busModel) return; // 如果模型未加载完成，不执行更新
    
    // 根据速度和时间增量计算位置变化
    const positionDelta = this.options.speed * deltaTime;
    
    // 记录之前的行驶方向
    const wasForward = this.isForward;
    
    // 根据行驶方向更新位置
    if (this.isForward) {
      this.currentPosition += positionDelta;
      // 如果到达终点，改变方向
      if (this.currentPosition >= 1) {
        this.currentPosition = 1;
        this.isForward = false;
      }
    } else {
      this.currentPosition -= positionDelta;
      // 如果回到起点，改变方向
      if (this.currentPosition <= 0) {
        this.currentPosition = 0;
        this.isForward = true;
      }
    }
    
    // 如果行驶方向发生变化，旋转车头180度
    if (wasForward !== this.isForward) {
      this.rotateModel(180);
      console.log(`公交车 ${this.modelId} 掉头，旋转180度`);
    }
    
    // 计算当前位置的坐标
    const currentCoord = this.getPositionAlongRoute(this.currentPosition);
    
    // 计算当前方向（切线方向）
    const direction = this.getDirectionAtPosition(this.currentPosition);
    
    // 更新模型位置
    this.modelLoader.updatePosition(currentCoord);
    
    // 更新模型朝向
    this.updateModelOrientation(direction);
  }
  
  // 获取路线上指定位置的坐标（position为0-1之间的值）
  getPositionAlongRoute(position) {
    // 计算在路径上的实际索引位置
    const totalDistance = this.coordinates.length - 1;
    const exactIndex = position * totalDistance;
    
    // 获取相邻的两个点
    const index1 = Math.floor(exactIndex);
    const index2 = Math.min(Math.ceil(exactIndex), this.coordinates.length - 1);
    
    // 如果是同一个点，直接返回
    if (index1 === index2) {
      return this.coordinates[index1];
    }
    
    // 计算两点之间的插值比例
    const fraction = exactIndex - index1;
    
    // 线性插值计算当前位置
    const point1 = this.coordinates[index1];
    const point2 = this.coordinates[index2];
    
    return [
      point1[0] + (point2[0] - point1[0]) * fraction,
      point1[1] + (point2[1] - point1[1]) * fraction
    ];
  }
  
  // 获取指定位置的方向（切线方向）
  getDirectionAtPosition(position) {
    // 计算在路径上的实际索引位置
    const totalDistance = this.coordinates.length - 1;
    const exactIndex = position * totalDistance;
    
    // 获取相邻的两个点用于计算方向
    const index1 = Math.floor(exactIndex);
    const index2 = Math.min(Math.ceil(exactIndex), this.coordinates.length - 1);
    
    // 如果是同一个点或到达终点，使用前后点计算方向
    if (index1 === index2) {
      // 如果是起点
      if (index1 === 0) {
        const p1 = this.coordinates[0];
        const p2 = this.coordinates[1];
        return this.calculateAngle(p1, p2);
      }
      // 如果是终点
      else if (index1 === this.coordinates.length - 1) {
        const p1 = this.coordinates[this.coordinates.length - 2];
        const p2 = this.coordinates[this.coordinates.length - 1];
        return this.calculateAngle(p1, p2);
      }
    }
    
    // 计算两点之间的方向角度
    const point1 = this.coordinates[index1];
    const point2 = this.coordinates[index2];
    
    return this.calculateAngle(point1, point2);
  }
  
  // 计算两点之间的角度（相对于正北方向）
  calculateAngle(point1, point2) {
    // 计算方向向量
    const dx = point2[0] - point1[0];
    const dy = point2[1] - point1[1];
    
    // 计算角度（弧度）
    let angle = Math.atan2(dx, dy);
    
    // 如果是反向行驶，角度需要反转
    if (!this.isForward) {
      angle += Math.PI; // 加180度
    }
    
    // 转换为度数
    return angle * (180 / Math.PI);
  }
  
  // 更新模型朝向
  updateModelOrientation(angle) {
    // 应用旋转偏移量
    const finalAngle = angle + this.rotationOffset;
    this.modelLoader.updateRotation(finalAngle);
  }
  
  // 旋转模型（用于掉头或手动旋转）
  rotateModel(degrees) {
    // 更新旋转偏移量
    this.rotationOffset += degrees;
    console.log(`模型 ${this.modelId} 旋转偏移量更新为: ${this.rotationOffset}度`);
    
    // 重新应用当前方向和旋转偏移量
    const direction = this.getDirectionAtPosition(this.currentPosition);
    this.updateModelOrientation(direction);
  }
  
  // 移除公交车模型
  remove() {
    if (this.modelLoader) {
      this.modelLoader.removeModel();
    }
  }
}

export default BusController; 