import * as THREE from "three";
import { OBJLoader } from "three/addons/loaders/OBJLoader.js";
import { MTLLoader } from "three/addons/loaders/MTLLoader.js";


class modelLoadHelper {
  constructor(map, options) {
    this.map = map;
    this.camera = new THREE.Camera(); // 创建Three.js相机
    this.scene = new THREE.Scene(); // 创建Three.js场景
    // 模型ID，若未传入则使用默认值
    this.modelId = options.modelId ? options.modelId : "3dModel";
    // 模型中心点坐标（经纬度
    this.modelOrigin = options.center ? options.center : [114.4, 30.5];
    this.modelHeight = options.height ? options.height : 0; // 模型基准高度
    this.modelAngle = options.angle ? options.angle : 0; // 模型旋转角度（绕Y轴）
    // 模型缩放比例，默认各轴等比缩放
    this.modelScale = options.scale
      ? options.scale
      : {
          x: 1,
          y: 1,
          z: 1,
        };

    // 将经纬度坐标转换为Mercator坐标系
    this.modelAsMercatorCoordinate = mapboxgl.MercatorCoordinate.fromLngLat(
      this.modelOrigin,
      this.modelHeight
    );

    this.objUrl = options.objUrl; // OBJ模型文件路径
    this.mtlUrl = options.mtlUrl; // 材质文件路径
    if (!this.objUrl) {
      console.warn("请输入obj模型的地址"); // 必须提供OBJ文件路径
      return;
    }

    // 角度转弧度计算函数（将角度转换为相对于PI的值）
    const calPI = () => {
      const unit = Math.PI / 2 / 90; // 每度对应的弧度值
      return this.modelAngle * unit;
    };

    // 设置模型旋转角度（X轴旋转90度，Y轴按参数旋转）
    const modelRotate = [Math.PI / 2, calPI(), 0];
    this.modelTransform = {
      // 模型位置（Mercator坐标）
      translateX: this.modelAsMercatorCoordinate.x,
      translateY: this.modelAsMercatorCoordinate.y,
      translateZ: this.modelAsMercatorCoordinate.z,
      // 旋转弧度
      rotateX: modelRotate[0],
      rotateY: modelRotate[1],
      rotateZ: modelRotate[2],
      // 缩放比例（转换为Mercator坐标系单位）
      scale: {
        x: this.modelScale.x * this.modelAsMercatorCoordinate.meterInMercatorCoordinateUnits(),
        y: this.modelScale.y * this.modelAsMercatorCoordinate.meterInMercatorCoordinateUnits(),
        z: this.modelScale.z * this.modelAsMercatorCoordinate.meterInMercatorCoordinateUnits(),
      },
    };
    
    // 添加回调函数支持
    this.onModelLoaded = options.onModelLoaded || null;
    this.onLoadProgress = options.onLoadProgress || null;
    this.onLoadError = options.onLoadError || null;
  }

  addModel() {
    // 创建Mapbox自定义图层配置
    const customLayer = {
      id: this.modelId,
      type: "custom",
      renderingMode: "3d",
      // 图层添加时的初始化操作
      onAdd: function (map, gl) {
        // 添加平行光光源（两个不同方向）
        const directionalLight = new THREE.DirectionalLight(0xffffff);
        directionalLight.position.set(0, -70, 100).normalize();
        this.scene.add(directionalLight);

        const directionalLight2 = new THREE.DirectionalLight(0xffffff);
        directionalLight2.position.set(0, 70, 100).normalize();
        this.scene.add(directionalLight2);

        // 添加环境光
        const light = new THREE.AmbientLight(0xd3f53a);
        this.scene.add(light);

        // 加载MTL材质文件
        const mtlLoader = new MTLLoader();
        const objLoader = new OBJLoader();
        
        if (this.mtlUrl) {
          mtlLoader.load(
            this.mtlUrl, 
            (mtl) => {
              mtl.preload();
              // 设置材质双面渲染
              for (const material of Object.values(mtl.materials)) {
                material.side = THREE.DoubleSide;
              }
              objLoader.setMaterials(mtl);
              // 加载OBJ模型
              objLoader.load(
                this.objUrl, 
                (root) => {
                  this.scene.add(root); // 将模型添加到场景
                  if (this.onModelLoaded) {
                    this.onModelLoaded(root);
                  }
                },
                (xhr) => {
                  // 加载进度回调
                  if (this.onLoadProgress) {
                    const percentComplete = Math.round((xhr.loaded / xhr.total) * 100);
                    this.onLoadProgress(percentComplete);
                  }
                },
                (error) => {
                  // 加载错误回调
                  console.error('加载模型时出错:', error);
                  if (this.onLoadError) {
                    this.onLoadError(error);
                  }
                }
              );
            },
            (xhr) => {
              // 材质加载进度
              if (this.onLoadProgress) {
                const percentComplete = Math.round((xhr.loaded / xhr.total) * 50);
                this.onLoadProgress(percentComplete);
              }
            },
            (error) => {
              // 材质加载错误
              console.error('加载材质时出错:', error);
              if (this.onLoadError) {
                this.onLoadError(error);
              }
              
              // 如果材质加载失败，尝试直接加载OBJ模型
              this.loadObjWithoutMaterial(objLoader);
            }
          );
        } else {
          // 如果没有提供材质文件，直接加载OBJ
          this.loadObjWithoutMaterial(objLoader);
        }

        this.map = map;
        // 创建WebGL渲染器（使用Mapbox的画布和上下文）
        this.renderer = new THREE.WebGLRenderer({
          canvas: map.getCanvas(),
          context: gl,
          antialias: true, // 开启抗锯齿
        });
        this.renderer.autoClear = false; // 禁用自动清屏
      }.bind(this),
      
      // 每帧渲染时的回调
      render: function (gl, matrix) {
        // 创建旋转矩阵
        const rotationX = new THREE.Matrix4().makeRotationAxis(
          new THREE.Vector3(1, 0, 0),
          this.modelTransform.rotateX
        );
        const rotationY = new THREE.Matrix4().makeRotationAxis(
          new THREE.Vector3(0, 1, 0),
          this.modelTransform.rotateY
        );
        const rotationZ = new THREE.Matrix4().makeRotationAxis(
          new THREE.Vector3(0, 0, 1),
          this.modelTransform.rotateZ
        );

        // 组合变换矩阵
        const m = new THREE.Matrix4().fromArray(matrix); // Mapbox变换矩阵
        const l = new THREE.Matrix4()
          .makeTranslation(
            this.modelTransform.translateX,
            this.modelTransform.translateY,
            this.modelTransform.translateZ
          )
          .scale(
            new THREE.Vector3(
              this.modelTransform.scale.x,
              this.modelTransform.scale.y,
              this.modelTransform.scale.z
            )
          )
          .multiply(rotationX)
          .multiply(rotationY)
          .multiply(rotationZ);

        // 设置相机投影矩阵
        this.camera.projectionMatrix = m.multiply(l);
        this.renderer.resetState(); // 重置渲染器状态
        this.renderer.render(this.scene, this.camera); // 执行渲染
        this.map.triggerRepaint(); // 触发地图重绘
      }.bind(this),
    };
    
    // 将自定义图层添加到地图
    this.map.addLayer(customLayer);
    return customLayer;
  }
  
  // 不使用材质直接加载OBJ模型
  loadObjWithoutMaterial(objLoader) {
    objLoader.load(
      this.objUrl,
      (root) => {
        // 为模型添加默认材质
        root.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.material = new THREE.MeshPhongMaterial({
              color: 0x0088ff,  // 蓝色
              specular: 0x111111,
              shininess: 20,
              side: THREE.DoubleSide
            });
          }
        });
        
        this.scene.add(root);
        if (this.onModelLoaded) {
          this.onModelLoaded(root);
        }
      },
      (xhr) => {
        // 加载进度回调
        if (this.onLoadProgress) {
          const percentComplete = Math.round((xhr.loaded / xhr.total) * 100);
          this.onLoadProgress(percentComplete);
        }
      },
      (error) => {
        // 加载错误回调
        console.error('加载模型（无材质）时出错:', error);
        if (this.onLoadError) {
          this.onLoadError(error);
        }
      }
    );
  }

  // 移除模型图层
  removeModel() {
    if (this.map.getLayer(this.modelId)) {
      this.map.removeLayer(this.modelId);
    }
  }
  
  // 更新模型位置
  updatePosition(center, height = 0) {
    this.modelOrigin = center;
    this.modelHeight = height;
    
    // 重新计算Mercator坐标
    this.modelAsMercatorCoordinate = mapboxgl.MercatorCoordinate.fromLngLat(
      this.modelOrigin,
      this.modelHeight
    );
    
    // 更新变换矩阵中的位置
    this.modelTransform.translateX = this.modelAsMercatorCoordinate.x;
    this.modelTransform.translateY = this.modelAsMercatorCoordinate.y;
    this.modelTransform.translateZ = this.modelAsMercatorCoordinate.z;
    
    // 更新缩放比例（因为meterInMercatorCoordinateUnits可能随位置变化）
    this.updateScale(this.modelScale);
  }
  
  // 更新模型旋转角度
  updateRotation(angle) {
    this.modelAngle = angle;
    
    // 角度转弧度
    const calPI = () => {
      const unit = Math.PI / 2 / 90;
      return this.modelAngle * unit;
    };
    
    this.modelTransform.rotateY = calPI();
  }
  
  // 更新模型缩放比例
  updateScale(scale) {
    this.modelScale = scale;
    
    // 使用meterInMercatorCoordinateUnits方法计算正确的缩放比例
    const metersToMercatorUnits = this.modelAsMercatorCoordinate.meterInMercatorCoordinateUnits();
    
    this.modelTransform.scale = {
      x: this.modelScale.x * metersToMercatorUnits,
      y: this.modelScale.y * metersToMercatorUnits,
      z: this.modelScale.z * metersToMercatorUnits,
    };
  }
}

export default modelLoadHelper; 